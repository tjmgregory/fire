/**
 * Currency Converter
 *
 * Converts non-GBP transaction amounts to GBP using historical exchange rates.
 * Optimizes API usage by batching date ranges and caching by (date, currency).
 *
 * Satisfies:
 * - FR-003: Currency Standardization
 * - FR-004: Currency Conversion
 * - FR-007: Exchange Rate API Integration
 * - FR-009: Network Retry Mechanism
 * - UC-001: Import and Normalize Transactions
 *
 * @module domain/converters/CurrencyConverter
 */

import { CurrencyCode, Transaction } from '../../models/Transaction';
import { ExchangeRatePort } from '../ports/ExchangeRatePort';
import { ExchangeRateSnapshot, ExchangeRateSnapshotFactory } from '../../models/ExchangeRateSnapshot';
import { Logger } from '../../utils/Logger';

/**
 * Currency conversion result
 */
export interface ConversionResult {
  /** Amount in GBP */
  gbpAmount: number;

  /** Exchange rate used (null if already GBP) */
  exchangeRate: number | null;

  /** Exchange rate snapshot (null if already GBP) */
  snapshot: ExchangeRateSnapshot | null;
}

/**
 * Currency Converter
 *
 * Handles currency conversion with date-aware caching.
 * Fetches historical exchange rates for transaction dates,
 * minimising API calls via time series batching (FR-007).
 */
export class CurrencyConverter {
  private readonly exchangeRatePort: ExchangeRatePort;
  private readonly processingRunId: string;
  private readonly rateCache: Map<string, ExchangeRateSnapshot>;

  /**
   * Create currency converter for a processing run
   *
   * @param exchangeRatePort - Exchange rate service port
   * @param processingRunId - Unique identifier for this processing run
   */
  constructor(exchangeRatePort: ExchangeRatePort, processingRunId: string) {
    this.exchangeRatePort = exchangeRatePort;
    this.processingRunId = processingRunId;
    this.rateCache = new Map();
  }

  /**
   * Convert transaction amount to GBP
   *
   * Uses the historical exchange rate for the transaction's date.
   * If transaction is already in GBP, returns the amount as-is.
   *
   * @param transaction - Transaction to convert
   * @returns Conversion result with GBP amount and exchange rate
   */
  async convertToGBP(transaction: Transaction): Promise<ConversionResult> {
    // FR-003: If already GBP, no conversion needed
    if (transaction.originalAmountCurrency === CurrencyCode.GBP) {
      Logger.debug('Transaction already in GBP, no conversion needed', {
        transactionId: transaction.id,
        amount: transaction.originalAmountValue
      });

      return {
        gbpAmount: transaction.originalAmountValue,
        exchangeRate: null,
        snapshot: null
      };
    }

    // FR-004, FR-007: Get exchange rate for transaction date (cached or fetch)
    const dateStr = this.formatDate(transaction.transactionDate);
    const snapshot = await this.getExchangeRate(transaction.originalAmountCurrency, dateStr);

    // Convert amount using rate
    const gbpAmount = transaction.originalAmountValue * snapshot.rate;

    Logger.info('Currency conversion successful', {
      transactionId: transaction.id,
      originalAmount: transaction.originalAmountValue,
      originalCurrency: transaction.originalAmountCurrency,
      rateDate: dateStr,
      gbpAmount,
      exchangeRate: snapshot.rate,
      provider: snapshot.provider
    });

    return {
      gbpAmount,
      exchangeRate: snapshot.rate,
      snapshot
    };
  }

  /**
   * Convert multiple transactions to GBP in batch
   *
   * Optimizes API usage by computing a date range across all transactions
   * and fetching all required rates in minimal API calls.
   *
   * @param transactions - Array of transactions to convert
   * @returns Map of transaction ID to conversion result
   */
  async convertBatchToGBP(
    transactions: Transaction[]
  ): Promise<Map<string, ConversionResult>> {
    const results = new Map<string, ConversionResult>();

    // Collect unique (date, currency) pairs needed
    const nonGbpTransactions = transactions.filter(
      txn => txn.originalAmountCurrency !== CurrencyCode.GBP
    );

    if (nonGbpTransactions.length > 0) {
      // Compute date range and unique currencies
      const currencies = new Set<CurrencyCode>();
      let minDate: string | null = null;
      let maxDate: string | null = null;

      for (const txn of nonGbpTransactions) {
        currencies.add(txn.originalAmountCurrency);
        const dateStr = this.formatDate(txn.transactionDate);
        if (!minDate || dateStr < minDate) minDate = dateStr;
        if (!maxDate || dateStr > maxDate) maxDate = dateStr;
      }

      // FR-007: Fetch all required rates in one batch call
      await this.fetchExchangeRatesBatch(
        Array.from(currencies),
        minDate!,
        maxDate!
      );
    }

    // Convert each transaction using cached rates
    for (const transaction of transactions) {
      const result = await this.convertToGBP(transaction);
      results.set(transaction.id, result);
    }

    Logger.info('Batch currency conversion completed', {
      totalTransactions: transactions.length,
      nonGbpCount: nonGbpTransactions.length,
      processingRunId: this.processingRunId
    });

    return results;
  }

