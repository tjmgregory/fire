/**
 * ExchangeRateSnapshot Entity Model
 *
 * Represents a snapshot of exchange rates fetched during a processing run.
 * Rates are immutable once fetched and preserved for audit trail.
 *
 * @module models/ExchangeRateSnapshot
 */

import { CurrencyCode } from './Transaction';

/**
 * ExchangeRateSnapshot entity
 *
 * Represents a snapshot of an exchange rate at a specific point in time.
 * Identity is composite: (baseCurrency, targetCurrency, fetchedAt)
 */
export interface ExchangeRateSnapshot {
  /**
   * Base currency (always GBP for this system)
   */
  baseCurrency: CurrencyCode;

  /**
   * Target currency being converted from
   */
  targetCurrency: CurrencyCode;

  /**
   * Exchange rate: 1 targetCurrency = rate baseCurrency
   * Example: If 1 USD = 0.79 GBP, then rate = 0.79
   */
  rate: number;

  /**
   * When this rate was fetched
   */
  fetchedAt: Date;

  /**
   * Exchange rate provider name
   * Example: "exchangerate-api.com"
   */
  provider: string;

  /**
   * Identifier for the processing run that fetched this rate
   */
  processingRunId: string;
}

/**
 * Validation error thrown when exchange rate snapshot data is invalid
 */
export class ExchangeRateSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExchangeRateSnapshotValidationError';
  }
}

/**
 * ExchangeRateSnapshot validation and utility methods
 */
export class ExchangeRateSnapshotValidator {
  /**
   * Validate an exchange rate snapshot object
   *
   * @param snapshot - Exchange rate snapshot to validate
   * @throws ExchangeRateSnapshotValidationError if validation fails
   */
  static validate(snapshot: ExchangeRateSnapshot): void {
    // Currency validation
    if (!Object.values(CurrencyCode).includes(snapshot.baseCurrency)) {
      throw new ExchangeRateSnapshotValidationError(`Invalid base currency: ${snapshot.baseCurrency}`);
    }

    if (!Object.values(CurrencyCode).includes(snapshot.targetCurrency)) {
      throw new ExchangeRateSnapshotValidationError(`Invalid target currency: ${snapshot.targetCurrency}`);
    }

    // Business rule: Base currency should always be GBP for this system
    if (snapshot.baseCurrency !== CurrencyCode.GBP) {
      throw new ExchangeRateSnapshotValidationError(
        `Base currency must be GBP, got ${snapshot.baseCurrency}`
      );
    }

    // Currency pair validation
    if (snapshot.baseCurrency === snapshot.targetCurrency) {
      throw new ExchangeRateSnapshotValidationError(
        'Base and target currencies must be different'
      );
    }

    // Rate validation
    if (typeof snapshot.rate !== 'number' || isNaN(snapshot.rate)) {
      throw new ExchangeRateSnapshotValidationError('Rate must be a valid number');
    }

    if (snapshot.rate <= 0) {
      throw new ExchangeRateSnapshotValidationError('Rate must be positive');
    }

    // Date validation
    if (!(snapshot.fetchedAt instanceof Date) || isNaN(snapshot.fetchedAt.getTime())) {
      throw new ExchangeRateSnapshotValidationError('Fetched timestamp must be a valid date');
    }

    // Provider validation
    if (!snapshot.provider || snapshot.provider.trim().length === 0) {
      throw new ExchangeRateSnapshotValidationError('Provider is required');
    }

    // Processing run ID validation
    if (!snapshot.processingRunId || snapshot.processingRunId.trim().length === 0) {
      throw new ExchangeRateSnapshotValidationError('Processing run ID is required');
    }
  }

  /**
   * Convert amount from target currency to base currency
   *
   * @param snapshot - Exchange rate snapshot
   * @param amount - Amount in target currency
   * @returns Amount converted to base currency
   */
  static convertToBaseCurrency(snapshot: ExchangeRateSnapshot, amount: number): number {
    return amount * snapshot.rate;
  }

