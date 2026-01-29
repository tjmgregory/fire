/**
 * Sheet Data Adapter
 *
 * Implements SheetDataPort for Google Sheets operations.
 * Part of hexagonal architecture - isolates Google Sheets API calls.
 *
 * @module infrastructure/adapters/SheetDataAdapter
 */

import { SheetDataPort, RawRowData } from '../../domain/ports/SheetDataPort';
import { Transaction, ProcessingStatus, TransactionType, CurrencyCode } from '../../models/Transaction';
import { BankSourceId } from '../../models/BankSource';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { getBankSourceConfig } from '../config/BankSourceConfig';
import { logger } from '../logging/ErrorLogger';

/**
 * Result sheet column configuration
 */
const RESULT_SHEET_COLUMNS = {
  ID: 0,
  ORIGINAL_TRANSACTION_ID: 1,
  BANK_SOURCE_ID: 2,
  TRANSACTION_DATE: 3,
  TRANSACTION_TYPE: 4,
  DESCRIPTION: 5,
  NOTES: 6,
  COUNTRY: 7,
  ORIGINAL_AMOUNT_VALUE: 8,
  ORIGINAL_AMOUNT_CURRENCY: 9,
  GBP_AMOUNT_VALUE: 10,
  EXCHANGE_RATE_VALUE: 11,
  CATEGORY_AI_ID: 12,
  CATEGORY_AI_NAME: 13,
  CATEGORY_CONFIDENCE_SCORE: 14,
  CATEGORY_MANUAL_ID: 15,
  CATEGORY_MANUAL_NAME: 16,
  PROCESSING_STATUS: 17,
  ERROR_MESSAGE: 18,
  TIMESTAMP_CREATED: 19,
  TIMESTAMP_LAST_MODIFIED: 20,
  TIMESTAMP_NORMALISED: 21,
  TIMESTAMP_CATEGORISED: 22
};

/**
 * Categories sheet column configuration
 */
const CATEGORIES_SHEET_COLUMNS = {
  ID: 0,
  NAME: 1,
  DESCRIPTION: 2,
  EXAMPLES: 3,
  IS_ACTIVE: 4
};

/**
 * Sheet Data Adapter
 *
 * Implements SheetDataPort to provide Google Sheets data operations.
 */
export class SheetDataAdapter implements SheetDataPort {
  private spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
  private resultSheet: GoogleAppsScript.Spreadsheet.Sheet;
  private categoriesSheet: GoogleAppsScript.Spreadsheet.Sheet;
  private transactionIdCache: Map<string, number> | null = null;

  constructor() {
    this.spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    const resultSheetName = ConfigurationManager.get('RESULT_SHEET_NAME', 'Result') || 'Result';
    const categoriesSheetName = ConfigurationManager.get('CATEGORIES_SHEET_NAME', 'Categories') || 'Categories';

    const resultSheet = this.spreadsheet.getSheetByName(resultSheetName);
    const categoriesSheet = this.spreadsheet.getSheetByName(categoriesSheetName);

    if (!resultSheet) {
      throw new Error(`Result sheet '${resultSheetName}' not found`);
    }
    if (!categoriesSheet) {
      throw new Error(`Categories sheet '${categoriesSheetName}' not found`);
    }

    this.resultSheet = resultSheet;
    this.categoriesSheet = categoriesSheet;
  }

  /**
   * Read raw data from a bank source sheet
   */
  readSourceSheet(sourceId: BankSourceId): RawRowData[] {
    const bankConfig = getBankSourceConfig(sourceId);
    const sheet = this.spreadsheet.getSheetByName(bankConfig.sheetName);

    if (!sheet) {
      logger.warning(`Source sheet '${bankConfig.sheetName}' not found for ${sourceId}`);
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return []; // Only header row or empty
    }

    const headers = data[0] as string[];
    const rows: RawRowData[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowData: RawRowData = {};

      for (let j = 0; j < headers.length; j++) {
        rowData[headers[j]] = row[j];
      }

      rows.push(rowData);
    }

    logger.info(`Read ${rows.length} rows from ${sourceId}`, { sourceId, rowCount: rows.length });
    return rows;
  }

