/**
 * Configuration settings for the Transaction Categorization System
 */

const CONFIG = {
  // OpenAI API settings
  OPENAI: {
    MODEL: 'gpt-4-0125-preview',
    TEMPERATURE: 0.3,
    MAX_TOKENS: 150
  },
  
  // Sheet settings
  SHEETS: {
    SOURCE: {
      NAME: 'Transactions',
      COLUMNS: {
        DATE: 0,
        DESCRIPTION: 1,
        AMOUNT: 2,
        CATEGORY: 3,
        MANUAL_OVERRIDE: 4,
        CONFIDENCE: 5,
        LAST_UPDATED: 6
      }
    },
    OUTPUT: {
      NAME: 'Categorized Transactions',
      COLUMNS: {
        DATE: 0,
        DESCRIPTION: 1,
        AMOUNT: 2,
        CATEGORY: 3,
        SOURCE: 4
      }
    },
    SUMMARY: {
      NAME: 'Monthly Summary',
      COLUMNS: {
        MONTH: 0,
        CATEGORIES_START: 1
      }
    }
  },
  
  // Processing settings
  PROCESSING: {
    BATCH_SIZE: 50,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000 // milliseconds
  }
};

// Export the configuration
if (typeof module !== 'undefined') {
  module.exports = CONFIG;
} 