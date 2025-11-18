/**
 * Bank Normalizer Base Class
 *
 * Abstract base class for bank-specific normalization strategies.
 * Implements Strategy pattern per SAD 5.2.4.
 *
 * @module domain/normalizers/BankNormalizer
 */

import { Transaction, CurrencyCode, ProcessingStatus, TransactionType } from '../../models/Transaction';
import { RawRowData } from '../ports/SheetDataPort';
import { DataValidator } from '../validation/DataValidator';
import { BankSource } from '../../models/BankSource';

/**
 * Base class for bank-specific normalizers
 *
 * Each bank has different export formats. This base class defines
 * the interface and common utilities, while concrete implementations
 * handle bank-specific mapping logic.
 */
export abstract class BankNormalizer {
  protected readonly source: BankSource;

  constructor(source: BankSource) {
    this.source = source;
  }

  /**
   * Normalize raw bank data to Transaction entity
   *
   * @param rawData - Raw row data from bank export
   * @returns Normalized transaction
   */
  abstract normalize(rawData: RawRowData): Transaction;

  /**
   * Get value from raw data using column mapping
   *
   * @param rawData - Raw row data
   * @param standardField - Standard field name
   * @returns Field value
   */
  protected getValue(rawData: RawRowData, standardField: string): unknown {
    const columnName = this.source.columnMappings[standardField as keyof typeof this.source.columnMappings];
    if (!columnName) {
      return null;
    }
    return rawData[columnName];
  }

  /**
   * Get required string value
   *
   * @param rawData - Raw row data
   * @param standardField - Standard field name
   * @returns String value
   */
  protected getRequiredString(rawData: RawRowData, standardField: string): string {
    const value = this.getValue(rawData, standardField);
    return DataValidator.validateRequiredString(value, standardField);
  }

  /**
   * Get optional string value
   *
   * @param rawData - Raw row data
   * @param standardField - Standard field name
   * @returns String value or null
   */
  protected getOptionalString(rawData: RawRowData, standardField: string): string | null {
    const value = this.getValue(rawData, standardField);
    return DataValidator.validateOptional(value, (v) =>
      DataValidator.validateRequiredString(v, standardField)
    );
  }

  /**
   * Get required date value
   *
   * @param rawData - Raw row data
   * @param standardField - Standard field name
   * @returns Date value
   */
  protected getRequiredDate(rawData: RawRowData, standardField: string): Date {
    const value = this.getValue(rawData, standardField);
    return DataValidator.validateDate(value, standardField);
  }

  /**
   * Get required amount value
   *
   * @param rawData - Raw row data
   * @param standardField - Standard field name
   * @returns Number value
   */
  protected getRequiredAmount(rawData: RawRowData, standardField: string): number {
    const value = this.getValue(rawData, standardField);
    return DataValidator.validateAmount(value, standardField);
  }

  /**
   * Get currency code
   *
   * @param rawData - Raw row data
   * @param standardField - Standard field name
   * @returns Currency code
   */
  protected getCurrencyCode(rawData: RawRowData, standardField: string): CurrencyCode {
    const value = this.getValue(rawData, standardField);
    const code = DataValidator.validateCurrencyCode(value, standardField);
    return DataValidator.validateEnum(code, CurrencyCode, standardField);
  }

  /**
   * Determine transaction type from amount
   *
   * @param amount - Transaction amount
   * @returns Transaction type
   */
  protected determineType(amount: number): TransactionType {
    return amount < 0 ? TransactionType.DEBIT : TransactionType.CREDIT;
  }

  /**
   * Generate transaction ID using SHA-256 hash
   *
   * For banks without native transaction IDs, generates a deterministic
   * hash from transaction attributes.
   *
   * @param date - Transaction date
   * @param description - Transaction description
   * @param amount - Transaction amount
   * @param currency - Currency code
   * @returns Generated transaction ID
   */
  protected generateTransactionId(
    date: Date,
    description: string,
    amount: number,
    currency: string
  ): string {
    // Create deterministic string
    const dataString = `${date.toISOString()}_${description}_${amount}_${currency}`;

    // Use Google Apps Script's built-in digest if available
    if (typeof Utilities !== 'undefined' && Utilities.computeDigest) {
      const digest = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        dataString
      );

      // Convert to hex string
      return digest.map(byte => {
        const v = (byte < 0 ? byte + 256 : byte).toString(16);
        return v.length === 1 ? '0' + v : v;
      }).join('');
    }

    // Fallback for testing: simple hash
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Create base transaction with common fields
   *
   * @param _rawData - Raw row data (unused but kept for API consistency)
   * @returns Partial transaction with common fields
   */
  protected createBaseTransaction(_rawData: RawRowData): Partial<Transaction> {
    const now = new Date();

    return {
      bankSourceId: this.source.id,
      processingStatus: ProcessingStatus.UNPROCESSED,
      timestampCreated: now,
      timestampLastModified: now,
      timestampNormalised: null,
      timestampCategorised: null,
      categoryAiId: null,
      categoryAiName: null,
      categoryConfidenceScore: null,
      categoryManualId: null,
      categoryManualName: null,
      errorMessage: null,
      exchangeRateValue: null
    };
  }

  /**
   * Generate UUID for transaction
   *
   * @returns New UUID
   */
  protected generateUUID(): string {
    if (typeof Utilities !== 'undefined' && Utilities.getUuid) {
      return Utilities.getUuid();
    }

    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