  /**
   * Get exchange rate for a currency on a specific date
   *
   * Returns cached rate if available, otherwise fetches from API.
   *
   * @param fromCurrency - Currency to convert from
   * @param date - Rate date in YYYY-MM-DD format
   * @returns Exchange rate snapshot
   * @throws Error if rate cannot be fetched after retries
   */
  private async getExchangeRate(fromCurrency: CurrencyCode, date: string): Promise<ExchangeRateSnapshot> {
    const key = this.cacheKey(date, fromCurrency);

    // Check cache first
    const cached = this.rateCache.get(key);
    if (cached) {
      Logger.debug('Using cached exchange rate', {
        fromCurrency,
        date,
        rate: cached.rate,
        provider: cached.provider
      });
      return cached;
    }

    // Fetch from API
    Logger.info('Fetching exchange rate from API', {
      fromCurrency,
      toCurrency: CurrencyCode.GBP,
      date,
      processingRunId: this.processingRunId
    });

    const exchangeRate = await this.exchangeRatePort.getExchangeRate(
      fromCurrency,
      CurrencyCode.GBP,
      date
    );

    // Create snapshot and cache it
    const snapshot = ExchangeRateSnapshotFactory.create(
      fromCurrency,
      exchangeRate.rate,
      exchangeRate.rateDate,
      exchangeRate.provider,
      this.processingRunId
    );

    this.rateCache.set(this.cacheKey(exchangeRate.rateDate, fromCurrency), snapshot);

    Logger.info('Exchange rate fetched and cached', {
      fromCurrency,
      date: exchangeRate.rateDate,
      rate: snapshot.rate,
      provider: snapshot.provider,
      processingRunId: this.processingRunId
    });

    return snapshot;
  }

  /**
   * Fetch exchange rates for multiple currencies across a date range
   *
   * Populates the cache with all rates returned by the batch call.
   *
   * @param currencies - Array of currencies to fetch rates for
   * @param startDate - Start of date range (YYYY-MM-DD)
   * @param endDate - End of date range (YYYY-MM-DD)
   */
  private async fetchExchangeRatesBatch(
    currencies: CurrencyCode[],
    startDate: string,
    endDate: string
  ): Promise<void> {
    const currenciesToFetch = currencies.filter(c => c !== CurrencyCode.GBP);

    if (currenciesToFetch.length === 0) {
      Logger.debug('No currencies to fetch');
      return;
    }

    Logger.info('Fetching exchange rates in batch', {
      currencies: currenciesToFetch.join(', '),
      startDate,
      endDate,
      processingRunId: this.processingRunId
    });

    const ratesByDate = await this.exchangeRatePort.getExchangeRatesBatchByDateRange(
      currenciesToFetch,
      CurrencyCode.GBP,
      startDate,
      endDate
    );

    // Create snapshots and cache them
    let count = 0;
    for (const [, currencyRates] of ratesByDate) {
      for (const [currency, exchangeRate] of currencyRates) {
        const snapshot = ExchangeRateSnapshotFactory.create(
          currency,
          exchangeRate.rate,
          exchangeRate.rateDate,
          exchangeRate.provider,
          this.processingRunId
        );

        this.rateCache.set(this.cacheKey(exchangeRate.rateDate, currency), snapshot);
        count++;
      }
    }

    Logger.info('Exchange rates batch fetched and cached', {
      count,
      dates: ratesByDate.size,
      currencies: currenciesToFetch.join(', '),
      processingRunId: this.processingRunId
    });
  }

  /**
   * Get all cached exchange rate snapshots
   *
   * Useful for persisting rates for audit trail.
   *
   * @returns Array of exchange rate snapshots used in this run
   */
  getExchangeRateSnapshots(): ExchangeRateSnapshot[] {
    return Array.from(this.rateCache.values());
  }

  /**
   * Clear the exchange rate cache
   *
   * Should be called at the start of each new processing run.
   * Ensures all transactions in a run use consistent rates.
   */
  clearCache(): void {
    this.rateCache.clear();
    this.exchangeRatePort.clearCache();

    Logger.debug('Exchange rate cache cleared', {
      processingRunId: this.processingRunId
    });
  }

  /**
   * Get number of cached exchange rates
   *
   * @returns Number of (date, currency) pairs in cache
   */
  getCacheSize(): number {
    return this.rateCache.size;
  }

  /**
   * Format a Date as YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Build cache key from date and currency
   */
  private cacheKey(date: string, currency: CurrencyCode): string {
    return `${date}:${currency}`;
  }
}
