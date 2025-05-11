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
  
  // Guard clause for required objects
  if (!config) config = new Config();
  if (!utils) utils = new Utils();
  
  // Set up triggers if they don't exist
  setupTriggers();
  console.log('[initialize] Initialization complete.');
}

/**
 * Set up time-based triggers for the script
 */
function setupTriggers() {
  console.log('[setupTriggers] Setting up triggers...');
  
  // Guard clause for required objects
  if (!config || !utils) {
    throw new Error('Configuration or utilities not initialized');
  }
  
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
  
  console.log(`[onSheetEdit] Edit event on sheet: ${sheet.getName()}, range: ${range.getA1Notation()}`);
  
  // Check if the edit was in a source sheet
  if (!config.getSourceSheets().includes(sheet)) {
    console.log(`[onSheetEdit] Sheet ${sheet.getName()} is not a source sheet. Skipping.`);
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
  
  // Get all existing originalReferences in the output sheet - key change for duplicate detection
  const lastRow = outputSheet.getLastRow();
  const originalRefCol = 10; // Original Reference column (1-based)
  const existingRefs = lastRow > 1 ? outputSheet.getRange(2, originalRefCol, lastRow - 1, 1).getValues().flat() : [];
  
  console.log(`[processNewTransactions] Found ${existingRefs.length} existing transaction references.`);

  // Summary stats for logging and reporting
  const processingStats = {
    processed: 0,
    added: 0,
    duplicatesSkipped: 0,
    sheetStats: {}
  };

  // Process each source sheet
  sourceSheets.forEach(sheet => {
    const sheetName = sheet.getName();
    console.log(`[processNewTransactions] Processing source sheet: ${sheetName}`);
    
    // Normalize all transactions from the sheet
    const transactions = utils.getNewTransactions(sheet).map(t => ({ ...t, sourceSheet: sheetName }));
    
    // Run duplicate check with detailed logging
    const duplicateCheck = utils.checkForDuplicates(transactions, existingRefs, sheetName);
    
    // Filter out already processed transactions by originalReference
    const newTransactions = transactions.filter(t => !existingRefs.includes(t.originalReference));
    
    // Update processing stats
    processingStats.processed += transactions.length;
    processingStats.duplicatesSkipped += duplicateCheck.duplicates;
    processingStats.added += newTransactions.length;
    processingStats.sheetStats[sheetName] = {
      total: transactions.length,
      duplicates: duplicateCheck.duplicates,
      added: newTransactions.length
    };
    
    console.log(`[processNewTransactions] Found ${newTransactions.length} new transactions in sheet: ${sheetName}`);
    
    if (newTransactions.length > 0) {
      // Persist normalized transactions to output sheet
      utils.writeNormalizedTransactions(newTransactions, outputSheet);
      console.log(`[processNewTransactions] Added ${newTransactions.length} new transactions from ${sheetName}`);
    } else {
      console.log(`[processNewTransactions] No new transactions to add from ${sheetName}`);
    }
  });
  
  // Log summary of processing
  console.info('[processNewTransactions] Transaction processing summary:');
  console.info(`- Total transactions processed: ${processingStats.processed}`);
  console.info(`- Transactions added: ${processingStats.added}`);
  console.info(`- Duplicates skipped: ${processingStats.duplicatesSkipped}`);
  Object.keys(processingStats.sheetStats).forEach(sheet => {
    const stats = processingStats.sheetStats[sheet];
    console.info(`- ${sheet}: ${stats.total} processed, ${stats.added} added, ${stats.duplicates} duplicates`);
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
  
  console.log(`[categorizeTransactions] Found ${toCategorize.length} transactions to categorize.`);
  // TODO: Implement categorization logic for these rows
}