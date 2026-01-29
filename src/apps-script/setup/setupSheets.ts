/**
 * Sheet Setup Functions
 *
 * Creates and configures required sheets for the FIRE system.
 * Idempotent - safe to run multiple times.
 *
 * @module setup/setupSheets
 */

import { Logger } from '../utils/Logger';
import { CategoryValidator } from '../models/Category';
import { installOnEditTrigger } from '../triggers/onEditTrigger';
import { installScheduledTriggers } from '../triggers/scheduledTriggers';

/**
 * Sheet configuration
 */
const SHEET_CONFIG = {
  categories: {
    name: 'Categories',
    columns: ['ID', 'Name', 'Description', 'Examples', 'Is Active', 'Created At', 'Modified At']
  },
  result: {
    name: 'Result',
    columns: [
      'ID',
      'Original Transaction ID',
      'Bank Source',
      'Transaction Date',
      'Transaction Type',
      'Description',
      'Notes',
      'Country',
      'Original Amount',
      'Original Currency',
      'GBP Amount',
      'Exchange Rate',
      'AI Category ID',
      'AI Category',
      'Confidence Score',
      'Manual Category ID',
      'Manual Category',
      'Category',  // Computed column
      'Processing Status',
      'Error Message',
      'Created At',
      'Last Modified',
      'Normalised At',
      'Categorised At'
    ]
  }
};

/**
 * Default categories to seed when Categories sheet is empty
 */
const DEFAULT_CATEGORIES = [
  {
    name: 'Groceries',
    description: 'Food and household items from supermarkets and grocery stores',
    examples: 'Tesco, Sainsbury\'s, Waitrose, Aldi, Lidl, Ocado'
  },
  {
    name: 'Transport',
    description: 'Public transport, taxis, and ride-sharing services',
    examples: 'TfL, Uber, Bolt, Train tickets, Bus fares'
  },
  {
    name: 'Eating Out',
    description: 'Restaurants, cafes, takeaways, and food delivery',
    examples: 'Deliveroo, Just Eat, Nandos, Pret, Costa'
  },
  {
    name: 'Entertainment',
    description: 'Leisure activities, streaming services, and events',
    examples: 'Netflix, Spotify, Cinema, Concerts, Theatre'
  },
  {
    name: 'Shopping',
    description: 'General retail purchases (non-grocery)',
    examples: 'Amazon, ASOS, John Lewis, Argos'
  },
  {
    name: 'Bills & Utilities',
    description: 'Regular household bills and utility payments',
    examples: 'Electricity, Gas, Water, Internet, Phone'
  },
  {
    name: 'Health & Fitness',
    description: 'Medical expenses, gym memberships, and wellness',
    examples: 'Gym, Pharmacy, Doctor, Dentist, Optician'
  },
  {
    name: 'Travel',
    description: 'Holidays, flights, hotels, and travel expenses',
    examples: 'Hotels, Airbnb, Flights, Holiday bookings'
  },
  {
    name: 'Subscriptions',
    description: 'Recurring subscription payments',
    examples: 'Software subscriptions, Membership fees, Magazines'
  },
  {
    name: 'Income',
    description: 'Salary, refunds, and other income',
    examples: 'Salary, Refunds, Interest, Dividends'
  },
  {
    name: 'Transfers',
    description: 'Money transfers between accounts',
    examples: 'Bank transfer, Savings transfer, Investment transfer'
  },
  {
    name: 'Other',
    description: 'Miscellaneous transactions that don\'t fit other categories',
    examples: 'Cash withdrawal, Unknown transactions'
  }
];

/**
 * Main setup function
 *
 * Creates and configures Categories and Result sheets.
 * Idempotent - can be run multiple times safely.
 */
