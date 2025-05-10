/**
 * Transaction Categorization System
 * Main script file containing core functionality
 */

// Global configuration
const CONFIG = {
  CATEGORIES: [
    'Housing', 'Subscriptions', 'Phone', 'Groceries', 'Entertainment',
    'Eating Out', 'Flights', 'Insurance', 'Clothing', 'Self Care',
    'Gym', 'Education', 'Medical', 'Rideshare', 'Gifts',
    'Charity', 'Fees', 'Cash', 'Misc'
  ],
  SHEET_NAMES: {
    SOURCE: 'Transactions',
    OUTPUT: 'Categorized Transactions',
    SUMMARY: 'Monthly Summary'
  }
};

/**
 * Initialize the spreadsheet with required sheets and columns
 */
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create source sheet if it doesn't exist
  let sourceSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SOURCE);
  if (!sourceSheet) {
    sourceSheet = ss.insertSheet(CONFIG.SHEET_NAMES.SOURCE);
    sourceSheet.appendRow([
      'Date', 'Description', 'Amount', 'Category', 'Manual Override',
      'Confidence', 'Last Updated'
    ]);
  }
  
  // Create output sheet if it doesn't exist
  let outputSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.OUTPUT);
  if (!outputSheet) {
    outputSheet = ss.insertSheet(CONFIG.SHEET_NAMES.OUTPUT);
    outputSheet.appendRow([
      'Date', 'Description', 'Amount', 'Category', 'Source'
    ]);
  }
  
  // Create summary sheet if it doesn't exist
  let summarySheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SUMMARY);
  if (!summarySheet) {
    summarySheet = ss.insertSheet(CONFIG.SHEET_NAMES.SUMMARY);
    summarySheet.appendRow(['Month', ...CONFIG.CATEGORIES, 'Total']);
  }
}

/**
 * Normalize transaction data from different sources
 * @param {Object} transaction - Raw transaction data
 * @return {Object} Normalized transaction data
 */
function normalizeTransaction(transaction) {
  return {
    date: new Date(transaction.date),
    description: String(transaction.description).trim(),
    amount: Number(transaction.amount),
    source: transaction.source || 'Unknown'
  };
}

/**
 * Main function to process new transactions
 */
function processNewTransactions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SOURCE);
  
  // Get all transactions
  const data = sourceSheet.getDataRange().getValues();
  const headers = data[0];
  const transactions = data.slice(1);
  
  // Process each transaction
  transactions.forEach((row, index) => {
    if (!row[0]) return; // Skip empty rows
    
    const transaction = {
      date: row[0],
      description: row[1],
      amount: row[2],
      category: row[3],
      manualOverride: row[4],
      confidence: row[5],
      lastUpdated: row[6]
    };
    
    // If no category or manual override exists, categorize it
    if (!transaction.category && !transaction.manualOverride) {
      categorizeTransaction(transaction, index + 2); // +2 for header row and 0-based index
    }
  });
}

/**
 * Categorize a single transaction using OpenAI
 * @param {Object} transaction - Transaction to categorize
 * @param {number} rowIndex - Row index in the sheet
 */
function categorizeTransaction(transaction, rowIndex) {
  const category = callOpenAI(transaction.description);
  const sourceSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.SHEET_NAMES.SOURCE);
  
  // Update the category and last updated timestamp
  sourceSheet.getRange(rowIndex, 4).setValue(category);
  sourceSheet.getRange(rowIndex, 7).setValue(new Date());
}

// OpenAI API integration will be implemented in the next phase 