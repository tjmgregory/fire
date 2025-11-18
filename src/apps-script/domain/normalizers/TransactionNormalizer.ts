/**
 * Transaction Normalizer
 *
 * Orchestrates bank-specific normalization strategies.
 * Selects appropriate normalizer based on BankSource configuration
 * and handles ID generation for banks without native IDs (FR-012).
 *
 * Satisfies:
 * - UC-001: Import and Normalize Transactions
 * - UC-005: Execute Scheduled Normalization
 * - FR-001: Transaction Normalization
 * - FR-002: Concurrent Transaction Handling
 * - FR-012: Source Sheet ID Backfilling
 *
 * @module domain/normalizers/TransactionNormalizer
 */

import { Transaction, BankSourceId } from '../../models/Transaction';
import { BankSource } from '../../models/BankSource';
import { RawRowData } from '../ports/SheetDataPort';
import { BankNormalizer } from './BankNormalizer';
import { MonzoNormalizer } from './MonzoNormalizer';
import { RevolutNormalizer } from './RevolutNormalizer';
import { YonderNormalizer } from './YonderNormalizer';

/**
 * Factory for creating bank-specific normalizers
 *
 * Implements Strategy pattern (SAD 5.2.4) to handle different
 * bank export formats through polymorphic normalization.
 */
export class TransactionNormalizer {
  private normalizers: Map<BankSourceId, BankNormalizer>;

  /**
   * Initialize normalizer with bank sources
   *
   * @param sources - Array of configured bank sources
   */
  constructor(sources: BankSource[]) {
    this.normalizers = new Map();

    // Register normalizers for each source
    sources.forEach(source => {
      this.normalizers.set(source.id, this.createNormalizer(source));
    });
  }

  /**
   * Create appropriate normalizer for bank source
   *
   * @param source - Bank source configuration
   * @returns Bank-specific normalizer instance
   * @throws Error if source ID is not supported
   */
  private createNormalizer(source: BankSource): BankNormalizer {
    switch (source.id) {
      case BankSourceId.MONZO:
        return new MonzoNormalizer(source);
      case BankSourceId.REVOLUT:
        return new RevolutNormalizer(source);
      case BankSourceId.YONDER:
        return new YonderNormalizer(source);
      default:
        throw new Error(`Unsupported bank source: ${source.id}`);
    }
  }

  /**
   * Normalize raw transaction data
   *
   * Delegates to appropriate bank-specific normalizer based on source.
   *
   * @param rawData - Raw row data from bank export
   * @param sourceId - Bank source identifier
   * @returns Normalized transaction entity
   * @throws Error if source is not registered
   */
  normalize(rawData: RawRowData, sourceId: BankSourceId): Transaction {
    const normalizer = this.normalizers.get(sourceId);

    if (!normalizer) {
      throw new Error(
        `No normalizer registered for source: ${sourceId}. ` +
        `Available sources: ${Array.from(this.normalizers.keys()).join(', ')}`
      );
    }

    return normalizer.normalize(rawData);
  }

  /**
   * Check if source requires ID backfilling
   *
   * Banks without native transaction IDs (Revolut, Yonder) require
   * the system to generate and backfill IDs to source sheets (FR-012).
   *
   * @param sourceId - Bank source identifier
   * @returns True if source requires ID backfilling
   */
  requiresIdBackfilling(sourceId: BankSourceId): boolean {
    const normalizer = this.normalizers.get(sourceId);

    if (!normalizer) {
      throw new Error(`Unknown source: ${sourceId}`);
    }

    // Access the source through the protected field
    // We know this is safe because we control the BankNormalizer implementations
    return !(normalizer as any).source.hasNativeTransactionId;
  }

  /**
   * Get registered bank source IDs
   *
   * @returns Array of registered source identifiers
   */
  getRegisteredSources(): BankSourceId[] {
    return Array.from(this.normalizers.keys());
  }
}
