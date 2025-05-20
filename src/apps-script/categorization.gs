/**
 * Categorization service for the Transaction Categorization System
 */

class CategorizationService {
  constructor() {
    this.config = new Config();
    this.utils = new Utils();
    this.BATCH_SIZE = 10; // Process transactions in batches of 10
    this.RATE_LIMIT_DELAY = 1000; // 1 second delay between API calls
  }

  /**
   * Categorize a batch of transactions using OpenAI
   * @param {Array} transactions - Array of transactions to categorize
   * @returns {Promise<Array>} Array of categorized transactions
   */
  async categorizeBatch(transactions) {
    // Guard clause for required parameter
    if (!transactions || !Array.isArray(transactions)) {
      throw new Error('Transactions must be an array');
    }

    // Prepare the prompt for OpenAI
    const prompt = this.buildPrompt(transactions);

    try {
      // Call OpenAI API
      const response = await this.callOpenAI(prompt);
      
      // Parse the response and update transactions
      return this.parseCategorizationResponse(response, transactions);
    } catch (error) {
      console.error('[categorizeBatch] Error categorizing transactions:', error);
      throw error;
    }
  }

  /**
   * Build the prompt for OpenAI
   * @param {Array} transactions - Array of transactions to categorize
   * @returns {string} The prompt for OpenAI
   */
  buildPrompt(transactions) {
    const categories = this.config.CATEGORIES.join(', ');
    
    // Build the system message
    const systemMessage = {
      role: 'system',
      content: `You are a financial transaction categorizer. Categorize each transaction into one of these categories: ${categories}. Consider the transaction description, amount, and any patterns from similar transactions.`
    };

    // Build the user message with transaction details
    const userMessage = {
      role: 'user',
      content: transactions.map(t => 
        `Transaction: ${t.description}\nAmount: ${t.amount} ${t.currency}\nDate: ${t.date}\n`
      ).join('\n')
    };

    return [systemMessage, userMessage];
  }

  /**
   * Call the OpenAI API
   * @param {Array} messages - Array of message objects for the API
   * @returns {Promise<Object>} The API response
   */
  async callOpenAI(messages) {
    const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not found in script properties');
    }

    const url = 'https://api.openai.com/v1/chat/completions';
    const options = {
      method: 'post',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        model: 'gpt-4',
        messages: messages,
        temperature: 0.3, // Lower temperature for more consistent categorizations
        max_tokens: 500
      })
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      return JSON.parse(response.getContentText());
    } catch (error) {
      console.error('[callOpenAI] API call failed:', error);
      throw error;
    }
  }

  /**
   * Parse the OpenAI response and update transactions
   * @param {Object} response - The OpenAI API response
   * @param {Array} transactions - Original transactions
   * @returns {Array} Updated transactions with categories
   */
  parseCategorizationResponse(response, transactions) {
    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('Invalid response format from OpenAI');
    }

    const content = response.choices[0].message.content;
    const lines = content.split('\n');
    
    // Parse each line and update transactions
    return transactions.map((transaction, index) => {
      const line = lines[index];
      if (!line) {
        return {
          ...transaction,
          aiCategory: 'Unknown',
          confidence: 0
        };
      }

      // Extract category and confidence from the response
      const match = line.match(/Category: (.*?)(?:\s*Confidence: (\d+))?/);
      if (!match) {
        return {
          ...transaction,
          aiCategory: 'Unknown',
          confidence: 0
        };
      }

      return {
        ...transaction,
        aiCategory: match[1].trim(),
        confidence: match[2] ? parseInt(match[2]) : 80 // Default confidence if not specified
      };
    });
  }

  /**
   * Process all uncategorized transactions
   * @param {Sheet} outputSheet - The output sheet
   */
  async processUncategorizedTransactions(outputSheet) {
    // Get all transactions with status 'UNPROCESSED'
    const data = outputSheet.getDataRange().getValues();
    const headers = data[0];
    const statusCol = headers.indexOf(this.config.OUTPUT_COLUMNS.PROCESSING_STATUS);
    const aiCategoryCol = headers.indexOf(this.config.OUTPUT_COLUMNS.AI_CATEGORY);
    const confidenceCol = headers.indexOf(this.config.OUTPUT_COLUMNS.CONFIDENCE);
    const timestampCol = headers.indexOf(this.config.OUTPUT_COLUMNS.CATEGORIZATION_TIMESTAMP);

    if (statusCol === -1 || aiCategoryCol === -1 || confidenceCol === -1 || timestampCol === -1) {
      throw new Error('Required columns not found in output sheet');
    }

    // Find all rows with status 'UNPROCESSED'
    const toCategorize = data
      .map((row, idx) => ({ row, idx }))
      .filter(obj => obj.idx > 0 && obj.row[statusCol] === 'UNPROCESSED');

    console.log(`[processUncategorizedTransactions] Found ${toCategorize.length} transactions to categorize`);

    // Process in batches
    for (let i = 0; i < toCategorize.length; i += this.BATCH_SIZE) {
      const batch = toCategorize.slice(i, i + this.BATCH_SIZE);
      const transactions = batch.map(obj => ({
        description: obj.row[headers.indexOf(this.config.OUTPUT_COLUMNS.DESCRIPTION)],
        amount: obj.row[headers.indexOf(this.config.OUTPUT_COLUMNS.AMOUNT)],
        currency: 'GBP',
        date: obj.row[headers.indexOf(this.config.OUTPUT_COLUMNS.DATE)]
      }));

      try {
        // Categorize the batch
        const categorized = await this.categorizeBatch(transactions);

        // Update the sheet with results
        batch.forEach((obj, batchIndex) => {
          const categorizedTransaction = categorized[batchIndex];
          const row = obj.idx + 1; // Convert to 1-based index

          // Update AI Category and Confidence
          outputSheet.getRange(row, aiCategoryCol + 1).setValue(categorizedTransaction.aiCategory);
          outputSheet.getRange(row, confidenceCol + 1).setValue(categorizedTransaction.confidence);
          
          // Update status and timestamp
          outputSheet.getRange(row, statusCol + 1).setValue('CATEGORIZED');
          outputSheet.getRange(row, timestampCol + 1).setValue(new Date());
        });

        // Add delay between batches to respect rate limits
        if (i + this.BATCH_SIZE < toCategorize.length) {
          Utilities.sleep(this.RATE_LIMIT_DELAY);
        }
      } catch (error) {
        console.error(`[processUncategorizedTransactions] Error processing batch ${i / this.BATCH_SIZE + 1}:`, error);
        
        // Update status for failed batch
        batch.forEach(obj => {
          const row = obj.idx + 1;
          outputSheet.getRange(row, statusCol + 1).setValue('ERROR');
          outputSheet.getRange(row, headers.indexOf(this.config.OUTPUT_COLUMNS.ERROR_DETAILS) + 1)
            .setValue(error.message);
        });
      }
    }
  }
} 