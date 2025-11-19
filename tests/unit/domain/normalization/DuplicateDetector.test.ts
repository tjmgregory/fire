/**
 * Duplicate Detector Tests
 *
 * Tests duplicate detection functionality per FR-010 and SAD 5.2.7.
 * Validates behaviors required by:
 * - UC-001: Import and Normalize Transactions
 * - UC-005: Execute Scheduled Normalization
 * - FR-010: Transaction Deduplication
 * - FR-012: Source Sheet ID Backfilling
 *
 * Business Rules Tested:
 * - BR-DD-01: Each transaction has a unique identifier (originalTransactionId)
 * - BR-DD-02: System checks for existing transactions before adding new ones
 * - BR-DD-03: Duplicate transactions are skipped with appropriate detection
 * - BR-DD-04: Deduplication works with both bank-native and system-generated IDs
 * - BR-DD-05: Hash-based lookup provides O(1) duplicate detection performance
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  DuplicateDetector,
  DuplicateCheckResult
} from '../../../../src/apps-script/domain/normalization/DuplicateDetector';
import {
  Transaction,
  ProcessingStatus,
  TransactionType,
  CurrencyCode
} from '../../../../src/apps-script/models/Transaction';
import { BankSourceId } from '../../../../src/apps-script/models/BankSource';

describe('DuplicateDetector', () => {
  // Test fixture factory
  function createTestTransaction(overrides: Partial<Transaction> = {}): Transaction {
    return {
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
      processingStatus: ProcessingStatus.NORMALISED,
      errorMessage: null,
      timestampCreated: new Date(),
      timestampLastModified: new Date(),
      timestampNormalised: new Date(),
      timestampCategorised: null,
      ...overrides
    };
  }

  describe('Constructor and Initialization', () => {
    test('UC-005: Given empty transaction set, when detector created, then initializes with empty index', () => {
      // Arrange & Act
      const detector = new DuplicateDetector([]);

      // Assert
      expect(detector.getIndexSize()).toBe(0);
      expect(detector.getStats().uniqueTransactions).toBe(0);
    });

    test('UC-005: Given existing transactions, when detector created, then builds index correctly', () => {
      // Arrange
      const existingTransactions = [
        createTestTransaction({ originalTransactionId: 'tx_001' }),
        createTestTransaction({ originalTransactionId: 'tx_002' }),
        createTestTransaction({ originalTransactionId: 'tx_003' })
      ];

      // Act
      const detector = new DuplicateDetector(existingTransactions);

      // Assert
      expect(detector.getIndexSize()).toBe(3);
      expect(detector.getStats().uniqueTransactions).toBe(3);
    });

    test('BR-DD-01: Given duplicate IDs in initial set, when detector created, then keeps only unique entries', () => {
      // Arrange - Two transactions with same originalTransactionId
      const existingTransactions = [
        createTestTransaction({ originalTransactionId: 'tx_001', description: 'First' }),
        createTestTransaction({ originalTransactionId: 'tx_001', description: 'Duplicate' }),
        createTestTransaction({ originalTransactionId: 'tx_002', description: 'Second' })
      ];

      // Act
      const detector = new DuplicateDetector(existingTransactions);

      // Assert - Hash map keeps last entry, so only 2 unique IDs
      expect(detector.getIndexSize()).toBe(2);
    });
  });

  describe('isDuplicate - Duplicate Detection (BR-DD-02, BR-DD-03)', () => {
    let detector: DuplicateDetector;
    let existingTransaction: Transaction;

    beforeEach(() => {
      existingTransaction = createTestTransaction({
        originalTransactionId: 'tx_existing',
        description: 'Existing Transaction'
      });
      detector = new DuplicateDetector([existingTransaction]);
    });

    test('BR-DD-02: Given existing transaction ID, when checked, then detects as duplicate', () => {
      // Arrange
      const duplicateTransaction = createTestTransaction({
        originalTransactionId: 'tx_existing',
        description: 'Different Description', // Same ID, different details
        originalAmountValue: 99.99
      });

      // Act
      const result = detector.isDuplicate(duplicateTransaction);

      // Assert
      expect(result.isDuplicate).toBe(true);
      expect(result.existingTransaction).toEqual(existingTransaction);
      expect(result.message).toContain('Duplicate transaction found');
      expect(result.message).toContain('tx_existing');
    });

    test('BR-DD-03: Given new transaction ID, when checked, then detects as unique', () => {
      // Arrange
      const newTransaction = createTestTransaction({
        originalTransactionId: 'tx_new',
        description: 'New Transaction'
      });

      // Act
      const result = detector.isDuplicate(newTransaction);

      // Assert
      expect(result.isDuplicate).toBe(false);
      expect(result.existingTransaction).toBeNull();
      expect(result.message).toContain('New transaction');
      expect(result.message).toContain('tx_new');
    });

    test('BR-DD-02: Given transaction checked multiple times, when checking, then updates statistics correctly', () => {
      // Arrange
      const transaction = createTestTransaction({ originalTransactionId: 'tx_existing' });

      // Act
      detector.isDuplicate(transaction); // Should be duplicate (exists in beforeEach)
      detector.isDuplicate(transaction); // Should be duplicate again
      const stats = detector.getStats();

      // Assert
      expect(stats.totalChecked).toBe(2);
      expect(stats.duplicatesFound).toBe(2); // Both checks found duplicates
    });
  });

  describe('register - Transaction Registration', () => {
    test('UC-001: Given new transaction imported, when registered, then adds to index', () => {
      // Arrange
      const detector = new DuplicateDetector([]);
      const newTransaction = createTestTransaction({
        originalTransactionId: 'tx_new'
      });

      // Act
      detector.register(newTransaction);

      // Assert
      expect(detector.getIndexSize()).toBe(1);
      expect(detector.hasTransaction('tx_new')).toBe(true);
    });

    test('Given duplicate registration, when registering same ID twice, then remains idempotent', () => {
      // Arrange
      const detector = new DuplicateDetector([]);
      const transaction = createTestTransaction({
        originalTransactionId: 'tx_001'
      });

      // Act
      detector.register(transaction);
      detector.register(transaction); // Register again

      // Assert - Should still be only 1 entry
      expect(detector.getIndexSize()).toBe(1);
      expect(detector.getStats().uniqueTransactions).toBe(1);
    });

    test('Given multiple unique transactions, when registered sequentially, then all added to index', () => {
      // Arrange
      const detector = new DuplicateDetector([]);
      const transactions = [
        createTestTransaction({ originalTransactionId: 'tx_001' }),
        createTestTransaction({ originalTransactionId: 'tx_002' }),
        createTestTransaction({ originalTransactionId: 'tx_003' })
      ];

      // Act
      transactions.forEach(tx => detector.register(tx));

      // Assert
      expect(detector.getIndexSize()).toBe(3);
      expect(detector.getStats().uniqueTransactions).toBe(3);
    });
  });

  describe('filterDuplicates - Batch Processing (UC-001, UC-005)', () => {
    test('UC-001: Given batch with all unique transactions, when filtered, then returns all', () => {
      // Arrange
      const detector = new DuplicateDetector([]);
      const batch = [
        createTestTransaction({ originalTransactionId: 'tx_001' }),
        createTestTransaction({ originalTransactionId: 'tx_002' }),
        createTestTransaction({ originalTransactionId: 'tx_003' })
      ];

      // Act
      const unique = detector.filterDuplicates(batch);

      // Assert
      expect(unique).toHaveLength(3);
      expect(unique).toEqual(batch);
    });

    test('UC-005: Given batch with some duplicates, when filtered, then returns only unique', () => {
      // Arrange
      const existingTransactions = [
        createTestTransaction({ originalTransactionId: 'tx_001' }),
        createTestTransaction({ originalTransactionId: 'tx_002' })
      ];
      const detector = new DuplicateDetector(existingTransactions);

      const batch = [
        createTestTransaction({ originalTransactionId: 'tx_001' }), // Duplicate
        createTestTransaction({ originalTransactionId: 'tx_003' }), // New
        createTestTransaction({ originalTransactionId: 'tx_002' }), // Duplicate
        createTestTransaction({ originalTransactionId: 'tx_004' })  // New
      ];

      // Act
      const unique = detector.filterDuplicates(batch);

      // Assert
      expect(unique).toHaveLength(2);
      expect(unique[0].originalTransactionId).toBe('tx_003');
      expect(unique[1].originalTransactionId).toBe('tx_004');
    });

    test('BR-DD-03: Given batch with all duplicates, when filtered, then returns empty array', () => {
      // Arrange
      const existingTransactions = [
        createTestTransaction({ originalTransactionId: 'tx_001' }),
        createTestTransaction({ originalTransactionId: 'tx_002' })
      ];
      const detector = new DuplicateDetector(existingTransactions);

      const batch = [
        createTestTransaction({ originalTransactionId: 'tx_001' }),
        createTestTransaction({ originalTransactionId: 'tx_002' })
      ];

      // Act
      const unique = detector.filterDuplicates(batch);

      // Assert
      expect(unique).toHaveLength(0);
    });

    test('UC-001: Given batch filtered, when checking stats, then updates correctly', () => {
      // Arrange
      const detector = new DuplicateDetector([
        createTestTransaction({ originalTransactionId: 'tx_001' })
      ]);

      const batch = [
        createTestTransaction({ originalTransactionId: 'tx_001' }), // Duplicate
        createTestTransaction({ originalTransactionId: 'tx_002' }), // New
        createTestTransaction({ originalTransactionId: 'tx_003' })  // New
      ];

      // Act
      detector.filterDuplicates(batch);
      const stats = detector.getStats();

      // Assert
      expect(stats.totalChecked).toBe(3);
      expect(stats.duplicatesFound).toBe(1);
    });
  });

  describe('Bank-Specific ID Handling (FR-012, BR-DD-04)', () => {
    test('FR-012: Given Monzo transaction with native ID, when checked, then uses bank ID', () => {
      // Arrange
      const detector = new DuplicateDetector([]);
      const monzoTransaction = createTestTransaction({
        bankSourceId: BankSourceId.MONZO,
        originalTransactionId: 'tx_monzo_native_12345' // Bank-native ID
      });

      // Act
      const result = detector.isDuplicate(monzoTransaction);

      // Assert
      expect(result.isDuplicate).toBe(false);
      expect(result.message).toContain('tx_monzo_native_12345');
    });

    test('FR-012: Given Revolut transaction with generated ID, when checked, then uses generated ID', () => {
      // Arrange
      const detector = new DuplicateDetector([]);
      // Revolut doesn't have native IDs, so system generates one
      const revolutTransaction = createTestTransaction({
        bankSourceId: BankSourceId.REVOLUT,
        originalTransactionId: 'REVOLUT-2025-11-15-Tesco-23.45-GBP' // System-generated ID
      });

      // Act
      const result = detector.isDuplicate(revolutTransaction);

      // Assert
      expect(result.isDuplicate).toBe(false);
      expect(result.message).toContain('REVOLUT-2025-11-15-Tesco-23.45-GBP');
    });

    test('FR-012: Given mixed bank sources, when indexed, then all IDs handled correctly', () => {
      // Arrange
      const transactions = [
        createTestTransaction({
          bankSourceId: BankSourceId.MONZO,
          originalTransactionId: 'tx_monzo_001'
        }),
        createTestTransaction({
          bankSourceId: BankSourceId.REVOLUT,
          originalTransactionId: 'REVOLUT-2025-11-15-Shop-10.00-GBP'
        }),
        createTestTransaction({
          bankSourceId: BankSourceId.YONDER,
          originalTransactionId: 'YONDER-2025-11-15-Store-20.00-GBP'
        })
      ];

      // Act
      const detector = new DuplicateDetector(transactions);

      // Assert
      expect(detector.getIndexSize()).toBe(3);
      expect(detector.hasTransaction('tx_monzo_001')).toBe(true);
      expect(detector.hasTransaction('REVOLUT-2025-11-15-Shop-10.00-GBP')).toBe(true);
      expect(detector.hasTransaction('YONDER-2025-11-15-Store-20.00-GBP')).toBe(true);
    });
  });

  describe('Performance and Utility Methods', () => {
    test('BR-DD-05: Given large transaction set, when checking duplicates, then performs efficiently', () => {
      // Arrange - Create 1000 transactions
      const existingTransactions = Array.from({ length: 1000 }, (_, i) =>
        createTestTransaction({
          originalTransactionId: `tx_${String(i).padStart(5, '0')}`
        })
      );
      const detector = new DuplicateDetector(existingTransactions);

      // Act - Check for duplicate (should be O(1) hash lookup)
      const start = Date.now();
      const result = detector.isDuplicate(
        createTestTransaction({ originalTransactionId: 'tx_00500' })
      );
      const duration = Date.now() - start;

      // Assert
      expect(result.isDuplicate).toBe(true);
      expect(duration).toBeLessThan(10); // Hash lookup should be near-instantaneous
    });

    test('Given detector with transactions, when getting transaction by ID, then returns correct transaction', () => {
      // Arrange
      const transaction = createTestTransaction({
        originalTransactionId: 'tx_test',
        description: 'Test Transaction'
      });
      const detector = new DuplicateDetector([transaction]);

      // Act
      const retrieved = detector.getTransaction('tx_test');

      // Assert
      expect(retrieved).toEqual(transaction);
      expect(retrieved?.description).toBe('Test Transaction');
    });

    test('Given detector with transactions, when checking non-existent ID, then returns undefined', () => {
      // Arrange
      const detector = new DuplicateDetector([
        createTestTransaction({ originalTransactionId: 'tx_001' })
      ]);

      // Act
      const retrieved = detector.getTransaction('tx_nonexistent');

      // Assert
      expect(retrieved).toBeUndefined();
    });

    test('Given detector with statistics, when stats reset, then clears counters but preserves index', () => {
      // Arrange
      const detector = new DuplicateDetector([
        createTestTransaction({ originalTransactionId: 'tx_001' })
      ]);
      detector.isDuplicate(createTestTransaction({ originalTransactionId: 'tx_002' }));

      // Act
      detector.resetStats();
      const stats = detector.getStats();

      // Assert
      expect(stats.totalChecked).toBe(0);
      expect(stats.duplicatesFound).toBe(0);
      expect(detector.getIndexSize()).toBe(1); // Index preserved
    });

    test('Given detector with transactions, when cleared, then removes all data', () => {
      // Arrange
      const detector = new DuplicateDetector([
        createTestTransaction({ originalTransactionId: 'tx_001' }),
        createTestTransaction({ originalTransactionId: 'tx_002' })
      ]);

      // Act
      detector.clear();

      // Assert
      expect(detector.getIndexSize()).toBe(0);
      expect(detector.getStats().uniqueTransactions).toBe(0);
      expect(detector.getStats().totalChecked).toBe(0);
    });
  });

  describe('Statistics Tracking', () => {
    test('Given detector operations, when getting stats, then provides accurate metrics', () => {
      // Arrange
      const existingTransactions = [
        createTestTransaction({ originalTransactionId: 'tx_001' }),
        createTestTransaction({ originalTransactionId: 'tx_002' })
      ];
      const detector = new DuplicateDetector(existingTransactions);

      // Act - Perform various operations
      detector.isDuplicate(createTestTransaction({ originalTransactionId: 'tx_001' })); // Duplicate
      detector.isDuplicate(createTestTransaction({ originalTransactionId: 'tx_003' })); // New
      detector.isDuplicate(createTestTransaction({ originalTransactionId: 'tx_002' })); // Duplicate

      const stats = detector.getStats();

      // Assert
      expect(stats.totalChecked).toBe(3);
      expect(stats.duplicatesFound).toBe(2);
      expect(stats.uniqueTransactions).toBe(2); // Original index size
    });

    test('Given stats retrieved, when returned, then provides immutable copy', () => {
      // Arrange
      const detector = new DuplicateDetector([]);
      const stats1 = detector.getStats();

      // Act - Modify returned stats
      stats1.totalChecked = 999;

      // Assert - Original stats unchanged
      const stats2 = detector.getStats();
      expect(stats2.totalChecked).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('Given empty original transaction ID, when checked, then treats as valid key', () => {
      // Arrange
      const detector = new DuplicateDetector([]);
      const transaction = createTestTransaction({ originalTransactionId: '' });

      // Act
      const result = detector.isDuplicate(transaction);

      // Assert - Empty string is technically a valid key
      expect(result.isDuplicate).toBe(false);
    });

    test('Given transactions with special characters in IDs, when indexed, then handles correctly', () => {
      // Arrange
      const transactions = [
        createTestTransaction({ originalTransactionId: 'tx-001/ABC#123' }),
        createTestTransaction({ originalTransactionId: 'tx@email.com' }),
        createTestTransaction({ originalTransactionId: 'tx with spaces' })
      ];

      // Act
      const detector = new DuplicateDetector(transactions);

      // Assert
      expect(detector.getIndexSize()).toBe(3);
      expect(detector.hasTransaction('tx-001/ABC#123')).toBe(true);
      expect(detector.hasTransaction('tx@email.com')).toBe(true);
      expect(detector.hasTransaction('tx with spaces')).toBe(true);
    });
  });
});