function setupSheets(): SetupResult {
  Logger.info('Starting sheet setup');

  const result: SetupResult = {
    success: true,
    categoriesSheet: { created: false, configured: false, seeded: false },
    resultSheet: { created: false, configured: false },
    triggersInstalled: false,
    errors: []
  };

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // Setup Categories sheet
    const categoriesResult = setupCategoriesSheet(spreadsheet);
    result.categoriesSheet = categoriesResult;
    if (!categoriesResult.configured) {
      result.errors.push('Failed to configure Categories sheet');
    }

    // Setup Result sheet
    const resultResult = setupResultSheet(spreadsheet);
    result.resultSheet = resultResult;
    if (!resultResult.configured) {
      result.errors.push('Failed to configure Result sheet');
    }

    // Install triggers
    try {
      installOnEditTrigger();
      installScheduledTriggers();
      result.triggersInstalled = true;
      Logger.info('Triggers installed successfully');
    } catch (error) {
      result.errors.push(`Failed to install triggers: ${error}`);
      Logger.error(`Trigger installation failed: ${error}`);
    }

    result.success = result.errors.length === 0;
    Logger.info('Sheet setup completed', {
      success: result.success,
      categoriesCreated: result.categoriesSheet.created,
      resultCreated: result.resultSheet.created,
      triggersInstalled: result.triggersInstalled,
      errorCount: result.errors.length
    });

  } catch (error) {
    result.success = false;
    result.errors.push(`Setup failed: ${error}`);
    Logger.error(`Sheet setup failed: ${error}`);
  }

  return result;
}

/**
 * Setup Categories sheet
 */
function setupCategoriesSheet(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet): SheetSetupResult & { seeded: boolean } {
  const result = { created: false, configured: false, seeded: false };

  let sheet = spreadsheet.getSheetByName(SHEET_CONFIG.categories.name);

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_CONFIG.categories.name);
    result.created = true;
    Logger.info('Categories sheet created');
  }

  // Check/add headers
  const headers = sheet.getRange(1, 1, 1, SHEET_CONFIG.categories.columns.length).getValues()[0];
  const headersMatch = SHEET_CONFIG.categories.columns.every((col, i) => headers[i] === col);

  if (!headersMatch) {
    // Set headers
    sheet.getRange(1, 1, 1, SHEET_CONFIG.categories.columns.length)
      .setValues([SHEET_CONFIG.categories.columns]);

    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, SHEET_CONFIG.categories.columns.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#e8eaed');

    // Set column widths
    sheet.setColumnWidth(1, 300);  // ID (UUID)
    sheet.setColumnWidth(2, 150);  // Name
    sheet.setColumnWidth(3, 300);  // Description
    sheet.setColumnWidth(4, 300);  // Examples
    sheet.setColumnWidth(5, 80);   // Is Active
    sheet.setColumnWidth(6, 150);  // Created At
    sheet.setColumnWidth(7, 150);  // Modified At

    Logger.info('Categories sheet headers configured');
  }

  result.configured = true;

  // Seed default categories if empty
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    seedDefaultCategories(sheet);
    result.seeded = true;
    Logger.info('Default categories seeded');
  }

  return result;
}

/**
 * Seed default categories
 */
