/**
 * Status Manager
 *
 * Manages ProcessingStatus transitions for transactions.
 * Encapsulates status lifecycle logic, validates transitions,
 * and automatically updates timestamps.
 *
 * Valid transitions:
 *   UNPROCESSED -> NORMALISED -> CATEGORISED
 *   Any state -> ERROR (can occur at any stage)
 *   ERROR -> NORMALISED or CATEGORISED (retry)
 *
 * @module domain/processing/StatusManager
 */

import {
  Transaction,
  ProcessingStatus,
  TransactionValidator,
  TransactionValidationError
} from '../../models/Transaction';

/**
 * Result of a status transition attempt
 */
export interface StatusTransitionResult {
  success: boolean;
  previousStatus: ProcessingStatus;
  newStatus: ProcessingStatus;
  error?: string;
}

/**
 * Error thrown when a status transition is invalid
 */
export class InvalidStatusTransitionError extends Error {
  public readonly fromStatus: ProcessingStatus;
  public readonly toStatus: ProcessingStatus;

  constructor(fromStatus: ProcessingStatus, toStatus: ProcessingStatus) {
    super(`Invalid status transition: ${fromStatus} -> ${toStatus}`);
    this.name = 'InvalidStatusTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

/**
 * Status Manager
 *
 * Provides a clean API for managing transaction processing status.
 * All transitions are validated and timestamps are automatically updated.
 */
export class StatusManager {
  /**
   * Transition a transaction to NORMALISED status
   *
   * @param transaction - Transaction to update (mutated in place)
   * @throws InvalidStatusTransitionError if transition is not allowed
   */
  static markAsNormalised(transaction: Transaction): StatusTransitionResult {
    return this.transition(transaction, ProcessingStatus.NORMALISED, () => {
      transaction.timestampNormalised = new Date();
    });
  }

  /**
   * Transition a transaction to CATEGORISED status
   *
   * @param transaction - Transaction to update (mutated in place)
   * @throws InvalidStatusTransitionError if transition is not allowed
   */
  static markAsCategorised(transaction: Transaction): StatusTransitionResult {
    return this.transition(transaction, ProcessingStatus.CATEGORISED, () => {
      transaction.timestampCategorised = new Date();
    });
  }

  /**
   * Transition a transaction to ERROR status
   *
   * @param transaction - Transaction to update (mutated in place)
   * @param errorMessage - Error message describing the failure
   */
  static markAsError(
    transaction: Transaction,
    errorMessage: string
  ): StatusTransitionResult {
    return this.transition(transaction, ProcessingStatus.ERROR, () => {
      transaction.errorMessage = errorMessage;
    });
  }

  /**
   * Clear error and retry from ERROR state
   *
   * @param transaction - Transaction in ERROR state
   * @param targetStatus - Status to transition to (NORMALISED or CATEGORISED)
   * @throws InvalidStatusTransitionError if transaction is not in ERROR state
   */
  static retryFromError(
    transaction: Transaction,
    targetStatus: ProcessingStatus.NORMALISED | ProcessingStatus.CATEGORISED
  ): StatusTransitionResult {
    if (transaction.processingStatus !== ProcessingStatus.ERROR) {
      throw new InvalidStatusTransitionError(
        transaction.processingStatus,
        targetStatus
      );
    }

    return this.transition(transaction, targetStatus, () => {
      transaction.errorMessage = null;
      if (targetStatus === ProcessingStatus.NORMALISED) {
        transaction.timestampNormalised = new Date();
      } else {
        transaction.timestampCategorised = new Date();
      }
    });
  }

  /**
   * Check if a transition is valid without performing it
   *
   * @param fromStatus - Current status
   * @param toStatus - Target status
   * @returns True if the transition is valid
   */
  static canTransition(
    fromStatus: ProcessingStatus,
    toStatus: ProcessingStatus
  ): boolean {
    try {
      TransactionValidator.validateStatusTransition(fromStatus, toStatus);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the next valid status in the happy path
   *
   * @param currentStatus - Current processing status
   * @returns Next status in the normal flow, or null if at end
   */
  static getNextStatus(currentStatus: ProcessingStatus): ProcessingStatus | null {
    switch (currentStatus) {
      case ProcessingStatus.UNPROCESSED:
        return ProcessingStatus.NORMALISED;
      case ProcessingStatus.NORMALISED:
        return ProcessingStatus.CATEGORISED;
      case ProcessingStatus.CATEGORISED:
        return null; // Terminal state
      case ProcessingStatus.ERROR:
        return null; // Requires explicit retry
      default:
        return null;
    }
  }

  /**
   * Check if a transaction is in a terminal state
   *
   * @param transaction - Transaction to check
   * @returns True if in CATEGORISED or ERROR state
   */
  static isTerminal(transaction: Transaction): boolean {
    return (
      transaction.processingStatus === ProcessingStatus.CATEGORISED ||
      transaction.processingStatus === ProcessingStatus.ERROR
    );
  }

  /**
   * Check if a transaction can be processed further
   *
   * @param transaction - Transaction to check
   * @returns True if not in ERROR state and not fully processed
   */
  static canProgress(transaction: Transaction): boolean {
    return (
      transaction.processingStatus !== ProcessingStatus.ERROR &&
      transaction.processingStatus !== ProcessingStatus.CATEGORISED
    );
  }

  /**
   * Internal transition helper
   *
   * @param transaction - Transaction to update
   * @param toStatus - Target status
   * @param onSuccess - Callback to run on successful transition
   */
  private static transition(
    transaction: Transaction,
    toStatus: ProcessingStatus,
    onSuccess: () => void
  ): StatusTransitionResult {
    const previousStatus = transaction.processingStatus;

    try {
      TransactionValidator.validateStatusTransition(previousStatus, toStatus);
    } catch (error) {
      if (error instanceof TransactionValidationError) {
        throw new InvalidStatusTransitionError(previousStatus, toStatus);
      }
      throw error;
    }

    // Update status
    transaction.processingStatus = toStatus;
    transaction.timestampLastModified = new Date();

    // Run status-specific updates
    onSuccess();

    return {
      success: true,
      previousStatus,
      newStatus: toStatus
    };
  }
}
