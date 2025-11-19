/**
 * AI Categorizer
 *
 * Orchestrates AI-powered transaction categorization through batch processing.
 * Uses historical context to improve accuracy and provides confidence scores.
 *
 * Satisfies:
 * - UC-002: AI-Powered Categorization
 * - UC-006: Schedule AI Categorization Runs
 * - FR-005: Asynchronous AI Categorization
 * - FR-014: Historical Transaction Learning
 * - FR-015: Category Definitions Management
 *
 * @module domain/categorization/AICategorizer
 */

import { Transaction, ProcessingStatus } from '../../models/Transaction';
import { Category } from '../../models/Category';
import {
  AICategorizationPort,
  CategoryInfo,
  HistoricalContext,
  CategorizationResult
} from '../ports/AICategorizationPort';

/**
 * Configuration for AI categorization
 */
export interface CategorizerConfig {
  /**
   * Maximum number of transactions to process in a single batch
   * FR-005: Batch processing (e.g., batches of 10)
   */
  batchSize: number;

  /**
   * Whether to include historical context for learning
   * FR-014: Historical Transaction Learning
   */
  useHistoricalContext: boolean;

  /**
   * Number of similar historical transactions to include as context
   */
  historicalContextSize: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CATEGORIZER_CONFIG: CategorizerConfig = {
  batchSize: 10,
  useHistoricalContext: true,
  historicalContextSize: 5
};

/**
 * Result of categorization operation
 */
export interface CategorizationOperationResult {
  /**
   * Transactions that were successfully categorized
   */
  categorized: Transaction[];

  /**
   * Transactions that failed categorization
   */
  failed: Array<{
    transaction: Transaction;
    error: string;
  }>;

  /**
   * Total number of transactions processed
   */
  totalProcessed: number;
}

/**
 * Provider for historical transaction data
 */
export interface HistoricalDataProvider {
  /**
   * Find similar historical transactions for learning
   *
   * @param transaction - Transaction to find similar matches for
   * @param limit - Maximum number of similar transactions to return
   * @returns Array of similar categorized transactions
   */
  findSimilarTransactions(
    transaction: Transaction,
    limit: number
  ): Promise<Array<{
    description: string;
    categoryId: string;
    categoryName: string;
    wasManualOverride: boolean;
    confidenceScore?: number;
  }>>;
}

/**
 * AI Categorizer
 *
 * Orchestrates AI-powered transaction categorization through batch processing.
 * Implements hexagonal architecture by depending on ports rather than concrete
 * infrastructure implementations.
 */
export class AICategorizer {
  private aiPort: AICategorizationPort;
  private config: CategorizerConfig;
  private historicalDataProvider?: HistoricalDataProvider;

  /**
   * Initialize AI categorizer
   *
   * @param aiPort - AI categorization port implementation
   * @param config - Categorizer configuration (optional)
   * @param historicalDataProvider - Provider for historical transaction data (optional)
   */
  constructor(
    aiPort: AICategorizationPort,
    config: CategorizerConfig = DEFAULT_CATEGORIZER_CONFIG,
    historicalDataProvider?: HistoricalDataProvider
  ) {
    this.aiPort = aiPort;
    this.config = config;
    this.historicalDataProvider = historicalDataProvider;
  }

  /**
   * Categorize a batch of transactions
   *
   * Processes transactions in configurable batch sizes (FR-005).
   * Optionally includes historical context for learning (FR-014).
   *
   * @param transactions - Transactions to categorize
   * @param categories - Available categories (FR-015)
   * @returns Categorization operation result
   */
  async categorize(
    transactions: Transaction[],
    categories: Category[]
  ): Promise<CategorizationOperationResult> {
    // Validate inputs
    this.validateInputs(transactions, categories);

    // Filter to only active categories (FR-015)
    const activeCategories = categories.filter(cat => cat.isActive);

    if (activeCategories.length === 0) {
      throw new CategorizationError('No active categories available for categorization');
    }

    // Convert categories to CategoryInfo format for AI port
    const categoryInfo = this.convertToCategorizationInfo(activeCategories);

    // Process in batches
    const results: CategorizationOperationResult = {
      categorized: [],
      failed: [],
      totalProcessed: 0
    };

    for (let i = 0; i < transactions.length; i += this.config.batchSize) {
      const batch = transactions.slice(i, i + this.config.batchSize);

      try {
        const batchResult = await this.categorizeBatch(batch, categoryInfo);
        results.categorized.push(...batchResult.categorized);
        results.failed.push(...batchResult.failed);
        results.totalProcessed += batch.length;
      } catch (error) {
        // If entire batch fails, mark all transactions as failed
        batch.forEach(transaction => {
          results.failed.push({
            transaction,
            error: error instanceof Error ? error.message : 'Unknown error during batch categorization'
          });
        });
        results.totalProcessed += batch.length;
      }
    }

    return results;
  }

