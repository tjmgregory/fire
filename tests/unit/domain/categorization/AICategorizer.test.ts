/**
 * AI Categorizer Tests
 *
 * Tests AI-powered transaction categorization per FR-005, FR-014, FR-015 and SAD 5.2.8.
 * Validates behaviors required by:
 * - UC-002: AI-Powered Categorization
 * - UC-006: Schedule AI Categorization Runs
 * - FR-005: Asynchronous AI Categorization
 * - FR-014: Historical Transaction Learning
 * - FR-015: Category Definitions Management
 *
 * Business Rules Tested:
 * - BR-CAT-01: Only normalized transactions can be categorized
 * - BR-CAT-02: Manual category overrides take precedence over AI categorization
 * - BR-CAT-03: Only active categories are used for categorization
 * - BR-CAT-04: Confidence scores must be between 0-100
 * - BR-CAT-05: Transactions are processed in configurable batches
 * - BR-CAT-06: Historical context improves categorization accuracy
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  AICategorizer,
  CategorizationError,
  DEFAULT_CATEGORIZER_CONFIG,
  CategorizerConfig,
  HistoricalDataProvider
} from '../../../../src/apps-script/domain/categorization/AICategorizer';
import {
  Transaction,
  ProcessingStatus,
  TransactionType,
  CurrencyCode,
  BankSourceId
} from '../../../../src/apps-script/models/Transaction';
import {
  Category,
  CategoryFactory
} from '../../../../src/apps-script/models/Category';
import {
  AICategorizationPort,
  CategoryInfo,
  HistoricalContext,
  CategorizationResult
} from '../../../../src/apps-script/domain/ports/AICategorizationPort';

describe('AICategorizer', () => {
  // Test fixture factories
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

  function createTestCategory(overrides: Partial<Category> = {}): Category {
    return CategoryFactory.create(
      overrides.name || 'Groceries',
      overrides.description || 'Food and grocery shopping',
      overrides.examples || 'Tesco, Sainsburys, Waitrose',
      overrides.isActive ?? true
    );
  }

  // Mock AI Port
  class MockAIPort implements AICategorizationPort {
    public categorizeBatchCalls: Array<{
      transactions: Transaction[];
      categories: CategoryInfo[];
      context?: HistoricalContext;
    }> = [];

    public mockResults: CategorizationResult[] = [];

    async categorizeBatch(
      transactions: Transaction[],
      categories: CategoryInfo[],
      context?: HistoricalContext
    ): Promise<CategorizationResult[]> {
      this.categorizeBatchCalls.push({ transactions, categories, context });
      return this.mockResults.length > 0
        ? this.mockResults
        : transactions.map(t => ({
            transactionId: t.id,
            categoryId: categories[0].id,
            categoryName: categories[0].name,
            confidenceScore: 85,
            reasoning: 'Mock categorization'
          }));
    }

    async categorizeSingle(
      transaction: Transaction,
      categories: CategoryInfo[],
      context?: HistoricalContext
    ): Promise<CategorizationResult> {
      const results = await this.categorizeBatch([transaction], categories, context);
      return results[0];
    }

    reset(): void {
      this.categorizeBatchCalls = [];
      this.mockResults = [];
    }
  }

  // Mock Historical Data Provider
  class MockHistoricalDataProvider implements HistoricalDataProvider {
    public findSimilarCalls: Array<{ transaction: Transaction; limit: number }> = [];
    public mockSimilarTransactions: Array<{
      description: string;
      categoryId: string;
      categoryName: string;
      wasManualOverride: boolean;
      confidenceScore?: number;
    }> = [];

    async findSimilarTransactions(
      transaction: Transaction,
      limit: number
    ): Promise<Array<{
      description: string;
      categoryId: string;
      categoryName: string;
      wasManualOverride: boolean;
      confidenceScore?: number;
    }>> {
      this.findSimilarCalls.push({ transaction, limit });
      return this.mockSimilarTransactions.slice(0, limit);
    }

    reset(): void {
      this.findSimilarCalls = [];
      this.mockSimilarTransactions = [];
    }
  }

  let mockAIPort: MockAIPort;
  let mockHistoricalProvider: MockHistoricalDataProvider;

  beforeEach(() => {
    mockAIPort = new MockAIPort();
    mockHistoricalProvider = new MockHistoricalDataProvider();
  });

  describe('Constructor and Initialization', () => {
    test('UC-002: Given AI port, when categorizer created with defaults, then initializes correctly', () => {
      // Arrange & Act
      const categorizer = new AICategorizer(mockAIPort);

      // Assert
      expect(categorizer).toBeDefined();
    });

    test('UC-002: Given custom config, when categorizer created, then uses custom configuration', () => {
      // Arrange
      const customConfig: CategorizerConfig = {
        batchSize: 20,
        useHistoricalContext: false,
        historicalContextSize: 10
      };

      // Act
      const categorizer = new AICategorizer(mockAIPort, customConfig);

      // Assert - We'll verify this through behavior in later tests
      expect(categorizer).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    test('BR-CAT-01: Given empty transaction array, when categorize called, then throws error', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const categories = [createTestCategory()];

      // Act & Assert
      await expect(categorizer.categorize([], categories))
        .rejects.toThrow(CategorizationError);
      await expect(categorizer.categorize([], categories))
        .rejects.toThrow('No transactions provided');
    });

    test('BR-CAT-03: Given empty category array, when categorize called, then throws error', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transactions = [createTestTransaction()];

      // Act & Assert
      await expect(categorizer.categorize(transactions, []))
        .rejects.toThrow(CategorizationError);
      await expect(categorizer.categorize(transactions, []))
        .rejects.toThrow('No categories provided');
    });

    test('BR-CAT-03: Given only inactive categories, when categorize called, then throws error', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transactions = [createTestTransaction()];
      const inactiveCategory = createTestCategory({ isActive: false });

      // Act & Assert
      await expect(categorizer.categorize(transactions, [inactiveCategory]))
        .rejects.toThrow(CategorizationError);
      await expect(categorizer.categorize(transactions, [inactiveCategory]))
        .rejects.toThrow('No active categories available');
    });

    test('BR-CAT-01: Given unprocessed transaction, when categorize called, then throws error', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const unprocessedTransaction = createTestTransaction({
        processingStatus: ProcessingStatus.UNPROCESSED
      });
      const categories = [createTestCategory()];

      // Act & Assert
      await expect(categorizer.categorize([unprocessedTransaction], categories))
        .rejects.toThrow(CategorizationError);
      await expect(categorizer.categorize([unprocessedTransaction], categories))
        .rejects.toThrow('must be normalized before categorization');
    });
  });

  describe('Single Batch Categorization', () => {
    test('FR-005: Given normalized transactions, when categorize called, then returns categorized transactions', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transaction = createTestTransaction({ id: 'tx-1' });
      const category = createTestCategory();

      mockAIPort.mockResults = [{
        transactionId: 'tx-1',
        categoryId: category.id,
        categoryName: category.name,
        confidenceScore: 92
      }];

      // Act
      const result = await categorizer.categorize([transaction], [category]);

      // Assert
      expect(result.totalProcessed).toBe(1);
      expect(result.categorized).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
      expect(result.categorized[0].categoryAiId).toBe(category.id);
      expect(result.categorized[0].categoryAiName).toBe(category.name);
      expect(result.categorized[0].categoryConfidenceScore).toBe(92);
      expect(result.categorized[0].processingStatus).toBe(ProcessingStatus.CATEGORISED);
    });

    test('FR-005: Given categorized transaction, when confidence stored, then can be audited', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transaction = createTestTransaction({ id: 'tx-1' });
      const category = createTestCategory();

      mockAIPort.mockResults = [{
        transactionId: 'tx-1',
        categoryId: category.id,
        categoryName: category.name,
        confidenceScore: 78
      }];

      // Act
      const result = await categorizer.categorize([transaction], [category]);

      // Assert - Confidence score is stored for auditability (FR-005)
      expect(result.categorized[0].categoryConfidenceScore).toBe(78);
    });

    test('BR-CAT-04: Given invalid confidence score, when result applied, then throws error', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transaction = createTestTransaction({ id: 'tx-1' });
      const category = createTestCategory();

      mockAIPort.mockResults = [{
        transactionId: 'tx-1',
        categoryId: category.id,
        categoryName: category.name,
        confidenceScore: 150 // Invalid: > 100
      }];

      // Act
      const result = await categorizer.categorize([transaction], [category]);

      // Assert
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Invalid confidence score');
    });

    test('FR-015: Given active and inactive categories, when categorize called, then only uses active categories', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transaction = createTestTransaction();
      const activeCategory = createTestCategory({ name: 'Active' });
      const inactiveCategory = createTestCategory({ name: 'Inactive', isActive: false });

      // Act
      await categorizer.categorize([transaction], [activeCategory, inactiveCategory]);

      // Assert - Only active category should be passed to AI port
      expect(mockAIPort.categorizeBatchCalls).toHaveLength(1);
      const categoriesPassedToAI = mockAIPort.categorizeBatchCalls[0].categories;
      expect(categoriesPassedToAI).toHaveLength(1);
      expect(categoriesPassedToAI[0].name).toBe('Active');
    });
  });

  describe('Batch Processing', () => {
    test('FR-005: Given 25 transactions and batch size 10, when categorize called, then processes in 3 batches', async () => {
      // Arrange
      const config: CategorizerConfig = {
        batchSize: 10,
        useHistoricalContext: false,
        historicalContextSize: 5
      };
      const categorizer = new AICategorizer(mockAIPort, config);

      const transactions = Array.from({ length: 25 }, (_, i) =>
        createTestTransaction({ id: `tx-${i}` })
      );
      const category = createTestCategory();

      // Setup mock to return results for all transactions
      mockAIPort.mockResults = transactions.map(t => ({
        transactionId: t.id,
        categoryId: category.id,
        categoryName: category.name,
        confidenceScore: 85
      }));

      // Act
      const result = await categorizer.categorize(transactions, [category]);

      // Assert - Should make 3 calls (10 + 10 + 5)
      expect(mockAIPort.categorizeBatchCalls).toHaveLength(3);
      expect(mockAIPort.categorizeBatchCalls[0].transactions).toHaveLength(10);
      expect(mockAIPort.categorizeBatchCalls[1].transactions).toHaveLength(10);
      expect(mockAIPort.categorizeBatchCalls[2].transactions).toHaveLength(5);
      expect(result.totalProcessed).toBe(25);
    });

    test('BR-CAT-05: Given custom batch size, when categorize called, then respects configuration', async () => {
      // Arrange
      const config: CategorizerConfig = {
        batchSize: 3,
        useHistoricalContext: false,
        historicalContextSize: 5
      };
      const categorizer = new AICategorizer(mockAIPort, config);

      const transactions = Array.from({ length: 7 }, (_, i) =>
        createTestTransaction({ id: `tx-${i}` })
      );
      const category = createTestCategory();

      // Act
      await categorizer.categorize(transactions, [category]);

      // Assert - Should make 3 calls (3 + 3 + 1)
      expect(mockAIPort.categorizeBatchCalls).toHaveLength(3);
      expect(mockAIPort.categorizeBatchCalls[0].transactions).toHaveLength(3);
      expect(mockAIPort.categorizeBatchCalls[1].transactions).toHaveLength(3);
      expect(mockAIPort.categorizeBatchCalls[2].transactions).toHaveLength(1);
    });
  });

  describe('Historical Context Learning', () => {
    test('FR-014: Given historical context enabled, when categorize called, then includes context in AI call', async () => {
      // Arrange
      const config: CategorizerConfig = {
        ...DEFAULT_CATEGORIZER_CONFIG,
        useHistoricalContext: true,
        historicalContextSize: 3
      };
      const categorizer = new AICategorizer(mockAIPort, config, mockHistoricalProvider);

      const transaction = createTestTransaction({ description: 'Tesco' });
      const category = createTestCategory();

      mockHistoricalProvider.mockSimilarTransactions = [
        {
          description: 'Tesco Express',
          categoryId: category.id,
          categoryName: category.name,
          wasManualOverride: false,
          confidenceScore: 95
        }
      ];

      // Act
      await categorizer.categorize([transaction], [category]);

      // Assert
      expect(mockHistoricalProvider.findSimilarCalls).toHaveLength(1);
      expect(mockAIPort.categorizeBatchCalls[0].context).toBeDefined();
      expect(mockAIPort.categorizeBatchCalls[0].context?.similarTransactions).toHaveLength(1);
    });

    test('BR-CAT-06: Given historical context disabled, when categorize called, then no context passed', async () => {
      // Arrange
      const config: CategorizerConfig = {
        ...DEFAULT_CATEGORIZER_CONFIG,
        useHistoricalContext: false
      };
      const categorizer = new AICategorizer(mockAIPort, config, mockHistoricalProvider);

      const transaction = createTestTransaction();
      const category = createTestCategory();

      // Act
      await categorizer.categorize([transaction], [category]);

      // Assert
      expect(mockHistoricalProvider.findSimilarCalls).toHaveLength(0);
      expect(mockAIPort.categorizeBatchCalls[0].context).toBeUndefined();
    });

    test('FR-014: Given no historical provider, when categorize called, then processes without context', async () => {
      // Arrange
      const config: CategorizerConfig = {
        ...DEFAULT_CATEGORIZER_CONFIG,
        useHistoricalContext: true // Enabled but no provider
      };
      const categorizer = new AICategorizer(mockAIPort, config); // No provider

      const transaction = createTestTransaction();
      const category = createTestCategory();

      // Act
      const result = await categorizer.categorize([transaction], [category]);

      // Assert - Should still work, just without context
      expect(result.categorized).toHaveLength(1);
      expect(mockAIPort.categorizeBatchCalls[0].context).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('UC-002: Given AI port returns no result for transaction, when categorize called, then marks transaction as failed', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transaction1 = createTestTransaction({ id: 'tx-1' });
      const transaction2 = createTestTransaction({ id: 'tx-2' });
      const category = createTestCategory();

      // Mock AI to return result only for tx-1, not for tx-2
      mockAIPort.mockResults = [{
        transactionId: 'tx-1',
        categoryId: category.id,
        categoryName: category.name,
        confidenceScore: 85
      }];

      // Act
      const result = await categorizer.categorize([transaction1, transaction2], [category]);

      // Assert - tx-2 should be marked as failed
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].transaction.id).toBe('tx-2');
      expect(result.failed[0].error).toContain('No categorization result');
      expect(result.categorized).toHaveLength(1);
      expect(result.categorized[0].id).toBe('tx-1');
    });

    test('UC-002: Given batch processing fails, when categorize called, then marks all in batch as failed', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transactions = [
        createTestTransaction({ id: 'tx-1' }),
        createTestTransaction({ id: 'tx-2' })
      ];
      const category = createTestCategory();

      // Mock AI to throw error
      mockAIPort.categorizeBatch = vi.fn().mockRejectedValue(new Error('AI service unavailable'));

      // Act
      const result = await categorizer.categorize(transactions, [category]);

      // Assert
      expect(result.failed).toHaveLength(2);
      expect(result.categorized).toHaveLength(0);
      expect(result.totalProcessed).toBe(2);
    });

    test('UC-002: Given partial batch failure, when categorize called, then continues processing remaining batches', async () => {
      // Arrange
      const config: CategorizerConfig = {
        batchSize: 2,
        useHistoricalContext: false,
        historicalContextSize: 5
      };
      const categorizer = new AICategorizer(mockAIPort, config);

      const transactions = [
        createTestTransaction({ id: 'tx-1' }),
        createTestTransaction({ id: 'tx-2' }),
        createTestTransaction({ id: 'tx-3' }),
        createTestTransaction({ id: 'tx-4' })
      ];
      const category = createTestCategory();

      // Mock first batch to fail, second to succeed
      let callCount = 0;
      mockAIPort.categorizeBatch = vi.fn().mockImplementation((txs) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First batch failed');
        }
        return Promise.resolve(txs.map(t => ({
          transactionId: t.id,
          categoryId: category.id,
          categoryName: category.name,
          confidenceScore: 85
        })));
      });

      // Act
      const result = await categorizer.categorize(transactions, [category]);

      // Assert
      expect(result.totalProcessed).toBe(4);
      expect(result.failed).toHaveLength(2); // First batch failed
      expect(result.categorized).toHaveLength(2); // Second batch succeeded
    });
  });

  describe('Static Filter Methods', () => {
    test('FR-005: Given uncategorized transactions, when filterUncategorized called, then returns only uncategorized', () => {
      // Arrange
      const transactions = [
        createTestTransaction({
          id: 'tx-1',
          processingStatus: ProcessingStatus.NORMALISED,
          categoryAiId: null
        }),
        createTestTransaction({
          id: 'tx-2',
          processingStatus: ProcessingStatus.CATEGORISED,
          categoryAiId: 'cat-123'
        }),
        createTestTransaction({
          id: 'tx-3',
          processingStatus: ProcessingStatus.NORMALISED,
          categoryAiId: null
        })
      ];

      // Act
      const uncategorized = AICategorizer.filterUncategorized(transactions);

      // Assert
      expect(uncategorized).toHaveLength(2);
      expect(uncategorized[0].id).toBe('tx-1');
      expect(uncategorized[1].id).toBe('tx-3');
    });

    test('BR-CAT-02: Given transaction with manual override, when filterUncategorized called, then excludes it', () => {
      // Arrange
      const transactions = [
        createTestTransaction({
          id: 'tx-1',
          processingStatus: ProcessingStatus.NORMALISED,
          categoryAiId: null,
          categoryManualId: null
        }),
        createTestTransaction({
          id: 'tx-2',
          processingStatus: ProcessingStatus.NORMALISED,
          categoryAiId: null,
          categoryManualId: 'manual-cat-123' // Has manual override
        })
      ];

      // Act
      const uncategorized = AICategorizer.filterUncategorized(transactions);

      // Assert - Manual override takes precedence, so tx-2 should be excluded
      expect(uncategorized).toHaveLength(1);
      expect(uncategorized[0].id).toBe('tx-1');
    });

    test('FR-005: Given unprocessed transaction, when filterUncategorized called, then excludes it', () => {
      // Arrange
      const transactions = [
        createTestTransaction({
          id: 'tx-1',
          processingStatus: ProcessingStatus.UNPROCESSED
        }),
        createTestTransaction({
          id: 'tx-2',
          processingStatus: ProcessingStatus.NORMALISED
        })
      ];

      // Act
      const uncategorized = AICategorizer.filterUncategorized(transactions);

      // Assert
      expect(uncategorized).toHaveLength(1);
      expect(uncategorized[0].id).toBe('tx-2');
    });

    test('FR-005: Given error transaction, when filterUncategorized called, then excludes it', () => {
      // Arrange
      const transactions = [
        createTestTransaction({
          id: 'tx-1',
          processingStatus: ProcessingStatus.ERROR
        }),
        createTestTransaction({
          id: 'tx-2',
          processingStatus: ProcessingStatus.NORMALISED
        })
      ];

      // Act
      const uncategorized = AICategorizer.filterUncategorized(transactions);

      // Assert
      expect(uncategorized).toHaveLength(1);
      expect(uncategorized[0].id).toBe('tx-2');
    });
  });

  describe('Processing Status Updates', () => {
    test('UC-002: Given successful categorization, when result applied, then status updated to CATEGORISED', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transaction = createTestTransaction({
        id: 'tx-1',
        processingStatus: ProcessingStatus.NORMALISED
      });
      const category = createTestCategory();

      // Act
      const result = await categorizer.categorize([transaction], [category]);

      // Assert
      expect(result.categorized[0].processingStatus).toBe(ProcessingStatus.CATEGORISED);
    });

    test('UC-002: Given successful categorization, when result applied, then clears previous error', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transaction = createTestTransaction({
        id: 'tx-1',
        processingStatus: ProcessingStatus.NORMALISED,
        errorMessage: 'Previous categorization failed'
      });
      const category = createTestCategory();

      // Act
      const result = await categorizer.categorize([transaction], [category]);

      // Assert
      expect(result.categorized[0].errorMessage).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('UC-002: Given category info conversion, when categorize called, then correctly maps fields', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transaction = createTestTransaction();
      const category = createTestCategory({
        name: 'Test Category',
        description: 'Test Description',
        examples: 'Example 1, Example 2'
      });

      // Act
      await categorizer.categorize([transaction], [category]);

      // Assert - Verify category info passed to AI port
      const categoryInfo = mockAIPort.categorizeBatchCalls[0].categories[0];
      expect(categoryInfo.id).toBe(category.id);
      expect(categoryInfo.name).toBe('Test Category');
      expect(categoryInfo.description).toBe('Test Description');
      expect(categoryInfo.examples).toBe('Example 1, Example 2');
    });

    test('UC-002: Given multiple categories, when categorize called, then passes all active categories to AI', async () => {
      // Arrange
      const categorizer = new AICategorizer(mockAIPort);
      const transaction = createTestTransaction();
      const categories = [
        createTestCategory({ name: 'Category 1' }),
        createTestCategory({ name: 'Category 2' }),
        createTestCategory({ name: 'Category 3' })
      ];

      // Act
      await categorizer.categorize([transaction], categories);

      // Assert
      expect(mockAIPort.categorizeBatchCalls[0].categories).toHaveLength(3);
    });
  });
});
