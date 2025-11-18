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
    const description = this.getRequiredString(rawData, 'description');
    const amount = this.getRequiredAmount(rawData, 'amount');
    const currency = this.getCurrencyCode(rawData, 'currency');
    const notes = this.getOptionalString(rawData, 'notes');

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
