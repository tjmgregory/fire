/**
 * Currency Converter
 *
 * Converts non-GBP transaction amounts to GBP using exchange rates.
 * Optimizes API usage by fetching rates once per processing run.
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
 * Handles currency conversion with caching and retry logic.
 * Fetches exchange rates once per processing run for efficiency (FR-007).
 */
export class CurrencyConverter {
  private readonly exchangeRatePort: ExchangeRatePort;
  private readonly processingRunId: string;
  private readonly rateCache: Map<CurrencyCode, ExchangeRateSnapshot>;

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
   * If transaction is already in GBP, returns the amount as-is.
   * Otherwise, fetches exchange rate (with caching) and converts.
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

    // FR-004, FR-007: Get exchange rate (cached or fetch)
    const snapshot = await this.getExchangeRate(transaction.originalAmountCurrency);

    // Convert amount using rate
    const gbpAmount = transaction.originalAmountValue * snapshot.rate;

    Logger.info('Currency conversion successful', {
      transactionId: transaction.id,
      originalAmount: transaction.originalAmountValue,
      originalCurrency: transaction.originalAmountCurrency,
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
   * Optimizes API usage by fetching all required exchange rates at once.
   * Implements FR-007: fetch rates only once per processing run.
   *
   * @param transactions - Array of transactions to convert
   * @returns Map of transaction ID to conversion result
   */
  async convertBatchToGBP(
    transactions: Transaction[]
  ): Promise<Map<string, ConversionResult>> {
    const results = new Map<string, ConversionResult>();

    // Identify unique non-GBP currencies needed
    const currenciesNeeded = new Set<CurrencyCode>();
    transactions.forEach(txn => {
      if (txn.originalAmountCurrency !== CurrencyCode.GBP) {
        currenciesNeeded.add(txn.originalAmountCurrency);
      }
    });

    // FR-007: Fetch all required rates in one batch call
    if (currenciesNeeded.size > 0) {
      await this.fetchExchangeRatesBatch(Array.from(currenciesNeeded));
    }

    // Convert each transaction using cached rates
    for (const transaction of transactions) {
      const result = await this.convertToGBP(transaction);
      results.set(transaction.id, result);
    }

    Logger.info('Batch currency conversion completed', {
      totalTransactions: transactions.length,
      currenciesConverted: currenciesNeeded.size,
      processingRunId: this.processingRunId
    });

    return results;
  }

  /**
   * Get exchange rate for a currency
   *
   * Returns cached rate if available, otherwise fetches from API.
   * Implements FR-007 optimization: rates fetched once per run.
   *
   * @param fromCurrency - Currency to convert from
   * @returns Exchange rate snapshot
   * @throws Error if rate cannot be fetched after retries
   */
  private async getExchangeRate(fromCurrency: CurrencyCode): Promise<ExchangeRateSnapshot> {
    // Check cache first (FR-007: reuse rates within run)
    const cached = this.rateCache.get(fromCurrency);
    if (cached) {
      Logger.debug('Using cached exchange rate', {
        fromCurrency,
        rate: cached.rate,
        provider: cached.provider
      });
      return cached;
    }

    // Fetch from API (with retry logic from FR-009 via ExchangeRatePort)
    Logger.info('Fetching exchange rate from API', {
      fromCurrency,
      toCurrency: CurrencyCode.GBP,
      processingRunId: this.processingRunId
    });

    const exchangeRate = await this.exchangeRatePort.getExchangeRate(
      fromCurrency,
      CurrencyCode.GBP
    );

    // Create snapshot and cache it
    const snapshot = ExchangeRateSnapshotFactory.create(
      fromCurrency,
      exchangeRate.rate,
      exchangeRate.provider,
      this.processingRunId
    );

    this.rateCache.set(fromCurrency, snapshot);

    Logger.info('Exchange rate fetched and cached', {
      fromCurrency,
      rate: snapshot.rate,
      provider: snapshot.provider,
      processingRunId: this.processingRunId
    });

    return snapshot;
  }

  /**
   * Fetch multiple exchange rates in batch
   *
   * Optimizes API calls by fetching multiple currencies at once.
   * Only fetches currencies not already in cache.
   *
   * @param currencies - Array of currencies to fetch rates for
   */
  private async fetchExchangeRatesBatch(currencies: CurrencyCode[]): Promise<void> {
    // Filter out currencies already in cache
    const currenciesToFetch = currencies.filter(
      currency => !this.rateCache.has(currency) && currency !== CurrencyCode.GBP
    );

    if (currenciesToFetch.length === 0) {
      Logger.debug('All exchange rates already cached', {
        currencies: currencies.join(', ')
      });
      return;
    }

    Logger.info('Fetching exchange rates in batch', {
      currencies: currenciesToFetch.join(', '),
      count: currenciesToFetch.length,
      processingRunId: this.processingRunId
    });

    // Fetch rates from API (with retry logic from FR-009)
    const exchangeRates = await this.exchangeRatePort.getExchangeRatesBatch(
      currenciesToFetch,
      CurrencyCode.GBP
    );

    // Create snapshots and cache them
    exchangeRates.forEach((exchangeRate, currency) => {
      const snapshot = ExchangeRateSnapshotFactory.create(
        currency,
        exchangeRate.rate,
        exchangeRate.provider,
        this.processingRunId
      );

      this.rateCache.set(currency, snapshot);
    });

    Logger.info('Exchange rates batch fetched and cached', {
      count: exchangeRates.size,
      currencies: Array.from(exchangeRates.keys()).join(', '),
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
   * @returns Number of currencies in cache
   */
  getCacheSize(): number {
    return this.rateCache.size;
  }
}
