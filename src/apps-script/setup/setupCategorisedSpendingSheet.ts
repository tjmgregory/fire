/**
 * Categorised Spending Sheet Setup
 *
 * Creates a summary sheet with months as rows and categories as columns.
 * Each cell contains a SUMIFS formula that calculates the total GBP spend
 * for that category in that month, based on live data from the Result sheet.
 *
 * Idempotent - safe to run multiple times. Recreates the sheet on each run
 * to pick up any new/changed categories.
 *
 * @module setup/setupCategorisedSpendingSheet
 */

import { Logger } from '../utils/Logger';
import { ConfigurationManager } from '../infrastructure/config/ConfigurationManager';

const DEFAULT_SHEET_NAME = 'Categorised Spending';

interface CategorisedSpendingResult {
  created: boolean;
  configured: boolean;
  error?: string;
}

/**
 * Setup the Categorised Spending sheet.
 *
 * Reads active categories and the date range from the Result sheet,
 * then builds a month-by-category grid populated with SUMIFS formulas.
 *
 * Called as part of setupSheets(). Also safe to re-run independently
 * whenever categories change.
 */
function setupCategorisedSpendingSheet(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet
): CategorisedSpendingResult {
  Logger.info('Starting Categorised Spending sheet setup');

  try {
    // Read active categories
    const categoriesSheetName = ConfigurationManager.get('CATEGORIES_SHEET_NAME', 'Categories') || 'Categories';
    const categoriesSheet = spreadsheet.getSheetByName(categoriesSheetName);
    if (!categoriesSheet) {
      return { created: false, configured: false, error: 'Categories sheet not found' };
    }

    const categoryNames = getActiveCategoryNames(categoriesSheet);
    if (categoryNames.length === 0) {
      return { created: false, configured: false, error: 'No active categories found' };
    }

    // Get date range from Result sheet
    const resultSheetName = ConfigurationManager.get('RESULT_SHEET_NAME', 'Result') || 'Result';
    const resultSheet = spreadsheet.getSheetByName(resultSheetName);
    if (!resultSheet) {
      return { created: false, configured: false, error: 'Result sheet not found' };
    }

    const months = getMonthRange(resultSheet);
    if (months.length === 0) {
      return { created: false, configured: false, error: 'No transactions found in Result sheet yet' };
    }

    // Resolve sheet name from config
    const sheetName = ConfigurationManager.get('CATEGORISED_SPENDING_SHEET_NAME', DEFAULT_SHEET_NAME) || DEFAULT_SHEET_NAME;

    // Delete existing sheet and recreate (idempotent refresh)
    const existingSheet = spreadsheet.getSheetByName(sheetName);
    const isRecreate = !!existingSheet;
    if (existingSheet) {
      spreadsheet.deleteSheet(existingSheet);
      Logger.info('Deleted existing Categorised Spending sheet for refresh');
    }

    const sheet = spreadsheet.insertSheet(sheetName);

    // Write headers: "Month" in A1, then category names
    const headers = ['Month', ...categoryNames];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#e8eaed');

    // Write month labels in column A (starting row 2)
    const monthValues = months.map(m => [m]);
    sheet.getRange(2, 1, months.length, 1).setValues(monthValues);

    // Build SUMIFS formulas for each cell
    // Result sheet references:
    //   Column K (11) = GBP Amount
    //   Column S (19) = Category (computed)
    //   Column D (4)  = Transaction Date
    //
    // Formula pattern (e.g. cell B2):
    //   =SUMIFS(Result!$K:$K, Result!$S:$S, B$1, TEXT(Result!$D:$D,"YYYY-MM"), $A2)
    //   - B$1 locks row for category header (absolute row, relative column)
    //   - $A2 locks column for month label (absolute column, relative row)
    const formulas: string[][] = [];

    for (let row = 0; row < months.length; row++) {
      const sheetRow = row + 2; // data starts at row 2
      const formulaRow: string[] = [];
      for (let col = 0; col < categoryNames.length; col++) {
        const colLetter = columnToLetter(col + 2); // +2 because col A is Month
        const formula = `=SUMIFS('${resultSheetName}'!$K:$K,'${resultSheetName}'!$S:$S,${colLetter}$1,TEXT('${resultSheetName}'!$D:$D,"YYYY-MM"),$A${sheetRow})`;
        formulaRow.push(formula);
      }
      formulas.push(formulaRow);
    }

    // Write all formulas at once
    sheet.getRange(2, 2, months.length, categoryNames.length).setFormulas(formulas);

    // Format: set column widths
    sheet.setColumnWidth(1, 100); // Month column
    for (let i = 0; i < categoryNames.length; i++) {
      sheet.setColumnWidth(i + 2, 120);
    }

    // Format: number format for currency cells
    sheet.getRange(2, 2, months.length, categoryNames.length).setNumberFormat('#,##0.00');

    // Freeze header row and month column
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);

    Logger.info('Categorised Spending sheet setup completed', {
      categories: categoryNames.length,
      months: months.length
    });

    return { created: !isRecreate, configured: true };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Categorised Spending sheet setup failed: ${message}`);
    return { created: false, configured: false, error: message };
  }
}

/**
 * Read active category names from the Categories sheet
 */
function getActiveCategoryNames(categoriesSheet: GoogleAppsScript.Spreadsheet.Sheet): string[] {
  const data = categoriesSheet.getDataRange().getValues();
  const names: string[] = [];

  // Column indices (from CATEGORIES_SHEET_COLUMNS)
  const NAME_COL = 1;
  const IS_ACTIVE_COL = 4;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const isActive = row[IS_ACTIVE_COL] !== false && row[IS_ACTIVE_COL] !== 'FALSE';
    if (isActive && row[NAME_COL]) {
      names.push(String(row[NAME_COL]));
    }
  }

  return names;
}

/**
 * Get the range of months from the Result sheet transaction dates.
 *
 * Scans Transaction Date column (D) to find min and max dates,
 * then generates an array of "YYYY-MM" strings covering the full range.
 */
function getMonthRange(resultSheet: GoogleAppsScript.Spreadsheet.Sheet): string[] {
  const lastRow = resultSheet.getLastRow();
  if (lastRow <= 1) return [];

  // Read Transaction Date column (column 4)
  const dateData = resultSheet.getRange(2, 4, lastRow - 1, 1).getValues();

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const row of dateData) {
    const val = row[0];
    if (!val) continue;

    const date = val instanceof Date ? val : new Date(val);
    if (isNaN(date.getTime())) continue;

    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
  }

  if (!minDate || !maxDate) return [];

  // Generate month strings from min to max
  const months: string[] = [];
  const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/**
 * Convert a 1-indexed column number to a letter (1=A, 2=B, ... 27=AA)
 */
function columnToLetter(col: number): string {
  let letter = '';
  let temp = col;
  while (temp > 0) {
    temp--;
    letter = String.fromCharCode(65 + (temp % 26)) + letter;
    temp = Math.floor(temp / 26);
  }
  return letter;
}

export { setupCategorisedSpendingSheet, CategorisedSpendingResult };
