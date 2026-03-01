/**
 * Historical Exchange Rate Adapter
 *
 * Implements ExchangeRatePort with date-aware historical rate fetching.
 * Uses two providers for full currency coverage:
 * - Frankfurter (primary): 13 currencies, time series endpoint
 * - fawazahmed0/exchange-api (fallback): MAD and other unsupported currencies
 *
 * @module infrastructure/adapters/HistoricalExchangeRateAdapter
 */

import { ExchangeRatePort, ExchangeRate } from '../../domain/ports/ExchangeRatePort';
import { CurrencyCode } from '../../models/Transaction';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { RetryUtils } from '../../utils/RetryUtils';
import { logger } from '../logging/ErrorLogger';

/**
 * Currencies not supported by Frankfurter (ECB data).
 * These are routed to the fallback provider.
 */
const FRANKFURTER_UNSUPPORTED: Set<CurrencyCode> = new Set([CurrencyCode.MAD]);

/**
 * Historical Exchange Rate Adapter
 *
 * Fetches historical exchange rates with in-memory caching.
 * Minimises API calls by using Frankfurter's time series endpoint
 * and caching by (date, currency) pair.
 */
export class HistoricalExchangeRateAdapter implements ExchangeRatePort {
  private cache: Map<string, ExchangeRate> = new Map();
  private primaryUrl: string;
  private fallbackUrl: string;

  constructor() {
    const config = ConfigurationManager.getExchangeRateConfig();
    this.primaryUrl = config.primaryProvider;
    this.fallbackUrl = config.fallbackProvider;
  }

  /**
   * Get exchange rate for a specific currency and date
   */
  async getExchangeRate(
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    date: string
  ): Promise<ExchangeRate> {
    if (fromCurrency === toCurrency) {
      return {
        baseCurrency: toCurrency,
        targetCurrency: fromCurrency,
        rate: 1,
        rateDate: date,
        fetchedAt: new Date(),
        provider: 'identity'
      };
    }

    const cacheKey = this.cacheKey(date, fromCurrency);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(`Using cached exchange rate for ${cacheKey}`);
      return cached;
    }

