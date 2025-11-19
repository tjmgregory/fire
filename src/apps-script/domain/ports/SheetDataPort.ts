/**
 * Sheet Data Port Interface
 *
 * Defines the contract for data persistence operations.
 * Part of hexagonal architecture - domain defines needs, infrastructure implements.
 *
 * @module domain/ports/SheetDataPort
 */

import { Transaction } from '../../models/Transaction';
import { BankSourceId } from '../../models/BankSource';

/**
 * Raw row data from source sheets
 */
export type RawRowData = Record<string, unknown>;

/**
 * Sheet Data Port
 *
 * Technology-agnostic interface for data persistence.
 * Implemented by GoogleSheetsAdapter in infrastructure layer.
 */
export interface SheetDataPort {
  /**
   * Read raw data from a bank source sheet
   *
   * @param sourceId - Bank source identifier
   * @returns Array of raw row data
   */
  readSourceSheet(sourceId: BankSourceId): RawRowData[];

  /**
   * Write a transaction to the result sheet
   *
   * @param transaction - Transaction to write
   */
  writeTransaction(transaction: Transaction): void;

  /**
   * Write multiple transactions in batch
   *
   * @param transactions - Transactions to write
   */
  writeTransactionsBatch(transactions: Transaction[]): void;

  /**
   * Check if a transaction already exists (by original transaction ID)
   *
   * @param originalTransactionId - Original transaction ID from bank
   * @param sourceId - Bank source identifier
   * @returns True if transaction exists
   */
  transactionExists(originalTransactionId: string, sourceId: BankSourceId): boolean;

  /**
   * Find transactions by merchant/description (for historical learning)
   *
   * @param description - Merchant/description to search for
   * @param limit - Maximum number of results (default: 10)
   * @param daysBack - How many days to search back (default: 90)
   * @returns Matching transactions, sorted by date (newest first)
   */
  findTransactionsByMerchant(
    description: string,
    limit?: number,
    daysBack?: number
  ): Transaction[];

  /**
   * Find transactions by status
   *
   * @param status - Processing status to filter by
   * @param limit - Maximum number of results (optional)
   * @returns Matching transactions
   */
  findTransactionsByStatus(status: string, limit?: number): Transaction[];

  /**
   * Update transaction status
   *
   * @param transactionId - Transaction ID
   * @param status - New status
   */
  updateTransactionStatus(transactionId: string, status: string): void;

  /**
   * Update transaction category (AI or manual)
   *
   * @param transactionId - Transaction ID
   * @param categoryId - Category ID
   * @param categoryName - Category name
   * @param isManual - True if manual override, false if AI
   * @param confidenceScore - Confidence score (for AI categories)
   */
  updateTransactionCategory(
    transactionId: string,
    categoryId: string,
    categoryName: string,
    isManual: boolean,
    confidenceScore?: number
  ): void;

  /**
   * Read all active categories
   *
   * @returns Array of categories
   */
  readCategories(): Array<{
    id: string;
    name: string;
    description: string;
    examples: string;
    isActive: boolean;
  }>;

  /**
   * Find category by name (case-insensitive)
   *
   * @param name - Category name
   * @returns Category or null if not found
   */
  findCategoryByName(name: string): {
    id: string;
    name: string;
    description: string;
    examples: string;
    isActive: boolean;
  } | null;
}
