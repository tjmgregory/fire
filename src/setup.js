/**
 * Setup and testing functions for the Transaction Categorization System
 */

/**
 * Test function to verify the project setup
 */
function testSetup() {
  try {
    // Test spreadsheet access
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('✓ Successfully accessed spreadsheet');
    
    // Test script properties
    const scriptProperties = PropertiesService.getScriptProperties();
    const apiKey = scriptProperties.getProperty('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not found in script properties');
    }
    Logger.log('✓ OpenAI API key found');
    
    // Test sheet initialization
    initializeSpreadsheet();
    Logger.log('✓ Sheets initialized successfully');
    
    // Test with sample data
    const sourceSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SOURCE);
    const testData = [
      ['2024-03-15', 'WALMART GROCERY', 45.67, '', '', '', ''],
      ['2024-03-14', 'NETFLIX SUBSCRIPTION', 15.99, '', '', '', ''],
      ['2024-03-13', 'UBER RIDE', 12.50, '', '', '', '']
    ];
    
    // Add test data
    testData.forEach(row => sourceSheet.appendRow(row));
    Logger.log('✓ Test data added successfully');
    
    return 'Setup test completed successfully!';
  } catch (error) {
    Logger.log('Error during setup test: ' + error.toString());
    throw error;
  }
}

/**
 * Create a menu in the spreadsheet for easy access to functions
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Transaction Categorizer')
    .addItem('Initialize Sheets', 'initializeSpreadsheet')
    .addItem('Process New Transactions', 'processNewTransactions')
    .addItem('Run Setup Test', 'testSetup')
    .addToUi();
}

/**
 * Clear all test data from the sheets
 */
function clearTestData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SOURCE);
  const outputSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.OUTPUT);
  const summarySheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SUMMARY);
  
  // Clear all data except headers
  if (sourceSheet) {
    const lastRow = sourceSheet.getLastRow();
    if (lastRow > 1) {
      sourceSheet.getRange(2, 1, lastRow - 1, sourceSheet.getLastColumn()).clear();
    }
  }
  
  if (outputSheet) {
    const lastRow = outputSheet.getLastRow();
    if (lastRow > 1) {
      outputSheet.getRange(2, 1, lastRow - 1, outputSheet.getLastColumn()).clear();
    }
  }
  
  if (summarySheet) {
    const lastRow = summarySheet.getLastRow();
    if (lastRow > 1) {
      summarySheet.getRange(2, 1, lastRow - 1, summarySheet.getLastColumn()).clear();
    }
  }
  
  Logger.log('Test data cleared successfully');
} 