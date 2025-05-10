/**
 * Utility functions for the Transaction Categorization System
 */

class Utils {
  constructor() {
    this.config = new Config();
  }
  
  /**
   * Get new transactions from a source sheet
   * @param {Sheet} sheet - The source sheet to process
   * @returns {Array} Array of transaction objects
   */
  getNewTransactions(sheet) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const dateCol = headers.indexOf(this.config.COLUMNS.DATE);
    const descCol = headers.indexOf(this.config.COLUMNS.DESCRIPTION);
    const amountCol = headers.indexOf(this.config.COLUMNS.AMOUNT);
    
    if (dateCol === -1 || descCol === -1 || amountCol === -1) {
      throw new Error('Required columns not found in sheet: ' + sheet.getName());
    }
    
    // Process transactions (skip header row)
    return data.slice(1).map(row => ({
      date: row[dateCol],
      description: row[descCol],
      amount: row[amountCol],
      sourceSheet: sheet.getName()
    }));
  }
  
  /**
   * Log an error to the system logs
   * @param {string} functionName - Name of the function where error occurred
   * @param {Error} error - The error object
   */
  logError(functionName, error) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName(this.config.SHEET_NAMES.LOGS);
    
    if (!logSheet) {
      logSheet = ss.insertSheet(this.config.SHEET_NAMES.LOGS);
      logSheet.getRange(1, 1, 1, 3).setValues([['Timestamp', 'Function', 'Error']]);
      logSheet.setFrozenRows(1);
    }
    
    const timestamp = new Date();
    logSheet.appendRow([timestamp, functionName, error.toString()]);
    
    // Also log to console for debugging
    console.error(`Error in ${functionName}:`, error);
  }
  
  /**
   * Normalize a transaction description
   * @param {string} description - The original description
   * @returns {string} Normalized description
   */
  normalizeDescription(description) {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')        // Normalize spaces
      .trim();
  }
  
  /**
   * Format a date for display
   * @param {Date} date - The date to format
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
} 