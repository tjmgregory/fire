/**
 * Transaction Entity Model
 *
 * Represents a single financial transaction from a bank source through its
 * entire lifecycle (normalization and categorization).
 *
 * @module models/Transaction
 */

/**
 * Bank source identifiers
 */
export enum BankSourceId {
  MONZO = 'MONZO',
  REVOLUT = 'REVOLUT',
  YONDER = 'YONDER'
}

/**
 * ISO 4217 currency codes
 */
export enum CurrencyCode {
  GBP = 'GBP',
  USD = 'USD',
  EUR = 'EUR',
  CAD = 'CAD',
  AUD = 'AUD',
  JPY = 'JPY',
  MAD = 'MAD',
  THB = 'THB',
  SGD = 'SGD',
  HKD = 'HKD',
  ZAR = 'ZAR',
  NOK = 'NOK',
  CNY = 'CNY',
  SEK = 'SEK'
}

/**
 * Transaction processing status lifecycle
 *
 * UNPROCESSED → NORMALISED → CATEGORISED
 *            ↓
 *          ERROR (can occur at any stage)
 */
export enum ProcessingStatus {
  UNPROCESSED = 'UNPROCESSED',
  NORMALISED = 'NORMALISED',
  CATEGORISED = 'CATEGORISED',
  ERROR = 'ERROR'
}

/**
 * Transaction type (debit or credit)
 */
export enum TransactionType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT'
}

/**
 * Transaction entity
 *
 * Represents a single financial transaction from a bank source through its
 * entire lifecycle (normalization and categorization).
 */
export interface Transaction {
  // Identity
  id: string;
  originalTransactionId: string;

  // Source
  bankSourceId: BankSourceId;

  // Transaction Details
  transactionDate: Date;
  transactionType: TransactionType;
  description: string;
  notes: string | null;
  country: string | null;

  // Amounts
  originalAmountValue: number;
  originalAmountCurrency: CurrencyCode;
  gbpAmountValue: number;
  exchangeRateValue: number | null;

  // Categorization (AI)
  categoryAiId: string | null;
  categoryAiName: string | null;
  categoryConfidenceScore: number | null;

  // Categorization (Manual Override)
  categoryManualId: string | null;
  categoryManualName: string | null;

  // Processing State
  processingStatus: ProcessingStatus;
  errorMessage: string | null;

  // Timestamps
  timestampCreated: Date;
  timestampLastModified: Date;
  timestampNormalised: Date | null;
  timestampCategorised: Date | null;
}

/**
 * Validation error thrown when transaction data is invalid
 */
export class TransactionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionValidationError';
  }
}

/**
 * Transaction validation utilities
 */
