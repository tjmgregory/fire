/**
 * System logging utilities for the Transaction Categorization System
 * Implements ADR-003 requirement for System Logs sheet
 */

class Logger {
  constructor() {
    this.config = new Config();
    this.logSheet = this.getOrCreateLogSheet();
  }
  
  /**
   * Get or create the System Logs sheet
   * @returns {Sheet} The System Logs sheet
   */
  getOrCreateLogSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error('No active spreadsheet found');
    }
    
    let sheet = ss.getSheetByName(this.config.SHEET_NAMES.LOGS);
    if (!sheet) {
      console.log(`[Logger] Creating System Logs sheet: ${this.config.SHEET_NAMES.LOGS}`);
      sheet = ss.insertSheet(this.config.SHEET_NAMES.LOGS);
      this.initializeLogSheet(sheet);
    }
    
    return sheet;
  }
  
  /**
   * Initialize the log sheet with headers
   * @param {Sheet} sheet - The sheet to initialize
   */
  initializeLogSheet(sheet) {
    const headers = [
      'Timestamp',
      'Level',
      'Function',
      'Message',
      'Details',
      'Error Stack',
      'Processing Stats'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    
    // Format the header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f0f0f0');
  }
  
  /**
   * Log an entry to the System Logs sheet
   * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
   * @param {string} functionName - Name of the function logging
   * @param {string} message - Log message
   * @param {Object} details - Additional details to log
   * @param {Error} error - Error object if applicable
   * @param {Object} stats - Processing statistics if applicable
   */
  log(level, functionName, message, details = null, error = null, stats = null) {
    try {
      const timestamp = new Date();
      const row = [
        timestamp,
        level,
        functionName,
        message,
        details ? JSON.stringify(details) : '',
        error ? error.stack || error.toString() : '',
        stats ? JSON.stringify(stats) : ''
      ];
      
      // Append to the log sheet
      this.logSheet.appendRow(row);
      
      // Also log to console for immediate visibility
      const consoleMessage = `[${functionName}] ${message}`;
      switch(level) {
        case 'ERROR':
          console.error(consoleMessage, details, error);
          break;
        case 'WARN':
          console.warn(consoleMessage, details);
          break;
        case 'INFO':
          console.info(consoleMessage, details);
          break;
        default:
          console.log(consoleMessage, details);
      }
    } catch (logError) {
      // If logging fails, at least try to log to console
      console.error('[Logger] Failed to write to log sheet:', logError);
      console.error(`Original log entry: ${level} - ${functionName} - ${message}`);
    }
  }
  
  /**
   * Log an error
   * @param {string} functionName - Name of the function logging
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {Object} details - Additional details
   */
  error(functionName, message, error, details = null) {
    this.log('ERROR', functionName, message, details, error);
  }
  
  /**
   * Log a warning
   * @param {string} functionName - Name of the function logging
   * @param {string} message - Warning message
   * @param {Object} details - Additional details
   */
  warn(functionName, message, details = null) {
    this.log('WARN', functionName, message, details);
  }
  
  /**
   * Log an info message
   * @param {string} functionName - Name of the function logging
   * @param {string} message - Info message
   * @param {Object} details - Additional details
   */
  info(functionName, message, details = null) {
    this.log('INFO', functionName, message, details);
  }
  
  /**
   * Log processing statistics
   * @param {string} functionName - Name of the function logging
   * @param {string} message - Summary message
   * @param {Object} stats - Processing statistics
   */
  logStats(functionName, message, stats) {
    this.log('INFO', functionName, message, null, null, stats);
  }
  
  /**
   * Log API usage
   * @param {string} apiName - Name of the API (e.g., 'OpenAI')
   * @param {number} tokensUsed - Number of tokens used
   * @param {number} cost - Estimated cost
   * @param {number} itemsProcessed - Number of items processed
   */
  logApiUsage(apiName, tokensUsed, cost, itemsProcessed) {
    const details = {
      api: apiName,
      tokensUsed: tokensUsed,
      estimatedCost: cost,
      itemsProcessed: itemsProcessed,
      timestamp: new Date().toISOString()
    };
    
    this.info('API_USAGE', `${apiName} API call completed`, details);
  }
  
  /**
   * Clean up old log entries (keep last 30 days)
   */
  cleanupOldLogs() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const lastRow = this.logSheet.getLastRow();
      if (lastRow <= 1) return; // No data to clean
      
      const timestampCol = 1;
      const data = this.logSheet.getRange(2, timestampCol, lastRow - 1, 1).getValues();
      
      let rowsToDelete = [];
      for (let i = 0; i < data.length; i++) {
        const timestamp = new Date(data[i][0]);
        if (timestamp < thirtyDaysAgo) {
          rowsToDelete.push(i + 2); // +2 because array is 0-indexed and we start from row 2
        }
      }
      
      // Delete rows in reverse order to maintain indices
      for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        this.logSheet.deleteRow(rowsToDelete[i]);
      }
      
      if (rowsToDelete.length > 0) {
        this.info('cleanupOldLogs', `Deleted ${rowsToDelete.length} old log entries`);
      }
    } catch (error) {
      console.error('[Logger] Failed to cleanup old logs:', error);
    }
  }
}

// Create a global logger instance
let logger;

/**
 * Get the global logger instance
 * @returns {Logger} The logger instance
 */
function getLogger() {
  if (!logger) {
    logger = new Logger();
  }
  return logger;
}