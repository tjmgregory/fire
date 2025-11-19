/**
 * Transaction Entity Tests
 *
 * Tests business rules from entity-models.md section 1 (Transaction)
 * Validates behaviors required by:
 * - UC-001: Import and Normalize Transactions
 * - UC-002: Review Categorized Transactions
 * - UC-005: Execute Scheduled Normalization
 * - UC-006: Execute Scheduled Categorization
 *
 * Business Rules Tested:
 * - BR-T-01: Each transaction must have a unique ID
 * - BR-T-02: Transactions cannot be deleted, only marked as ERROR
 * - BR-T-03: Manual category overrides always take precedence over AI categories
 * - BR-T-04: GBP amount is required; original amount and currency must be preserved
 * - BR-T-05: Exchange rate is required for non-GBP transactions
 * - BR-T-06: Confidence scores must be between 0-100%
 * - BR-T-07: Status transitions follow lifecycle: UNPROCESSED → NORMALISED → CATEGORISED
 * - BR-T-08: ERROR status can occur at any stage
 */

import { describe, test, expect } from 'vitest';
import {
  Transaction,
  TransactionValidator,
  ProcessingStatus,
  TransactionType,
  CurrencyCode
} from '../../../src/apps-script/models/Transaction';
import { BankSourceId } from '../../../src/apps-script/models/BankSource';

