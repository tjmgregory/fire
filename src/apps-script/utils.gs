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
    
    // Guard clause for required parameter
    if (!sheet) {
      throw new Error('Sheet parameter is required');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    console.log(`[getNewTransactions] Header row: ${JSON.stringify(headers)}`);
    
    // Get column mapping
    const columnMap = this.getColumnMap(sheet.getName());
    
    // Find column indices using the mapping
    const indices = {};
    Object.entries(columnMap).forEach(([key, possibleNames]) => {
      indices[key] = this.findColumnIndex(headers, possibleNames);
      if (indices[key] === -1) {
        throw new Error(`Required column not found in sheet ${sheet.getName()}: ${possibleNames.join(', ')}`);
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
    // Guard clause for required parameter
    if (!sheetName) {
      throw new Error('Sheet name is required');
    }
    
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
    
    throw new Error(`Unsupported sheet name: ${sheetName}`);
  }
  
  /**
   * Find the index of a column using possible names
   * @param {Array} headers - Array of header names
   * @param {Array} possibleNames - Array of possible column names
   * @returns {number} Column index or -1 if not found
   */
  findColumnIndex(headers, possibleNames) {
    // Guard clause for required parameters
    if (!headers || !Array.isArray(headers)) {
      throw new Error('Headers must be an array');
    }
    if (!possibleNames || !Array.isArray(possibleNames)) {
      throw new Error('Possible names must be an array');
    }
    
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
    // Guard clause for required parameters
    if (!row || !Array.isArray(row)) {
      throw new Error('Row must be an array');
    }
    if (!indices || typeof indices !== 'object') {
      throw new Error('Indices must be an object');
    }
    if (!sourceSheet) {
      throw new Error('Source sheet name is required');
    }
    
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
   * Parse date and time from various formats and convert to UTC ISO string
   * @param {string|Date} dateStr - Date string or Date object
   * @param {string|Date} timeStr - Time string or Date object
   * @param {string} sourceSheet - Name of the source sheet
   * @returns {Object} Normalized date and time in UTC
   */
  parseDateTime(dateStr, timeStr, sourceSheet) {
    let dateTime;

    if (sourceSheet.toLowerCase() === 'monzo') {
      // Monzo format: Both dateStr and timeStr are Date objects.
      dateTime = new Date(dateStr);

      // Special handling for Google Sheets "zero date" (Dec 30, 1899) used for time-only values
      const timeDate = new Date(timeStr);
      
      // Apply time to the main date
      dateTime.setHours(timeDate.getHours(), timeDate.getMinutes(), timeDate.getSeconds());
    
    } else if (sourceSheet.toLowerCase() === 'revolut' || 
               sourceSheet.toLowerCase() === 'yonder') {
      // ISO format: YYYY-MM-DD HH:mm:ss
      if (typeof dateStr === 'string') {
        dateTime = new Date(dateStr.replace(' ', 'T'));
      } else if (dateStr instanceof Date) {
        dateTime = new Date(dateStr);
      } else {
        throw new Error(`${sourceSheet} dateStr has unexpected type (${typeof dateStr}): ${dateStr}`);
      }
    } else {
      throw new Error(`Unknown source sheet: ${sourceSheet}`);
    }

    // Validate we have a valid date
    if (!(dateTime instanceof Date) || isNaN(dateTime.getTime())) {
      throw new Error(`Invalid date created from: dateStr=${dateStr}, timeStr=${timeStr}, sheet=${sourceSheet}`);
    }
    // Transaction source dates are assumed to be in UK time
    // Convert directly to ISO string (UTC) for standardization
    const isoString = dateTime.toISOString();
    
    return {
      date: isoString,
      time: isoString.split('T')[1].split('.')[0] // HH:mm:ss
    };
  }
  
  /**
   * Normalize amount and handle currency conversion
   * @param {string|number} amount - Transaction amount
   * @param {string} currency - Currency code
   * @param {string} sourceSheet - Name of the source sheet
   * @returns {Object} Normalized amount and currency
   */
  normalizeAmount(amount, currency, sourceSheet) {
    // Guard clause for required parameters
    if (amount === undefined || amount === null) {
      throw new Error(`Amount is required for sheet: ${sourceSheet}`);
    }
    if (!sourceSheet) {
      throw new Error('Source sheet name is required');
    }
    
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
    // Guard clause for required parameters
    if (amount === undefined || amount === null) {
      throw new Error(`Amount is required for sheet: ${sourceSheet}`);
    }
    if (!sourceSheet) {
      throw new Error('Source sheet name is required');
    }
    
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
    // Guard clause for required parameter
    if (!description) {
      throw new Error('Description is required');
    }
    
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
    // Guard clause for required parameters
    if (!type) {
      throw new Error(`Transaction type is required for sheet: ${sourceSheet}`);
    }
    if (!sourceSheet) {
      throw new Error('Source sheet name is required');
    }
    
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
    // Guard clause for required parameters
    if (!dateTime || !dateTime.date || !dateTime.time) {
      throw new Error('Date and time object is required');
    }
    if (!amount || amount.value === undefined) {
      throw new Error('Amount object is required');
    }
    
    if (originalId) return originalId;
    return `${dateTime.date}T${dateTime.time.split(':')[0]}:${dateTime.time.split(':')[1]}_${amount.value.toFixed(2)}`;
  }
  
  /**
   * Write normalized transactions to the output sheet
   * @param {Array} transactions - Array of normalized transaction objects
   * @param {Sheet} outputSheet - The output sheet
   */
  writeNormalizedTransactions(transactions, outputSheet) {
    // Guard clause for required parameters
    if (!transactions || !Array.isArray(transactions)) {
      throw new Error('Transactions must be an array');
    }
    if (!outputSheet) {
      throw new Error('Output sheet is required');
    }
    
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
    
    console.log(`[writeNormalizedTransactions] Writing ${rows.length} transactions to output sheet`);
    outputSheet.getRange(outputSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
} 