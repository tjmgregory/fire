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
 * Implemented by ExchangeRateAdapter in infrastructure layer.
 */
export interface ExchangeRatePort {
  /**
   * Get exchange rate from target currency to GBP
   *
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code (should be GBP)
   * @returns Exchange rate
   */
  getExchangeRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<ExchangeRate>;

  /**
   * Get multiple exchange rates in batch
   *
   * Fetches rates for multiple currencies at once for efficiency.
   *
   * @param currencies - Array of currency codes to convert from
   * @param toCurrency - Target currency (should be GBP)
   * @returns Map of currency code to exchange rate
   */
  getExchangeRatesBatch(
    currencies: CurrencyCode[],
    toCurrency: CurrencyCode
  ): Promise<Map<CurrencyCode, ExchangeRate>>;

  /**
   * Clear the rate cache
   *
   * Should be called at the start of each processing run to ensure
   * all transactions in a run use the same rates.
   */
  clearCache(): void;
}
