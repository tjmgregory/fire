/**
 * Configuration and constants for the Transaction Categorization System
 */

class Config {
  constructor() {
    this.CATEGORIES = [
      'Housing',
      'Subscriptions',
      'Phone',
      'Groceries',
      'Entertainment',
      'Eating Out',
      'Flights',
      'Insurance',
      'Clothing',
      'Self Care',
      'Gym',
      'Education',
      'Medical',
      'Rideshare',
      'Gifts',
      'Charity',
      'Fees',
      'Cash',
      'Misc'
    ];
    
    this.SHEET_NAMES = {
      OUTPUT: 'Transaction Categories',
      LOGS: 'System Logs'
    };
    
    this.OUTPUT_COLUMNS = {
      DATE: 'Date (UTC ISO)',
      DESCRIPTION: 'Description',
      AMOUNT: 'Amount',
      CATEGORY: 'Category',
      AI_CATEGORY: 'AI Category',
      MANUAL_OVERRIDE: 'Manual Override',
      CONFIDENCE: 'Confidence',
      SOURCE_SHEET: 'Source Sheet',
      TRANSACTION_ID: 'Transaction ID',
      ORIGINAL_REFERENCE: 'Original Reference',
      NOTES: 'Notes',
      LAST_UPDATED: 'Last Updated',
      PROCESSING_STATUS: 'Processing Status',
      NORMALIZATION_TIMESTAMP: 'Normalization Timestamp',
      CATEGORIZATION_TIMESTAMP: 'Categorization Timestamp',
      ERROR_DETAILS: 'Error Details'
    };
  }
  
  /**
   * Get the list of source sheets to process
   * @returns {Array} Array of sheet objects
   */
  getSourceSheets() {
    console.log('[getSourceSheets] Getting source sheets...');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error('No active spreadsheet found');
    }
    
    const sheets = ss.getSheets();
    const expectedNames = ['monzo', 'revolut', 'yonder'];
    const allNames = sheets.map(s => s.getName());
    console.log(`[getSourceSheets] All sheet names: ${JSON.stringify(allNames)}`);
    
    const selected = sheets.filter(sheet => {
      const name = sheet.getName().toLowerCase();
      return expectedNames.includes(name);
    });
    
    console.log(`[getSourceSheets] Found ${selected.length} source sheets: ${JSON.stringify(selected.map(s => s.getName()))}`);
    return selected;
  }
  
  /**
   * Get the output sheet, create if it doesn't exist
   * @returns {Sheet} The output sheet
   */
  getOutputSheet() {
    console.log('[getOutputSheet] Getting output sheet...');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error('No active spreadsheet found');
    }
    
    let sheet = ss.getSheetByName(this.SHEET_NAMES.OUTPUT);
    if (!sheet) {
      console.log(`[getOutputSheet] Output sheet not found. Creating: ${this.SHEET_NAMES.OUTPUT}`);
      sheet = ss.insertSheet(this.SHEET_NAMES.OUTPUT);
      this.initializeOutputSheet(sheet);
    } else {
      console.log(`[getOutputSheet] Output sheet found: ${this.SHEET_NAMES.OUTPUT}`);
    }
    return sheet;
  }
  
  /**
   * Initialize the output sheet with headers
   * @param {Sheet} sheet - The sheet to initialize
   */
  initializeOutputSheet(sheet) {
    // Guard clause for required parameter
    if (!sheet) {
      throw new Error('Sheet parameter is required');
    }
    
    const headers = [
      this.OUTPUT_COLUMNS.DATE,
      this.OUTPUT_COLUMNS.DESCRIPTION,
      this.OUTPUT_COLUMNS.AMOUNT,
      this.OUTPUT_COLUMNS.CATEGORY,
      this.OUTPUT_COLUMNS.AI_CATEGORY,
      this.OUTPUT_COLUMNS.MANUAL_OVERRIDE,
      this.OUTPUT_COLUMNS.CONFIDENCE,
      this.OUTPUT_COLUMNS.SOURCE_SHEET,
      this.OUTPUT_COLUMNS.TRANSACTION_ID,
      this.OUTPUT_COLUMNS.ORIGINAL_REFERENCE,
      this.OUTPUT_COLUMNS.NOTES,
      this.OUTPUT_COLUMNS.LAST_UPDATED,
      this.OUTPUT_COLUMNS.PROCESSING_STATUS,
      this.OUTPUT_COLUMNS.NORMALIZATION_TIMESTAMP,
      this.OUTPUT_COLUMNS.CATEGORIZATION_TIMESTAMP,
      this.OUTPUT_COLUMNS.ERROR_DETAILS
    ];
    
    console.log(`[initializeOutputSheet] Initializing output sheet with headers: ${JSON.stringify(headers)}`);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    console.log('[initializeOutputSheet] Output sheet initialized successfully');
  }
} 