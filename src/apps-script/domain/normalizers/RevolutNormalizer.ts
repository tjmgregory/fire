/**
 * Revolut Normalizer
 *
 * Normalizes Revolut bank export format to Transaction entity.
 * Revolut does not provide native IDs - generates UUIDs and backfills to source sheet.
 *
 * @module domain/normalizers/RevolutNormalizer
 */

import { Transaction, CurrencyCode, ProcessingStatus } from '../../models/Transaction';
import { RawRowData } from '../ports/SheetDataPort';
import { BankNormalizer } from './BankNormalizer';
import { BankSource } from '../../models/BankSource';

/**
 * Revolut-specific normalizer
 *
 * Revolut characteristics:
 * - No native transaction IDs (generates UUID, backfilled to source sheet)
 * - Separate Started Date and Completed Date
 * - Fee column (separate from amount)
 * - State and Balance columns
 */
export class RevolutNormalizer extends BankNormalizer {
  constructor(source: BankSource) {
    super(source);
  }

  /**
   * Normalize Revolut transaction
   *
   * @param rawData - Raw Revolut export row
   * @returns Normalized transaction
   */
  normalize(rawData: RawRowData): Transaction {
    const base = this.createBaseTransaction(rawData);

    // Parse dates (use Started Date as primary, Completed Date if available)
    const startedDate = this.getRequiredDate(rawData, 'date');
    const completedDateValue = this.getValue(rawData, 'completedDate');
    const transactionDate = completedDateValue
      ? new Date(completedDateValue as string)
      : startedDate;

    // Get transaction details
    const description = this.getRequiredString(rawData, 'description');
    const amount = this.getRequiredAmount(rawData, 'amount');
    const currency = this.getCurrencyCode(rawData, 'currency');

    // Use existing ID if already backfilled, otherwise generate a new UUID (FR-012)
    const existingId = this.getOptionalString(rawData, 'transactionId');
    const originalTransactionId = existingId || this.generateUUID();

    const transaction: Transaction = {
      ...base,
      id: this.generateUUID(),
      originalTransactionId,
      transactionDate,
      transactionType: this.determineType(amount),
      description,
      notes: null,
      country: null,
      originalAmountValue: Math.abs(amount),
      originalAmountCurrency: currency,
      gbpAmountValue: currency === CurrencyCode.GBP ? Math.abs(amount) : 0, // Will be set by currency converter
      bankSourceId: this.source.id,
      processingStatus: ProcessingStatus.UNPROCESSED,
      errorMessage: null,
      exchangeRateValue: null,
      originalCategory: null, // Revolut exports don't include categories
      categoryAiId: null,
      categoryAiName: null,
      categoryConfidenceScore: null,
      categoryManualId: null,
      categoryManualName: null,
      timestampCreated: new Date(),
      timestampLastModified: new Date(),
      timestampNormalised: null,
      timestampCategorised: null
    };

    return transaction;
  }
}
