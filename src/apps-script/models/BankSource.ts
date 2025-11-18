/**
 * BankSource Entity Model
 *
 * Represents a source bank/financial institution with its specific schema configuration.
 * Encapsulates bank-specific column mappings and processing requirements.
 *
 * @module models/BankSource
 */

import { BankSourceId } from './Transaction';

/**
 * Column mapping for bank-specific source sheets
 * Maps standard fields to source-specific column names
 */
export interface ColumnMapping {
  /** Date column name */
  date: string;

  /** Description/merchant column name */
  description: string;

  /** Amount column name */
  amount: string;

  /** Currency column name */
  currency: string;

  /** Transaction ID column name (optional for banks without native IDs) */
  transactionId?: string;

  /** Transaction type column name (optional) */
  type?: string;

  /** Category column name (optional, not used for AI categorization) */
  category?: string;

  /** Notes/tags column name (optional) */
  notes?: string;

  /** Country column name (optional) */
  country?: string;

  /** Time column name (optional, separate from date) */
  time?: string;

  /** Completed date column name (optional, for Revolut) */
  completedDate?: string;
}

/**
 * BankSource entity
 *
 * Represents a source bank with its configuration and schema.
 */
export interface BankSource {
  /**
   * Unique identifier (MONZO, REVOLUT, YONDER)
   */
  id: BankSourceId;

  /**
   * Human-readable name
   */
  displayName: string;

  /**
   * Google Sheets sheet name for this source
   */
  sheetName: string;

  /**
   * Whether bank provides native transaction IDs
   */
  hasNativeTransactionId: boolean;

  /**
   * Whether this source is currently being processed
   */
  isActive: boolean;

  /**
   * Column mappings from standard fields to source-specific column names
   */
  columnMappings: ColumnMapping;

  /**
   * When source was configured
   */
  createdAt: Date;

  /**
   * Last successful processing timestamp
   */
  lastProcessedAt: Date | null;
}

/**
 * Validation error thrown when bank source data is invalid
 */
export class BankSourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BankSourceValidationError';
  }
}

/**
 * BankSource validation utilities
 */
export class BankSourceValidator {
  /**
   * Validate a bank source object
   *
   * @param source - Bank source to validate
   * @throws BankSourceValidationError if validation fails
   */
  static validate(source: BankSource): void {
    // ID validation
    if (!Object.values(BankSourceId).includes(source.id)) {
      throw new BankSourceValidationError(`Invalid bank source ID: ${source.id}`);
    }

    // Required string fields
    if (!source.displayName || source.displayName.trim().length === 0) {
      throw new BankSourceValidationError('Display name is required');
    }

    if (!source.sheetName || source.sheetName.trim().length === 0) {
      throw new BankSourceValidationError('Sheet name is required');
    }

    // Boolean validation
    if (typeof source.hasNativeTransactionId !== 'boolean') {
      throw new BankSourceValidationError('hasNativeTransactionId must be a boolean');
    }

    if (typeof source.isActive !== 'boolean') {
      throw new BankSourceValidationError('isActive must be a boolean');
    }

    // Column mappings validation
    this.validateColumnMappings(source.columnMappings, source.hasNativeTransactionId);

    // Date validation
    if (!(source.createdAt instanceof Date) || isNaN(source.createdAt.getTime())) {
      throw new BankSourceValidationError('Created timestamp must be a valid date');
    }

    if (source.lastProcessedAt !== null) {
      if (!(source.lastProcessedAt instanceof Date) || isNaN(source.lastProcessedAt.getTime())) {
        throw new BankSourceValidationError('Last processed timestamp must be a valid date');
      }
    }
  }

  /**
   * Validate column mappings
   *
   * @param mappings - Column mappings to validate
   * @param hasNativeId - Whether bank has native transaction IDs
   * @throws BankSourceValidationError if mappings are invalid
   */
  static validateColumnMappings(mappings: ColumnMapping, hasNativeId: boolean): void {
    // Required fields for all sources
    const requiredFields = ['date', 'description', 'amount', 'currency'];

    for (const field of requiredFields) {
      const value = mappings[field as keyof ColumnMapping];
      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        throw new BankSourceValidationError(`Column mapping '${field}' is required`);
      }
    }

    // Transaction ID required for banks with native IDs
    if (hasNativeId && (!mappings.transactionId || mappings.transactionId.trim().length === 0)) {
      throw new BankSourceValidationError('Transaction ID column mapping required for banks with native IDs');
    }
  }

  /**
   * Check if column mappings are immutable after first processing
   *
   * @param source - Bank source
   * @returns True if mappings should be treated as immutable
   */
  static areMappingsImmutable(source: BankSource): boolean {
    return source.lastProcessedAt !== null;
  }
}
