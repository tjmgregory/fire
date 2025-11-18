/**
 * ProcessingRun Entity Model
 *
 * Represents a single execution of the normalization or categorization process.
 * Tracks metadata about the run including success/failure counts and error logs.
 *
 * @module models/ProcessingRun
 */

import { ExchangeRateSnapshot } from './ExchangeRateSnapshot';

/**
 * Processing run type
 */
export enum RunType {
  NORMALISATION = 'NORMALISATION',
  CATEGORISATION = 'CATEGORISATION'
}

/**
 * Processing run status
 */
export enum RunStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS'
}

/**
 * ProcessingRun entity
 *
 * Represents a single execution of normalization or categorization processing.
 */
export interface ProcessingRun {
  /**
   * Unique run identifier (UUID)
   */
  id: string;

  /**
   * Type of processing run
   */
  runType: RunType;

  /**
   * Current run status
   */
  status: RunStatus;

  /**
   * When processing started
   */
  startedAt: Date;

  /**
   * When processing completed (null if still in progress)
   */
  completedAt: Date | null;

  /**
   * Number of transactions processed (attempted)
   */
  transactionsProcessed: number;

  /**
   * Number of transactions successfully processed
   */
  transactionsSucceeded: number;

  /**
   * Number of transactions that failed
   */
  transactionsFailed: number;

  /**
   * Collection of error messages
   */
  errorLog: string[];

  /**
   * Exchange rate snapshots used in this run (normalization only)
   */
  exchangeRateSnapshot: ExchangeRateSnapshot[];
}

/**
 * Validation error thrown when processing run data is invalid
 */
export class ProcessingRunValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcessingRunValidationError';
  }
}

/**
 * ProcessingRun validation and utility methods
 */
export class ProcessingRunValidator {
  /**
   * Validate a processing run object
   *
   * @param run - Processing run to validate
   * @throws ProcessingRunValidationError if validation fails
   */
  static validate(run: ProcessingRun): void {
    // Required fields
    if (!run.id) {
      throw new ProcessingRunValidationError('Run ID is required');
    }

    // Run type validation
    if (!Object.values(RunType).includes(run.runType)) {
      throw new ProcessingRunValidationError(`Invalid run type: ${run.runType}`);
    }

    // Status validation
    if (!Object.values(RunStatus).includes(run.status)) {
      throw new ProcessingRunValidationError(`Invalid run status: ${run.status}`);
    }

    // Date validation
    if (!(run.startedAt instanceof Date) || isNaN(run.startedAt.getTime())) {
      throw new ProcessingRunValidationError('Started timestamp must be a valid date');
    }

    if (run.completedAt !== null) {
      if (!(run.completedAt instanceof Date) || isNaN(run.completedAt.getTime())) {
        throw new ProcessingRunValidationError('Completed timestamp must be a valid date');
      }

      if (run.completedAt < run.startedAt) {
        throw new ProcessingRunValidationError('Completed timestamp cannot be before started timestamp');
      }
    }

    // Count validation
    if (typeof run.transactionsProcessed !== 'number' || run.transactionsProcessed < 0) {
      throw new ProcessingRunValidationError('Transactions processed must be a non-negative number');
    }

    if (typeof run.transactionsSucceeded !== 'number' || run.transactionsSucceeded < 0) {
      throw new ProcessingRunValidationError('Transactions succeeded must be a non-negative number');
    }

    if (typeof run.transactionsFailed !== 'number' || run.transactionsFailed < 0) {
      throw new ProcessingRunValidationError('Transactions failed must be a non-negative number');
    }

    // Count consistency
    if (run.transactionsSucceeded + run.transactionsFailed !== run.transactionsProcessed) {
      throw new ProcessingRunValidationError(
        'Transactions processed must equal succeeded + failed'
      );
    }

    // Array validation
    if (!Array.isArray(run.errorLog)) {
      throw new ProcessingRunValidationError('Error log must be an array');
    }

    if (!Array.isArray(run.exchangeRateSnapshot)) {
      throw new ProcessingRunValidationError('Exchange rate snapshot must be an array');
    }

    // Business rule: Exchange rates only for normalization runs
    if (run.runType === RunType.CATEGORISATION && run.exchangeRateSnapshot.length > 0) {
      throw new ProcessingRunValidationError(
        'Categorization runs should not have exchange rate snapshots'
      );
    }

    // Status consistency
    if (run.status === RunStatus.IN_PROGRESS && run.completedAt !== null) {
      throw new ProcessingRunValidationError('In-progress runs should not have completion timestamp');
    }

    if (run.status !== RunStatus.IN_PROGRESS && run.completedAt === null) {
      throw new ProcessingRunValidationError('Completed runs must have completion timestamp');
    }
  }

