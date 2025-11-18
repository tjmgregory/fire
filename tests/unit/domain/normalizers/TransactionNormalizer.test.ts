/**
 * Transaction Normalizer Tests
 *
 * Tests the orchestration of bank-specific normalization strategies.
 * Validates requirements from use-cases.md (UC-001, UC-005) and
 * requirements-catalogue.md (FR-001, FR-002, FR-012).
 *
 * Business Rules Tested:
 * - Strategy pattern implementation for bank-specific normalization
 * - Factory pattern for normalizer creation
 * - ID backfilling detection for sources without native IDs
 * - Error handling for unsupported bank sources
 *
 * Requirements Tested:
 * - FR-001: Transaction Normalization from multiple sources
 * - FR-002: Concurrent Transaction Handling
 * - FR-012: Source Sheet ID Backfilling
 * - UC-001: Import and Normalize Transactions
 * - UC-005: Execute Scheduled Normalization
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { TransactionNormalizer } from '../../../../src/apps-script/domain/normalizers/TransactionNormalizer';
import { BankSource } from '../../../../src/apps-script/models/BankSource';
import { BankSourceId, CurrencyCode, ProcessingStatus, TransactionType } from '../../../../src/apps-script/models/Transaction';
import { RawRowData } from '../../../../src/apps-script/domain/ports/SheetDataPort';

// Test fixtures
const createMonzoSource = (): BankSource => ({
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
});

const createRevolutSource = (): BankSource => ({
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
});

const createYonderSource = (): BankSource => ({
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
});

describe('TransactionNormalizer', () => {
  let normalizer: TransactionNormalizer;
  let sources: BankSource[];

  beforeEach(() => {
    sources = [
      createMonzoSource(),
      createRevolutSource(),
      createYonderSource()
    ];
    normalizer = new TransactionNormalizer(sources);
  });

  describe('Constructor and Initialization', () => {
    test('UC-001: Given multiple bank sources, when TransactionNormalizer created, then registers normalizer for each source', () => {
      // Arrange - sources created in beforeEach

      // Act
      const registeredSources = normalizer.getRegisteredSources();

      // Assert - All three sources should be registered
      expect(registeredSources).toHaveLength(3);
      expect(registeredSources).toContain(BankSourceId.MONZO);
      expect(registeredSources).toContain(BankSourceId.REVOLUT);
      expect(registeredSources).toContain(BankSourceId.YONDER);
    });

    test('FR-001: Given empty sources array, when TransactionNormalizer created, then creates instance with no normalizers', () => {
      // Arrange
      const emptySources: BankSource[] = [];

      // Act
      const emptyNormalizer = new TransactionNormalizer(emptySources);

      // Assert
      expect(emptyNormalizer.getRegisteredSources()).toHaveLength(0);
    });

    test('FR-001: Given single bank source, when TransactionNormalizer created, then registers only that source', () => {
      // Arrange
      const singleSource = [createMonzoSource()];

      // Act
      const singleNormalizer = new TransactionNormalizer(singleSource);

      // Assert
      expect(singleNormalizer.getRegisteredSources()).toHaveLength(1);
      expect(singleNormalizer.getRegisteredSources()[0]).toBe(BankSourceId.MONZO);
    });
  });

  describe('normalize - Monzo transactions', () => {
    test('UC-001: Given Monzo transaction data, when normalized, then delegates to MonzoNormalizer', () => {
      // Arrange - Raw Monzo export
      const rawData: RawRowData = {
        'Transaction ID': 'tx_monzo_12345',
        'Date': new Date('2025-11-15'),
        'Time': '14:30:00',
        'Name': 'Tesco Metro',
        'Amount': -23.45,
        'Currency': 'GBP',
        'Notes and #tags': '#groceries'
      };

      // Act
      const result = normalizer.normalize(rawData, BankSourceId.MONZO);

      // Assert - MonzoNormalizer was used
      expect(result.bankSourceId).toBe(BankSourceId.MONZO);
      expect(result.originalTransactionId).toBe('tx_monzo_12345');
      expect(result.description).toBe('Tesco Metro');
      expect(result.originalAmountValue).toBe(23.45);
      expect(result.notes).toBe('#groceries');
      expect(result.processingStatus).toBe(ProcessingStatus.UNPROCESSED);
    });

    test('FR-002: Given Monzo transaction with multi-currency, when normalized, then preserves original currency', () => {
      // Arrange
      const rawData: RawRowData = {
        'Transaction ID': 'tx_monzo_67890',
        'Date': new Date('2025-11-10'),
        'Name': 'Hotel Paris',
        'Amount': -120.00,
        'Currency': 'EUR'
      };

      // Act
      const result = normalizer.normalize(rawData, BankSourceId.MONZO);

      // Assert
      expect(result.originalAmountCurrency).toBe(CurrencyCode.EUR);
      expect(result.originalAmountValue).toBe(120.00);
      expect(result.gbpAmountValue).toBe(0); // Will be set by currency converter
    });
  });

  describe('normalize - Revolut transactions', () => {
    test('UC-005: Given Revolut transaction data, when normalized, then delegates to RevolutNormalizer', () => {
      // Arrange - Revolut does not have native transaction IDs
      const rawData: RawRowData = {
        'Started Date': new Date('2025-11-15'),
        'Completed Date': '2025-11-15',
        'Description': 'Uber Trip',
        'Amount': -15.50,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData, BankSourceId.REVOLUT);

      // Assert - RevolutNormalizer was used
      expect(result.bankSourceId).toBe(BankSourceId.REVOLUT);
      expect(result.description).toBe('Uber Trip');
      expect(result.originalAmountValue).toBe(15.50);
      expect(result.originalTransactionId).toBeDefined(); // Generated ID
      expect(result.originalTransactionId).toMatch(/^[0-9a-f]+$/); // Hex format
    });

    test('FR-012: Given Revolut transaction, when normalized, then generates deterministic ID', () => {
      // Arrange - Same transaction data
      const rawData: RawRowData = {
        'Started Date': new Date('2025-11-15'),
        'Description': 'Coffee Shop',
        'Amount': -4.50,
        'Currency': 'GBP'
      };

      // Act - Normalize twice
      const result1 = normalizer.normalize(rawData, BankSourceId.REVOLUT);
      const result2 = normalizer.normalize(rawData, BankSourceId.REVOLUT);

      // Assert - FR-012: IDs must be deterministic for duplicate detection
      expect(result1.originalTransactionId).toBe(result2.originalTransactionId);
    });
  });

  describe('normalize - Yonder transactions', () => {
    test('UC-001: Given Yonder transaction data, when normalized, then delegates to YonderNormalizer', () => {
      // Arrange - Yonder has explicit debit/credit type
      const rawData: RawRowData = {
        'Date/Time of transaction': new Date('2025-11-15T14:30:00'),
        'Description': 'John Lewis',
        'Amount (GBP)': 89.99,
        'Currency': 'GBP',
        'Debit or Credit': 'Debit',
        'Country': 'United Kingdom'
      };

      // Act
      const result = normalizer.normalize(rawData, BankSourceId.YONDER);

      // Assert - YonderNormalizer was used
      expect(result.bankSourceId).toBe(BankSourceId.YONDER);
      expect(result.description).toBe('John Lewis');
      expect(result.originalAmountValue).toBe(89.99);
      expect(result.transactionType).toBe(TransactionType.DEBIT);
      expect(result.country).toBe('United Kingdom');
      expect(result.originalTransactionId).toBeDefined(); // Generated ID
    });

    test('FR-001: Given Yonder GBP-only transaction, when normalized, then sets GBP amount immediately', () => {
      // Arrange - Yonder only deals in GBP
      const rawData: RawRowData = {
        'Date/Time of transaction': new Date('2025-11-15'),
        'Description': 'M&S',
        'Amount (GBP)': 42.30,
        'Currency': 'GBP',
        'Debit or Credit': 'Debit'
      };

      // Act
      const result = normalizer.normalize(rawData, BankSourceId.YONDER);

      // Assert - No conversion needed for GBP
      expect(result.originalAmountCurrency).toBe(CurrencyCode.GBP);
      expect(result.gbpAmountValue).toBe(42.30);
      expect(result.exchangeRateValue).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('FR-001: Given unregistered source ID, when normalized, then throws descriptive error', () => {
      // Arrange
      const rawData: RawRowData = {
        'Date': new Date('2025-11-15'),
        'Description': 'Test Transaction',
        'Amount': -10.00,
        'Currency': 'GBP'
      };

      // Act & Assert
      expect(() => {
        normalizer.normalize(rawData, 'UNKNOWN_BANK' as BankSourceId);
      }).toThrow(/No normalizer registered for source: UNKNOWN_BANK/);
    });

    test('FR-001: Given error message for unregistered source, when thrown, then includes available sources', () => {
      // Arrange
      const rawData: RawRowData = {};

      // Act & Assert
      try {
        normalizer.normalize(rawData, 'FAKE_BANK' as BankSourceId);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('MONZO');
        expect(error.message).toContain('REVOLUT');
        expect(error.message).toContain('YONDER');
      }
    });
  });

  describe('requiresIdBackfilling - FR-012 ID Backfilling Detection', () => {
    test('FR-012: Given Monzo source (has native IDs), when checked, then does not require backfilling', () => {
      // Arrange - Monzo has native transaction IDs

      // Act
      const requiresBackfilling = normalizer.requiresIdBackfilling(BankSourceId.MONZO);

      // Assert - Should NOT require backfilling
      expect(requiresBackfilling).toBe(false);
    });

    test('FR-012: Given Revolut source (no native IDs), when checked, then requires backfilling', () => {
      // Arrange - Revolut does not have native transaction IDs

      // Act
      const requiresBackfilling = normalizer.requiresIdBackfilling(BankSourceId.REVOLUT);

      // Assert - Should require backfilling per FR-012
      expect(requiresBackfilling).toBe(true);
    });

    test('FR-012: Given Yonder source (no native IDs), when checked, then requires backfilling', () => {
      // Arrange - Yonder does not have native transaction IDs

      // Act
      const requiresBackfilling = normalizer.requiresIdBackfilling(BankSourceId.YONDER);

      // Assert - Should require backfilling per FR-012
      expect(requiresBackfilling).toBe(true);
    });

    test('FR-012: Given unknown source ID, when checked for backfilling, then throws error', () => {
      // Arrange
      const unknownSource = 'UNKNOWN_BANK' as BankSourceId;

      // Act & Assert
      expect(() => {
        normalizer.requiresIdBackfilling(unknownSource);
      }).toThrow(/Unknown source: UNKNOWN_BANK/);
    });
  });

  describe('Multi-bank Processing (FR-001, UC-001)', () => {
    test('UC-001: Given transactions from all three banks, when normalized, then processes each with correct normalizer', () => {
      // Arrange - Transactions from all three sources
      const monzoData: RawRowData = {
        'Transaction ID': 'tx_monzo_111',
        'Date': new Date('2025-11-15'),
        'Name': 'Tesco',
        'Amount': -10.00,
        'Currency': 'GBP'
      };

      const revolutData: RawRowData = {
        'Started Date': new Date('2025-11-15'),
        'Description': 'Uber',
        'Amount': -15.00,
        'Currency': 'GBP'
      };

      const yonderData: RawRowData = {
        'Date/Time of transaction': new Date('2025-11-15'),
        'Description': 'Sainsbury\'s',
        'Amount (GBP)': 20.00,
        'Currency': 'GBP',
        'Debit or Credit': 'Debit'
      };

      // Act
      const monzoResult = normalizer.normalize(monzoData, BankSourceId.MONZO);
      const revolutResult = normalizer.normalize(revolutData, BankSourceId.REVOLUT);
      const yonderResult = normalizer.normalize(yonderData, BankSourceId.YONDER);

      // Assert - Each transaction processed by correct normalizer
      expect(monzoResult.bankSourceId).toBe(BankSourceId.MONZO);
      expect(monzoResult.originalTransactionId).toBe('tx_monzo_111'); // Native ID

      expect(revolutResult.bankSourceId).toBe(BankSourceId.REVOLUT);
      expect(revolutResult.originalTransactionId).toMatch(/^[0-9a-f]+$/); // Generated ID

      expect(yonderResult.bankSourceId).toBe(BankSourceId.YONDER);
      expect(yonderResult.originalTransactionId).toMatch(/^[0-9a-f]+$/); // Generated ID

      // All should be UNPROCESSED initially
      expect(monzoResult.processingStatus).toBe(ProcessingStatus.UNPROCESSED);
      expect(revolutResult.processingStatus).toBe(ProcessingStatus.UNPROCESSED);
      expect(yonderResult.processingStatus).toBe(ProcessingStatus.UNPROCESSED);
    });
  });
});
