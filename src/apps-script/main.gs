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
  console.info('[initialize] Starting initialization...');
  
  // Guard clause for required objects
  if (!config) config = new Config();
  if (!utils) utils = new Utils();
  
  // Set up triggers if they don't exist
  setupTriggers();
  console.info('[initialize] Initialization complete.');
}

/**
 * Set up time-based triggers for the script
 */
function setupTriggers() {
  console.info('[setupTriggers] Setting up triggers...');
  
  // Guard clause for required objects
  if (!config || !utils) {
    throw new Error('Configuration or utilities not initialized');
  }
  
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    console.debug(`[setupTriggers] Deleting existing trigger for function: ${trigger.getHandlerFunction()}`);
    ScriptApp.deleteTrigger(trigger);
  });
  
  // Create a one-time trigger to run immediately
  ScriptApp.newTrigger('processNewTransactions')
    .timeBased()
    .at(new Date())
    .create();
  console.info('[setupTriggers] Created one-time immediate trigger for processNewTransactions');

  // Create a recurring trigger to run every hour
  ScriptApp.newTrigger('processNewTransactions')
    .timeBased()
    .everyHours(1)
    .create();
  console.info('[setupTriggers] Created hourly recurring trigger for processNewTransactions');
    
  // Create an edit trigger for each source sheet
  const sourceSheets = config.getSourceSheets();
  sourceSheets.forEach(sheet => {
    ScriptApp.newTrigger('onSheetEdit')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onEdit()
      .create();
    console.debug(`[setupTriggers] Created onEdit trigger for sheet: ${sheet.getName()}`);
  });
  console.info('[setupTriggers] Trigger setup complete.');
}

/**
 * Handle sheet edit events
 * @param {Event} e - The edit event
 */
function onSheetEdit(e) {
  // Guard clause for event object
  if (!e || !e.source) {
    console.warn('[onSheetEdit] Invalid edit event received');
    return;
  }

  // Ensure config and utils are initialized
  if (!config) config = new Config();
  if (!utils) utils = new Utils();
  
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  
  console.debug(`[onSheetEdit] Edit event on sheet: ${sheet.getName()}, range: ${range.getA1Notation()}`);
  
  // Check if the edit was in a source sheet
  if (!config.getSourceSheets().includes(sheet)) {
    console.debug(`[onSheetEdit] Sheet ${sheet.getName()} is not a source sheet. Skipping.`);
    return;
  }
  
  // Process only if a new row was added
  if (range.getNumRows() === 1 && range.getRow() > 1) {
    console.info('[onSheetEdit] New row detected. Processing new transactions...');
    processNewTransactions();
  }
}

/**
 * Main function to process new transactions
 */
function processNewTransactions() {
  console.info('[processNewTransactions] Starting transaction processing...');
  
  // Guard clause for required objects
  if (!config) config = new Config();
  if (!utils) utils = new Utils();
  
  // Get source sheets
  const sourceSheets = config.getSourceSheets();
  const outputSheet = config.getOutputSheet();
  
  // Get all existing transaction IDs in the output sheet
  const lastRow = outputSheet.getLastRow();
  const idCol = 9; // Transaction ID column (1-based)
  const existingIds = lastRow > 1 ? outputSheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat() : [];

  // Process each source sheet
  sourceSheets.forEach(sheet => {
    console.debug(`[processNewTransactions] Processing source sheet: ${sheet.getName()}`);
    const transactions = utils.getNewTransactions(sheet).map(t => ({ ...t, sourceSheet: sheet.getName() }));
    // Filter out already processed transactions by ID
    const newTransactions = transactions.filter(t => !existingIds.includes(t.id));
    console.info(`[processNewTransactions] Found ${newTransactions.length} new transactions in sheet: ${sheet.getName()}`);
    if (newTransactions.length > 0) {
      // Persist normalized transactions to output sheet
      utils.writeNormalizedTransactions(newTransactions, outputSheet);
    }
  });
  console.info('[processNewTransactions] Transaction processing complete.');
}

/**
 * Categorize a batch of transactions using OpenAI
 * This function should be triggered separately and only process rows with Processing Status 'Normalized'.
 */
function categorizeTransactions() {
  console.info('[categorizeTransactions] Starting transaction categorization...');
  
  // Guard clause for required objects
  if (!config) config = new Config();
  if (!utils) utils = new Utils();
  
  const outputSheet = config.getOutputSheet();
  const data = outputSheet.getDataRange().getValues();
  const headers = data[0];
  const statusCol = headers.indexOf(config.OUTPUT_COLUMNS.PROCESSING_STATUS);
  const idCol = headers.indexOf(config.OUTPUT_COLUMNS.TRANSACTION_ID);
  
  // Guard clause for required columns
  if (statusCol === -1 || idCol === -1) {
    throw new Error('Required columns not found in output sheet');
  }
  
  // Find all rows with status 'UNPROCESSED'
  const toCategorize = data
    .map((row, idx) => ({ row, idx }))
    .filter(obj => obj.idx > 0 && obj.row[statusCol] === 'UNPROCESSED');
  
  console.info(`[categorizeTransactions] Found ${toCategorize.length} transactions to categorize.`);
  // TODO: Implement categorization logic for these rows
}

/**
 * Entry point for trigger-based execution
 */
function onTrigger() {
  try {
    console.info('[onTrigger] Starting scheduled execution');
    processNewTransactions();
    console.info('[onTrigger] Execution completed successfully');
    return true;
  } catch (error) {
    // This is where we ensure the script doesn't crash
    // Log the error ONLY at the place where it's caught and handled
    console.error('[onTrigger] Execution failed:', error);
    return false;
  }
} 