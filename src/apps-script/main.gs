/**
 * Main script file for the Transaction Categorization System
 */

// Global variables
let config;
let utils;

/**
 * Initialize the script and set up necessary configurations
 */
function initialize() {
  config = new Config();
  utils = new Utils();
  
  // Set up triggers if they don't exist
  setupTriggers();
}

/**
 * Set up time-based triggers for the script
 */
function setupTriggers() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Create new triggers
  ScriptApp.newTrigger('processNewTransactions')
    .timeBased()
    .everyHours(1)
    .create();
}

/**
 * Main function to process new transactions
 */
function processNewTransactions() {
  try {
    // Get source sheets
    const sourceSheets = config.getSourceSheets();
    
    // Process each source sheet
    sourceSheets.forEach(sheet => {
      const transactions = utils.getNewTransactions(sheet);
      if (transactions.length > 0) {
        categorizeTransactions(transactions);
      }
    });
  } catch (error) {
    utils.logError('processNewTransactions', error);
  }
}

/**
 * Categorize a batch of transactions using OpenAI
 * @param {Array} transactions - Array of transaction objects
 */
function categorizeTransactions(transactions) {
  // Implementation will be added in Phase 2
  console.log('Categorization to be implemented');
} 