  /**
   * Calculate run duration in milliseconds
   *
   * @param run - Processing run
   * @returns Duration in milliseconds, or null if not completed
   */
  static getDurationMs(run: ProcessingRun): number | null {
    if (!run.completedAt) {
      return null;
    }
    return run.completedAt.getTime() - run.startedAt.getTime();
  }

  /**
   * Calculate success rate as a percentage
   *
   * @param run - Processing run
   * @returns Success rate (0-100), or null if no transactions processed
   */
  static getSuccessRate(run: ProcessingRun): number | null {
    if (run.transactionsProcessed === 0) {
      return null;
    }
    return (run.transactionsSucceeded / run.transactionsProcessed) * 100;
  }

  /**
   * Check if run completed successfully (all transactions succeeded)
   *
   * @param run - Processing run
   * @returns True if status is COMPLETED and all transactions succeeded
   */
  static isFullSuccess(run: ProcessingRun): boolean {
    return run.status === RunStatus.COMPLETED && run.transactionsFailed === 0;
  }

  /**
   * Check if run had partial success (some failures but not total failure)
   *
   * @param run - Processing run
   * @returns True if some transactions succeeded and some failed
   */
  static isPartialSuccess(run: ProcessingRun): boolean {
    return run.status === RunStatus.PARTIAL_SUCCESS ||
           (run.transactionsSucceeded > 0 && run.transactionsFailed > 0);
  }
}

/**
 * ProcessingRun factory methods
 */
export class ProcessingRunFactory {
  /**
   * Create a new processing run
   *
   * @param runType - Type of processing run
   * @returns New processing run object
   */
  static create(runType: RunType): ProcessingRun {
    const run: ProcessingRun = {
      id: this.generateUUID(),
      runType,
      status: RunStatus.IN_PROGRESS,
      startedAt: new Date(),
      completedAt: null,
      transactionsProcessed: 0,
      transactionsSucceeded: 0,
      transactionsFailed: 0,
      errorLog: [],
      exchangeRateSnapshot: []
    };

    ProcessingRunValidator.validate(run);
    return run;
  }

  /**
   * Complete a processing run successfully
   *
   * @param run - Processing run to complete
   * @param transactionsSucceeded - Number of transactions succeeded
   * @param transactionsFailed - Number of transactions failed
   * @returns Updated processing run
   */
  static complete(
    run: ProcessingRun,
    transactionsSucceeded: number,
    transactionsFailed: number
  ): ProcessingRun {
    const updated: ProcessingRun = {
      ...run,
      status: transactionsFailed === 0 ? RunStatus.COMPLETED : RunStatus.PARTIAL_SUCCESS,
      completedAt: new Date(),
      transactionsProcessed: transactionsSucceeded + transactionsFailed,
      transactionsSucceeded,
      transactionsFailed
    };

    ProcessingRunValidator.validate(updated);
    return updated;
  }

  /**
   * Mark a processing run as failed
   *
   * @param run - Processing run to fail
   * @param error - Error message
   * @returns Updated processing run
   */
  static fail(run: ProcessingRun, error: string): ProcessingRun {
    const updated: ProcessingRun = {
      ...run,
      status: RunStatus.FAILED,
      completedAt: new Date(),
      errorLog: [...run.errorLog, error]
    };

    ProcessingRunValidator.validate(updated);
    return updated;
  }

  /**
   * Add an error to the run's error log
   *
   * @param run - Processing run
   * @param error - Error message
   * @returns Updated processing run
   */
  static addError(run: ProcessingRun, error: string): ProcessingRun {
    return {
      ...run,
      errorLog: [...run.errorLog, error]
    };
  }

  /**
   * Add exchange rate snapshots to the run
   *
   * @param run - Processing run
   * @param snapshots - Exchange rate snapshots
   * @returns Updated processing run
   * @throws ProcessingRunValidationError if not a normalization run
   */
  static addExchangeRateSnapshots(
    run: ProcessingRun,
    snapshots: ExchangeRateSnapshot[]
  ): ProcessingRun {
    if (run.runType !== RunType.NORMALISATION) {
      throw new ProcessingRunValidationError(
        'Exchange rate snapshots can only be added to normalization runs'
      );
    }

    const updated: ProcessingRun = {
      ...run,
      exchangeRateSnapshot: [...run.exchangeRateSnapshot, ...snapshots]
    };

    ProcessingRunValidator.validate(updated);
    return updated;
  }

  /**
   * Generate a new UUID
   *
   * @returns New UUID string
   */
  private static generateUUID(): string {
    if (typeof Utilities !== 'undefined' && Utilities.getUuid) {
      return Utilities.getUuid();
    }

    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
