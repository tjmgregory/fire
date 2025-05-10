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
  console.log('[initialize] Starting initialization...');
  config = new Config();
  utils = new Utils();
  
  // Set up triggers if they don't exist
  setupTriggers();
  console.log('[initialize] Initialization complete.');
}

/**
 * Set up time-based triggers for the script
 */
function setupTriggers() {
  console.log('[setupTriggers] Setting up triggers...');
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    console.log(`[setupTriggers] Deleting existing trigger for function: ${trigger.getHandlerFunction()}`);
    ScriptApp.deleteTrigger(trigger);
  });
  
  // Create a one-time trigger to run immediately
  ScriptApp.newTrigger('processNewTransactions')
    .timeBased()
    .at(new Date())
    .create();
  console.log('[setupTriggers] Created one-time immediate trigger for processNewTransactions');

  // Create a recurring trigger to run every hour
  ScriptApp.newTrigger('processNewTransactions')
    .timeBased()
    .everyHours(1)
    .create();
  console.log('[setupTriggers] Created hourly recurring trigger for processNewTransactions');
    
  // Create an edit trigger for each source sheet
  const sourceSheets = config.getSourceSheets();
  sourceSheets.forEach(sheet => {
    ScriptApp.newTrigger('onSheetEdit')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onEdit()
      .create();
    console.log(`[setupTriggers] Created onEdit trigger for sheet: ${sheet.getName()}`);
  });
  console.log('[setupTriggers] Trigger setup complete.');
}

/**
 * Handle sheet edit events
 * @param {Event} e - The edit event
 */
function onSheetEdit(e) {
  if (!e || !e.source) return;

  // Ensure config and utils are initialized
  if (!config) config = new Config();
  if (!utils) utils = new Utils();
  
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  
  console.log(`[onSheetEdit] Edit event on sheet: ${sheet.getName()}, range: ${range.getA1Notation()}`);
  
  // Check if the edit was in a source sheet
  if (!config.getSourceSheets().includes(sheet)) {
    console.log(`[onSheetEdit] Sheet ${sheet.getName()} is not a source sheet. Skipping.`);
    return;
  }
  
  // Process only if a new row was added
  if (range.getNumRows() === 1 && range.getRow() > 1) {
    console.log('[onSheetEdit] New row detected. Processing new transactions...');
    processNewTransactions();
  }
}

/**
 * Main function to process new transactions
 */
function processNewTransactions() {
  console.log('[processNewTransactions] Starting transaction processing...');
  // Ensure config and utils are initialized
  if (!config) config = new Config();
  if (!utils) utils = new Utils();
  
  try {
    // Get source sheets
    const sourceSheets = config.getSourceSheets();
    const outputSheet = config.getOutputSheet();
    
    // Get all existing transaction IDs in the output sheet
    const lastRow = outputSheet.getLastRow();
    const idCol = 9; // Transaction ID column (1-based)
    const existingIds = lastRow > 1 ? outputSheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat() : [];

    // Process each source sheet
    sourceSheets.forEach(sheet => {
      console.log(`[processNewTransactions] Processing source sheet: ${sheet.getName()}`);
      const transactions = utils.getNewTransactions(sheet).map(t => ({ ...t, sourceSheet: sheet.getName() }));
      // Filter out already processed transactions by ID
      const newTransactions = transactions.filter(t => !existingIds.includes(t.id));
      console.log(`[processNewTransactions] Found ${newTransactions.length} new transactions in sheet: ${sheet.getName()}`);
      if (newTransactions.length > 0) {
        // Persist normalized transactions to output sheet
        utils.writeNormalizedTransactions(newTransactions, outputSheet);
      }
    });
    console.log('[processNewTransactions] Transaction processing complete.');
  } catch (error) {
    console.error('[processNewTransactions] Error:', error);
    utils.logError('processNewTransactions', error);
  }
}

/**
 * Categorize a batch of transactions using OpenAI
 * This function should be triggered separately and only process rows with Processing Status 'Normalized'.
 */
function categorizeTransactions() {
  console.log(`[categorizeTransactions] Scanning for uncategorized transactions.`);
  if (!config) config = new Config();
  if (!utils) utils = new Utils();
  const outputSheet = config.getOutputSheet();
  const data = outputSheet.getDataRange().getValues();
  const headers = data[0];
  const statusCol = headers.indexOf(config.OUTPUT_COLUMNS.PROCESSING_STATUS);
  const idCol = headers.indexOf(config.OUTPUT_COLUMNS.TRANSACTION_ID);
  // Find all rows with status 'UNPROCESSED'
  const toCategorize = data
    .map((row, idx) => ({ row, idx }))
    .filter(obj => obj.idx > 0 && obj.row[statusCol] === 'UNPROCESSED');
  // TODO: Implement categorization logic for these rows
  console.log(`[categorizeTransactions] Found ${toCategorize.length} transactions to categorize.`);
  // ...categorization logic to be implemented...
} 