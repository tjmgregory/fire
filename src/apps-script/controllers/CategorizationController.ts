/**
 * Categorization Controller
 *
 * Orchestrates the AI-powered transaction categorization workflow.
 * Entry points for categorizing normalized transactions.
 *
 * Satisfies:
 * - UC-002: AI-Powered Categorization
 * - UC-006: Execute Scheduled Categorization
 * - FR-005, FR-014, FR-015
 *
 * @module controllers/CategorizationController
 */

import { Transaction, ProcessingStatus } from '../models/Transaction';
import { Category } from '../models/Category';
import { SheetDataAdapter } from '../infrastructure/adapters/SheetDataAdapter';
import { AICategorizationAdapter } from '../infrastructure/adapters/AICategorizationAdapter';
import { AICategorizer, HistoricalDataProvider } from '../domain/categorization/AICategorizer';
import { HistoricalPatternLearner } from '../domain/categorization/HistoricalPatternLearner';
import { logger } from '../infrastructure/logging/ErrorLogger';

/**
 * Categorization result for a single run
 */
interface CategorizationResult {
  success: boolean;
  processingRunId: string;
  startTime: Date;
  endTime: Date;
  totalProcessed: number;
  categorized: number;
  failed: number;
  skipped: number;
  errorMessages: string[];
}

/**
 * Historical data provider implementation using SheetDataAdapter
 */
class SheetHistoricalDataProvider implements HistoricalDataProvider {
  private sheetAdapter: SheetDataAdapter;
  private patternLearner: HistoricalPatternLearner;
  private historicalTransactions: Transaction[] | null = null;

  constructor(sheetAdapter: SheetDataAdapter) {
    this.sheetAdapter = sheetAdapter;
    this.patternLearner = new HistoricalPatternLearner();
  }

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
    // Lazy load historical transactions
    if (!this.historicalTransactions) {
      this.historicalTransactions = this.sheetAdapter.findTransactionsByStatus(
        ProcessingStatus.CATEGORISED
      );
    }

    const matches = this.patternLearner.findSimilarPatterns(
      transaction,
      this.historicalTransactions,
      limit
    );

    return matches.map(match => ({
      description: match.pattern.description,
      categoryId: match.pattern.categoryId,
      categoryName: match.pattern.categoryName,
      wasManualOverride: match.pattern.wasManualOverride,
      confidenceScore: match.pattern.confidenceScore
    }));
  }
}

/**
 * Categorization Controller
 *
 * Coordinates the AI categorization process for transactions.
 */
export class CategorizationController {
  private sheetAdapter: SheetDataAdapter;
  private aiAdapter: AICategorizationAdapter;
  private categorizer: AICategorizer;
  private processingRunId: string;

  constructor() {
    this.processingRunId = this.generateProcessingRunId();
    this.sheetAdapter = new SheetDataAdapter();
    this.aiAdapter = new AICategorizationAdapter();

    // Initialize historical data provider
    const historicalProvider = new SheetHistoricalDataProvider(this.sheetAdapter);

    // Initialize AI categorizer
    this.categorizer = new AICategorizer(
      this.aiAdapter,
      {
        batchSize: 10,
        useHistoricalContext: true,
        historicalContextSize: 5
      },
      historicalProvider
    );

    logger.info('CategorizationController initialized', {
      processingRunId: this.processingRunId
    });
  }