function seedDefaultCategories(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  const now = new Date();
  const rows = DEFAULT_CATEGORIES.map(cat => [
    CategoryValidator.generateUUID(),
    cat.name,
    cat.description,
    cat.examples,
    true,  // isActive
    now,
    now
  ]);

  sheet.getRange(2, 1, rows.length, SHEET_CONFIG.categories.columns.length)
    .setValues(rows);

  // Format date columns
  const dateColumns = [6, 7]; // Created At, Modified At
  for (const col of dateColumns) {
    sheet.getRange(2, col, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
}

/**
 * Setup Result sheet
 */
function setupResultSheet(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet): SheetSetupResult {
  const result = { created: false, configured: false };

  let sheet = spreadsheet.getSheetByName(SHEET_CONFIG.result.name);

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_CONFIG.result.name);
    result.created = true;
    Logger.info('Result sheet created');
  }

  // Check/add headers
  const headers = sheet.getRange(1, 1, 1, SHEET_CONFIG.result.columns.length).getValues()[0];
  const headersMatch = SHEET_CONFIG.result.columns.every((col, i) => headers[i] === col);

  if (!headersMatch) {
    // Set headers
    sheet.getRange(1, 1, 1, SHEET_CONFIG.result.columns.length)
      .setValues([SHEET_CONFIG.result.columns]);

    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, SHEET_CONFIG.result.columns.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#e8eaed');

    // Set column widths
    const columnWidths: Record<number, number> = {
      1: 300,   // ID (UUID)
      2: 200,   // Original Transaction ID
      3: 100,   // Bank Source
      4: 120,   // Transaction Date
      5: 100,   // Transaction Type
      6: 300,   // Description
      7: 200,   // Notes
      8: 80,    // Country
      9: 100,   // Original Amount
      10: 80,   // Original Currency
      11: 100,  // GBP Amount
      12: 100,  // Exchange Rate
      13: 300,  // AI Category ID
      14: 150,  // AI Category
      15: 100,  // Confidence Score
      16: 300,  // Manual Category ID
      17: 150,  // Manual Category
      18: 150,  // Category (computed)
      19: 120,  // Processing Status
      20: 200,  // Error Message
      21: 150,  // Created At
      22: 150,  // Last Modified
      23: 150,  // Normalised At
      24: 150   // Categorised At
    };

    for (const [col, width] of Object.entries(columnWidths)) {
      sheet.setColumnWidth(parseInt(col), width);
    }

    Logger.info('Result sheet headers configured');
  }

  // Add data validation for Processing Status column
  const statusColumn = SHEET_CONFIG.result.columns.indexOf('Processing Status') + 1;
  const lastRow = Math.max(sheet.getLastRow(), 100); // Pre-configure for at least 100 rows
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['UNPROCESSED', 'NORMALISED', 'CATEGORISED', 'ERROR'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, statusColumn, lastRow - 1, 1).setDataValidation(statusRule);

  // Add data validation for Transaction Type column
  const typeColumn = SHEET_CONFIG.result.columns.indexOf('Transaction Type') + 1;
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['DEBIT', 'CREDIT'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, typeColumn, lastRow - 1, 1).setDataValidation(typeRule);

  result.configured = true;
  return result;
}

/**
 * Add Category formula to a row
 *
 * The Category column shows Manual Category if set, otherwise AI Category.
 * Call this after writing a transaction row.
 *
 * @param sheet - Result sheet
 * @param row - Row number (1-indexed)
 */
function setCategoryFormula(sheet: GoogleAppsScript.Spreadsheet.Sheet, row: number): void {
  const categoryCol = SHEET_CONFIG.result.columns.indexOf('Category') + 1;
  const manualCategoryCol = SHEET_CONFIG.result.columns.indexOf('Manual Category') + 1;
  const aiCategoryCol = SHEET_CONFIG.result.columns.indexOf('AI Category') + 1;

  const manualCategoryRef = sheet.getRange(row, manualCategoryCol).getA1Notation();
  const aiCategoryRef = sheet.getRange(row, aiCategoryCol).getA1Notation();

  const formula = `=IF(${manualCategoryRef}<>"", ${manualCategoryRef}, ${aiCategoryRef})`;
  sheet.getRange(row, categoryCol).setFormula(formula);
}

/**
 * Setup result for tracking
 */
interface SheetSetupResult {
  created: boolean;
  configured: boolean;
}

interface SetupResult {
  success: boolean;
  categoriesSheet: SheetSetupResult & { seeded: boolean };
  resultSheet: SheetSetupResult;
  triggersInstalled: boolean;
  errors: string[];
}

// Export for module usage
export {
  setupSheets,
  setupCategoriesSheet,
  setupResultSheet,
  setCategoryFormula,
  SHEET_CONFIG,
  DEFAULT_CATEGORIES,
  SetupResult
};