  /**
   * Write a transaction to the result sheet
   */
  writeTransaction(transaction: Transaction): void {
    const row = this.transactionToRow(transaction);
    this.resultSheet.appendRow(row);
    this.invalidateCache();
    logger.debug(`Wrote transaction ${transaction.id} to result sheet`);
  }

  /**
   * Write multiple transactions in batch
   */
  writeTransactionsBatch(transactions: Transaction[]): void {
    if (transactions.length === 0) return;

    const rows = transactions.map(t => this.transactionToRow(t));
    const lastRow = this.resultSheet.getLastRow();

    this.resultSheet
      .getRange(lastRow + 1, 1, rows.length, rows[0].length)
      .setValues(rows);

    this.invalidateCache();
    logger.info(`Batch wrote ${transactions.length} transactions to result sheet`);
  }

  /**
   * Check if a transaction already exists
   */
  transactionExists(originalTransactionId: string, sourceId: BankSourceId): boolean {
    this.ensureCache();
    const cacheKey = `${sourceId}:${originalTransactionId}`;
    return this.transactionIdCache!.has(cacheKey);
  }

  /**
   * Find transactions by merchant/description
   */
  findTransactionsByMerchant(
    description: string,
    limit: number = 10,
    daysBack: number = 90
  ): Transaction[] {
    const data = this.getResultSheetData();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const searchTerm = description.toLowerCase();
    const matches: Transaction[] = [];

    for (let i = data.length - 1; i >= 1 && matches.length < limit; i--) {
      const row = data[i];
      const txDate = this.parseDate(row[RESULT_SHEET_COLUMNS.TRANSACTION_DATE]);

      if (txDate && txDate >= cutoffDate) {
        const txDescription = String(row[RESULT_SHEET_COLUMNS.DESCRIPTION] || '').toLowerCase();
        if (txDescription.includes(searchTerm)) {
          matches.push(this.rowToTransaction(row, i + 1));
        }
      }
    }

    return matches;
  }

  /**
   * Find transactions by status
   */
  findTransactionsByStatus(status: string, limit?: number): Transaction[] {
    const data = this.getResultSheetData();
    const matches: Transaction[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[RESULT_SHEET_COLUMNS.PROCESSING_STATUS] === status) {
        matches.push(this.rowToTransaction(row, i + 1));
        if (limit && matches.length >= limit) break;
      }
    }

