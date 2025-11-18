/**
 * Yonder Normalizer
 *
 * Normalizes Yonder bank export format to Transaction entity.
 * Yonder does not provide native IDs and only deals in GBP.
 *
 * @module domain/normalizers/YonderNormalizer
 */

import { Transaction, ProcessingStatus, TransactionType } from '../../models/Transaction';
import { RawRowData } from '../ports/SheetDataPort';
import { BankNormalizer } from './BankNormalizer';
import { BankSource } from '../../models/BankSource';

/**
 * Yonder-specific normalizer
 *
 * Yonder characteristics:
 * - No native transaction IDs (generate hash)
 * - GBP-only transactions
 * - Combined Date/Time column
 * - Explicit "Debit or Credit" column
 * - Country column
 */
export class YonderNormalizer extends BankNormalizer {
  constructor(source: BankSource) {
    super(source);
  }

  /**
   * Normalize Yonder transaction
   *
   * @param rawData - Raw Yonder export row
   * @returns Normalized transaction
   */
  normalize(rawData: RawRowData): Transaction {
    const base = this.createBaseTransaction(rawData);

    // Parse combined date/time
    const transactionDate = this.getRequiredDate(rawData, 'date');

    // Get transaction details
    const description = this.getRequiredString(rawData, 'description');
    const amount = this.getRequiredAmount(rawData, 'amount');
    const currency = this.getCurrencyCode(rawData, 'currency');
    const country = this.getOptionalString(rawData, 'country');

    // Parse transaction type (Yonder has explicit Debit/Credit column)
    const typeValue = this.getValue(rawData, 'type');
    let transactionType: TransactionType;

    if (typeValue && typeof typeValue === 'string') {
      const typeStr = typeValue.trim().toUpperCase();
      if (typeStr === 'DEBIT') {
        transactionType = TransactionType.DEBIT;
      } else if (typeStr === 'CREDIT') {
        transactionType = TransactionType.CREDIT;
      } else {
        // Fallback to amount-based detection
        transactionType = this.determineType(amount);
      }
    } else {
      transactionType = this.determineType(amount);
    }

    // Generate deterministic transaction ID (Yonder doesn't provide one)
    const originalTransactionId = this.generateTransactionId(
      transactionDate,
      description,
      amount,
      currency
    );

    const transaction: Transaction = {
      ...base,
      id: this.generateUUID(),
      originalTransactionId,
      transactionDate,
      transactionType,
      description,
      notes: null,
      country,
      originalAmountValue: Math.abs(amount),
      originalAmountCurrency: currency,
      gbpAmountValue: Math.abs(amount), // Yonder is GBP-only
      bankSourceId: this.source.id,
      processingStatus: ProcessingStatus.UNPROCESSED,
      errorMessage: null,
      exchangeRateValue: null, // Yonder is GBP-only, no conversion needed
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
