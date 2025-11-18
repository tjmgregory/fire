/**
 * Transaction Entity Tests
 *
 * Tests business rules from entity-models.md section 3.1
 */

import { describe, test, expect } from 'vitest';
import {
  Transaction,
  TransactionValidator,
  ProcessingStatus,
  TransactionType,
  CurrencyCode
} from '../../../src/apps-script/models/Transaction';

describe('TransactionValidator', () => {
  describe('validate', () => {
    test('Given valid transaction, when validated, then passes without error', () => {
      // Arrange
      const validTransaction: Transaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bankSourceId: 'MONZO',
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

    test('Given missing required id, when validated, then throws error', () => {
      // Arrange
      const invalidTransaction = {
        bankSourceId: 'MONZO',
        originalTransactionId: 'tx_00001',
        transactionDate: new Date('2025-11-15'),
        originalAmountValue: 23.45
      } as Transaction;

      // Act & Assert
      expect(() => TransactionValidator.validate(invalidTransaction))
        .toThrow('Transaction ID is required');
    });

    test('Given missing required description, when validated, then throws error', () => {
      // Arrange
      const invalidTransaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bankSourceId: 'MONZO',
        originalTransactionId: 'tx_00001',
        transactionDate: new Date('2025-11-15'),
        originalAmountValue: 23.45
      } as Transaction;

      // Act & Assert
      expect(() => TransactionValidator.validate(invalidTransaction))
        .toThrow('Description is required');
    });

    test('Given missing required originalTransactionId, when validated, then throws error', () => {
      // Arrange
      const invalidTransaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bankSourceId: 'MONZO',
        description: 'Tesco',
        transactionDate: new Date('2025-11-15'),
        originalAmountValue: 23.45
      } as Transaction;

      // Act & Assert
      expect(() => TransactionValidator.validate(invalidTransaction))
        .toThrow('Original transaction ID is required');
    });

    test('Given confidence score above 100, when validated, then throws error', () => {
      // Arrange
      const transaction: Transaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bankSourceId: 'MONZO',
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
        categoryConfidenceScore: 105, // Above 100
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

    test('Given confidence score below 0, when validated, then throws error', () => {
      // Arrange
      const transaction: Transaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bankSourceId: 'MONZO',
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
        categoryConfidenceScore: -5, // Below 0
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

  describe('validateStatusTransition', () => {
    test('Given UNPROCESSED to NORMALISED, when validated, then allows transition', () => {
      // Act & Assert
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.UNPROCESSED,
        ProcessingStatus.NORMALISED
      )).not.toThrow();
    });

    test('Given NORMALISED to CATEGORISED, when validated, then allows transition', () => {
      // Act & Assert
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.NORMALISED,
        ProcessingStatus.CATEGORISED
      )).not.toThrow();
    });

    test('Given any status to ERROR, when validated, then allows transition', () => {
      // Act & Assert
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

    test('Given CATEGORISED to NORMALISED, when validated, then rejects backward transition', () => {
      // Act & Assert
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.CATEGORISED,
        ProcessingStatus.NORMALISED
      )).toThrow('Invalid status transition');
    });

    test('Given NORMALISED to UNPROCESSED, when validated, then rejects backward transition', () => {
      // Act & Assert
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.NORMALISED,
        ProcessingStatus.UNPROCESSED
      )).toThrow('Invalid status transition');
    });

    test('Given UNPROCESSED to CATEGORISED, when validated, then rejects skipping NORMALISED', () => {
      // Act & Assert
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.UNPROCESSED,
        ProcessingStatus.CATEGORISED
      )).toThrow('Invalid status transition');
    });

    test('Given ERROR to NORMALISED, when validated, then allows retry', () => {
      // Act & Assert
      expect(() => TransactionValidator.validateStatusTransition(
        ProcessingStatus.ERROR,
        ProcessingStatus.NORMALISED
      )).not.toThrow();
    });
  });
});
