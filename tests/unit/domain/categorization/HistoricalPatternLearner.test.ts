/**
 * Historical Pattern Learner Tests
 *
 * Tests historical transaction learning per FR-014.
 * Validates behaviors required by:
 * - FR-014: Historical Transaction Learning
 *
 * Business Rules Tested:
 * - BR-LEARN-01: Exact merchant matching has highest priority
 * - BR-LEARN-02: Fuzzy merchant matching uses Jaccard similarity
 * - BR-LEARN-03: Amount range matching uses configurable tolerance
 * - BR-LEARN-04: Manual overrides are weighted 2x
 * - BR-LEARN-05: Only last 90 days of transactions are considered
 * - BR-LEARN-06: Only categorized transactions are used for learning
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  HistoricalPatternLearner,
  DEFAULT_LEARNER_CONFIG,
  LearnerConfig,
  SimilarityMatch
} from '../../../../src/apps-script/domain/categorization/HistoricalPatternLearner';
import {
  Transaction,
  ProcessingStatus,
  TransactionType,
  CurrencyCode,
  BankSourceId
} from '../../../../src/apps-script/models/Transaction';

describe('HistoricalPatternLearner', () => {
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
      categoryAiId: 'cat-groceries',
      categoryAiName: 'Groceries',
      categoryConfidenceScore: 85,
      categoryManualId: null,
      categoryManualName: null,
      processingStatus: ProcessingStatus.CATEGORISED,
      errorMessage: null,
      timestampCreated: new Date(),
      timestampLastModified: new Date(),
      timestampNormalised: new Date(),
      timestampCategorised: new Date(),
      ...overrides
    };
  }

  let learner: HistoricalPatternLearner;

  beforeEach(() => {
    learner = new HistoricalPatternLearner(DEFAULT_LEARNER_CONFIG);
  });

  describe('Exact Merchant Matching', () => {
    test('should find exact match with normalized descriptions', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'TESCO METRO', // Different case
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [historicalTransaction],
        5
      );

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('exact');
      expect(matches[0].score).toBe(100);
      expect(matches[0].pattern.categoryId).toBe('cat-groceries');
    });

    test('should normalize whitespace and punctuation for exact matching', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Marks & Spencer',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'MARKS  &  SPENCER!',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [historicalTransaction],
        5
      );

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('exact');
      expect(matches[0].score).toBe(100);
    });

    test('should not match different merchants', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Sainsburys',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [historicalTransaction],
        5
      );

      // Assert: Should only match if fuzzy or amount matching applies
      const exactMatches = matches.filter(m => m.matchType === 'exact');
      expect(exactMatches).toHaveLength(0);
    });
  });

  describe('Fuzzy Merchant Matching', () => {
    test('should find fuzzy match using Jaccard similarity', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro Oxford Street London',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Tesco Express Oxford Street London',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [historicalTransaction],
        5
      );

      // Assert
      // Tokens: {tesco, metro, oxford, street, london} vs {tesco, express, oxford, street, london}
      // Intersection: {tesco, oxford, street, london} = 4
      // Union: {tesco, metro, express, oxford, street, london} = 6
      // Jaccard = 4/6 = 0.67 = 67% (above 60% threshold)
      const fuzzyMatches = matches.filter(m => m.matchType === 'fuzzy');
      expect(fuzzyMatches.length).toBeGreaterThan(0);
      expect(fuzzyMatches[0].score).toBeGreaterThanOrEqual(DEFAULT_LEARNER_CONFIG.fuzzyMatchThreshold);
      expect(fuzzyMatches[0].pattern.categoryId).toBe('cat-groceries');
    });

    test('should not match below fuzzy threshold', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Completely Different Store Name',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [historicalTransaction],
        5
      );

      // Assert
      const fuzzyMatches = matches.filter(m => m.matchType === 'fuzzy');
      expect(fuzzyMatches).toHaveLength(0);
    });

    test('should calculate Jaccard similarity correctly', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Apple Store Regent Street London UK',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Apple Store Regent Street Manchester UK',
        categoryAiId: 'cat-electronics',
        categoryAiName: 'Electronics',
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [historicalTransaction],
        5
      );

      // Assert
      // Tokens: {apple, store, regent, street, london, uk} vs {apple, store, regent, street, manchester, uk}
      // Intersection: {apple, store, regent, street, uk} = 5
      // Union: {apple, store, regent, street, london, manchester, uk} = 7
      // Jaccard = 5/7 = 0.71 = 71% (above 60% threshold)
      const fuzzyMatches = matches.filter(m => m.matchType === 'fuzzy');
      expect(fuzzyMatches.length).toBeGreaterThan(0);
    });
  });

  describe('Amount Range Matching', () => {
    test('should match transactions within amount tolerance', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Different Merchant',
        gbpAmountValue: 100.00,
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Another Merchant',
        gbpAmountValue: 105.00, // Within 10% tolerance
        categoryAiId: 'cat-utilities',
        categoryAiName: 'Utilities',
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [historicalTransaction],
        5
      );

      // Assert
      const amountMatches = matches.filter(m => m.matchType === 'amount_range');
      expect(amountMatches.length).toBeGreaterThan(0);
      expect(amountMatches[0].pattern.categoryId).toBe('cat-utilities');
    });

    test('should not match transactions outside amount tolerance', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Different Merchant',
        gbpAmountValue: 100.00,
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Another Merchant',
        gbpAmountValue: 150.00, // Outside 10% tolerance
        categoryAiId: 'cat-utilities',
        categoryAiName: 'Utilities',
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [historicalTransaction],
        5
      );

      // Assert
      const amountMatches = matches.filter(m => m.matchType === 'amount_range');
      expect(amountMatches).toHaveLength(0);
    });

    test('should score closer amounts higher', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Merchant',
        gbpAmountValue: 100.00,
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransactions = [
        createTestTransaction({
          id: 'hist-1',
          description: 'Merchant A',
          gbpAmountValue: 100.00, // Exact match
          categoryAiId: 'cat-a',
          categoryAiName: 'Category A',
          transactionDate: new Date('2025-11-01')
        }),
        createTestTransaction({
          id: 'hist-2',
          description: 'Merchant B',
          gbpAmountValue: 109.00, // Near edge of tolerance
          categoryAiId: 'cat-b',
          categoryAiName: 'Category B',
          transactionDate: new Date('2025-11-01')
        })
      ];

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        historicalTransactions,
        5
      );

      // Assert
      const amountMatches = matches.filter(m => m.matchType === 'amount_range');
      expect(amountMatches.length).toBe(2);

      const exactAmountMatch = amountMatches.find(m => m.pattern.amountGbp === 100.00);
      const nearEdgeMatch = amountMatches.find(m => m.pattern.amountGbp === 109.00);

      expect(exactAmountMatch!.score).toBeGreaterThan(nearEdgeMatch!.score);
    });
  });

  describe('Manual Override Weighting', () => {
    test('should weight manual overrides 2x higher', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const aiCategorized = createTestTransaction({
        id: 'hist-1',
        description: 'Tesco Metro',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        categoryManualId: null,
        categoryManualName: null,
        transactionDate: new Date('2025-11-01')
      });

      const manualOverride = createTestTransaction({
        id: 'hist-2',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryManualId: 'cat-groceries',
        categoryManualName: 'Groceries',
        transactionDate: new Date('2025-11-02')
      });

      // Act
      const aiMatches = learner.findSimilarPatterns(targetTransaction, [aiCategorized], 5);
      const manualMatches = learner.findSimilarPatterns(targetTransaction, [manualOverride], 5);

      // Assert
      expect(aiMatches[0].score).toBe(manualMatches[0].score); // Same base score
      expect(manualMatches[0].weightedScore).toBe(aiMatches[0].weightedScore * 2); // 2x weighted
    });

    test('should prioritize manual override when suggesting category', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Ambiguous Transaction',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransactions = [
        // 2 AI categorizations for Category A (score: 2 × 100 = 200)
        createTestTransaction({
          id: 'hist-1',
          description: 'Ambiguous Transaction',
          categoryAiId: 'cat-a',
          categoryAiName: 'Category A',
          categoryManualId: null,
          categoryManualName: null,
          transactionDate: new Date('2025-11-01')
        }),
        createTestTransaction({
          id: 'hist-2',
          description: 'Ambiguous Transaction',
          categoryAiId: 'cat-a',
          categoryAiName: 'Category A',
          categoryManualId: null,
          categoryManualName: null,
          transactionDate: new Date('2025-11-02')
        }),
        // 2 manual overrides for Category B (score: 2 × 100 × 2 = 400)
        createTestTransaction({
          id: 'hist-3',
          description: 'Ambiguous Transaction',
          categoryAiId: null,
          categoryAiName: null,
          categoryManualId: 'cat-b',
          categoryManualName: 'Category B',
          transactionDate: new Date('2025-11-03')
        }),
        createTestTransaction({
          id: 'hist-4',
          description: 'Ambiguous Transaction',
          categoryAiId: null,
          categoryAiName: null,
          categoryManualId: 'cat-b',
          categoryManualName: 'Category B',
          transactionDate: new Date('2025-11-04')
        })
      ];

      // Act
      const matches = learner.findSimilarPatterns(targetTransaction, historicalTransactions, 5);
      const suggestion = learner.getSuggestedCategory(matches);

      // Assert
      // Manual overrides (2 × 200 = 400) should beat AI categorizations (2 × 100 = 200)
      expect(suggestion).not.toBeNull();
      expect(suggestion!.categoryId).toBe('cat-b');
    });
  });

  describe('90-Day Lookback Window', () => {
    test('should only include transactions within 90 days', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        transactionDate: new Date('2025-11-15'),
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const recentTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Tesco Metro',
        transactionDate: new Date('2025-08-20'), // 87 days ago - within window
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries'
      });

      const oldTransaction = createTestTransaction({
        id: 'hist-2',
        description: 'Tesco Metro',
        transactionDate: new Date('2025-07-01'), // 137 days ago - outside window
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries'
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [recentTransaction, oldTransaction],
        5
      );

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern.transactionDate).toEqual(recentTransaction.transactionDate);
    });

    test('should respect custom lookback configuration', () => {
      // Arrange
      const customConfig: LearnerConfig = {
        ...DEFAULT_LEARNER_CONFIG,
        lookbackDays: 30 // Only 30 days
      };
      const customLearner = new HistoricalPatternLearner(customConfig);

      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        transactionDate: new Date('2025-11-15'),
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const within30Days = createTestTransaction({
        id: 'hist-1',
        description: 'Tesco Metro',
        transactionDate: new Date('2025-10-20'), // 26 days ago
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries'
      });

      const within90Days = createTestTransaction({
        id: 'hist-2',
        description: 'Tesco Metro',
        transactionDate: new Date('2025-09-01'), // 75 days ago
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries'
      });

      // Act
      const matches = customLearner.findSimilarPatterns(
        targetTransaction,
        [within30Days, within90Days],
        5
      );

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern.transactionDate).toEqual(within30Days.transactionDate);
    });
  });

  describe('Categorized Transaction Filtering', () => {
    test('should only include categorized transactions', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const categorizedTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Tesco Metro',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        transactionDate: new Date('2025-11-01')
      });

      const uncategorizedTransaction = createTestTransaction({
        id: 'hist-2',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED,
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [categorizedTransaction, uncategorizedTransaction],
        5
      );

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern.description).toBe(categorizedTransaction.description);
    });

    test('should exclude error and unprocessed transactions', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const validTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Tesco Metro',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        processingStatus: ProcessingStatus.CATEGORISED,
        transactionDate: new Date('2025-11-01')
      });

      const errorTransaction = createTestTransaction({
        id: 'hist-2',
        description: 'Tesco Metro',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        processingStatus: ProcessingStatus.ERROR,
        transactionDate: new Date('2025-11-01')
      });

      const unprocessedTransaction = createTestTransaction({
        id: 'hist-3',
        description: 'Tesco Metro',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        processingStatus: ProcessingStatus.UNPROCESSED,
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(
        targetTransaction,
        [validTransaction, errorTransaction, unprocessedTransaction],
        5
      );

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern.description).toBe(validTransaction.description);
    });
  });

  describe('Category Suggestion', () => {
    test('should return null when no matches', () => {
      // Arrange
      const matches: SimilarityMatch[] = [];

      // Act
      const suggestion = learner.getSuggestedCategory(matches);

      // Assert
      expect(suggestion).toBeNull();
    });

    test('should suggest category with highest weighted score', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Mixed Transaction',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransactions = [
        createTestTransaction({
          id: 'hist-1',
          description: 'Mixed Transaction',
          categoryAiId: 'cat-a',
          categoryAiName: 'Category A',
          transactionDate: new Date('2025-11-01')
        }),
        createTestTransaction({
          id: 'hist-2',
          description: 'Mixed Transaction',
          categoryAiId: 'cat-b',
          categoryAiName: 'Category B',
          transactionDate: new Date('2025-11-02')
        }),
        createTestTransaction({
          id: 'hist-3',
          description: 'Mixed Transaction',
          categoryAiId: 'cat-b',
          categoryAiName: 'Category B',
          transactionDate: new Date('2025-11-03')
        })
      ];

      // Act
      const matches = learner.findSimilarPatterns(targetTransaction, historicalTransactions, 5);
      const suggestion = learner.getSuggestedCategory(matches);

      // Assert
      expect(suggestion).not.toBeNull();
      expect(suggestion!.categoryId).toBe('cat-b'); // 2 votes vs 1
      expect(suggestion!.categoryName).toBe('Category B');
      expect(suggestion!.confidence).toBeGreaterThan(0);
      expect(suggestion!.confidence).toBeLessThanOrEqual(100);
    });

    test('should include confidence score in suggestion', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Tesco Metro',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(targetTransaction, [historicalTransaction], 5);
      const suggestion = learner.getSuggestedCategory(matches);

      // Assert
      expect(suggestion).not.toBeNull();
      expect(suggestion!.confidence).toBeGreaterThan(0);
      expect(suggestion!.confidence).toBeLessThanOrEqual(100);
    });

    test('should give high confidence for unanimous exact matches', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransactions = [
        createTestTransaction({
          id: 'hist-1',
          description: 'Tesco Metro',
          categoryAiId: 'cat-groceries',
          categoryAiName: 'Groceries',
          transactionDate: new Date('2025-11-01')
        }),
        createTestTransaction({
          id: 'hist-2',
          description: 'Tesco Metro',
          categoryAiId: 'cat-groceries',
          categoryAiName: 'Groceries',
          transactionDate: new Date('2025-11-02')
        }),
        createTestTransaction({
          id: 'hist-3',
          description: 'Tesco Metro',
          categoryAiId: 'cat-groceries',
          categoryAiName: 'Groceries',
          transactionDate: new Date('2025-11-03')
        })
      ];

      // Act
      const matches = learner.findSimilarPatterns(targetTransaction, historicalTransactions, 5);
      const suggestion = learner.getSuggestedCategory(matches);

      // Assert
      // 100% agreement + 100% match quality + no manual override = ~90% confidence
      expect(suggestion).not.toBeNull();
      expect(suggestion!.confidence).toBeGreaterThanOrEqual(85);
      expect(suggestion!.categoryId).toBe('cat-groceries');
    });

    test('should give lower confidence for split votes', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Ambiguous Store',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransactions = [
        // 2 votes for Category A
        createTestTransaction({
          id: 'hist-1',
          description: 'Ambiguous Store',
          categoryAiId: 'cat-a',
          categoryAiName: 'Category A',
          transactionDate: new Date('2025-11-01')
        }),
        createTestTransaction({
          id: 'hist-2',
          description: 'Ambiguous Store',
          categoryAiId: 'cat-a',
          categoryAiName: 'Category A',
          transactionDate: new Date('2025-11-02')
        }),
        // 1 vote for Category B
        createTestTransaction({
          id: 'hist-3',
          description: 'Ambiguous Store',
          categoryAiId: 'cat-b',
          categoryAiName: 'Category B',
          transactionDate: new Date('2025-11-03')
        })
      ];

      // Act
      const matches = learner.findSimilarPatterns(targetTransaction, historicalTransactions, 5);
      const suggestion = learner.getSuggestedCategory(matches);

      // Assert
      // 67% agreement (2/3) + 100% match quality = ~77% confidence
      expect(suggestion).not.toBeNull();
      expect(suggestion!.categoryId).toBe('cat-a');
      expect(suggestion!.confidence).toBeLessThan(85); // Lower than unanimous
      expect(suggestion!.confidence).toBeGreaterThan(50); // But still reasonably confident
    });

    test('should give bonus confidence for manual override backing', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const withManualOverride = [
        createTestTransaction({
          id: 'hist-1',
          description: 'Tesco Metro',
          categoryAiId: null,
          categoryAiName: null,
          categoryManualId: 'cat-groceries',
          categoryManualName: 'Groceries',
          transactionDate: new Date('2025-11-01')
        })
      ];

      const withoutManualOverride = [
        createTestTransaction({
          id: 'hist-2',
          description: 'Tesco Metro',
          categoryAiId: 'cat-groceries',
          categoryAiName: 'Groceries',
          categoryManualId: null,
          categoryManualName: null,
          transactionDate: new Date('2025-11-01')
        })
      ];

      // Act
      const matchesWithManual = learner.findSimilarPatterns(targetTransaction, withManualOverride, 5);
      const suggestionWithManual = learner.getSuggestedCategory(matchesWithManual);

      const matchesWithoutManual = learner.findSimilarPatterns(targetTransaction, withoutManualOverride, 5);
      const suggestionWithoutManual = learner.getSuggestedCategory(matchesWithoutManual);

      // Assert
      // Manual override should get +10 bonus
      expect(suggestionWithManual).not.toBeNull();
      expect(suggestionWithoutManual).not.toBeNull();
      expect(suggestionWithManual!.confidence).toBeGreaterThan(suggestionWithoutManual!.confidence);
      expect(suggestionWithManual!.confidence).toBeGreaterThanOrEqual(95); // Should be near perfect
    });

    test('should give lower confidence for fuzzy matches', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro Oxford Street London',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransactions = [
        createTestTransaction({
          id: 'hist-1',
          description: 'Tesco Express Oxford Street London', // Fuzzy match
          categoryAiId: 'cat-groceries',
          categoryAiName: 'Groceries',
          transactionDate: new Date('2025-11-01')
        })
      ];

      // Act
      const matches = learner.findSimilarPatterns(targetTransaction, historicalTransactions, 5);
      const suggestion = learner.getSuggestedCategory(matches);

      // Assert
      // Fuzzy match (67% similarity) should result in lower confidence than exact match
      expect(suggestion).not.toBeNull();
      expect(suggestion!.confidence).toBeLessThan(90); // Lower than exact match
      expect(suggestion!.confidence).toBeGreaterThan(40); // But still meaningful
    });
  });

  describe('Match Deduplication', () => {
    test('should prefer exact match over fuzzy match for same pattern', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro Store',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransaction = createTestTransaction({
        id: 'hist-1',
        description: 'Tesco Metro Store',
        categoryAiId: 'cat-groceries',
        categoryAiName: 'Groceries',
        transactionDate: new Date('2025-11-01')
      });

      // Act
      const matches = learner.findSimilarPatterns(targetTransaction, [historicalTransaction], 5);

      // Assert
      // Should only return one match (exact), not both exact and fuzzy
      const uniquePatterns = new Set(matches.map(m => m.pattern.description));
      expect(uniquePatterns.size).toBe(1);

      const exactMatch = matches.find(m => m.matchType === 'exact');
      expect(exactMatch).toBeDefined();
    });

    test('should respect limit parameter', () => {
      // Arrange
      const targetTransaction = createTestTransaction({
        id: 'target-1',
        description: 'Tesco Metro',
        categoryAiId: null,
        categoryAiName: null,
        categoryConfidenceScore: null,
        processingStatus: ProcessingStatus.NORMALISED
      });

      const historicalTransactions = Array.from({ length: 10 }, (_, i) =>
        createTestTransaction({
          id: `hist-${i}`,
          description: 'Tesco Metro',
          categoryAiId: 'cat-groceries',
          categoryAiName: 'Groceries',
          transactionDate: new Date('2025-11-01')
        })
      );

      // Act
      const matches = learner.findSimilarPatterns(targetTransaction, historicalTransactions, 3);

      // Assert
      expect(matches.length).toBeLessThanOrEqual(3);
    });
  });
});
