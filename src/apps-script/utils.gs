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
      
      // Per ADR-005, category is optional during normalization
      // Other fields may be optional for specific sheet types
      const optionalFields = ['category'];
      if (indices[key] === -1 && !optionalFields.includes(key)) {
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
        // Category removed as per ADR-005 - categories are handled in a separate phase
        // and Revolut sheets don't typically include a Category column
        type: ['Type'],
        originalId: ['ID'], // Revolut doesn't have explicit IDs
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
        // Remove originalId as Yonder doesn't have Transaction ID column
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
    
    // Check for GBP amount column for Yonder
    const amountGbp = sourceSheet.toLowerCase().includes('yonder') && indices.amount >= 0 ? 
      row[indices.amount] : undefined;
    
    const amount = this.normalizeAmount(
      row[indices.amount], 
      amountGbp,
      row[indices.currency], 
      sourceSheet,
      transactionType
    );
    
    // Use the enhanced description extraction
    const description = this.getTransactionDescription(row, indices, headers, sourceSheet);
    
    // Handle case when indices.originalId doesn't exist (like with Yonder)
    const originalId = indices.originalId !== undefined ? row[indices.originalId] : undefined;
    
    // Get transaction type for reference generation
    const transactionType = indices.type !== undefined ? row[indices.type] : undefined;
    
    // Generate reference without amount, using bank-specific logic
    const originalReference = this.generateOriginalReference(
      dateTime, 
      amount, 
      originalId, 
      sourceSheet,
      transactionType,
      description
    );
    
    return {
      id: Utilities.getUuid(),
      originalReference: originalReference,
      date: dateTime.date,
      time: dateTime.time,
      description: description,
      amount: amount.value,
      currency: 'GBP',
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
      
      dateTime = new Date(dateStr);
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
   * @param {string|number} amount_gbp - Native GBP amount if available (e.g., from Yonder)
   * @param {string} currency - Currency code
   * @param {string} sourceSheet - Name of the source sheet
   * @param {string} transactionType - Transaction type (e.g., 'Debit', 'Credit', 'CARD_PAYMENT')
   * @returns {Object} Normalized amount and currency
   * 
   * This function implements a priority-based approach to amount selection:
   * 1. Use "Amount (GBP)" if directly available (for sheets like Yonder that provide this)
   * 2. Use amount directly if currency is already GBP
   * 3. Apply currency conversion only if neither condition is met
   * 
   * This approach minimizes unnecessary currency conversion and ensures we use the
   * most accurate GBP amount when available directly from the source.
   */
  normalizeAmount(amount, amount_gbp, currency, sourceSheet, transactionType) {
    // Guard clause for required parameters
    if (amount === undefined || amount === null) {
      throw new Error(`Amount is required for sheet: ${sourceSheet}`);
    }
    if (!sourceSheet) {
      throw new Error('Source sheet name is required');
    }
    
    // Priority order for amount selection:
    // 1. Use "Amount (GBP)" if available (e.g., Yonder)
    // 2. Use amount directly if currency is already GBP
    // 3. Apply currency conversion only if neither condition is met
    
    // If we have a GBP amount directly provided (like in Yonder), use it
    if (amount_gbp !== undefined && amount_gbp !== null) {
      // console.log(`Using provided GBP amount: ${amount_gbp}`);
      let value = parseFloat(amount_gbp);
      
      // Ensure correct sign based on transaction type
      // Per ADR-001: positive for credits, negative for debits
      if (this.isDebit(transactionType, sourceSheet)) {
        // Make sure debits are negative
        value = Math.abs(value) * -1;
      } else {
        // Make sure credits are positive
        value = Math.abs(value);
      }
      
      return {
        value: value,
        currency: 'GBP'
      };
    }
    
    // Convert to number and handle negative amounts
    let value = parseFloat(amount);
    
    // Handle bank-specific amount sign conventions
    if (sourceSheet.toLowerCase().includes('revolut')) {
      // Revolut already provides negative amounts for debits and positive for credits
      // No sign adjustment needed
    } else if (sourceSheet.toLowerCase().includes('monzo')) {
      // Monzo provides positive amounts, need to check transaction type
      if (this.isDebit(transactionType, sourceSheet)) {
        // Make sure debits are negative
        value = Math.abs(value) * -1;
      } else {
        // Make sure credits are positive
        value = Math.abs(value);
      }
    } else {
      // For other sources, apply standard logic
      if (this.isDebit(transactionType, sourceSheet)) {
        // Make sure debits are negative
        value = Math.abs(value) * -1;
      } else {
        // Make sure credits are positive
        value = Math.abs(value);
      }
    }
    
    // If already in GBP, no conversion needed
    if (currency === 'GBP') {
      return {
        value: value,
        currency: 'GBP'
      };
    }
    
    // Handle currency conversion if not GBP
    // console.log(`Converting from ${currency} to GBP: ${value}`);
    value = this.convertCurrency(value, currency, 'GBP');
    
    return {
      value: value,
      currency: 'GBP' // Always return GBP as the currency
    };
  }
  
  /**
   * Convert amount from one currency to another
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @returns {number} Converted amount
   */
  convertCurrency(amount, fromCurrency, toCurrency) {
    // Guard clause for required parameters
    if (amount === undefined || amount === null) {
      throw new Error('Amount is required for currency conversion');
    }
    if (!fromCurrency) {
      throw new Error('Source currency is required');
    }
    if (!toCurrency) {
      throw new Error('Target currency is required');
    }
    
    // If currencies are the same, no conversion needed
    if (fromCurrency === toCurrency) {
      return amount;
    }
    
    // In a real implementation, we would call an exchange rate API or use a cached rate
    // For now, use hardcoded approximate rates for common currencies as of mid-2025
    const rates = {
      'USD_GBP': 0.78,
      'EUR_GBP': 0.85,
      'CAD_GBP': 0.58,
      'AUD_GBP': 0.52,
      'JPY_GBP': 0.0051,
      'MAD_GBP': 0.078,
      'THB_GBP': 0.022,
      'SGD_GBP': 0.58,
      'HKD_GBP': 0.099,
      'ZAR_GBP': 0.041,
      'NOK_GBP': 0.074,
      'CNY_GBP': 0.11,
      'SEK_GBP': 0.075
    };
    
    const rateKey = `${fromCurrency}_${toCurrency}`;
    if (rates[rateKey]) {
      return amount * rates[rateKey];
    } else {
      // Handle other currencies
      console.warn(`No conversion rate found for ${fromCurrency} to ${toCurrency}`);
      // For demo, return the original amount with a warning
      throw new Error(`Currency conversion from ${fromCurrency} to ${toCurrency} not supported`);
    }
  }
  
  /**
   * Check if a transaction is a debit
   * @param {string} transactionType - Transaction type
   * @param {string} sourceSheet - Name of the source sheet
   * @returns {boolean} True if debit
   */
  isDebit(transactionType, sourceSheet) {
    // Guard clause for required parameters
    if (!sourceSheet) {
      throw new Error('Source sheet name is required');
    }
    
    // If no transaction type provided, assume debit (conservative approach)
    if (!transactionType) {
      console.warn(`[isDebit] No transaction type provided for ${sourceSheet}, assuming debit`);
      return true;
    }
    
    const lowerType = transactionType.toString().toLowerCase();
    
    if (sourceSheet.toLowerCase().includes('yonder')) {
      // Yonder uses "Debit" or "Credit" in the "Debit or Credit" column
      return lowerType.includes('debit');
    } else if (sourceSheet.toLowerCase().includes('monzo')) {
      // Monzo transactions are typically debits unless it's an incoming transfer or refund
      // Check for credit indicators
      return !lowerType.includes('credit') && !lowerType.includes('refund') && !lowerType.includes('incoming');
    } else if (sourceSheet.toLowerCase().includes('revolut')) {
      // Revolut uses transaction types like CARD_PAYMENT, TRANSFER, TOPUP
      // TOPUP and incoming transfers are credits
      return !lowerType.includes('topup') && !lowerType.includes('credit');
    }
    
    // Default: assume debit unless explicitly marked as credit
    return !lowerType.includes('credit');
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
          // Combine fields using a template approach as specified in ADR-001
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
          
          // Add description for additional context if it's different from name
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
          // Combine fields using a template approach as specified in ADR-001
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
          
          // Add product info for additional context
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
          // Combine fields using a template approach as specified in ADR-001
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
    
    // Handle generic case for unknown sheets
    return {
      fields: ['Description'],
      combineStrategy: (row) => {
        // For generic sheets, just use any field that might be a description
        // Look for common description field names
        const possibleFields = ['Description', 'Merchant', 'Payee', 'Details', 'Memo', 'Narrative'];
        
        for (const field of possibleFields) {
          if (row[field] && row[field].toString().trim() !== '') {
            return row[field];
          }
        }
        
        throw new Error(`No valid description field found for sheet: ${sheetName}`);
      }
    };
  }
  
  /**
   * Get description from transaction row based on source sheet
   * @param {Array} row - Raw transaction row
   * @param {Object} indices - Column indices
   * @param {Array} headers - Sheet headers
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
      if (row[index] !== undefined && row[index] !== null) {
        rowObject[header] = row[index];
      } else {
        rowObject[header] = ''; // Ensure no undefined values
      }
    });
    
    // Get field mapping configuration for this sheet
    const mapping = this.getDescriptionFieldMapping(sourceSheet);
    
    // Make sure all needed fields are available in rowObject
    // This ensures fields mentioned in the mapping are accessible
    // even if they weren't directly found in headers
    const lowerName = sourceSheet.toLowerCase();
    if (lowerName === 'monzo') {
      if (indices.description >= 0) {
        // If Name/Description wasn't found directly, use the mapped description field
        if (headers[indices.description] === 'Name' && !rowObject['Name']) {
          rowObject['Name'] = row[indices.description];
        } else if (headers[indices.description] === 'Description' && !rowObject['Description']) {
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
      console.error(`Source sheet: ${sourceSheet}`);
      console.error(`Row data: ${JSON.stringify(row)}`);
      console.error(`Row object: ${JSON.stringify(rowObject)}`);
      console.error(`Indices: ${JSON.stringify(indices)}`);
      console.error(`Headers: ${JSON.stringify(headers)}`);
      
      // Attempt fallback description as a last resort
      if (indices.description >= 0 && row[indices.description]) {
        try {
          console.log(`Attempting fallback description from index ${indices.description}`);
          return this.normalizeDescription(row[indices.description], sourceSheet);
        } catch (fallbackError) {
          console.error(`Fallback description also failed: ${fallbackError.message}`);
        }
      }
      
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
   * @param {Object} amount - Amount object (not used for reference generation anymore)
   * @param {string} originalId - Original transaction ID if available
   * @param {string} sourceSheet - Name of the source sheet
   * @param {string} [transactionType] - Transaction type (for Revolut)
   * @param {string} [description] - Transaction description (for Yonder)
   * @returns {string} Original reference
   * 
   * This function generates stable transaction references that don't depend on
   * amount values, which could change with exchange rates over time. Instead:
   * 
   * 1. For accounts with native IDs (like Monzo): Use the original ID
   * 2. For Revolut (without native IDs): Use `${date}T${time}_${type}`
   * 3. For Yonder (without native IDs): Use `${date}T${time}_${truncatedDescription}`
   * 
   * By avoiding amount values in references, we ensure they remain stable
   * even when currency conversion rates change, which improves deduplication reliability.
   */
  generateOriginalReference(dateTime, amount, originalId, sourceSheet, transactionType, description) {
    // Guard clause for required parameters
    if (!dateTime || !dateTime.date || !dateTime.time) {
      throw new Error('Date and time object is required');
    }
    if (!sourceSheet) {
      throw new Error('Source sheet name is required');
    }
    
    // If we have an original ID from the source, use it (e.g., Monzo)
    if (originalId) {
      // console.log(`[generateOriginalReference] Using original ID from source: ${originalId}`);
      return originalId;
    }
    
    // Extract date and time components for the reference
    const datePart = dateTime.date.split('T')[0]; // YYYY-MM-DD
    const timePart = `${dateTime.time.split(':')[0]}:${dateTime.time.split(':')[1]}`; // HH:MM
    
    // Bank-specific reference generation without amount
    if (sourceSheet.toLowerCase().includes('revolut')) {
      // For Revolut: Use ${date}T${time}_${type}
      const typeValue = transactionType || 'UNKNOWN';
      const generatedRef = `${datePart}T${timePart}_${typeValue}`;
      // console.log(`[generateOriginalReference] Generated Revolut reference: ${generatedRef}`);
      return generatedRef;
    } else if (sourceSheet.toLowerCase().includes('yonder')) {
      // For Yonder: Use ${date}T${time}_${truncatedDescription}
      let descriptionValue = '';
      if (description) {
        // Sanitize and truncate description to 20 chars
        descriptionValue = description.toString()
          .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
          .replace(/\s+/g, '_')
          .trim()
          .substring(0, 20)
          .trim()
          .toUpperCase();
      }
      
      const generatedRef = `${datePart}T${timePart}_${descriptionValue}`;
      // console.log(`[generateOriginalReference] Generated Yonder reference: ${generatedRef}`);
      return generatedRef;
    }
    
    // Fallback for other sources - date+time only, no amount
    const generatedRef = `${datePart}T${timePart}`;
    console.log(`[generateOriginalReference] Generated generic reference: ${generatedRef}`);
    return generatedRef;
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
    const startRow = outputSheet.getLastRow() + 1;
    
    // Get column index for Category column (where we'll set the formula)
    const headers = outputSheet.getRange(1, 1, 1, outputSheet.getLastColumn()).getValues()[0];
    const categoryCol = headers.indexOf(this.config.OUTPUT_COLUMNS.CATEGORY) + 1; // 1-based
    
    const rows = transactions.map(t => [
      t.date,
      t.description,
      t.amount,
      '', // Category (will be set as formula below)
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
    
    console.log(`[writeNormalizedTransactions] Writing ${rows.length} transactions to output sheet starting at row ${startRow}`);
    outputSheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    
    // Set formulas for Category column: IF(Manual Override <> "", Manual Override, AI Category)
    // Column references: E = AI Category (column 5), F = Manual Override (column 6)
    const categoryFormulas = transactions.map((t, index) => {
      const rowNum = startRow + index;
      return [`=IF(F${rowNum}<>"", F${rowNum}, E${rowNum})`];
    });
    outputSheet.getRange(startRow, categoryCol, rows.length, 1).setFormulas(categoryFormulas);
    
    console.log(`[writeNormalizedTransactions] Set Category column formulas for ${rows.length} rows`);
  }
  
  /**
   * Backfill Category column formulas for existing rows that don't have them
   * This is useful for updating existing data to use the calculated Category column
   * @param {Sheet} outputSheet - The output sheet
   * @param {number} startRow - Optional starting row (default: 2, skipping header)
   * @param {number} endRow - Optional ending row (default: last row)
   */
  backfillCategoryFormulas(outputSheet, startRow = null, endRow = null) {
    // Guard clause for required parameter
    if (!outputSheet) {
      throw new Error('Output sheet is required');
    }
    
    const headers = outputSheet.getRange(1, 1, 1, outputSheet.getLastColumn()).getValues()[0];
    const categoryCol = headers.indexOf(this.config.OUTPUT_COLUMNS.CATEGORY) + 1; // 1-based
    
    const lastRow = endRow || outputSheet.getLastRow();
    const firstRow = startRow || 2; // Skip header row
    
    if (lastRow < firstRow) {
      console.log('[backfillCategoryFormulas] No rows to update');
      return;
    }
    
    const numRows = lastRow - firstRow + 1;
    const formulas = [];
    
    for (let i = 0; i < numRows; i++) {
      const rowNum = firstRow + i;
      formulas.push([`=IF(F${rowNum}<>"", F${rowNum}, E${rowNum})`]);
    }
    
    console.log(`[backfillCategoryFormulas] Backfilling Category formulas for rows ${firstRow} to ${lastRow}`);
    outputSheet.getRange(firstRow, categoryCol, numRows, 1).setFormulas(formulas);
    console.log(`[backfillCategoryFormulas] Updated ${numRows} rows with Category formulas`);
  }
  
  /**
   * Check for potential duplicate transactions and log detailed information
   * This helps detect edge cases and diagnose issues with duplicate detection
   * @param {Array} newTransactions - Array of transactions to be added
   * @param {Array} existingRefs - Array of existing references
   * @param {string} sourceSheet - Name of the source sheet being processed
   * @returns {Object} Statistics about potential duplicates found
   */
  checkForDuplicates(newTransactions, existingRefs, sourceSheet) {
    // Guard clause for required parameters
    if (!newTransactions || !Array.isArray(newTransactions)) {
      throw new Error('New transactions must be an array');
    }
    if (!existingRefs || !Array.isArray(existingRefs)) {
      throw new Error('Existing references must be an array');
    }
    if (!sourceSheet) {
      throw new Error('Source sheet name is required');
    }
    
    // Find potential duplicates
    const duplicates = newTransactions.filter(t => existingRefs.includes(t.originalReference));
    
    // Create a result object with statistics
    const result = {
      total: newTransactions.length,
      unique: newTransactions.length - duplicates.length,
      duplicates: duplicates.length,
      duplicateDetails: [] // Store details about each duplicate for diagnostics
    };
    
    // Skip detailed logging if no duplicates found
    if (duplicates.length === 0) {
      console.log(`[checkForDuplicates] No duplicates found in ${sourceSheet}.`);
      return result;
    }
    
    // Log duplicate details for diagnosis
    console.log(`[checkForDuplicates] Found ${duplicates.length} potential duplicates in ${sourceSheet}.`);
    
    duplicates.forEach(dup => {
      const details = {
        originalReference: dup.originalReference,
        date: dup.date,
        time: dup.time,
        amount: dup.amount,
        description: dup.description,
        transactionMethod: dup.transactionMethod
      };
      
      // console.log(`[checkForDuplicates] Duplicate transaction: ${JSON.stringify(details)}`);
      result.duplicateDetails.push(details);
    });
    
    return result;
  }
} 