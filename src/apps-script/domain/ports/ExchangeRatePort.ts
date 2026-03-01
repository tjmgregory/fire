/**
 * Exchange Rate Port Interface
 *
 * Defines the contract for exchange rate fetching and caching.
 * Part of hexagonal architecture - domain defines needs, infrastructure implements.
 *
 * @module domain/ports/ExchangeRatePort
 */

import { CurrencyCode } from '../../models/Transaction';

/**
 * Exchange rate information
 */
export interface ExchangeRate {
  /**
   * Base currency (always GBP for this system)
   */
  baseCurrency: CurrencyCode;

  /**
   * Target currency
   */
  targetCurrency: CurrencyCode;

  /**
   * Exchange rate: 1 targetCurrency = rate baseCurrency
   */
  rate: number;

  /**
   * The date this rate is for (YYYY-MM-DD)
   */
  rateDate: string;

  /**
   * When this rate was fetched
   */
  fetchedAt: Date;

  /**
   * Exchange rate provider name
   */
  provider: string;
}

/**
 * Exchange Rate Port
 *
 * Technology-agnostic interface for exchange rate services.
 * Implemented by HistoricalExchangeRateAdapter in infrastructure layer.
 */
export interface ExchangeRatePort {
  /**
   * Get exchange rate from target currency to GBP for a specific date
   *
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code (should be GBP)
   * @param date - Rate date in YYYY-MM-DD format
   * @returns Exchange rate
   */
  getExchangeRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode, date: string): Promise<ExchangeRate>;

  /**
   * Get exchange rates for multiple currencies across a date range
   *
   * Fetches rates for multiple currencies and dates in minimal API calls.
   *
   * @param currencies - Array of currency codes to convert from
   * @param toCurrency - Target currency (should be GBP)
   * @param startDate - Start of date range (YYYY-MM-DD)
   * @param endDate - End of date range (YYYY-MM-DD)
   * @returns Map of date string to map of currency code to exchange rate
   */
  getExchangeRatesBatchByDateRange(
    currencies: CurrencyCode[],
    toCurrency: CurrencyCode,
    startDate: string,
    endDate: string
  ): Promise<Map<string, Map<CurrencyCode, ExchangeRate>>>;

  /**
   * Clear the rate cache
   *
   * Should be called at the start of each processing run to ensure
   * all transactions in a run use the same rates.
   */
  clearCache(): void;
}