  /**
   * Categorize all uncategorized transactions
   *
   * Main entry point for categorization. Processes all transactions with
   * status NORMALISED that don't have a category assigned.
   */
  async categorizeTransactions(): Promise<CategorizationResult> {
    const startTime = new Date();
    const errorMessages: string[] = [];

    logger.info('Starting categorization run', { processingRunId: this.processingRunId });

    // Load uncategorized transactions
    const uncategorized = this.sheetAdapter.findTransactionsByStatus(ProcessingStatus.NORMALISED);
    const toCategorize = AICategorizer.filterUncategorized(uncategorized);

    logger.info(`Found ${toCategorize.length} transactions to categorize`, {
      processingRunId: this.processingRunId,
      totalNormalized: uncategorized.length,
      toCategorize: toCategorize.length
    });

    if (toCategorize.length === 0) {
      return this.createResult(startTime, 0, 0, 0, 0, []);
    }

    // Load categories
    const categoriesData = this.sheetAdapter.readCategories();
    const categories: Category[] = categoriesData.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      examples: c.examples,
      isActive: c.isActive,
      createdAt: new Date(),
      modifiedAt: new Date()
    }));

    if (categories.length === 0) {
      logger.error('No categories found for categorization');
      return this.createResult(startTime, toCategorize.length, 0, toCategorize.length, 0, [
        'No categories found'
      ]);
    }

    // Perform categorization
    try {
      const result = await this.categorizer.categorize(toCategorize, categories);

      // Update successfully categorized transactions in sheet
      for (const transaction of result.categorized) {
        try {
          this.sheetAdapter.updateTransactionCategory(
            transaction.id,
            transaction.categoryAiId!,
            transaction.categoryAiName!,
            false, // Not manual
            transaction.categoryConfidenceScore ?? undefined
          );
        } catch (error) {
          logger.error(`Failed to update transaction ${transaction.id}`, error as Error);
          errorMessages.push(`Failed to save category for ${transaction.id}: ${(error as Error).message}`);
        }
      }

      // Log failures
      for (const failure of result.failed) {
        logger.error(`Failed to categorize transaction ${failure.transaction.id}: ${failure.error}`);
        errorMessages.push(failure.error);
      }

      return this.createResult(
        startTime,
        result.totalProcessed,
        result.categorized.length,
        result.failed.length,
        uncategorized.length - toCategorize.length,
        errorMessages
      );

    } catch (error) {
      logger.error('Categorization run failed', error as Error);
      return this.createResult(startTime, toCategorize.length, 0, toCategorize.length, 0, [
        (error as Error).message
      ]);
    }
  }

  /**
   * Re-categorize all transactions
   *
   * Forces re-categorization of all categorized transactions,
   * excluding those with manual overrides.
   */
  async recategorizeAll(): Promise<CategorizationResult> {
    const startTime = new Date();
    const errorMessages: string[] = [];

    logger.info('Starting full re-categorization', { processingRunId: this.processingRunId });

    // Load all categorized transactions
    const categorized = this.sheetAdapter.findTransactionsByStatus(ProcessingStatus.CATEGORISED);

    // Filter out transactions with manual overrides
    const toRecategorize = categorized.filter(t => t.categoryManualId === null);

    logger.info(`Found ${toRecategorize.length} transactions to re-categorize`, {
      processingRunId: this.processingRunId,
      totalCategorized: categorized.length,
      manualOverrides: categorized.length - toRecategorize.length
    });

    if (toRecategorize.length === 0) {
      return this.createResult(startTime, 0, 0, 0, categorized.length, []);
    }

    // Reset AI categories to allow re-categorization
    const resetTransactions = toRecategorize.map(t => ({
      ...t,
      categoryAiId: null,
      categoryAiName: null,
      categoryConfidenceScore: null,
      processingStatus: ProcessingStatus.NORMALISED
    }));

    // Load categories
    const categoriesData = this.sheetAdapter.readCategories();
    const categories: Category[] = categoriesData.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      examples: c.examples,
      isActive: c.isActive,
      createdAt: new Date(),
      modifiedAt: new Date()
    }));

    // Perform categorization
    try {
      const result = await this.categorizer.categorize(resetTransactions, categories);

      // Update successfully categorized transactions in sheet
      for (const transaction of result.categorized) {
        try {
          this.sheetAdapter.updateTransactionCategory(
            transaction.id,
            transaction.categoryAiId!,
            transaction.categoryAiName!,
            false,
            transaction.categoryConfidenceScore ?? undefined
          );
        } catch (error) {
          logger.error(`Failed to update transaction ${transaction.id}`, error as Error);
          errorMessages.push(`Failed to save category for ${transaction.id}`);
        }
      }

      // Log failures
      for (const failure of result.failed) {
        errorMessages.push(failure.error);
      }

      return this.createResult(
        startTime,
        result.totalProcessed,
        result.categorized.length,
        result.failed.length,
        categorized.length - toRecategorize.length,
        errorMessages
      );

    } catch (error) {
      logger.error('Re-categorization run failed', error as Error);
      return this.createResult(startTime, toRecategorize.length, 0, toRecategorize.length, 0, [
        (error as Error).message
      ]);
    }
  }

  /**
   * Generate unique processing run ID
   */
  private generateProcessingRunId(): string {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 8);
    return `cat-${timestamp}-${random}`;
  }

  /**
   * Create categorization result
   */
  private createResult(
    startTime: Date,
    totalProcessed: number,
    categorized: number,
    failed: number,
    skipped: number,
    errorMessages: string[]
  ): CategorizationResult {
    const endTime = new Date();

    const result: CategorizationResult = {
      success: failed === 0,
      processingRunId: this.processingRunId,
      startTime,
      endTime,
      totalProcessed,
      categorized,
      failed,
      skipped,
      errorMessages
    };

    logger.info('Categorization run completed', {
      duration: endTime.getTime() - startTime.getTime(),
      ...result
    });

    return result;
  }
}

// ============ Global Entry Points for Apps Script ============

/**
 * Main entry point - categorize uncategorized transactions
 *
 * Call this to categorize all transactions that need AI categorization.
 */
function categorizeTransactions(): CategorizationResult {
  const controller = new CategorizationController();
  return promiseToSync(() => controller.categorizeTransactions());
}

/**
 * Scheduled trigger entry point
 *
 * Called by Apps Script time-based trigger (UC-006).
 */
function runCategorization(): CategorizationResult {
  return categorizeTransactions();
}

/**
 * Force re-categorization of all transactions
 *
 * Re-runs AI categorization on all transactions, excluding manual overrides.
 */
function recategorizeAll(): CategorizationResult {
  const controller = new CategorizationController();
  return promiseToSync(() => controller.recategorizeAll());
}

/**
 * Helper to run async functions synchronously in Apps Script
 */
function promiseToSync<T>(fn: () => Promise<T>): T {
  let result: T;
  let error: Error | null = null;
  let completed = false;

  fn()
    .then(r => {
      result = r;
      completed = true;
    })
    .catch(e => {
      error = e;
      completed = true;
    });

  while (!completed) {
    Utilities.sleep(100);
  }

  if (error) {
    throw error;
  }

  return result!;
}

// Export for module usage
export {
  categorizeTransactions,
  runCategorization,
  recategorizeAll
};