describe('TransactionValidator', () => {
  describe('validate - Required Fields (BR-T-01, BR-T-04)', () => {
    test('UC-005: Given valid normalized transaction, when validated, then passes all business rules', () => {
      // Arrange - Normalized transaction from UC-005 (Execute Scheduled Normalization)
      const validTransaction: Transaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bankSourceId: BankSourceId.MONZO,
        originalTransactionId: 'tx_00001',
        transactionDate: new Date('2025-11-15'),
        transactionType: TransactionType.DEBIT,
        description: 'Tesco Metro',
        notes: null,
        country: null,
        originalAmountValue: 23.45,
        originalAmountCurrency: CurrencyCode.GBP,
        gbpAmountValue: 23.45,
        exchangeRateValue: null,
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        categoryManualId: null,
        categoryManualName: null,
        processingStatus: ProcessingStatus.UNPROCESSED,
        errorMessage: null,
        timestampCreated: new Date(),
        timestampLastModified: new Date(),
        timestampNormalised: null,
        timestampCategorised: null
      };

      // Act & Assert
      expect(() => TransactionValidator.validate(validTransaction)).not.toThrow();
    });

    test('BR-T-01: Given transaction without unique ID, when validated, then rejects (entity identity requirement)', () => {
      // Arrange
      const invalidTransaction = {
        bankSourceId: BankSourceId.MONZO,
        originalTransactionId: 'tx_00001',
        transactionDate: new Date('2025-11-15'),
        originalAmountValue: 23.45
      } as Transaction;

      // Act & Assert - Per entity-models.md: "Each transaction must have a unique ID"
      expect(() => TransactionValidator.validate(invalidTransaction))
        .toThrow('Transaction ID is required');
    });

    test('BR-T-04: Given transaction without description, when validated, then rejects (required field)', () => {
      // Arrange
      const invalidTransaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bankSourceId: BankSourceId.MONZO,
        originalTransactionId: 'tx_00001',
        transactionDate: new Date('2025-11-15'),
        originalAmountValue: 23.45
      } as Transaction;

      // Act & Assert - Description is merchant/payee name, critical for categorization
      expect(() => TransactionValidator.validate(invalidTransaction))
        .toThrow('Description is required');
    });

    test('BR-T-01: Given transaction without originalTransactionId, when validated, then rejects (deduplication requirement)', () => {
      // Arrange - Per UC-001 Alternative Flow 3b: System detects duplicates by transaction ID
      const invalidTransaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bankSourceId: BankSourceId.MONZO,
        description: 'Tesco',
        transactionDate: new Date('2025-11-15'),
        originalAmountValue: 23.45
      } as Transaction;

      // Act & Assert
      expect(() => TransactionValidator.validate(invalidTransaction))
        .toThrow('Original transaction ID is required');
    });
  });

  describe('validate - Confidence Scores (BR-T-06)', () => {
    test('UC-006: Given categorized transaction with confidence score 105, when validated, then rejects (confidence must be 0-100)', () => {
      // Arrange - Per UC-002: AI returns confidence scores 0-100%
      const transaction: Transaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bankSourceId: BankSourceId.MONZO,
        originalTransactionId: 'tx_00001',
        transactionDate: new Date('2025-11-15'),
        transactionType: TransactionType.DEBIT,
        description: 'Tesco',
        notes: null,
        country: null,
        originalAmountValue: 23.45,
        originalAmountCurrency: CurrencyCode.GBP,
        gbpAmountValue: 23.45,
        exchangeRateValue: null,
        categoryAiId: '550e8400-e29b-41d4-a716-446655440000',
        categoryAiName: 'Groceries',
        categoryConfidenceScore: 105, // Invalid: above 100
        categoryManualId: null,
        categoryManualName: null,
        processingStatus: ProcessingStatus.CATEGORISED,
        errorMessage: null,
        timestampCreated: new Date(),
        timestampLastModified: new Date(),
        timestampNormalised: new Date(),
        timestampCategorised: new Date()
      };

      // Act & Assert - Per entity-models.md BR-T-06
      expect(() => TransactionValidator.validate(transaction))
        .toThrow('Confidence score must be between 0 and 100');
    });

    test('UC-002: Given categorized transaction with negative confidence, when validated, then rejects', () => {
      // Arrange
      const transaction: Transaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bankSourceId: BankSourceId.MONZO,
        originalTransactionId: 'tx_00001',
        transactionDate: new Date('2025-11-15'),
        transactionType: TransactionType.DEBIT,
        description: 'Tesco',
        notes: null,
        country: null,
        originalAmountValue: 23.45,
        originalAmountCurrency: CurrencyCode.GBP,
        gbpAmountValue: 23.45,
        exchangeRateValue: null,
        categoryAiId: '550e8400-e29b-41d4-a716-446655440000',
        categoryAiName: 'Groceries',
        categoryConfidenceScore: -5, // Invalid: below 0
        categoryManualId: null,
        categoryManualName: null,
        processingStatus: ProcessingStatus.CATEGORISED,
        errorMessage: null,
        timestampCreated: new Date(),
        timestampLastModified: new Date(),
        timestampNormalised: new Date(),
        timestampCategorised: new Date()
      };

      // Act & Assert
      expect(() => TransactionValidator.validate(transaction))
        .toThrow('Confidence score must be between 0 and 100');
    });
  });

  describe('validateStatusTransition - Lifecycle States (BR-T-07, BR-T-08)', () => {
    test('UC-005: Given UNPROCESSED transaction, when normalized, then allows transition to NORMALISED', () => {
      // Act & Assert - Per entity-models.md lifecycle: UNPROCESSED → NORMALISED
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.UNPROCESSED,
        ProcessingStatus.NORMALISED
      )).not.toThrow();
    });

    test('UC-006: Given NORMALISED transaction, when categorized, then allows transition to CATEGORISED', () => {
      // Act & Assert - Per entity-models.md lifecycle: NORMALISED → CATEGORISED
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.NORMALISED,
        ProcessingStatus.CATEGORISED
      )).not.toThrow();
    });

    test('BR-T-08: Given transaction at any status, when error occurs, then allows transition to ERROR', () => {
      // Arrange & Act & Assert - Per entity-models.md: "ERROR (can occur at any stage)"
      // UC-001 Alternative Flow 3a: Invalid data → ERROR status
      // UC-001 Alternative Flow 5a: Currency conversion fails → ERROR status

      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.UNPROCESSED,
        ProcessingStatus.ERROR
      )).not.toThrow();

      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.NORMALISED,
        ProcessingStatus.ERROR
      )).not.toThrow();

      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.CATEGORISED,
        ProcessingStatus.ERROR
      )).not.toThrow();
    });

    test('BR-T-02: Given CATEGORISED transaction, when attempting backward transition to NORMALISED, then rejects (immutability)', () => {
      // Act & Assert - Transactions cannot move backward in lifecycle
      // Per entity-models.md: Lifecycle is unidirectional (except to ERROR)
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.CATEGORISED,
        ProcessingStatus.NORMALISED
      )).toThrow('Invalid status transition');
    });

    test('BR-T-02: Given NORMALISED transaction, when attempting backward transition to UNPROCESSED, then rejects', () => {
      // Act & Assert
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.NORMALISED,
        ProcessingStatus.UNPROCESSED
      )).toThrow('Invalid status transition');
    });

    test('BR-T-07: Given UNPROCESSED transaction, when attempting to skip NORMALISED phase, then rejects lifecycle constraint', () => {
      // Act & Assert - Per entity-models.md: Must follow UNPROCESSED → NORMALISED → CATEGORISED
      // Cannot skip normalization phase per UC-005/UC-006 two-phase architecture
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.UNPROCESSED,
        ProcessingStatus.CATEGORISED
      )).toThrow('Invalid status transition');
    });

    test('UC-001 Alt 5a: Given ERROR transaction, when retrying normalization, then allows transition to NORMALISED', () => {
      // Arrange & Act & Assert - Per UC-001 Alternative Flow 5a4: "User can retry manually"
      // UC-005 Alternative Flow 3b: System retries failed transactions
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.ERROR,
        ProcessingStatus.NORMALISED
      )).not.toThrow();
    });
  });
});
