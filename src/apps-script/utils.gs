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
    return data.slice(1).map(row => this.normalizeTransaction(row, indices, headers, sheet.getName()));
  }
  
  /**
   * Get column mapping for a specific sheet
   * @param {string} sheetName - Name of the sheet
   * @returns {Object} Column mapping object
   * @note For description field, this is only used for backward compatibility.
   *       The actual description handling is done by getDescriptionFieldMapping and 
   *       getTransactionDescription with more robust fallback behavior.
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
        description: ['Name', 'Description'], // Basic fallback, full handling in getDescriptionFieldMapping
        amount: ['Amount'],
        currency: ['Currency'],
        category: ['Category'],
        type: ['Type'],
        originalId: ['Transaction ID'],
        // Add all fields needed for rich description
        notesAndTags: ['Notes and #tags']
      };
    } else if (lowerName === 'revolut') {
      return {
        date: ['Started Date', 'Completed Date'],
        time: ['Started Date', 'Completed Date'],
        description: ['Description'], // Basic fallback, full handling in getDescriptionFieldMapping
        amount: ['Amount'],
        currency: ['Currency'],
        type: ['Type'],
        // Add all fields needed for rich description
        product: ['Product']
      };
    } else if (lowerName === 'yonder') {
      return {
        date: ['Date/Time of transaction'],
        time: ['Date/Time of transaction'],
        description: ['Description'], // Basic fallback, full handling in getDescriptionFieldMapping
        amount: ['Amount (GBP)'],
        currency: ['Currency'],
        category: ['Category'],
        type: ['Debit or Credit'],
        // Add all fields needed for rich description
        country: ['Country']
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
   * @param {Array} headers - Sheet headers
   * @param {string} sourceSheet - Name of the source sheet
   * @returns {Object} Normalized transaction
   */
  normalizeTransaction(row, indices, headers, sourceSheet) {
    // Guard clause for required parameters
    if (!row || !Array.isArray(row)) {
      throw new Error('Row must be an array');
    }
    if (!indices || typeof indices !== 'object') {
      throw new Error('Indices must be an object');
    }
    if (!headers || !Array.isArray(headers)) {
      throw new Error('Headers must be an array');
    }
    if (!sourceSheet) {
      throw new Error('Source sheet name is required');
    }
    
    const dateTime = this.parseDateTime(row[indices.date], row[indices.time], sourceSheet);
    const amount = this.normalizeAmount(row[indices.amount], row[indices.currency], sourceSheet);
    
    // Use the enhanced description extraction
    const description = this.getTransactionDescription(row, indices, headers, sourceSheet);
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
        console.log('dateStr is a string - delete the other code handler');
        dateTime = new Date(dateStr.replace(' ', 'T'));
      } else if (dateStr instanceof Date) {
        console.log('dateStr is a Date - delete the other code handler');
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
   * Normalize a description string
   * @param {string} description - Raw description string
   * @param {string} [sourceSheet] - Optional source sheet name for better error messages
   * @returns {string} Normalized description
   */
  normalizeDescription(description, sourceSheet = '') {
    // Guard clause for required parameter
    if (!description) {
      const sheetInfo = sourceSheet ? ` in ${sourceSheet} sheet` : '';
      throw new Error(`Description is required${sheetInfo}`);
    }
    
    // Handle empty strings after toString()
    const descStr = description.toString().trim();
    if (descStr === '') {
      const sheetInfo = sourceSheet ? ` in ${sourceSheet} sheet` : '';
      throw new Error(`Description is empty after normalization${sheetInfo}`);
    }
    
    return descStr
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')        // Normalize spaces
      .trim();
  }
  
  /**
   * Get description field mapping for a specific sheet
   * @param {string} sheetName - Name of the sheet
   * @returns {Object} Description field mapping configuration
   */
  getDescriptionFieldMapping(sheetName) {
    // Guard clause for required parameter
    if (!sheetName) {
      throw new Error('Sheet name is required');
    }
    
    const lowerName = sheetName.toLowerCase();
    if (lowerName === 'monzo') {
      return {
        fields: ['Name', 'Description', 'Notes and #tags', 'Type'],
        combineStrategy: (row) => {
          // Combine fields using a template approach
          const name = row['Name'] || '';
          const description = row['Description'] || '';
          const notes = row['Notes and #tags'] || '';
          const type = row['Type'] || '';
          
          // Build a rich description combining available fields
          let combinedDesc = '';
          
          // Add name as primary identifier
          if (name) {
            combinedDesc += name;
          }
          
          // Add description for additional context
          if (description && description !== name) {
            combinedDesc += combinedDesc ? ` - ${description}` : description;
          }
          
          // Add transaction type for context
          if (type) {
            combinedDesc += combinedDesc ? ` (${type})` : type;
          }
          
          // Add notes if available
          if (notes) {
            combinedDesc += combinedDesc ? ` ${notes}` : notes;
          }
          
          // Return the combined description or throw error if nothing available
          if (combinedDesc) {
            return combinedDesc.trim();
          }
          
          throw new Error('Unable to construct description for Monzo transaction');
        }
      };
    } else if (lowerName === 'revolut') {
      return {
        fields: ['Description', 'Type', 'Product'],
        combineStrategy: (row) => {
          // Combine fields using a template approach
          const description = row['Description'] || '';
          const type = row['Type'] || '';
          const product = row['Product'] || '';
          
          // Build a rich description combining available fields
          let combinedDesc = '';
          
          // Add description as primary identifier
          if (description) {
            combinedDesc += description;
          }
          
          // Add transaction type for context
          if (type) {
            combinedDesc += combinedDesc ? ` (${type})` : type;
          }
          
          // Add product info if available
          if (product) {
            combinedDesc += combinedDesc ? ` - ${product}` : product;
          }
          
          // Return the combined description or throw error if nothing available
          if (combinedDesc) {
            return combinedDesc.trim();
          }
          
          throw new Error('Unable to construct description for Revolut transaction');
        }
      };
    } else if (lowerName === 'yonder') {
      return {
        fields: ['Description', 'Country'],
        combineStrategy: (row) => {
          // Combine fields using a template approach
          const description = row['Description'] || '';
          const country = row['Country'] || '';
          
          // Build a rich description combining available fields
          let combinedDesc = '';
          
          // Add description as primary identifier
          if (description) {
            combinedDesc += description;
          }
          
          // Add country for context if available
          if (country) {
            combinedDesc += combinedDesc ? ` (${country})` : country;
          }
          
          // Return the combined description or throw error if nothing available
          if (combinedDesc) {
            return combinedDesc.trim();
          }
          
          throw new Error('Unable to construct description for Yonder transaction');
        }
      };
    }
    
    throw new Error(`No description field mapping for sheet: ${sheetName}`);
  }
  
  /**
   * Get description from transaction row based on source sheet
   * @param {Object} row - Raw transaction row with column headers as keys
   * @param {string} sourceSheet - Name of the source sheet
   * @returns {string} Processed description
   * @throws {Error} If no valid description can be extracted
   */
  getTransactionDescription(row, indices, headers, sourceSheet) {
    // Guard clause for required parameters
    if (!row || !Array.isArray(row)) {
      throw new Error('Row must be an array');
    }
    if (!indices || typeof indices !== 'object') {
      throw new Error('Indices must be an object');
    }
    if (!headers || !Array.isArray(headers)) {
      throw new Error('Headers must be an array');
    }
    if (!sourceSheet) {
      throw new Error('Source sheet name is required');
    }
    
    // Convert row array to object using headers
    const rowObject = {};
    
    // Process standard headers first
    headers.forEach((header, index) => {
      rowObject[header] = row[index];
    });
    
    // Get field mapping configuration for this sheet
    const mapping = this.getDescriptionFieldMapping(sourceSheet);
    
    // Make sure all needed fields are available in rowObject
    // This ensures fields mentioned in the mapping are accessible
    // even if they weren't directly found in headers
    const lowerName = sourceSheet.toLowerCase();
    if (lowerName === 'monzo') {
      if (indices.description >= 0 && !rowObject['Name'] && !rowObject['Description']) {
        // If Name/Description wasn't found directly, use the mapped description field
        if (headers[indices.description] === 'Name') {
          rowObject['Name'] = row[indices.description];
        } else if (headers[indices.description] === 'Description') {
          rowObject['Description'] = row[indices.description];
        }
      }
      
      // Make sure Notes and #tags is available
      if (indices.notesAndTags >= 0 && !rowObject['Notes and #tags']) {
        rowObject['Notes and #tags'] = row[indices.notesAndTags];
      }
      
      // Make sure Type is available
      if (indices.type >= 0 && !rowObject['Type']) {
        rowObject['Type'] = row[indices.type];
      }
    } else if (lowerName === 'revolut') {
      if (indices.description >= 0 && !rowObject['Description']) {
        rowObject['Description'] = row[indices.description];
      }
      
      // Make sure Type is available
      if (indices.type >= 0 && !rowObject['Type']) {
        rowObject['Type'] = row[indices.type];
      }
      
      // Make sure Product is available
      if (indices.product >= 0 && !rowObject['Product']) {
        rowObject['Product'] = row[indices.product];
      }
    } else if (lowerName === 'yonder') {
      if (indices.description >= 0 && !rowObject['Description']) {
        rowObject['Description'] = row[indices.description];
      }
      
      // Make sure Country is available
      if (indices.country >= 0 && !rowObject['Country']) {
        rowObject['Country'] = row[indices.country];
      }
    }
    
    try {
      // Use source-specific combine strategy
      const rawDescription = mapping.combineStrategy(rowObject);
      
      // Throw error if no description could be determined
      if (!rawDescription) {
        console.error(`Failed to extract description from row: ${JSON.stringify(rowObject)}`);
        throw new Error(`Unable to construct description for ${sourceSheet} transaction`);
      }
      
      // Apply standard normalization with source sheet for better error messages
      return this.normalizeDescription(rawDescription, sourceSheet);
    } catch (error) {
      // Add more context to the error
      console.error(`Error in description extraction: ${error.message}`);
      console.error(`Row data: ${JSON.stringify(row)}`);
      console.error(`Row object: ${JSON.stringify(rowObject)}`);
      console.error(`Indices: ${JSON.stringify(indices)}`);
      throw new Error(`Failed to construct description for ${sourceSheet} transaction: ${error.message}`);
    }
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