export class TransactionValidator {
  /**
   * Validate a transaction object
   *
   * @param transaction - Transaction to validate
   * @throws TransactionValidationError if validation fails
   */
  static validate(transaction: Transaction): void {
    // Required fields
    if (!transaction.id) {
      throw new TransactionValidationError('Transaction ID is required');
    }

    if (!transaction.originalTransactionId) {
      throw new TransactionValidationError('Original transaction ID is required');
    }

    if (!transaction.description) {
      throw new TransactionValidationError('Description is required');
    }

    // Bank source validation
    if (!Object.values(BankSourceId).includes(transaction.bankSourceId)) {
      throw new TransactionValidationError(`Invalid bank source: ${transaction.bankSourceId}`);
    }

    // Currency validation
    if (!Object.values(CurrencyCode).includes(transaction.originalAmountCurrency)) {
      throw new TransactionValidationError(`Invalid currency code: ${transaction.originalAmountCurrency}`);
    }

    // Amount validation
    if (typeof transaction.originalAmountValue !== 'number' || isNaN(transaction.originalAmountValue)) {
      throw new TransactionValidationError('Original amount must be a valid number');
    }

    if (typeof transaction.gbpAmountValue !== 'number' || isNaN(transaction.gbpAmountValue)) {
      throw new TransactionValidationError('GBP amount must be a valid number');
    }

    // Exchange rate validation (required for non-GBP transactions)
    if (transaction.originalAmountCurrency !== CurrencyCode.GBP) {
      if (transaction.exchangeRateValue === null || transaction.exchangeRateValue === undefined) {
        throw new TransactionValidationError('Exchange rate is required for non-GBP transactions');
      }

      if (typeof transaction.exchangeRateValue !== 'number' || isNaN(transaction.exchangeRateValue)) {
        throw new TransactionValidationError('Exchange rate must be a valid number');
      }

      if (transaction.exchangeRateValue <= 0) {
        throw new TransactionValidationError('Exchange rate must be positive');
      }
    }

    // Date validation
    if (!(transaction.transactionDate instanceof Date) || isNaN(transaction.transactionDate.getTime())) {
      throw new TransactionValidationError('Transaction date must be a valid date');
    }

    if (!(transaction.timestampCreated instanceof Date) || isNaN(transaction.timestampCreated.getTime())) {
      throw new TransactionValidationError('Created timestamp must be a valid date');
    }

    if (!(transaction.timestampLastModified instanceof Date) || isNaN(transaction.timestampLastModified.getTime())) {
      throw new TransactionValidationError('Last modified timestamp must be a valid date');
    }

    // Status validation
    if (!Object.values(ProcessingStatus).includes(transaction.processingStatus)) {
      throw new TransactionValidationError(`Invalid processing status: ${transaction.processingStatus}`);
    }

    // Type validation
    if (!Object.values(TransactionType).includes(transaction.transactionType)) {
      throw new TransactionValidationError(`Invalid transaction type: ${transaction.transactionType}`);
    }

    // Confidence score validation (if present)
    if (transaction.categoryConfidenceScore !== null && transaction.categoryConfidenceScore !== undefined) {
      if (typeof transaction.categoryConfidenceScore !== 'number' || isNaN(transaction.categoryConfidenceScore)) {
        throw new TransactionValidationError('Confidence score must be a valid number');
      }

      if (transaction.categoryConfidenceScore < 0 || transaction.categoryConfidenceScore > 100) {
        throw new TransactionValidationError('Confidence score must be between 0 and 100');
      }
    }

    // Business rule: Manual category takes precedence over AI category
    if (transaction.categoryManualId && transaction.categoryManualName) {
      // Manual override is set, this is valid
    } else if (transaction.categoryAiId && transaction.categoryAiName) {
      // AI category is set, this is valid
    } else if (transaction.categoryAiId || transaction.categoryAiName || transaction.categoryManualId || transaction.categoryManualName) {
      // Partial category data is invalid
      throw new TransactionValidationError('Category ID and name must both be set or both be null');
    }
  }

  /**
   * Validate lifecycle state transition
   *
   * @param fromStatus - Current status
   * @param toStatus - Target status
   * @throws TransactionValidationError if transition is invalid
   */
  static validateStatusTransition(fromStatus: ProcessingStatus, toStatus: ProcessingStatus): void {
    const validTransitions: Record<ProcessingStatus, ProcessingStatus[]> = {
      [ProcessingStatus.UNPROCESSED]: [
        ProcessingStatus.NORMALISED,
        ProcessingStatus.ERROR
      ],
      [ProcessingStatus.NORMALISED]: [
        ProcessingStatus.CATEGORISED,
        ProcessingStatus.ERROR
      ],
      [ProcessingStatus.CATEGORISED]: [
        ProcessingStatus.CATEGORISED, // Allow re-categorization
        ProcessingStatus.ERROR
      ],
      [ProcessingStatus.ERROR]: [
        ProcessingStatus.NORMALISED, // Allow retry from error
        ProcessingStatus.CATEGORISED,
        ProcessingStatus.ERROR
      ]
    };

    const allowedTransitions = validTransitions[fromStatus];
    if (!allowedTransitions.includes(toStatus)) {
      throw new TransactionValidationError(
        `Invalid status transition: ${fromStatus} → ${toStatus}`
      );
    }
  }

  /**
   * Check if a transaction is categorized (AI or manual)
   *
   * @param transaction - Transaction to check
   * @returns True if transaction has a category assigned
   */
  static isCategorized(transaction: Transaction): boolean {
    return !!(transaction.categoryManualId || transaction.categoryAiId);
  }

  /**
   * Get the effective category (manual override takes precedence)
   *
   * @param transaction - Transaction to check
   * @returns Category ID and name, or null if not categorized
   */
  static getEffectiveCategory(transaction: Transaction): { id: string; name: string } | null {
    if (transaction.categoryManualId && transaction.categoryManualName) {
      return {
        id: transaction.categoryManualId,
        name: transaction.categoryManualName
      };
    }

    if (transaction.categoryAiId && transaction.categoryAiName) {
      return {
        id: transaction.categoryAiId,
        name: transaction.categoryAiName
      };
    }

    return null;
  }
}
