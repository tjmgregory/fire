/**
 * Monzo Normalizer
 *
 * Normalizes Monzo bank export format to Transaction entity.
 * Monzo provides native transaction IDs and comprehensive metadata.
 *
 * @module domain/normalizers/MonzoNormalizer
 */

import { Transaction, CurrencyCode, ProcessingStatus } from '../../models/Transaction';
import { RawRowData } from '../ports/SheetDataPort';
import { BankNormalizer } from './BankNormalizer';
import { BankSource } from '../../models/BankSource';

/**
 * Monzo-specific normalizer
 *
 * Monzo characteristics:
 * - Native transaction IDs (use as-is)
 * - Separate Date and Time columns
 * - Notes and tags support
 * - Comprehensive metadata
 */
export class MonzoNormalizer extends BankNormalizer {
  constructor(source: BankSource) {
    super(source);
  }

  /**
   * Normalize Monzo transaction
   *
   * @param rawData - Raw Monzo export row
   * @returns Normalized transaction
   */
  normalize(rawData: RawRowData): Transaction {
    const base = this.createBaseTransaction(rawData);

    // Get transaction ID (native from Monzo)
    const originalTransactionId = this.getRequiredString(rawData, 'transactionId');

    // Parse date and time
    const date = this.getRequiredDate(rawData, 'date');
    const timeValue = this.getValue(rawData, 'time');

    // Combine date and time if time is available
    let transactionDate = date;
    if (timeValue && typeof timeValue === 'string') {
      const timeParts = timeValue.split(':');
      if (timeParts.length >= 2) {
        transactionDate = new Date(date);
        transactionDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2] || '0'));
      }
    }

    // Get transaction details
    // Monzo maps description to 'Name' column, but some transaction types
    // (interest, overdraft, cashback, cheque, card fees, international payments)
    // have an empty Name. Fall back to the raw 'Description' column.
    const nameValue = this.getValue(rawData, 'description');
    const nameStr = typeof nameValue === 'string' ? nameValue.trim() : '';
    const description = nameStr.length > 0
      ? nameStr
      : String(rawData['Description'] ?? '').trim() || 'Unknown';

    const amount = this.getRequiredAmount(rawData, 'amount');
    const currency = this.getCurrencyCode(rawData, 'currency');

    // Notes and Description columns can contain numeric values in Monzo exports;
    // coerce to string before validation.
    const rawNotes = this.getValue(rawData, 'notes');
    const notes = rawNotes != null && rawNotes !== ''
      ? String(rawNotes).trim() || null
      : null;

    // Extract original bank category (freetext, used as AI hint)
    const rawCategory = this.getValue(rawData, 'category');
    const originalCategory = typeof rawCategory === 'string' && rawCategory.trim().length > 0
      ? rawCategory.trim()
      : null;

    const transaction: Transaction = {
      ...base,
      id: this.generateUUID(),
      originalTransactionId,
      transactionDate,
      transactionType: this.determineType(amount),
      description,
      notes,
      country: null,
      originalAmountValue: Math.abs(amount),
      originalAmountCurrency: currency,
      gbpAmountValue: currency === CurrencyCode.GBP ? Math.abs(amount) : 0, // Will be set by currency converter
      bankSourceId: this.source.id,
      processingStatus: ProcessingStatus.UNPROCESSED,
      errorMessage: null,
      exchangeRateValue: null,
      originalCategory,
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