    return matches;
  }

  /**
   * Update transaction status
   */
  updateTransactionStatus(transactionId: string, status: string): void {
    const rowIndex = this.findTransactionRowIndex(transactionId);
    if (rowIndex === -1) {
      logger.warning(`Transaction ${transactionId} not found for status update`);
      return;
    }

    this.resultSheet.getRange(rowIndex, RESULT_SHEET_COLUMNS.PROCESSING_STATUS + 1).setValue(status);
    this.resultSheet.getRange(rowIndex, RESULT_SHEET_COLUMNS.TIMESTAMP_LAST_MODIFIED + 1).setValue(new Date());

    logger.debug(`Updated transaction ${transactionId} status to ${status}`);
  }

  /**
   * Update transaction category
   */
  updateTransactionCategory(
    transactionId: string,
    categoryId: string,
    categoryName: string,
    isManual: boolean,
    confidenceScore?: number
  ): void {
    const rowIndex = this.findTransactionRowIndex(transactionId);
    if (rowIndex === -1) {
      logger.warning(`Transaction ${transactionId} not found for category update`);
      return;
    }

    const now = new Date();

    if (isManual) {
      this.resultSheet.getRange(rowIndex, RESULT_SHEET_COLUMNS.CATEGORY_MANUAL_ID + 1).setValue(categoryId);
      this.resultSheet.getRange(rowIndex, RESULT_SHEET_COLUMNS.CATEGORY_MANUAL_NAME + 1).setValue(categoryName);
    } else {
      this.resultSheet.getRange(rowIndex, RESULT_SHEET_COLUMNS.CATEGORY_AI_ID + 1).setValue(categoryId);
      this.resultSheet.getRange(rowIndex, RESULT_SHEET_COLUMNS.CATEGORY_AI_NAME + 1).setValue(categoryName);
      if (confidenceScore !== undefined) {
        this.resultSheet.getRange(rowIndex, RESULT_SHEET_COLUMNS.CATEGORY_CONFIDENCE_SCORE + 1).setValue(confidenceScore);
      }
    }

    this.resultSheet.getRange(rowIndex, RESULT_SHEET_COLUMNS.TIMESTAMP_LAST_MODIFIED + 1).setValue(now);
    this.resultSheet.getRange(rowIndex, RESULT_SHEET_COLUMNS.TIMESTAMP_CATEGORISED + 1).setValue(now);
    this.resultSheet.getRange(rowIndex, RESULT_SHEET_COLUMNS.PROCESSING_STATUS + 1).setValue(ProcessingStatus.CATEGORISED);

    logger.debug(`Updated transaction ${transactionId} category to ${categoryName} (manual: ${isManual})`);
  }

  /**
   * Read all active categories
   */
  readCategories(): Array<{
    id: string;
    name: string;
    description: string;
    examples: string;
    isActive: boolean;
  }> {
    const data = this.categoriesSheet.getDataRange().getValues();
    const categories: Array<{
      id: string;
      name: string;
      description: string;
      examples: string;
      isActive: boolean;
    }> = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isActive = row[CATEGORIES_SHEET_COLUMNS.IS_ACTIVE] !== false &&
                       row[CATEGORIES_SHEET_COLUMNS.IS_ACTIVE] !== 'FALSE';

      if (isActive) {
        categories.push({
          id: String(row[CATEGORIES_SHEET_COLUMNS.ID] || ''),
          name: String(row[CATEGORIES_SHEET_COLUMNS.NAME] || ''),
          description: String(row[CATEGORIES_SHEET_COLUMNS.DESCRIPTION] || ''),
          examples: String(row[CATEGORIES_SHEET_COLUMNS.EXAMPLES] || ''),
          isActive: true
        });
      }
    }

    return categories;
  }

  /**
   * Find category by name
   */
  findCategoryByName(name: string): {
    id: string;
    name: string;
    description: string;
    examples: string;
    isActive: boolean;
  } | null {
    const categories = this.readCategories();
    const searchName = name.toLowerCase().trim();

    return categories.find(c => c.name.toLowerCase().trim() === searchName) || null;
  }

  // ============ Private Helper Methods ============

  /**
   * Convert a Transaction to a row array for writing
   */
  private transactionToRow(transaction: Transaction): unknown[] {
    return [
      transaction.id,
      transaction.originalTransactionId,
      transaction.bankSourceId,
      transaction.transactionDate,
      transaction.transactionType,
      transaction.description,
      transaction.notes || '',
      transaction.country || '',
      transaction.originalAmountValue,
      transaction.originalAmountCurrency,
      transaction.gbpAmountValue,
      transaction.exchangeRateValue || '',
      transaction.categoryAiId || '',
      transaction.categoryAiName || '',
      transaction.categoryConfidenceScore || '',
      transaction.categoryManualId || '',
      transaction.categoryManualName || '',
      transaction.processingStatus,
      transaction.errorMessage || '',
      transaction.timestampCreated,
      transaction.timestampLastModified,
      transaction.timestampNormalised || '',
      transaction.timestampCategorised || ''
    ];
  }

  /**
   * Convert a row array to a Transaction
   */
  private rowToTransaction(row: unknown[], _rowNumber: number): Transaction {
    return {
      id: String(row[RESULT_SHEET_COLUMNS.ID] || ''),
      originalTransactionId: String(row[RESULT_SHEET_COLUMNS.ORIGINAL_TRANSACTION_ID] || ''),
      bankSourceId: row[RESULT_SHEET_COLUMNS.BANK_SOURCE_ID] as BankSourceId,
      transactionDate: this.parseDate(row[RESULT_SHEET_COLUMNS.TRANSACTION_DATE]) || new Date(),
      transactionType: row[RESULT_SHEET_COLUMNS.TRANSACTION_TYPE] as TransactionType,
      description: String(row[RESULT_SHEET_COLUMNS.DESCRIPTION] || ''),
      notes: row[RESULT_SHEET_COLUMNS.NOTES] ? String(row[RESULT_SHEET_COLUMNS.NOTES]) : null,
      country: row[RESULT_SHEET_COLUMNS.COUNTRY] ? String(row[RESULT_SHEET_COLUMNS.COUNTRY]) : null,
      originalAmountValue: Number(row[RESULT_SHEET_COLUMNS.ORIGINAL_AMOUNT_VALUE]) || 0,
      originalAmountCurrency: row[RESULT_SHEET_COLUMNS.ORIGINAL_AMOUNT_CURRENCY] as CurrencyCode,
      gbpAmountValue: Number(row[RESULT_SHEET_COLUMNS.GBP_AMOUNT_VALUE]) || 0,
      exchangeRateValue: row[RESULT_SHEET_COLUMNS.EXCHANGE_RATE_VALUE] ? Number(row[RESULT_SHEET_COLUMNS.EXCHANGE_RATE_VALUE]) : null,
      categoryAiId: row[RESULT_SHEET_COLUMNS.CATEGORY_AI_ID] ? String(row[RESULT_SHEET_COLUMNS.CATEGORY_AI_ID]) : null,
      categoryAiName: row[RESULT_SHEET_COLUMNS.CATEGORY_AI_NAME] ? String(row[RESULT_SHEET_COLUMNS.CATEGORY_AI_NAME]) : null,
      categoryConfidenceScore: row[RESULT_SHEET_COLUMNS.CATEGORY_CONFIDENCE_SCORE] ? Number(row[RESULT_SHEET_COLUMNS.CATEGORY_CONFIDENCE_SCORE]) : null,
      categoryManualId: row[RESULT_SHEET_COLUMNS.CATEGORY_MANUAL_ID] ? String(row[RESULT_SHEET_COLUMNS.CATEGORY_MANUAL_ID]) : null,
      categoryManualName: row[RESULT_SHEET_COLUMNS.CATEGORY_MANUAL_NAME] ? String(row[RESULT_SHEET_COLUMNS.CATEGORY_MANUAL_NAME]) : null,
      processingStatus: row[RESULT_SHEET_COLUMNS.PROCESSING_STATUS] as ProcessingStatus,
      errorMessage: row[RESULT_SHEET_COLUMNS.ERROR_MESSAGE] ? String(row[RESULT_SHEET_COLUMNS.ERROR_MESSAGE]) : null,
      timestampCreated: this.parseDate(row[RESULT_SHEET_COLUMNS.TIMESTAMP_CREATED]) || new Date(),
      timestampLastModified: this.parseDate(row[RESULT_SHEET_COLUMNS.TIMESTAMP_LAST_MODIFIED]) || new Date(),
      timestampNormalised: this.parseDate(row[RESULT_SHEET_COLUMNS.TIMESTAMP_NORMALISED]),
      timestampCategorised: this.parseDate(row[RESULT_SHEET_COLUMNS.TIMESTAMP_CATEGORISED])
    };
  }

  /**
   * Get all data from result sheet
   */
  private getResultSheetData(): unknown[][] {
    return this.resultSheet.getDataRange().getValues();
  }

  /**
   * Find the row index for a transaction by ID
   */
  private findTransactionRowIndex(transactionId: string): number {
    const data = this.getResultSheetData();

    for (let i = 1; i < data.length; i++) {
      if (data[i][RESULT_SHEET_COLUMNS.ID] === transactionId) {
        return i + 1; // 1-indexed for sheet operations
      }
    }

    return -1;
  }

  /**
   * Parse a date value from sheet
   */
  private parseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'number') {
      // Excel serial date
      return new Date((value - 25569) * 86400 * 1000);
    }
    return null;
  }

  /**
   * Ensure the transaction ID cache is populated
   */
  private ensureCache(): void {
    if (this.transactionIdCache !== null) return;

    this.transactionIdCache = new Map();
    const data = this.getResultSheetData();

    for (let i = 1; i < data.length; i++) {
      const sourceId = data[i][RESULT_SHEET_COLUMNS.BANK_SOURCE_ID];
      const originalId = data[i][RESULT_SHEET_COLUMNS.ORIGINAL_TRANSACTION_ID];
      if (sourceId && originalId) {
        const cacheKey = `${sourceId}:${originalId}`;
        this.transactionIdCache.set(cacheKey, i + 1);
      }
    }

    logger.debug(`Built transaction cache with ${this.transactionIdCache.size} entries`);
  }

  /**
   * Invalidate the transaction ID cache
   */
  private invalidateCache(): void {
    this.transactionIdCache = null;
  }
}
