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
    
    this.COLUMNS = {
      DATE: 'Date',
      DESCRIPTION: 'Description',
      AMOUNT: 'Amount',
      CATEGORY: 'Category',
      AI_CATEGORY: 'AI Category',
      MANUAL_OVERRIDE: 'Manual Override',
      CONFIDENCE: 'Confidence'
    };
  }
  
  /**
   * Get the list of source sheets to process
   * @returns {Array} Array of sheet objects
   */
  getSourceSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const expectedNames = ['monzo', 'revolut', 'yonder'];
    return sheets.filter(sheet => {
      const name = sheet.getName().toLowerCase();
      return expectedNames.includes(name);
    });
  }
  
  /**
   * Get the output sheet, create if it doesn't exist
   * @returns {Sheet} The output sheet
   */
  getOutputSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(this.SHEET_NAMES.OUTPUT);
    
    if (!sheet) {
      sheet = ss.insertSheet(this.SHEET_NAMES.OUTPUT);
      this.initializeOutputSheet(sheet);
    }
    
    return sheet;
  }
  
  /**
   * Initialize the output sheet with headers
   * @param {Sheet} sheet - The sheet to initialize
   */
  initializeOutputSheet(sheet) {
    const headers = [
      this.COLUMNS.DATE,
      this.COLUMNS.DESCRIPTION,
      this.COLUMNS.AMOUNT,
      this.COLUMNS.CATEGORY,
      this.COLUMNS.AI_CATEGORY,
      this.COLUMNS.MANUAL_OVERRIDE,
      this.COLUMNS.CONFIDENCE
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
} 