  /**
   * Categorize a single batch of transactions
   *
   * @param batch - Batch of transactions to categorize
   * @param categoryInfo - Available category information
   * @returns Categorization result for the batch
   */
  private async categorizeBatch(
    batch: Transaction[],
    categoryInfo: CategoryInfo[]
  ): Promise<Pick<CategorizationOperationResult, 'categorized' | 'failed'>> {
    const categorized: Transaction[] = [];
    const failed: Array<{ transaction: Transaction; error: string }> = [];

    try {
      // Build historical context if enabled
      const context = this.config.useHistoricalContext
        ? await this.buildHistoricalContext(batch)
        : undefined;

      // Call AI port to categorize the batch
      const results = await this.aiPort.categorizeBatch(batch, categoryInfo, context);

      // Apply categorization results to transactions
      for (const result of results) {
        const transaction = batch.find(t => t.id === result.transactionId);

        if (!transaction) {
          continue; // Skip if transaction not found in batch
        }

        try {
          const categorizedTransaction = this.applyCategorizationResult(transaction, result);
          categorized.push(categorizedTransaction);
        } catch (error) {
          failed.push({
            transaction,
            error: error instanceof Error ? error.message : 'Failed to apply categorization result'
          });
        }
      }

      // Check for any transactions that didn't get results
      batch.forEach(transaction => {
        const hasResult = results.some(r => r.transactionId === transaction.id);
        const alreadyProcessed = categorized.some(t => t.id === transaction.id) ||
                                 failed.some(f => f.transaction.id === transaction.id);

        if (!hasResult && !alreadyProcessed) {
          failed.push({
            transaction,
            error: 'No categorization result returned from AI'
          });
        }
      });

    } catch (error) {
      // If batch processing fails, mark all as failed
      throw error;
    }

    return { categorized, failed };
  }

  /**
   * Build historical context for a batch of transactions
   *
   * Implements FR-014: Historical Transaction Learning
   *
   * @param batch - Batch of transactions
   * @returns Historical context for AI categorization
   */
  private async buildHistoricalContext(batch: Transaction[]): Promise<HistoricalContext | undefined> {
    if (!this.historicalDataProvider) {
      return undefined;
    }

    // Aggregate similar transactions for all transactions in batch
    const allSimilarTransactions = [];

    for (const transaction of batch) {
      const similar = await this.historicalDataProvider.findSimilarTransactions(
        transaction,
        this.config.historicalContextSize
      );
      allSimilarTransactions.push(...similar);
    }

    // Remove duplicates and limit total context size
    const uniqueSimilar = Array.from(
      new Map(allSimilarTransactions.map(item => [
        `${item.description}-${item.categoryId}`,
        item
      ])).values()
    ).slice(0, this.config.historicalContextSize * batch.length);

    return {
      similarTransactions: uniqueSimilar
    };
  }

  /**
   * Apply categorization result to a transaction
   *
   * Updates transaction with AI category, confidence score, and processing status.
   * Implements FR-005: AI provides confidence scores stored for auditability.
   *
   * @param transaction - Original transaction
   * @param result - Categorization result from AI
   * @returns Updated transaction with categorization applied
   */
  private applyCategorizationResult(
    transaction: Transaction,
    result: CategorizationResult
  ): Transaction {
    // Validate confidence score (0-100)
    if (result.confidenceScore < 0 || result.confidenceScore > 100) {
      throw new CategorizationError(
        `Invalid confidence score: ${result.confidenceScore}. Must be between 0 and 100.`
      );
    }

    // Create updated transaction with AI categorization
    return {
      ...transaction,
      categoryAiId: result.categoryId,
      categoryAiName: result.categoryName,
      categoryConfidenceScore: result.confidenceScore,
      processingStatus: ProcessingStatus.CATEGORISED,
      errorMessage: null // Clear any previous errors
    };
  }

  /**
   * Convert Category entities to CategoryInfo for AI port
   *
   * @param categories - Category entities
   * @returns CategoryInfo array for AI categorization
   */
  private convertToCategorizationInfo(categories: Category[]): CategoryInfo[] {
    return categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      examples: cat.examples
    }));
  }

  /**
   * Validate categorization inputs
   *
   * @param transactions - Transactions to validate
   * @param categories - Categories to validate
   * @throws CategorizationError if validation fails
   */
  private validateInputs(transactions: Transaction[], categories: Category[]): void {
    if (!transactions || transactions.length === 0) {
      throw new CategorizationError('No transactions provided for categorization');
    }

    if (!categories || categories.length === 0) {
      throw new CategorizationError('No categories provided for categorization');
    }

    // Validate all transactions are in correct state for categorization
    transactions.forEach((transaction, index) => {
      // Must have been normalized first
      if (transaction.processingStatus === ProcessingStatus.UNPROCESSED) {
        throw new CategorizationError(
          `Transaction ${transaction.id} (index ${index}) must be normalized before categorization`
        );
      }

      // Skip transactions that are already categorized or have manual overrides
      // (This validation allows re-categorization if needed)
    });
  }

  /**
   * Filter transactions that need categorization
   *
   * Implements FR-005: Only uncategorized transactions are processed in each run.
   * Excludes transactions with manual category overrides.
   *
   * @param transactions - All transactions
   * @returns Transactions that need AI categorization
   */
  static filterUncategorized(transactions: Transaction[]): Transaction[] {
    return transactions.filter(transaction => {
      // Must be at least normalized
      if (transaction.processingStatus === ProcessingStatus.UNPROCESSED ||
          transaction.processingStatus === ProcessingStatus.ERROR) {
        return false;
      }

      // Skip if has manual override (manual takes precedence over AI)
      if (transaction.categoryManualId !== null) {
        return false;
      }

      // Include if not yet categorized by AI
      return transaction.categoryAiId === null;
    });
  }
}

/**
 * Categorization error
 */
export class CategorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategorizationError';
  }
}