  /**
   * Convert amount from base currency to target currency
   *
   * @param snapshot - Exchange rate snapshot
   * @param amount - Amount in base currency
   * @returns Amount converted to target currency
   */
  static convertFromBaseCurrency(snapshot: ExchangeRateSnapshot, amount: number): number {
    return amount / snapshot.rate;
  }

  /**
   * Generate composite key for the snapshot
   *
   * @param snapshot - Exchange rate snapshot
   * @returns Composite key string
   */
  static getCompositeKey(snapshot: ExchangeRateSnapshot): string {
    return `${snapshot.baseCurrency}_${snapshot.targetCurrency}_${snapshot.fetchedAt.toISOString()}`;
  }

  /**
   * Check if two snapshots are from the same processing run and currency pair
   *
   * @param snapshot1 - First snapshot
   * @param snapshot2 - Second snapshot
   * @returns True if same run and currency pair
   */
  static isSameRunAndPair(
    snapshot1: ExchangeRateSnapshot,
    snapshot2: ExchangeRateSnapshot
  ): boolean {
    return snapshot1.processingRunId === snapshot2.processingRunId &&
           snapshot1.baseCurrency === snapshot2.baseCurrency &&
           snapshot1.targetCurrency === snapshot2.targetCurrency;
  }
}

/**
 * ExchangeRateSnapshot factory methods
 */
export class ExchangeRateSnapshotFactory {
  /**
   * Create a new exchange rate snapshot
   *
   * @param targetCurrency - Target currency code
   * @param rate - Exchange rate
   * @param provider - Exchange rate provider name
   * @param processingRunId - Processing run identifier
   * @returns New exchange rate snapshot
   */
  static create(
    targetCurrency: CurrencyCode,
    rate: number,
    provider: string,
    processingRunId: string
  ): ExchangeRateSnapshot {
    const snapshot: ExchangeRateSnapshot = {
      baseCurrency: CurrencyCode.GBP,
      targetCurrency,
      rate,
      fetchedAt: new Date(),
      provider: provider.trim(),
      processingRunId: processingRunId.trim()
    };

    ExchangeRateSnapshotValidator.validate(snapshot);
    return snapshot;
  }

  /**
   * Create multiple exchange rate snapshots for a processing run
   *
   * @param rates - Map of currency code to exchange rate
   * @param provider - Exchange rate provider name
   * @param processingRunId - Processing run identifier
   * @returns Array of exchange rate snapshots
   */
  static createBatch(
    rates: Map<CurrencyCode, number>,
    provider: string,
    processingRunId: string
  ): ExchangeRateSnapshot[] {
    const fetchedAt = new Date();
    const snapshots: ExchangeRateSnapshot[] = [];

    rates.forEach((rate, targetCurrency) => {
      // Skip GBP (no conversion needed)
      if (targetCurrency === CurrencyCode.GBP) {
        return;
      }

      const snapshot: ExchangeRateSnapshot = {
        baseCurrency: CurrencyCode.GBP,
        targetCurrency,
        rate,
        fetchedAt,
        provider: provider.trim(),
        processingRunId: processingRunId.trim()
      };

      ExchangeRateSnapshotValidator.validate(snapshot);
      snapshots.push(snapshot);
    });

    return snapshots;
  }

  /**
   * Find snapshot for a specific currency pair in a collection
   *
   * @param snapshots - Collection of snapshots
   * @param targetCurrency - Target currency to find
   * @returns Matching snapshot, or null if not found
   */
  static findByCurrency(
    snapshots: ExchangeRateSnapshot[],
    targetCurrency: CurrencyCode
  ): ExchangeRateSnapshot | null {
    return snapshots.find(
      s => s.baseCurrency === CurrencyCode.GBP && s.targetCurrency === targetCurrency
    ) || null;
  }
}