    const rate = await RetryUtils.retry(
      async () => this.fetchSingleRate(fromCurrency, toCurrency, date),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        isRetryable: RetryUtils.isNetworkError
      }
    );

    this.cache.set(cacheKey, rate);
    logger.info(`Fetched exchange rate: 1 ${fromCurrency} = ${rate.rate} ${toCurrency} on ${date}`);

    return rate;
  }

  /**
   * Get exchange rates for multiple currencies across a date range
   *
   * Makes one Frankfurter time series call for supported currencies,
   * plus one fawazahmed0 call per unique date for unsupported currencies (MAD).
   */
  async getExchangeRatesBatchByDateRange(
    currencies: CurrencyCode[],
    toCurrency: CurrencyCode,
    startDate: string,
    endDate: string
  ): Promise<Map<string, Map<CurrencyCode, ExchangeRate>>> {
    const results = new Map<string, Map<CurrencyCode, ExchangeRate>>();

    const uniqueCurrencies = [...new Set(currencies)].filter(c => c !== toCurrency);
    if (uniqueCurrencies.length === 0) {
      return results;
    }

    // Split into Frankfurter-supported and fallback currencies
    const frankfurterCurrencies = uniqueCurrencies.filter(c => !FRANKFURTER_UNSUPPORTED.has(c));
    const fallbackCurrencies = uniqueCurrencies.filter(c => FRANKFURTER_UNSUPPORTED.has(c));

    // Fetch from Frankfurter (one time series call)
    if (frankfurterCurrencies.length > 0) {
      const frankfurterRates = await RetryUtils.retry(
        async () => this.fetchFrankfurterTimeSeries(toCurrency, frankfurterCurrencies, startDate, endDate),
        {
          maxAttempts: 3,
          initialDelay: 1000,
          isRetryable: RetryUtils.isNetworkError
        }
      );

      for (const [dateStr, currencyMap] of frankfurterRates) {
        if (!results.has(dateStr)) {
          results.set(dateStr, new Map());
        }
        const dateResults = results.get(dateStr)!;
        for (const [currency, rate] of currencyMap) {
          dateResults.set(currency, rate);
          this.cache.set(this.cacheKey(dateStr, currency), rate);
        }
      }
    }

    // Fetch fallback currencies (one call per unique date needed)
    if (fallbackCurrencies.length > 0) {
      const uniqueDates = this.getDateRange(startDate, endDate);
      for (const dateStr of uniqueDates) {
        // Check if all fallback currencies for this date are already cached
        const uncachedFallback = fallbackCurrencies.filter(
          c => !this.cache.has(this.cacheKey(dateStr, c))
        );
        if (uncachedFallback.length === 0) continue;

        const fallbackRates = await RetryUtils.retry(
          async () => this.fetchFawazahmedRates(toCurrency, uncachedFallback, dateStr),
          {
            maxAttempts: 3,
            initialDelay: 1000,
            isRetryable: RetryUtils.isNetworkError
          }
        );

        if (!results.has(dateStr)) {
          results.set(dateStr, new Map());
        }
        const dateResults = results.get(dateStr)!;
        for (const [currency, rate] of fallbackRates) {
          dateResults.set(currency, rate);
          this.cache.set(this.cacheKey(dateStr, currency), rate);
        }
      }
    }

    logger.info(`Fetched exchange rates for ${results.size} dates, ${uniqueCurrencies.length} currencies`);
    return results;
  }

  /**
   * Clear the rate cache
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug(`Cleared exchange rate cache (${size} entries)`);
  }

  // ============ Private Helper Methods ============

  private cacheKey(date: string, currency: CurrencyCode): string {
    return `${date}:${currency}`;
  }

  /**
   * Fetch a single rate from the appropriate provider
   */
  private async fetchSingleRate(
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    date: string
  ): Promise<ExchangeRate> {
    if (FRANKFURTER_UNSUPPORTED.has(fromCurrency)) {
      const rates = await this.fetchFawazahmedRates(toCurrency, [fromCurrency], date);
      const rate = rates.get(fromCurrency);
      if (!rate) {
        throw new Error(`Exchange rate not found for ${fromCurrency} on ${date}`);
      }
      return rate;
    }

    return this.fetchFrankfurterSingleDate(fromCurrency, toCurrency, date);
  }

  /**
   * Fetch a single rate from Frankfurter for one date
   *
   * GET /v1/{date}?base=GBP&symbols=USD
   */
  private async fetchFrankfurterSingleDate(
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    date: string
  ): Promise<ExchangeRate> {
    const url = `${this.primaryUrl}/${date}?base=${toCurrency}&symbols=${fromCurrency}`;

    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/json' }
    });

    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      throw new Error(`Frankfurter API returned ${statusCode}: ${response.getContentText()}`);
    }

    const data = JSON.parse(response.getContentText());
    const rates = data.rates as Record<string, number>;
    const actualDate = data.date as string;

    if (!rates || rates[fromCurrency] === undefined) {
      throw new Error(`Exchange rate not found for ${fromCurrency} on ${date}`);
    }

    // API returns: 1 toCurrency (GBP) = X fromCurrency
    // We need: 1 fromCurrency = Y toCurrency (GBP)
    const rate = 1 / rates[fromCurrency];

    return {
      baseCurrency: toCurrency,
      targetCurrency: fromCurrency,
      rate,
      rateDate: actualDate,
      fetchedAt: new Date(),
      provider: 'frankfurter.dev'
    };
  }

  /**
   * Fetch time series from Frankfurter
   *
   * GET /v1/{start}..{end}?base=GBP&symbols=USD,EUR,...
   * Returns rates for all business days in range.
   */
  private async fetchFrankfurterTimeSeries(
    baseCurrency: CurrencyCode,
    targetCurrencies: CurrencyCode[],
    startDate: string,
    endDate: string
  ): Promise<Map<string, Map<CurrencyCode, ExchangeRate>>> {
    const symbols = targetCurrencies.join(',');
    const url = `${this.primaryUrl}/${startDate}..${endDate}?base=${baseCurrency}&symbols=${symbols}`;

    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/json' }
    });

    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      throw new Error(`Frankfurter API returned ${statusCode}: ${response.getContentText()}`);
    }

    const data = JSON.parse(response.getContentText());
    const ratesByDate = data.rates as Record<string, Record<string, number>>;
    const results = new Map<string, Map<CurrencyCode, ExchangeRate>>();
    const now = new Date();

    for (const [dateStr, rates] of Object.entries(ratesByDate)) {
      const dateMap = new Map<CurrencyCode, ExchangeRate>();

      for (const currency of targetCurrencies) {
        if (rates[currency] !== undefined) {
          // API: 1 GBP = X target, we need: 1 target = Y GBP
          const rate = 1 / rates[currency];
          dateMap.set(currency, {
            baseCurrency: baseCurrency,
            targetCurrency: currency,
            rate,
            rateDate: dateStr,
            fetchedAt: now,
            provider: 'frankfurter.dev'
          });
        }
      }

      if (dateMap.size > 0) {
        results.set(dateStr, dateMap);
      }
    }

    logger.info(`Frankfurter time series: ${results.size} dates, ${targetCurrencies.length} currencies`);
    return results;
  }

  /**
   * Fetch rates from fawazahmed0/exchange-api for a single date
   *
   * GET /@{date}/v1/currencies/gbp.min.json
   * Returns all currencies relative to GBP in one call.
   */
  private async fetchFawazahmedRates(
    baseCurrency: CurrencyCode,
    targetCurrencies: CurrencyCode[],
    date: string
  ): Promise<Map<CurrencyCode, ExchangeRate>> {
    const baseCode = baseCurrency.toLowerCase();
    const url = `${this.fallbackUrl}${date}/v1/currencies/${baseCode}.min.json`;

    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/json' }
    });

    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      throw new Error(`fawazahmed0 API returned ${statusCode}: ${response.getContentText()}`);
    }

    const data = JSON.parse(response.getContentText());
    const rates = data[baseCode] as Record<string, number>;
    const actualDate = (data.date as string) || date;
    const results = new Map<CurrencyCode, ExchangeRate>();
    const now = new Date();

    for (const currency of targetCurrencies) {
      const currencyKey = currency.toLowerCase();
      if (rates && rates[currencyKey] !== undefined) {
        // API: 1 GBP = X target, we need: 1 target = Y GBP
        const rate = 1 / rates[currencyKey];
        results.set(currency, {
          baseCurrency: baseCurrency,
          targetCurrency: currency,
          rate,
          rateDate: actualDate,
          fetchedAt: now,
          provider: 'fawazahmed0/exchange-api'
        });
      } else {
        logger.warning(`Exchange rate not found for ${currency} on ${date} from fawazahmed0`);
      }
    }

    return results;
  }

  /**
   * Generate array of YYYY-MM-DD date strings for a range (inclusive)
   */
  private getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }
}
