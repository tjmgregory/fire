/**
 * Bank Normalizers Tests
 *
 * Tests business rules from entity-models.md section 2 (BankSource)
 * Validates bank-specific normalization strategies required by:
 * - UC-001: Import and Normalize Transactions
 * - UC-005: Execute Scheduled Normalization
 * - FR-001: Support multiple bank sources
 * - FR-002: Normalize different bank formats
 * - FR-003: Handle banks with native transaction IDs
 * - FR-004: Backfill transaction IDs for banks without native IDs
 *
 * Business Rules Tested:
 * - BR-BS-01: Each source must have a unique identifier
 * - BR-BS-02: Column mappings must include all required fields (date, description, amount, currency)
 * - BR-BS-03: Sources without native transaction IDs require ID backfilling
 * - BR-BS-04: Column mappings are immutable once transactions are processed
 * - BR-BS-05: Banks with native IDs must use them as-is
 * - BR-BS-06: Generated IDs must be deterministic (same input → same ID)
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { MonzoNormalizer } from '../../../../src/apps-script/domain/normalizers/MonzoNormalizer';
import { RevolutNormalizer } from '../../../../src/apps-script/domain/normalizers/RevolutNormalizer';
import { YonderNormalizer } from '../../../../src/apps-script/domain/normalizers/YonderNormalizer';
import { BankSource, ColumnMapping } from '../../../../src/apps-script/models/BankSource';
import { RawRowData } from '../../../../src/apps-script/domain/ports/SheetDataPort';
import { CurrencyCode, ProcessingStatus, TransactionType } from '../../../../src/apps-script/models/Transaction';

// Test fixtures
const createMonzoSource = (): BankSource => ({
  id: 'MONZO',
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
  id: 'REVOLUT',
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
  id: 'YONDER',
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

describe('MonzoNormalizer', () => {
  let normalizer: MonzoNormalizer;
  let source: BankSource;

  beforeEach(() => {
    source = createMonzoSource();
    normalizer = new MonzoNormalizer(source);
  });

  describe('normalize - Monzo-specific behavior (BR-BS-05: Native ID usage)', () => {
    test('UC-005: Given Monzo transaction with native ID, when normalized, then uses native ID as-is', () => {
      // Arrange - Raw Monzo export data
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
      const result = normalizer.normalize(rawData);

      // Assert - BR-BS-05: Banks with native IDs must use them as-is
      expect(result.originalTransactionId).toBe('tx_monzo_12345');
      expect(result.description).toBe('Tesco Metro');
      expect(result.originalAmountValue).toBe(23.45);
      expect(result.originalAmountCurrency).toBe(CurrencyCode.GBP);
      expect(result.notes).toBe('#groceries');
      expect(result.bankSourceId).toBe('MONZO');
      expect(result.processingStatus).toBe(ProcessingStatus.UNPROCESSED);
    });

    test('UC-001: Given Monzo transaction with date and time, when normalized, then combines into full timestamp', () => {
      // Arrange
      const rawData: RawRowData = {
        'Transaction ID': 'tx_monzo_67890',
        'Date': new Date('2025-11-15'),
        'Time': '09:15:30',
        'Name': 'Pret A Manger',
        'Amount': -8.50,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert - Monzo has separate Date and Time columns
      const expectedDate = new Date('2025-11-15');
      expectedDate.setHours(9, 15, 30);
      expect(result.transactionDate.getHours()).toBe(9);
      expect(result.transactionDate.getMinutes()).toBe(15);
      expect(result.transactionDate.getSeconds()).toBe(30);
    });

    test('FR-001: Given Monzo transaction with only date (no time), when normalized, then uses date with default time', () => {
      // Arrange
      const rawData: RawRowData = {
        'Transaction ID': 'tx_monzo_11111',
        'Date': new Date('2025-11-15'),
        'Name': 'Sainsbury\'s',
        'Amount': -45.20,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert - Should handle missing time gracefully
      expect(result.transactionDate).toBeInstanceOf(Date);
      expect(result.transactionDate.toISOString().split('T')[0]).toBe('2025-11-15');
    });

    test('FR-002: Given Monzo debit transaction, when normalized, then type is DEBIT with positive amount', () => {
      // Arrange - Monzo uses negative amounts for debits
      const rawData: RawRowData = {
        'Transaction ID': 'tx_monzo_22222',
        'Date': new Date('2025-11-15'),
        'Name': 'Amazon',
        'Amount': -100.00,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert
      expect(result.transactionType).toBe(TransactionType.DEBIT);
      expect(result.originalAmountValue).toBe(100.00);
    });

    test('FR-002: Given Monzo credit transaction, when normalized, then type is CREDIT with positive amount', () => {
      // Arrange - Monzo uses positive amounts for credits
      const rawData: RawRowData = {
        'Transaction ID': 'tx_monzo_33333',
        'Date': new Date('2025-11-15'),
        'Name': 'Salary',
        'Amount': 2500.00,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert
      expect(result.transactionType).toBe(TransactionType.CREDIT);
      expect(result.originalAmountValue).toBe(2500.00);
    });

    test('FR-001: Given Monzo multi-currency transaction, when normalized, then preserves original currency', () => {
      // Arrange - Foreign currency transaction
      const rawData: RawRowData = {
        'Transaction ID': 'tx_monzo_44444',
        'Date': new Date('2025-11-10'),
        'Name': 'Hotel Paris',
        'Amount': -120.00,
        'Currency': 'EUR'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert - Original currency preserved, GBP amount will be set by currency converter
      expect(result.originalAmountCurrency).toBe(CurrencyCode.EUR);
      expect(result.originalAmountValue).toBe(120.00);
      expect(result.gbpAmountValue).toBe(0); // Will be set by currency converter
      expect(result.exchangeRateValue).toBeNull(); // Will be set by currency converter
    });
  });
});

describe('RevolutNormalizer', () => {
  let normalizer: RevolutNormalizer;
  let source: BankSource;

  beforeEach(() => {
    source = createRevolutSource();
    normalizer = new RevolutNormalizer(source);
  });

  describe('normalize - Revolut-specific behavior (BR-BS-03, BR-BS-06: ID backfilling)', () => {
    test('UC-005: Given Revolut transaction without native ID, when normalized, then generates deterministic ID', () => {
      // Arrange - Revolut does not provide transaction IDs
      const rawData: RawRowData = {
        'Started Date': new Date('2025-11-15'),
        'Completed Date': '2025-11-15',
        'Description': 'Uber Trip',
        'Amount': -15.50,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert - BR-BS-03: Sources without native IDs require ID backfilling
      expect(result.originalTransactionId).toBeDefined();
      expect(result.originalTransactionId).not.toBe('');
      expect(result.originalTransactionId).toMatch(/^[0-9a-f]+$/); // Hex hash format
    });

    test('BR-BS-06: Given same Revolut transaction data, when normalized twice, then generates identical IDs', () => {
      // Arrange - Same transaction data
      const rawData: RawRowData = {
        'Started Date': new Date('2025-11-15'),
        'Description': 'Uber Trip',
        'Amount': -15.50,
        'Currency': 'GBP'
      };

      // Act - Normalize twice
      const result1 = normalizer.normalize(rawData);
      const result2 = normalizer.normalize(rawData);

      // Assert - BR-BS-06: Generated IDs must be deterministic
      expect(result1.originalTransactionId).toBe(result2.originalTransactionId);
    });

    test('FR-002: Given Revolut transaction with completed date, when normalized, then prefers completed over started date', () => {
      // Arrange - Revolut has both Started Date and Completed Date
      const startedDate = new Date('2025-11-14');
      const completedDate = '2025-11-15';
      const rawData: RawRowData = {
        'Started Date': startedDate,
        'Completed Date': completedDate,
        'Description': 'Transfer',
        'Amount': -50.00,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert - Should use completed date when available
      expect(result.transactionDate.toISOString().split('T')[0]).toBe('2025-11-15');
    });

    test('FR-002: Given Revolut transaction without completed date, when normalized, then uses started date', () => {
      // Arrange - No completed date
      const rawData: RawRowData = {
        'Started Date': new Date('2025-11-14'),
        'Description': 'Pending Transfer',
        'Amount': -25.00,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert - Falls back to started date
      expect(result.transactionDate.toISOString().split('T')[0]).toBe('2025-11-14');
    });

    test('FR-001: Given Revolut multi-currency transaction, when normalized, then preserves original currency', () => {
      // Arrange - USD transaction
      const rawData: RawRowData = {
        'Started Date': new Date('2025-11-10'),
        'Description': 'Amazon.com',
        'Amount': -49.99,
        'Currency': 'USD'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert
      expect(result.originalAmountCurrency).toBe(CurrencyCode.USD);
      expect(result.originalAmountValue).toBe(49.99);
      expect(result.gbpAmountValue).toBe(0); // Will be set by currency converter
    });

    test('UC-001: Given Revolut transaction, when normalized, then sets notes to null (not supported)', () => {
      // Arrange - Revolut doesn't have notes field
      const rawData: RawRowData = {
        'Started Date': new Date('2025-11-15'),
        'Description': 'Coffee Shop',
        'Amount': -4.50,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert
      expect(result.notes).toBeNull();
      expect(result.country).toBeNull();
    });
  });
});

describe('YonderNormalizer', () => {
  let normalizer: YonderNormalizer;
  let source: BankSource;

  beforeEach(() => {
    source = createYonderSource();
    normalizer = new YonderNormalizer(source);
  });

  describe('normalize - Yonder-specific behavior (BR-BS-03: ID backfilling, GBP-only)', () => {
    test('UC-005: Given Yonder transaction without native ID, when normalized, then generates deterministic ID', () => {
      // Arrange - Yonder does not provide transaction IDs
      const rawData: RawRowData = {
        'Date/Time of transaction': new Date('2025-11-15T14:30:00'),
        'Description': 'John Lewis',
        'Amount (GBP)': 89.99,
        'Currency': 'GBP',
        'Debit or Credit': 'Debit',
        'Country': 'United Kingdom'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert - BR-BS-03: Sources without native IDs require ID backfilling
      expect(result.originalTransactionId).toBeDefined();
      expect(result.originalTransactionId).toMatch(/^[0-9a-f]+$/);
    });

    test('BR-BS-06: Given same Yonder transaction data, when normalized twice, then generates identical IDs', () => {
      // Arrange
      const rawData: RawRowData = {
        'Date/Time of transaction': new Date('2025-11-15T14:30:00'),
        'Description': 'John Lewis',
        'Amount (GBP)': 89.99,
        'Currency': 'GBP',
        'Debit or Credit': 'Debit'
      };

      // Act
      const result1 = normalizer.normalize(rawData);
      const result2 = normalizer.normalize(rawData);

      // Assert - BR-BS-06: Deterministic ID generation
      expect(result1.originalTransactionId).toBe(result2.originalTransactionId);
    });

    test('FR-002: Given Yonder transaction with explicit DEBIT type, when normalized, then respects type column', () => {
      // Arrange - Yonder has explicit "Debit or Credit" column
      const rawData: RawRowData = {
        'Date/Time of transaction': new Date('2025-11-15'),
        'Description': 'Waitrose',
        'Amount (GBP)': 34.50,
        'Currency': 'GBP',
        'Debit or Credit': 'Debit'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert - Uses explicit type from column
      expect(result.transactionType).toBe(TransactionType.DEBIT);
      expect(result.originalAmountValue).toBe(34.50);
    });

    test('FR-002: Given Yonder transaction with explicit CREDIT type, when normalized, then respects type column', () => {
      // Arrange
      const rawData: RawRowData = {
        'Date/Time of transaction': new Date('2025-11-15'),
        'Description': 'Refund',
        'Amount (GBP)': 25.00,
        'Currency': 'GBP',
        'Debit or Credit': 'Credit'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert
      expect(result.transactionType).toBe(TransactionType.CREDIT);
    });

    test('FR-002: Given Yonder transaction with invalid type, when normalized, then falls back to amount-based detection', () => {
      // Arrange - Invalid type value
      const rawData: RawRowData = {
        'Date/Time of transaction': new Date('2025-11-15'),
        'Description': 'Unknown',
        'Amount (GBP)': -50.00,
        'Currency': 'GBP',
        'Debit or Credit': 'INVALID'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert - Falls back to amount-based logic
      expect(result.transactionType).toBe(TransactionType.DEBIT);
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
      const result = normalizer.normalize(rawData);

      // Assert - Yonder is GBP-only, no conversion needed
      expect(result.originalAmountCurrency).toBe(CurrencyCode.GBP);
      expect(result.originalAmountValue).toBe(42.30);
      expect(result.gbpAmountValue).toBe(42.30); // Already in GBP
      expect(result.exchangeRateValue).toBeNull(); // No conversion needed
    });

    test('UC-001: Given Yonder transaction with country, when normalized, then preserves country field', () => {
      // Arrange - Yonder includes country information
      const rawData: RawRowData = {
        'Date/Time of transaction': new Date('2025-11-15'),
        'Description': 'Hotel',
        'Amount (GBP)': 150.00,
        'Currency': 'GBP',
        'Debit or Credit': 'Debit',
        'Country': 'France'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert
      expect(result.country).toBe('France');
    });

    test('UC-001: Given Yonder transaction without country, when normalized, then country is null', () => {
      // Arrange
      const rawData: RawRowData = {
        'Date/Time of transaction': new Date('2025-11-15'),
        'Description': 'Local Shop',
        'Amount (GBP)': 12.50,
        'Currency': 'GBP',
        'Debit or Credit': 'Debit'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert
      expect(result.country).toBeNull();
    });
  });
});

describe('BankNormalizer - Cross-cutting concerns', () => {
  describe('Column mapping (BR-BS-02: Required fields)', () => {
    test('BR-BS-02: Given normalizer with valid column mappings, when normalizing, then maps fields correctly', () => {
      // Arrange
      const source = createMonzoSource();
      const normalizer = new MonzoNormalizer(source);
      const rawData: RawRowData = {
        'Transaction ID': 'tx_12345',
        'Date': new Date('2025-11-15'),
        'Name': 'Test Merchant',
        'Amount': -10.00,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert - All required fields mapped
      expect(result.transactionDate).toBeInstanceOf(Date);
      expect(result.description).toBe('Test Merchant');
      expect(result.originalAmountValue).toBe(10.00);
      expect(result.originalAmountCurrency).toBe(CurrencyCode.GBP);
    });
  });

  describe('Transaction lifecycle (UC-001, UC-005)', () => {
    test('UC-001: Given any normalized transaction, when created, then starts with UNPROCESSED status', () => {
      // Arrange
      const sources = [
        { normalizer: new MonzoNormalizer(createMonzoSource()), data: { 'Transaction ID': 'tx1', 'Date': new Date(), 'Name': 'Test', 'Amount': -10, 'Currency': 'GBP' }},
        { normalizer: new RevolutNormalizer(createRevolutSource()), data: { 'Started Date': new Date(), 'Description': 'Test', 'Amount': -10, 'Currency': 'GBP' }},
        { normalizer: new YonderNormalizer(createYonderSource()), data: { 'Date/Time of transaction': new Date(), 'Description': 'Test', 'Amount (GBP)': 10, 'Currency': 'GBP', 'Debit or Credit': 'Debit' }}
      ];

      // Act & Assert
      sources.forEach(({ normalizer, data }) => {
        const result = normalizer.normalize(data);
        expect(result.processingStatus).toBe(ProcessingStatus.UNPROCESSED);
        expect(result.timestampNormalised).toBeNull();
        expect(result.timestampCategorised).toBeNull();
        expect(result.categoryAiId).toBeNull();
        expect(result.categoryManualId).toBeNull();
      });
    });

    test('UC-005: Given normalized transaction, when created, then sets creation timestamps', () => {
      // Arrange
      const source = createMonzoSource();
      const normalizer = new MonzoNormalizer(source);
      const rawData: RawRowData = {
        'Transaction ID': 'tx_99999',
        'Date': new Date('2025-11-15'),
        'Name': 'Test',
        'Amount': -10.00,
        'Currency': 'GBP'
      };

      // Act
      const result = normalizer.normalize(rawData);

      // Assert
      expect(result.timestampCreated).toBeInstanceOf(Date);
      expect(result.timestampLastModified).toBeInstanceOf(Date);
      expect(result.errorMessage).toBeNull();
    });
  });

  describe('Entity identity (BR-T-01: Unique IDs)', () => {
    test('BR-T-01: Given normalized transaction, when created, then generates unique UUID', () => {
      // Arrange
      const source = createMonzoSource();
      const normalizer = new MonzoNormalizer(source);
      const rawData: RawRowData = {
        'Transaction ID': 'tx_test',
        'Date': new Date('2025-11-15'),
        'Name': 'Test',
        'Amount': -10.00,
        'Currency': 'GBP'
      };

      // Act
      const result1 = normalizer.normalize(rawData);
      const result2 = normalizer.normalize(rawData);

      // Assert - Each transaction gets unique UUID
      expect(result1.id).toBeDefined();
      expect(result2.id).toBeDefined();
      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });
});
