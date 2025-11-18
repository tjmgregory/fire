/**
 * Duplicate Detector
 *
 * Prevents duplicate transactions from being added to the result sheet.
 * Uses hash-based lookup with originalTransactionId as the primary key.
 *
 * Satisfies:
 * - FR-010: Transaction Deduplication
 * - FR-002: Concurrent Transaction Handling (via unique IDs)
 * - FR-012: Source Sheet ID Backfilling (supports generated IDs)
 *
 * Design per SAD 5.2.7: Hash-based deduplication with conflict resolution
 *
 * @module domain/normalization/DuplicateDetector
 */

import { Transaction } from '../../models/Transaction';

/**
 * Result of duplicate detection check
 */
export interface DuplicateCheckResult {
  /** Whether the transaction is a duplicate */
  isDuplicate: boolean;

  /** Existing transaction if duplicate found, null otherwise */
  existingTransaction: Transaction | null;

  /** Optional message explaining the duplicate detection result */
  message?: string;
}

/**
 * Duplicate detection statistics
 */
export interface DuplicateStats {
  /** Total number of transactions checked */
  totalChecked: number;

  /** Number of duplicates detected */
  duplicatesFound: number;

  /** Number of unique transactions */
  uniqueTransactions: number;
}

/**
 * Duplicate Detector
 *
 * Detects and prevents duplicate transactions using hash-based lookup.
 * Primary key: originalTransactionId (from bank or system-generated per FR-012)
 */
export class DuplicateDetector {
  /** Hash map of existing transactions keyed by originalTransactionId */
  private transactionIndex: Map<string, Transaction>;

  /** Statistics for tracking duplicate detection performance */
  private stats: DuplicateStats;

  /**
   * Initialize detector with existing transactions
   *
   * @param existingTransactions - Array of existing transactions to index
   */
  constructor(existingTransactions: Transaction[] = []) {
    this.transactionIndex = new Map();
    this.stats = {
      totalChecked: 0,
      duplicatesFound: 0,
      uniqueTransactions: 0
    };

    // Build hash index from existing transactions
    this.buildIndex(existingTransactions);
  }

  /**
   * Build transaction index from existing transactions
   *
   * @param transactions - Transactions to index
   */
  private buildIndex(transactions: Transaction[]): void {
    transactions.forEach(transaction => {
      const key = this.getDeduplicationKey(transaction);
      this.transactionIndex.set(key, transaction);
    });

    this.stats.uniqueTransactions = this.transactionIndex.size;
  }

  /**
   * Get deduplication key for a transaction
   *
   * Uses originalTransactionId as the primary key per FR-010.
   * This supports both bank-native IDs and system-generated IDs (FR-012).
   *
   * @param transaction - Transaction to get key for
   * @returns Deduplication key
   */
  private getDeduplicationKey(transaction: Transaction): string {
    return transaction.originalTransactionId;
  }

  /**
   * Check if a transaction is a duplicate
   *
   * @param transaction - Transaction to check
   * @returns Duplicate check result
   */
  isDuplicate(transaction: Transaction): DuplicateCheckResult {
    this.stats.totalChecked++;

    const key = this.getDeduplicationKey(transaction);
    const existing = this.transactionIndex.get(key);

    if (existing) {
      this.stats.duplicatesFound++;
      return {
        isDuplicate: true,
        existingTransaction: existing,
        message: `Duplicate transaction found: ${key} (${transaction.description})`
      };
    }

    return {
      isDuplicate: false,
      existingTransaction: null,
      message: `New transaction: ${key}`
    };
  }

  /**
   * Register a new transaction after successful insertion
   *
   * Call this after a transaction has been successfully written to the
   * result sheet to keep the index up to date.
   *
   * @param transaction - Transaction to register
   */
  register(transaction: Transaction): void {
    const key = this.getDeduplicationKey(transaction);

    // Only register if not already present (idempotent)
    if (!this.transactionIndex.has(key)) {
      this.transactionIndex.set(key, transaction);
      this.stats.uniqueTransactions++;
    }
  }

  /**
   * Filter out duplicates from a batch of transactions
   *
   * Returns only the unique transactions that don't exist in the index.
   * Updates statistics for the batch.
   *
   * @param transactions - Transactions to filter
   * @returns Array of unique transactions
   */
  filterDuplicates(transactions: Transaction[]): Transaction[] {
    const unique: Transaction[] = [];

    transactions.forEach(transaction => {
      const result = this.isDuplicate(transaction);

      if (!result.isDuplicate) {
        unique.push(transaction);
      }
    });

    return unique;
  }

  /**
   * Get duplicate detection statistics
   *
   * @returns Current statistics
   */
  getStats(): DuplicateStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics (useful for testing or new batches)
   */
  resetStats(): void {
    this.stats.totalChecked = 0;
    this.stats.duplicatesFound = 0;
    // Keep uniqueTransactions count as it reflects index size
  }

  /**
   * Get the current size of the transaction index
   *
   * @returns Number of unique transactions in the index
   */
  getIndexSize(): number {
    return this.transactionIndex.size;
  }

  /**
   * Clear the entire transaction index
   *
   * Use with caution - this removes all indexed transactions.
   */
  clear(): void {
    this.transactionIndex.clear();
    this.stats = {
      totalChecked: 0,
      duplicatesFound: 0,
      uniqueTransactions: 0
    };
  }

  /**
   * Check if a transaction ID exists in the index
   *
   * @param transactionId - Original transaction ID to check
   * @returns True if transaction exists in index
   */
  hasTransaction(transactionId: string): boolean {
    return this.transactionIndex.has(transactionId);
  }

  /**
   * Get an existing transaction by ID
   *
   * @param transactionId - Original transaction ID
   * @returns Transaction if found, undefined otherwise
   */
  getTransaction(transactionId: string): Transaction | undefined {
    return this.transactionIndex.get(transactionId);
  }
}
