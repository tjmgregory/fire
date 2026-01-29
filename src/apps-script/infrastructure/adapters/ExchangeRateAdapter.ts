/**
 * Exchange Rate Adapter
 *
 * Implements ExchangeRatePort for fetching exchange rates from external APIs.
 * Part of hexagonal architecture - isolates external API calls.
 *
 * @module infrastructure/adapters/ExchangeRateAdapter
 */

import { ExchangeRatePort, ExchangeRate } from '../../domain/ports/ExchangeRatePort';
import { CurrencyCode } from '../../models/Transaction';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { RetryUtils } from '../../utils/RetryUtils';
import { logger } from '../logging/ErrorLogger';

/**
 * Exchange Rate Adapter
 *
 * Fetches exchange rates from external API with caching and retry logic.
 * Uses exchangerate-api.com by default (free tier supports common currencies).
 */
export class ExchangeRateAdapter implements ExchangeRatePort {
  private cache: Map<string, ExchangeRate> = new Map();
  private providerUrl: string;

  constructor() {
    const config = ConfigurationManager.getExchangeRateConfig();
    this.providerUrl = config.provider;
  }

  /**
   * Get exchange rate from source currency to target currency
   */
  async getExchangeRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<ExchangeRate> {
    // Check if same currency
    if (fromCurrency === toCurrency) {
      return {
        baseCurrency: toCurrency,
        targetCurrency: fromCurrency,
        rate: 1,
        fetchedAt: new Date(),
        provider: 'identity'
      };
    }

    // Check cache
    const cacheKey = `${fromCurrency}:${toCurrency}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(`Using cached exchange rate for ${cacheKey}`);
      return cached;
    }

    // Fetch from API with retry logic
    const rate = await RetryUtils.retry(
      async () => this.fetchExchangeRate(fromCurrency, toCurrency),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        isRetryable: RetryUtils.isNetworkError
      }
    );

    // Cache the result
    this.cache.set(cacheKey, rate);
    logger.info(`Fetched exchange rate: 1 ${fromCurrency} = ${rate.rate} ${toCurrency}`);

    return rate;
  }

  /**
   * Get multiple exchange rates in batch
   */
  async getExchangeRatesBatch(
    currencies: CurrencyCode[],
    toCurrency: CurrencyCode
  ): Promise<Map<CurrencyCode, ExchangeRate>> {
    const results = new Map<CurrencyCode, ExchangeRate>();

    // Filter out currencies that are the same as target
    const uniqueCurrencies = [...new Set(currencies)].filter(c => c !== toCurrency);

    // Check which rates we need to fetch
    const toFetch: CurrencyCode[] = [];
    for (const currency of uniqueCurrencies) {
      const cacheKey = `${currency}:${toCurrency}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        results.set(currency, cached);
      } else {
        toFetch.push(currency);
      }
    }

    // Fetch all rates in one API call if provider supports it
    if (toFetch.length > 0) {
      const rates = await RetryUtils.retry(
        async () => this.fetchBatchRates(toCurrency, toFetch),
        {
          maxAttempts: 3,
          initialDelay: 1000,
          isRetryable: RetryUtils.isNetworkError
        }
      );

      for (const [currency, rate] of rates) {
        results.set(currency, rate);
        const cacheKey = `${currency}:${toCurrency}`;
        this.cache.set(cacheKey, rate);
      }
    }

    // Add identity rate for target currency if requested
    if (currencies.includes(toCurrency)) {
      results.set(toCurrency, {
        baseCurrency: toCurrency,
        targetCurrency: toCurrency,
        rate: 1,
        fetchedAt: new Date(),
        provider: 'identity'
      });
    }

    logger.info(`Fetched ${results.size} exchange rates for batch request`);
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

  /**
   * Fetch a single exchange rate from the API
   */
  private async fetchExchangeRate(
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ): Promise<ExchangeRate> {
    // API returns rates relative to base currency
    // e.g., /v4/latest/GBP returns { rates: { USD: 1.27, EUR: 1.16, ... } }
    const url = `${this.providerUrl}${toCurrency}`;

    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'Accept': 'application/json'
      }
    });

    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      throw new Error(`Exchange rate API returned ${statusCode}: ${response.getContentText()}`);
    }

    const data = JSON.parse(response.getContentText());
    const rates = data.rates as Record<string, number>;

    if (!rates || rates[fromCurrency] === undefined) {
      throw new Error(`Exchange rate not found for ${fromCurrency}`);
    }

    // The API gives us: 1 toCurrency = X fromCurrency
    // We need: 1 fromCurrency = Y toCurrency
    // So rate = 1 / X
    const rate = 1 / rates[fromCurrency];

    return {
      baseCurrency: toCurrency,
      targetCurrency: fromCurrency,
      rate: rate,
      fetchedAt: new Date(),
      provider: this.providerUrl
    };
  }

  /**
   * Fetch multiple exchange rates in a single API call
   */
  private async fetchBatchRates(
    baseCurrency: CurrencyCode,
    targetCurrencies: CurrencyCode[]
  ): Promise<Map<CurrencyCode, ExchangeRate>> {
    const url = `${this.providerUrl}${baseCurrency}`;

    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'Accept': 'application/json'
      }
    });

    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      throw new Error(`Exchange rate API returned ${statusCode}: ${response.getContentText()}`);
    }

    const data = JSON.parse(response.getContentText());
    const rates = data.rates as Record<string, number>;

    const results = new Map<CurrencyCode, ExchangeRate>();
    const now = new Date();

    for (const currency of targetCurrencies) {
      if (rates[currency] !== undefined) {
        // API gives: 1 baseCurrency = X targetCurrency
        // We want: 1 targetCurrency = Y baseCurrency
        // So rate = 1 / X
        const rate = 1 / rates[currency];

        results.set(currency, {
          baseCurrency: baseCurrency,
          targetCurrency: currency,
          rate: rate,
          fetchedAt: now,
          provider: this.providerUrl
        });
      } else {
        logger.warning(`Exchange rate not found for ${currency}, skipping`);
      }
    }

    return results;
  }
}
