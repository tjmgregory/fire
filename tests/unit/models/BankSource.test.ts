/**
 * BankSource Entity Tests
 *
 * Tests business rules from entity-models.md section 2 (BankSource)
 * Validates behaviors required by:
 * - UC-001: Import and Normalize Transactions
 * - UC-005: Execute Scheduled Normalization
 * - FR-001: Support multiple bank sources
 * - FR-002: Normalize different bank formats
 *
 * Business Rules Tested:
 * - BR-BS-01: Each source must have a unique identifier
 * - BR-BS-02: Column mappings must include all required fields (date, description, amount, currency)
 * - BR-BS-03: Sources without native transaction IDs require ID backfilling
 * - BR-BS-04: Column mappings are immutable once transactions are processed
 */

import { describe, test, expect } from 'vitest';
import {
  BankSource,
  BankSourceValidator,
  BankSourceValidationError,
  ColumnMapping
} from '../../../src/apps-script/models/BankSource';
import { BankSourceId } from '../../../src/apps-script/models/Transaction';

describe('BankSourceValidator', () => {
  describe('validate - Required fields (BR-BS-01, BR-BS-02)', () => {
    test('UC-005: Given valid Monzo bank source, when validated, then passes all business rules', () => {
      // Arrange - Monzo configuration from UC-005
      const monzoSource: BankSource = {
        id: BankSourceId.MONZO,
        displayName: 'Monzo',
        sheetName: 'Monzo',
        hasNativeTransactionId: true,
        isActive: true,
        columnMappings: {
          date: 'Date',
          time: 'Time',
          description: 'Name',
          amount: 'Amount',
          currency: 'Currency',
          transactionId: 'Transaction ID',
          notes: 'Notes and #tags'
        },
        createdAt: new Date('2025-01-01'),
        lastProcessedAt: null
      };

      // Act & Assert - BR-BS-01: Each source must have unique identifier
      expect(() => BankSourceValidator.validate(monzoSource)).not.toThrow();
    });

    test('UC-001: Given valid Revolut bank source, when validated, then passes validation', () => {
      // Arrange - Revolut configuration without native IDs
      const revolutSource: BankSource = {
        id: BankSourceId.REVOLUT,
        displayName: 'Revolut',
        sheetName: 'Revolut',
        hasNativeTransactionId: false,
        isActive: true,
        columnMappings: {
          date: 'Started Date',
          completedDate: 'Completed Date',
          description: 'Description',
          amount: 'Amount',
          currency: 'Currency'
        },
        createdAt: new Date('2025-01-01'),
        lastProcessedAt: null
      };

      // Act & Assert - BR-BS-03: Sources without native IDs are valid
      expect(() => BankSourceValidator.validate(revolutSource)).not.toThrow();
    });

    test('UC-001: Given valid Yonder bank source, when validated, then passes validation', () => {
      // Arrange - Yonder configuration
      const yonderSource: BankSource = {
        id: BankSourceId.YONDER,
        displayName: 'Yonder',
        sheetName: 'Yonder',
        hasNativeTransactionId: false,
        isActive: true,
        columnMappings: {
          date: 'Date/Time of transaction',
          description: 'Description',
          amount: 'Amount (GBP)',
          currency: 'Currency',
          type: 'Debit or Credit',
          country: 'Country'
        },
        createdAt: new Date('2025-01-01'),
        lastProcessedAt: null
      };

      // Act & Assert
      expect(() => BankSourceValidator.validate(yonderSource)).not.toThrow();
    });

    test('BR-BS-01: Given invalid bank source ID, when validated, then throws BankSourceValidationError', () => {
      // Arrange - Invalid ID
      const invalidSource = {
        id: 'INVALID' as unknown as BankSourceId,
        displayName: 'Invalid Bank',
        sheetName: 'Invalid',
        hasNativeTransactionId: false,
        isActive: true,
        columnMappings: {
          date: 'Date',
          description: 'Description',
          amount: 'Amount',
          currency: 'Currency'
        },
        createdAt: new Date(),
        lastProcessedAt: null
      };

      // Act & Assert - BR-BS-01: Each source must have unique identifier from enum
      expect(() => BankSourceValidator.validate(invalidSource))
        .toThrow(BankSourceValidationError);
      expect(() => BankSourceValidator.validate(invalidSource))
        .toThrow('Invalid bank source ID: INVALID');
    });

    test('BR-BS-01: Given missing display name, when validated, then throws BankSourceValidationError', () => {
      // Arrange
      const sourceWithoutName = {
        id: BankSourceId.MONZO,
        displayName: '',
        sheetName: 'Monzo',
        hasNativeTransactionId: true,
        isActive: true,
        columnMappings: {
          date: 'Date',
          description: 'Name',
          amount: 'Amount',
          currency: 'Currency',
          transactionId: 'Transaction ID'
        },
        createdAt: new Date(),
        lastProcessedAt: null
      };

      // Act & Assert - Display name is required
      expect(() => BankSourceValidator.validate(sourceWithoutName))
        .toThrow('Display name is required');
    });

    test('BR-BS-01: Given missing sheet name, when validated, then throws BankSourceValidationError', () => {
      // Arrange
      const sourceWithoutSheet = {
        id: BankSourceId.MONZO,
        displayName: 'Monzo',
        sheetName: '   ',
        hasNativeTransactionId: true,
        isActive: true,
        columnMappings: {
          date: 'Date',
          description: 'Name',
          amount: 'Amount',
          currency: 'Currency',
          transactionId: 'Transaction ID'
        },
        createdAt: new Date(),
        lastProcessedAt: null
      };

      // Act & Assert - Sheet name is required
      expect(() => BankSourceValidator.validate(sourceWithoutSheet))
        .toThrow('Sheet name is required');
    });

    test('BR-BS-01: Given invalid hasNativeTransactionId type, when validated, then throws BankSourceValidationError', () => {
      // Arrange
      const sourceWithInvalidBoolean = {
        id: BankSourceId.MONZO,
        displayName: 'Monzo',
        sheetName: 'Monzo',
        hasNativeTransactionId: 'yes' as unknown as boolean,
        isActive: true,
        columnMappings: {
          date: 'Date',
          description: 'Name',
          amount: 'Amount',
          currency: 'Currency'
        },
        createdAt: new Date(),
        lastProcessedAt: null
      };

      // Act & Assert - Boolean validation
      expect(() => BankSourceValidator.validate(sourceWithInvalidBoolean))
        .toThrow('hasNativeTransactionId must be a boolean');
    });

    test('BR-BS-01: Given invalid isActive type, when validated, then throws BankSourceValidationError', () => {
      // Arrange
      const sourceWithInvalidActive = {
        id: BankSourceId.MONZO,
        displayName: 'Monzo',
        sheetName: 'Monzo',
        hasNativeTransactionId: true,
        isActive: 1 as unknown as boolean,
        columnMappings: {
          date: 'Date',
          description: 'Name',
          amount: 'Amount',
          currency: 'Currency',
          transactionId: 'Transaction ID'
        },
        createdAt: new Date(),
        lastProcessedAt: null
      };

      // Act & Assert
      expect(() => BankSourceValidator.validate(sourceWithInvalidActive))
        .toThrow('isActive must be a boolean');
    });

    test('BR-BS-01: Given invalid createdAt date, when validated, then throws BankSourceValidationError', () => {
      // Arrange
      const sourceWithInvalidDate = {
        id: BankSourceId.MONZO,
        displayName: 'Monzo',
        sheetName: 'Monzo',
        hasNativeTransactionId: true,
        isActive: true,
        columnMappings: {
          date: 'Date',
          description: 'Name',
          amount: 'Amount',
          currency: 'Currency',
          transactionId: 'Transaction ID'
        },
        createdAt: new Date('invalid'),
        lastProcessedAt: null
      };

      // Act & Assert - Date validation
      expect(() => BankSourceValidator.validate(sourceWithInvalidDate))
        .toThrow('Created timestamp must be a valid date');
    });

    test('BR-BS-01: Given invalid lastProcessedAt date, when validated, then throws BankSourceValidationError', () => {
      // Arrange
      const sourceWithInvalidProcessedDate = {
        id: BankSourceId.MONZO,
        displayName: 'Monzo',
        sheetName: 'Monzo',
        hasNativeTransactionId: true,
        isActive: true,
        columnMappings: {
          date: 'Date',
          description: 'Name',
          amount: 'Amount',
          currency: 'Currency',
          transactionId: 'Transaction ID'
        },
        createdAt: new Date('2025-01-01'),
        lastProcessedAt: new Date('invalid')
      };

      // Act & Assert
      expect(() => BankSourceValidator.validate(sourceWithInvalidProcessedDate))
        .toThrow('Last processed timestamp must be a valid date');
    });

    test('UC-005: Given null lastProcessedAt, when validated, then accepts as valid', () => {
      // Arrange - New source never processed
      const newSource: BankSource = {
        id: BankSourceId.MONZO,
        displayName: 'Monzo',
        sheetName: 'Monzo',
        hasNativeTransactionId: true,
        isActive: true,
        columnMappings: {
          date: 'Date',
          description: 'Name',
          amount: 'Amount',
          currency: 'Currency',
          transactionId: 'Transaction ID'
        },
        createdAt: new Date('2025-01-01'),
        lastProcessedAt: null
      };

      // Act & Assert - Null is valid for never-processed sources
      expect(() => BankSourceValidator.validate(newSource)).not.toThrow();
    });
  });

  describe('validateColumnMappings - Required mappings (BR-BS-02, BR-BS-03)', () => {
    test('BR-BS-02: Given mappings with all required fields, when validated, then passes', () => {
      // Arrange
      const validMappings: ColumnMapping = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        currency: 'Currency'
      };

      // Act & Assert - BR-BS-02: Required fields must be present
      expect(() => BankSourceValidator.validateColumnMappings(validMappings, false))
        .not.toThrow();
    });

    test('BR-BS-02: Given missing date mapping, when validated, then throws BankSourceValidationError', () => {
      // Arrange
      const missingDate: ColumnMapping = {
        date: '',
        description: 'Description',
        amount: 'Amount',
        currency: 'Currency'
      };

      // Act & Assert - BR-BS-02: date is required
      expect(() => BankSourceValidator.validateColumnMappings(missingDate, false))
        .toThrow("Column mapping 'date' is required");
    });

    test('BR-BS-02: Given missing description mapping, when validated, then throws BankSourceValidationError', () => {
      // Arrange
      const missingDescription = {
        date: 'Date',
        amount: 'Amount',
        currency: 'Currency'
      } as ColumnMapping;

      // Act & Assert - BR-BS-02: description is required
      expect(() => BankSourceValidator.validateColumnMappings(missingDescription, false))
        .toThrow("Column mapping 'description' is required");
    });

    test('BR-BS-02: Given missing amount mapping, when validated, then throws BankSourceValidationError', () => {
      // Arrange
      const missingAmount: ColumnMapping = {
        date: 'Date',
        description: 'Description',
        amount: '   ',
        currency: 'Currency'
      };

      // Act & Assert - BR-BS-02: amount is required
      expect(() => BankSourceValidator.validateColumnMappings(missingAmount, false))
        .toThrow("Column mapping 'amount' is required");
    });

    test('BR-BS-02: Given missing currency mapping, when validated, then throws BankSourceValidationError', () => {
      // Arrange
      const missingCurrency = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount'
      } as ColumnMapping;

      // Act & Assert - BR-BS-02: currency is required
      expect(() => BankSourceValidator.validateColumnMappings(missingCurrency, false))
        .toThrow("Column mapping 'currency' is required");
    });

    test('BR-BS-03: Given bank with native IDs and transactionId mapping, when validated, then passes', () => {
      // Arrange - Monzo has native transaction IDs
      const monzoMappings: ColumnMapping = {
        date: 'Date',
        description: 'Name',
        amount: 'Amount',
        currency: 'Currency',
        transactionId: 'Transaction ID'
      };

      // Act & Assert - BR-BS-03: Native ID banks must have transactionId mapping
      expect(() => BankSourceValidator.validateColumnMappings(monzoMappings, true))
        .not.toThrow();
    });

    test('BR-BS-03: Given bank with native IDs but missing transactionId mapping, when validated, then throws', () => {
      // Arrange - Native ID bank without transactionId mapping
      const invalidMappings: ColumnMapping = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        currency: 'Currency'
      };

      // Act & Assert - BR-BS-03: Transaction ID required for native ID banks
      expect(() => BankSourceValidator.validateColumnMappings(invalidMappings, true))
        .toThrow('Transaction ID column mapping required for banks with native IDs');
    });

    test('BR-BS-03: Given bank without native IDs and no transactionId mapping, when validated, then passes', () => {
      // Arrange - Revolut/Yonder don't have native IDs
      const revolutMappings: ColumnMapping = {
        date: 'Started Date',
        description: 'Description',
        amount: 'Amount',
        currency: 'Currency'
      };

      // Act & Assert - Banks without native IDs don't need transactionId mapping
      expect(() => BankSourceValidator.validateColumnMappings(revolutMappings, false))
        .not.toThrow();
    });

    test('FR-002: Given optional mappings (notes, country, time), when validated, then passes', () => {
      // Arrange - Mappings with optional fields
      const withOptionalFields: ColumnMapping = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        currency: 'Currency',
        notes: 'Notes and #tags',
        country: 'Country',
        time: 'Time',
        type: 'Debit or Credit'
      };

      // Act & Assert - Optional fields are allowed
      expect(() => BankSourceValidator.validateColumnMappings(withOptionalFields, false))
        .not.toThrow();
    });
  });

  describe('areMappingsImmutable - Immutability check (BR-BS-04)', () => {
    test('BR-BS-04: Given source never processed, when checking immutability, then returns false', () => {
      // Arrange - New source
      const newSource: BankSource = {
        id: BankSourceId.MONZO,
        displayName: 'Monzo',
        sheetName: 'Monzo',
        hasNativeTransactionId: true,
        isActive: true,
        columnMappings: {
          date: 'Date',
          description: 'Name',
          amount: 'Amount',
          currency: 'Currency',
          transactionId: 'Transaction ID'
        },
        createdAt: new Date('2025-01-01'),
        lastProcessedAt: null
      };

      // Act
      const result = BankSourceValidator.areMappingsImmutable(newSource);

      // Assert - BR-BS-04: New sources can have mappings changed
      expect(result).toBe(false);
    });

    test('BR-BS-04: Given source processed before, when checking immutability, then returns true', () => {
      // Arrange - Previously processed source
      const processedSource: BankSource = {
        id: BankSourceId.MONZO,
        displayName: 'Monzo',
        sheetName: 'Monzo',
        hasNativeTransactionId: true,
        isActive: true,
        columnMappings: {
          date: 'Date',
          description: 'Name',
          amount: 'Amount',
          currency: 'Currency',
          transactionId: 'Transaction ID'
        },
        createdAt: new Date('2025-01-01'),
        lastProcessedAt: new Date('2025-11-15')
      };

      // Act
      const result = BankSourceValidator.areMappingsImmutable(processedSource);

      // Assert - BR-BS-04: Mappings are immutable once transactions are processed
      expect(result).toBe(true);
    });

    test('UC-005: Given source just processed, when checking immutability, then becomes immutable', () => {
      // Arrange - Source right after first processing
      const source: BankSource = {
        id: BankSourceId.REVOLUT,
        displayName: 'Revolut',
        sheetName: 'Revolut',
        hasNativeTransactionId: false,
        isActive: true,
        columnMappings: {
          date: 'Started Date',
          description: 'Description',
          amount: 'Amount',
          currency: 'Currency'
        },
        createdAt: new Date('2025-01-01'),
        lastProcessedAt: new Date('2025-11-15T14:30:00')
      };

      // Act
      const result = BankSourceValidator.areMappingsImmutable(source);

      // Assert - Once processed, mappings become immutable to protect data integrity
      expect(result).toBe(true);
    });
  });

  describe('BankSourceValidationError - Error structure', () => {
    test('FR-001: Given validation error, when constructed, then is instanceof Error', () => {
      // Arrange & Act
      const error = new BankSourceValidationError('Test error');

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BankSourceValidationError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('BankSourceValidationError');
    });
  });
});
