/**
 * AI Categorization Port Interface
 *
 * Defines the contract for AI-powered transaction categorization.
 * Part of hexagonal architecture - domain defines needs, infrastructure implements.
 *
 * @module domain/ports/AICategorizationPort
 */

import { Transaction } from '../../models/Transaction';

/**
 * Category information for AI context
 */
export interface CategoryInfo {
  /**
   * Category ID (UUID)
   */
  id: string;

  /**
   * Category name
   */
  name: string;

  /**
   * Category description
   */
  description: string;

  /**
   * Example transactions/merchants for this category
   */
  examples: string;
}

/**
 * Historical context for AI categorization
 */
export interface HistoricalContext {
  /**
   * Similar transactions from history
   */
  similarTransactions: Array<{
    description: string;
    categoryId: string;
    categoryName: string;
    wasManualOverride: boolean;
    confidenceScore?: number;
  }>;
}

/**
 * Categorization result from AI
 */
export interface CategorizationResult {
  /**
   * Transaction ID that was categorized
   */
  transactionId: string;

  /**
   * Assigned category ID
   */
  categoryId: string;

  /**
   * Assigned category name
   */
  categoryName: string;

  /**
   * Confidence score (0-100)
   */
  confidenceScore: number;

  /**
   * Optional reasoning from AI
   */
  reasoning?: string;
}

/**
 * AI Categorization Port
 *
 * Technology-agnostic interface for AI categorization services.
 * Implemented by OpenAIAdapter in infrastructure layer.
 */
export interface AICategorizationPort {
  /**
   * Categorize a batch of transactions
   *
   * @param transactions - Transactions to categorize
   * @param categories - Available categories
   * @param context - Historical context for learning (optional)
   * @returns Categorization results
   */
  categorizeBatch(
    transactions: Transaction[],
    categories: CategoryInfo[],
    context?: HistoricalContext
  ): Promise<CategorizationResult[]>;

  /**
   * Categorize a single transaction
   *
   * @param transaction - Transaction to categorize
   * @param categories - Available categories
   * @param context - Historical context for learning (optional)
   * @returns Categorization result
   */
  categorizeSingle(
    transaction: Transaction,
    categories: CategoryInfo[],
    context?: HistoricalContext
  ): Promise<CategorizationResult>;
}
