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
   * @returns {Array} Array of normalized transaction objects
   */
  getNewTransactions(sheet) {
    console.log(`[getNewTransactions] Processing sheet: ${sheet.getName()}`);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    console.log(`[getNewTransactions] Header row: ${JSON.stringify(headers)}`);
    let columnMap;
    try {
      columnMap = this.getColumnMap(sheet.getName());
    } catch (err) {
      this.logError('getNewTransactions', err);
      console.log(`[getNewTransactions] Skipping unsupported sheet: ${sheet.getName()}`);
      return [];
    }
    // Find column indices using the mapping
    const indices = {};
    Object.entries(columnMap).forEach(([key, possibleNames]) => {
      indices[key] = this.findColumnIndex(headers, possibleNames);
      if (indices[key] === -1) {
        const msg = `Required column not found in sheet ${sheet.getName()}: ${possibleNames.join(', ')}`;
        this.logError('getNewTransactions', msg);
        console.log(`[getNewTransactions] ${msg}`);
        throw new Error(msg);
      }
    });
    // Process transactions (skip header row)
    console.log(`[getNewTransactions] Found ${data.length - 1} data rows in sheet: ${sheet.getName()}`);
    return data.slice(1).map(row => this.normalizeTransaction(row, indices, sheet.getName()));
  }
  
  /**
   * Get column mapping for a specific sheet
   * @param {string} sheetName - Name of the sheet
   * @returns {Object} Column mapping object
   */
  getColumnMap(sheetName) {
    const lowerName = sheetName.toLowerCase();
    if (lowerName === 'monzo') {
      return {
        date: ['Date'],
        time: ['Time'],
        description: ['Name', 'Description'],
        amount: ['Amount'],
        currency: ['Currency'],
        category: ['Category'],
        type: ['Type'],
        originalId: ['Transaction ID']
      };
    } else if (lowerName === 'revolut') {
      return {
        date: ['Started Date', 'Completed Date'],
        time: ['Started Date', 'Completed Date'],
        description: ['Description'],
        amount: ['Amount'],
        currency: ['Currency'],
        type: ['Type']
      };
    } else if (lowerName === 'yonder') {
      return {
        date: ['Date/Time of transaction'],
        time: ['Date/Time of transaction'],
        description: ['Description'],
        amount: ['Amount (GBP)'],
        currency: ['Currency'],
        category: ['Category'],
        type: ['Debit or Credit']
      };
    }
    // If not recognized, log and throw
    this.logError('getColumnMap', `Unsupported sheet name: ${sheetName}`);
    console.log(`[getColumnMap] Unsupported sheet name: ${sheetName}`);
    throw new Error(`Unsupported sheet name: ${sheetName}`);
  }
  
  /**
   * Find the index of a column using possible names
   * @param {Array} headers - Array of header names
   * @param {Array} possibleNames - Array of possible column names
   * @returns {number} Column index or -1 if not found
   */
  findColumnIndex(headers, possibleNames) {
    return headers.findIndex(header => 
      possibleNames.some(name => 
        header.toLowerCase() === name.toLowerCase()
      )
    );
  }
  
  /**
   * Normalize a transaction row
   * @param {Array} row - The row data
   * @param {Object} indices - Column indices
   * @param {string} sourceSheet - Name of the source sheet
   * @returns {Object} Normalized transaction
   */
  normalizeTransaction(row, indices, sourceSheet) {
    const dateTime = this.parseDateTime(row[indices.date], row[indices.time], sourceSheet);
    const amount = this.normalizeAmount(row[indices.amount], row[indices.currency], sourceSheet);
    const description = this.normalizeDescription(row[indices.description]);
    const originalReference = this.generateOriginalReference(dateTime, amount, row[indices.originalId]);
    
    return {
      id: Utilities.getUuid(),
      originalReference: originalReference,
      date: dateTime.date,
      time: dateTime.time,
      description: description,
      amount: amount.value,
      currency: 'GBP',
      category: row[indices.category] || 'Uncategorized',
      transactionMethod: this.normalizeTransactionType(row[indices.type], sourceSheet)
    };
  }
  
  /**
   * Parse date and time from various formats
   * @param {string|Date} dateStr - Date string or Date object
   * @param {string} timeStr - Time string
   * @param {string} sourceSheet - Name of the source sheet
   * @returns {Object} Normalized date and time
   */
  parseDateTime(dateStr, timeStr, sourceSheet) {
    let date, time;

    // Defensive: handle undefined/null
    if (!dateStr) {
      const msg = `[parseDateTime] dateStr is undefined/null for sheet: ${sourceSheet}`;
      this.logError('parseDateTime', msg);
      throw new Error(msg);
    }

    // If dateStr is a Date object, convert to string
    if (dateStr instanceof Date) {
      date = this.formatDate(dateStr); // 'yyyy-MM-dd'
      time = dateStr.toTimeString().split(' ')[0];
      console.log(`[parseDateTime] dateStr is Date object. Parsed date: ${date}, time: ${time}`);
      return { date, time };
    }

    if (sourceSheet.toLowerCase() === 'monzo') {
      // Monzo format: DD/MM/YYYY and HH:mm:ss
      if (typeof dateStr === 'string') {
        const [day, month, year] = dateStr.split('/');
        date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        time = timeStr;
        console.log(`[parseDateTime] Monzo string. Parsed date: ${date}, time: ${time}`);
        return { date, time };
      } else {
        const msg = `[parseDateTime] Monzo dateStr is not a string: ${dateStr}`;
        this.logError('parseDateTime', msg);
        throw new Error(msg);
      }
    } else if (sourceSheet.toLowerCase() === 'revolut' || 
               sourceSheet.toLowerCase() === 'yonder') {
      // ISO format: YYYY-MM-DD HH:mm:ss
      if (typeof dateStr === 'string') {
        const [datePart, timePart] = dateStr.split(' ');
        date = datePart;
        time = timePart;
        console.log(`[parseDateTime] ${sourceSheet} string. Parsed date: ${date}, time: ${time}`);
        return { date, time };
      } else {
        const msg = `[parseDateTime] ${sourceSheet} dateStr is not a string: ${dateStr}`;
        this.logError('parseDateTime', msg);
        throw new Error(msg);
      }
    }
    // If we reach here, the format is unknown
    const msg = `[parseDateTime] Unknown format for dateStr (${typeof dateStr}): ${dateStr} in sheet: ${sourceSheet}`;
    this.logError('parseDateTime', msg);
    throw new Error(msg);
  }
  
  /**
   * Normalize amount and handle currency conversion
   * @param {string|number} amount - Transaction amount
   * @param {string} currency - Currency code
   * @param {string} sourceSheet - Name of the source sheet
   * @returns {Object} Normalized amount and currency
   */
  normalizeAmount(amount, currency, sourceSheet) {
    // Convert to number and handle negative amounts
    let value = parseFloat(amount);
    
    // Handle Revolut's negative amounts for debits
    if (sourceSheet.toLowerCase().includes('revolut')) {
      // Amount is already negative for debits, no need to invert
    } else {
      // For other sources, ensure debits are negative
      if (value > 0 && this.isDebit(amount, sourceSheet)) {
        value = -value;
      }
    }
    
    // TODO: Implement currency conversion
    // For now, assume all amounts are in GBP
    return {
      value: value,
      currency: 'GBP'
    };
  }
  
  /**
   * Check if a transaction is a debit
   * @param {string|number} amount - Transaction amount
   * @param {string} sourceSheet - Name of the source sheet
   * @returns {boolean} True if debit
   */
  isDebit(amount, sourceSheet) {
    if (sourceSheet.toLowerCase().includes('yonder')) {
      return amount.toString().toLowerCase().includes('debit');
    }
    return parseFloat(amount) < 0;
  }
  
  /**
   * Normalize transaction description
   * @param {string} description - Original description
   * @returns {string} Normalized description
   */
  normalizeDescription(description) {
    return description
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')        // Normalize spaces
      .trim();
  }
  
  /**
   * Normalize transaction type
   * @param {string} type - Original transaction type
   * @param {string} sourceSheet - Name of the source sheet
   * @returns {string} Normalized transaction type
   */
  normalizeTransactionType(type, sourceSheet) {
    const lowerType = type.toString().toLowerCase();
    
    if (sourceSheet.toLowerCase().includes('monzo')) {
      if (lowerType.includes('card payment')) return 'PAYMENT';
      if (lowerType.includes('faster payment')) return 'TRANSFER';
      if (lowerType.includes('atm')) return 'ATM';
    } else if (sourceSheet.toLowerCase().includes('revolut')) {
      if (lowerType === 'card_payment') return 'PAYMENT';
      if (lowerType === 'transfer' || lowerType === 'topup') return 'TRANSFER';
      if (lowerType === 'atm') return 'ATM';
    } else if (sourceSheet.toLowerCase().includes('yonder')) {
      // Yonder doesn't have transaction types, default to PAYMENT
      return 'PAYMENT';
    }
    
    return 'PAYMENT'; // Default type
  }
  
  /**
   * Generate original reference for transactions without IDs
   * @param {Object} dateTime - Date and time object
   * @param {Object} amount - Amount object
   * @param {string} originalId - Original transaction ID if available
   * @returns {string} Original reference
   */
  generateOriginalReference(dateTime, amount, originalId) {
    if (originalId) return originalId;
    return `${dateTime.date}T${dateTime.time.split(':')[0]}:${dateTime.time.split(':')[1]}_${amount.value.toFixed(2)}`;
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
   * Format a date for display
   * @param {Date} date - The date to format
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  
  /**
   * Write normalized transactions to the output sheet
   * @param {Array} transactions - Array of normalized transaction objects
   * @param {Sheet} outputSheet - The output sheet
   */
  writeNormalizedTransactions(transactions, outputSheet) {
    if (!transactions.length) return;
    const now = new Date();
    const rows = transactions.map(t => [
      t.date,
      t.description,
      t.amount,
      '', // Category (final, to be filled after categorization)
      '', // AI Category (to be filled after categorization)
      '', // Manual Override
      '', // Confidence
      t.sourceSheet || '',
      t.id,
      t.originalReference,
      '', // Notes
      '', // Last Updated
      'UNPROCESSED', // Processing Status
      now, // Normalization Timestamp
      '', // Categorization Timestamp
      ''  // Error Details
    ]);
    outputSheet.getRange(outputSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
} 