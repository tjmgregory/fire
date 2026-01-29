/**
 * Normalization Controller
 *
 * Orchestrates the transaction normalization workflow.
 * Entry points for processing transactions from source sheets.
 *
 * Satisfies:
 * - UC-001: Import and Normalize Transactions
 * - UC-005: Execute Scheduled Normalization
 * - FR-001, FR-003, FR-004, FR-006, FR-010, FR-012
 *
 * @module controllers/NormalizationController
 */

import { Transaction, ProcessingStatus, CurrencyCode } from '../models/Transaction';
import { BankSourceId } from '../models/BankSource';
import { SheetDataAdapter } from '../infrastructure/adapters/SheetDataAdapter';
import { ExchangeRateAdapter } from '../infrastructure/adapters/ExchangeRateAdapter';
import { TransactionNormalizer } from '../domain/normalizers/TransactionNormalizer';
import { CurrencyConverter } from '../domain/converters/CurrencyConverter';
import { DuplicateDetector } from '../domain/normalization/DuplicateDetector';
import { getActiveBankSources } from '../infrastructure/config/BankSourceConfig';
import { logger } from '../infrastructure/logging/ErrorLogger';

/**
 * Normalization result for a single source
 */
interface SourceNormalizationResult {
  sourceId: BankSourceId;
  totalRows: number;
  normalized: number;
  duplicates: number;
  errors: number;
  errorMessages: string[];
}

/**
 * Overall normalization result
 */
interface NormalizationResult {
  success: boolean;
  processingRunId: string;
  startTime: Date;
  endTime: Date;
  sources: SourceNormalizationResult[];
  totalProcessed: number;
  totalNormalized: number;
  totalDuplicates: number;
  totalErrors: number;
}

/**
 * Normalization Controller
 *
 * Coordinates the normalization process across all bank sources.
 */
export class NormalizationController {
  private sheetAdapter: SheetDataAdapter;
  private exchangeRateAdapter: ExchangeRateAdapter;
  private normalizer: TransactionNormalizer;
  private duplicateDetector: DuplicateDetector;
  private currencyConverter: CurrencyConverter;
  private processingRunId: string;

  constructor() {
    this.processingRunId = this.generateProcessingRunId();
    this.sheetAdapter = new SheetDataAdapter();
    this.exchangeRateAdapter = new ExchangeRateAdapter();

    // Initialize normalizer with active bank sources
    const activeSources = getActiveBankSources();
    this.normalizer = new TransactionNormalizer(activeSources);

    // Initialize currency converter
    this.currencyConverter = new CurrencyConverter(
      this.exchangeRateAdapter,
      this.processingRunId
    );

    // Initialize duplicate detector with existing transactions
    const existingTransactions = this.sheetAdapter.findTransactionsByStatus(
      ProcessingStatus.NORMALISED
    ).concat(
      this.sheetAdapter.findTransactionsByStatus(ProcessingStatus.CATEGORISED)
    );
    this.duplicateDetector = new DuplicateDetector(existingTransactions);

    logger.info('NormalizationController initialized', {
      processingRunId: this.processingRunId,
      activeSources: activeSources.map(s => s.id),
      existingTransactions: existingTransactions.length
    });
  }

