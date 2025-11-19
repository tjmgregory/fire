/**
 * Bank Source Configuration
 *
 * Defines column mappings and configuration for supported bank sources:
 * - Monzo: Native transaction IDs, comprehensive metadata
 * - Revolut: No native IDs (requires backfilling), separate started/completed dates
 * - Yonder: No native IDs (requires backfilling), GBP-only transactions
 *
 * @module infrastructure/config/BankSourceConfig
 */

import { BankSource, BankSourceId, ColumnMapping } from '../../models/BankSource';

/**
 * Monzo Bank Configuration
 *
 * Monzo provides:
 * - Native transaction IDs
 * - Comprehensive metadata
 * - Separate date and time columns
 * - Notes and tags support
 */
export const MONZO_CONFIG: Readonly<BankSource> = {
  id: BankSourceId.MONZO,
  displayName: 'Monzo',
  sheetName: 'Monzo',
  hasNativeTransactionId: true,
  isActive: true,
  columnMappings: {
    transactionId: 'Transaction ID',
    date: 'Date',
    time: 'Time',
    description: 'Name',
    amount: 'Amount',
    currency: 'Currency',
    type: 'Type',
    category: 'Category', // Ignored by system
    notes: 'Notes and #tags'
  },
  createdAt: new Date(),
  lastProcessedAt: null
};

/**
 * Revolut Bank Configuration
 *
 * Revolut characteristics:
 * - No native transaction IDs (requires backfilling)
 * - Separate Started Date and Completed Date columns
 * - Fee column (separate from amount)
 * - State and Balance columns
 */
export const REVOLUT_CONFIG: Readonly<BankSource> = {
  id: BankSourceId.REVOLUT,
  displayName: 'Revolut',
  sheetName: 'Revolut',
  hasNativeTransactionId: false,
  isActive: true,
  columnMappings: {
    transactionId: 'ID', // Will be backfilled by system
    date: 'Started Date',
    completedDate: 'Completed Date',
    description: 'Description',
    amount: 'Amount',
    currency: 'Currency',
    type: 'Type'
  },
  createdAt: new Date(),
  lastProcessedAt: null
};

/**
 * Yonder Bank Configuration
 *
 * Yonder characteristics:
 * - No native transaction IDs (requires backfilling)
 * - GBP-only transactions
 * - Combined Date/Time column
 * - Debit or Credit column
 * - Country column
 */
export const YONDER_CONFIG: Readonly<BankSource> = {
  id: BankSourceId.YONDER,
  displayName: 'Yonder',
  sheetName: 'Yonder',
  hasNativeTransactionId: false,
  isActive: true,
  columnMappings: {
    transactionId: 'ID', // Will be backfilled by system
    date: 'Date/Time of transaction',
    description: 'Description',
    amount: 'Amount (GBP)',
    currency: 'Currency',
    type: 'Debit or Credit',
    category: 'Category', // Ignored by system
    country: 'Country'
  },
  createdAt: new Date(),
  lastProcessedAt: null
};

/**
 * All supported bank source configurations
 */
export const BANK_SOURCE_CONFIGS: Record<BankSourceId, BankSource> = {
  [BankSourceId.MONZO]: MONZO_CONFIG,
  [BankSourceId.REVOLUT]: REVOLUT_CONFIG,
  [BankSourceId.YONDER]: YONDER_CONFIG
};

/**
 * Get bank source configuration by ID
 *
 * @param sourceId - Bank source identifier
 * @returns Bank source configuration
 * @throws Error if source ID is not supported
 */
export function getBankSourceConfig(sourceId: BankSourceId): BankSource {
  const config = BANK_SOURCE_CONFIGS[sourceId];
  if (!config) {
    throw new Error(`Unsupported bank source: ${sourceId}`);
  }
  return config;
}

/**
 * Get all active bank source configurations
 *
 * @returns Array of active bank sources
 */
export function getActiveBankSources(): BankSource[] {
  return Object.values(BANK_SOURCE_CONFIGS).filter(source => source.isActive);
}

/**
 * Check if a bank source has native transaction IDs
 *
 * @param sourceId - Bank source identifier
 * @returns True if bank provides native IDs
 */
export function hasNativeTransactionId(sourceId: BankSourceId): boolean {
  return getBankSourceConfig(sourceId).hasNativeTransactionId;
}

/**
 * Get column name for a standard field
 *
 * @param sourceId - Bank source identifier
 * @param standardField - Standard field name
 * @returns Source-specific column name
 * @throws Error if field mapping not found
 */
export function getColumnName(
  sourceId: BankSourceId,
  standardField: keyof ColumnMapping
): string {
  const config = getBankSourceConfig(sourceId);
  const columnName = config.columnMappings[standardField];

  if (!columnName) {
    throw new Error(
      `Column mapping not found for field '${standardField}' in ${sourceId}`
    );
  }

  return columnName;
}