  /**
   * Process all source sheets
   *
   * Main entry point for normalization. Processes all active bank sources.
   */
  async processAllSources(): Promise<NormalizationResult> {
    const startTime = new Date();
    const results: SourceNormalizationResult[] = [];

    logger.info('Starting normalization run', { processingRunId: this.processingRunId });

    const activeSources = getActiveBankSources();

    for (const source of activeSources) {
      try {
        const result = await this.processSource(source.id);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to process source ${source.id}`, error as Error);
        results.push({
          sourceId: source.id,
          totalRows: 0,
          normalized: 0,
          duplicates: 0,
          errors: 1,
          errorMessages: [(error as Error).message]
        });
      }
    }

    const endTime = new Date();
    const totals = this.aggregateResults(results);

    const result: NormalizationResult = {
      success: totals.totalErrors === 0,
      processingRunId: this.processingRunId,
      startTime,
      endTime,
      sources: results,
      ...totals
    };

    logger.info('Normalization run completed', {
      processingRunId: this.processingRunId,
      duration: endTime.getTime() - startTime.getTime(),
      ...totals
    });

    return result;
  }

  /**
   * Process a single source sheet
   */
  async processSource(sourceId: BankSourceId): Promise<SourceNormalizationResult> {
    logger.info(`Processing source: ${sourceId}`, { processingRunId: this.processingRunId });

    const result: SourceNormalizationResult = {
      sourceId,
      totalRows: 0,
      normalized: 0,
      duplicates: 0,
      errors: 0,
      errorMessages: []
    };

    // Read raw data from source sheet
    const rawRows = this.sheetAdapter.readSourceSheet(sourceId);
    result.totalRows = rawRows.length;

    if (rawRows.length === 0) {
      logger.info(`No rows found in ${sourceId}`, { processingRunId: this.processingRunId });
      return result;
    }

    // Normalize each row
    const normalizedTransactions: Transaction[] = [];

    for (const rawRow of rawRows) {
      try {
        // Skip empty rows
        if (!rawRow || Object.keys(rawRow).length === 0) {
          continue;
        }

        // Normalize the transaction
        const transaction = this.normalizer.normalize(rawRow, sourceId);

        // Check for duplicates
        const duplicateCheck = this.duplicateDetector.isDuplicate(transaction);
        if (duplicateCheck.isDuplicate) {
          result.duplicates++;
          continue;
        }

        // Convert currency if needed
        if (transaction.originalAmountCurrency !== CurrencyCode.GBP) {
          const conversionResult = await this.currencyConverter.convertToGBP(transaction);
          transaction.gbpAmountValue = conversionResult.gbpAmount;
          transaction.exchangeRateValue = conversionResult.exchangeRate;
        }

        // Update processing status
        transaction.processingStatus = ProcessingStatus.NORMALISED;
        transaction.timestampNormalised = new Date();
        transaction.timestampLastModified = new Date();

        normalizedTransactions.push(transaction);
        this.duplicateDetector.register(transaction);
        result.normalized++;

      } catch (error) {
        result.errors++;
        const errorMessage = (error as Error).message;
        result.errorMessages.push(errorMessage);
        logger.error(`Failed to normalize row`, error as Error, { sourceId, rawRow });
      }
    }

    // Write normalized transactions in batch
    if (normalizedTransactions.length > 0) {
      this.sheetAdapter.writeTransactionsBatch(normalizedTransactions);
      logger.info(`Wrote ${normalizedTransactions.length} transactions from ${sourceId}`);
    }

    return result;
  }

  /**
   * Process a single sheet by name
   *
   * Allows processing specific bank sources on demand.
   */
  async processSheetByName(sheetName: string): Promise<SourceNormalizationResult> {
    // Map sheet name to source ID
    const activeSources = getActiveBankSources();
    const source = activeSources.find(s => s.sheetName === sheetName);

    if (!source) {
      throw new Error(`Unknown sheet name: ${sheetName}`);
    }

    return this.processSource(source.id);
  }

  /**
   * Generate unique processing run ID
   */
  private generateProcessingRunId(): string {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 8);
    return `run-${timestamp}-${random}`;
  }

  /**
   * Aggregate results from all sources
   */
  private aggregateResults(results: SourceNormalizationResult[]): {
    totalProcessed: number;
    totalNormalized: number;
    totalDuplicates: number;
    totalErrors: number;
  } {
    return results.reduce(
      (acc, result) => ({
        totalProcessed: acc.totalProcessed + result.totalRows,
        totalNormalized: acc.totalNormalized + result.normalized,
        totalDuplicates: acc.totalDuplicates + result.duplicates,
        totalErrors: acc.totalErrors + result.errors
      }),
      { totalProcessed: 0, totalNormalized: 0, totalDuplicates: 0, totalErrors: 0 }
    );
  }
}

// ============ Global Entry Points for Apps Script ============

/**
 * Main entry point - process all source sheets
 *
 * Call this to normalize transactions from all configured bank sources.
 */
function processNewTransactions(): NormalizationResult {
  const controller = new NormalizationController();
  return promiseToSync(() => controller.processAllSources());
}

/**
 * Scheduled trigger entry point
 *
 * Called by Apps Script time-based trigger (UC-005).
 */
function runNormalization(): NormalizationResult {
  return processNewTransactions();
}

/**
 * Process single sheet by name
 *
 * @param sheetName - Name of the sheet to process
 */
function normalizeFromSheet(sheetName: string): SourceNormalizationResult {
  const controller = new NormalizationController();
  return promiseToSync(() => controller.processSheetByName(sheetName));
}

/**
 * Helper to run async functions synchronously in Apps Script
 *
 * Apps Script doesn't fully support async/await at the top level,
 * so we need this wrapper for global functions.
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

  // Spin until promise resolves (Apps Script is single-threaded)
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
  processNewTransactions,
  runNormalization,
  normalizeFromSheet
};
