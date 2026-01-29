/**
 * onEdit Trigger Handler
 *
 * Handles Google Sheets onEdit events for manual category overrides.
 * This trigger fires when a user edits the "Manual Category" column,
 * automatically resolving category names to UUIDs.
 *
 * Key features:
 * - Only processes USER edits (ignores script updates to prevent infinite loops)
 * - Guards against edits outside the Manual Category column
 * - Uses ManualOverrideHandler for category resolution and ID assignment
 * - Provides error handling and logging for auditability
 *
 * Implementation of FR-013 (Manual Category Override) and FR-016 (Category Name Resolution).
 *
 * @module triggers/onEditTrigger
 */

import { ManualOverrideHandler, OnEditEvent } from '../domain/categorization/ManualOverrideHandler';
import { CategoryResolver } from '../domain/categorization/CategoryResolver';
import { Category } from '../models/Category';
import { Logger } from '../utils/Logger';

/**
 * Column configuration for manual overrides
 */
const MANUAL_OVERRIDE_CONFIG = {
  manualCategoryHeader: 'Manual Category',
  manualCategoryIdHeader: 'Manual Category ID',
  resultSheetName: 'Result',
  categoriesSheetName: 'Categories'
};

/**
 * Main onEdit trigger function
 *
 * This is the entry point for Google Sheets onEdit simple trigger.
 * Must be globally accessible (not exported) for Apps Script to invoke it.
 *
 * @param e - Google Sheets onEdit event object
 */
function onEdit(e: OnEditEvent): void {
  try {
    Logger.info('onEdit trigger fired');

    // Guard: Only process events with a range
    if (!e?.range) {
      Logger.debug('No range in event, ignoring');
      return;
    }

    // Guard: Only process edits to the Result sheet
    const sheet = e.range.getSheet();
    if (sheet.getName() !== MANUAL_OVERRIDE_CONFIG.resultSheetName) {
      Logger.debug(`Edit not in ${MANUAL_OVERRIDE_CONFIG.resultSheetName} sheet, ignoring`);
      return;
    }

    // Guard: Only process USER edits (prevent infinite loops)
    // The ManualOverrideHandler also checks this, but we do an early check here
    // to avoid unnecessary processing
    if (e.source === 'SCRIPT') {
      Logger.debug('Script-initiated edit, ignoring to prevent infinite loop');
      return;
    }

    // Load active categories from the Categories sheet
    const activeCategories = loadActiveCategories();
    if (activeCategories.length === 0) {
      Logger.warning('No active categories found, manual override not possible');
      return;
    }

    // Create handler and process the edit
    const categoryResolver = new CategoryResolver();
    const handler = new ManualOverrideHandler(categoryResolver);

    const result = handler.handleEdit(e, activeCategories, MANUAL_OVERRIDE_CONFIG);

    if (result) {
      Logger.info(`Manual override processed: ${result.message}`);

      // Log warning for custom categories (not in Categories sheet)
      if (!result.categoryId && result.categoryName) {
        Logger.warning(
          `Custom category "${result.categoryName}" used. Consider adding to Categories sheet.`
        );
      }
    }

  } catch (error) {
    Logger.error(`Error in onEdit trigger: ${error}`);

    // Optionally show user-facing error
    // (Uncomment if you want to display errors to users)
    // SpreadsheetApp.getActiveSpreadsheet().toast(
    //   'Error processing manual category override. Please check logs.',
    //   'Error',
    //   5
    // );
  }
}

/**
 * Load active categories from the Categories sheet
 *
 * Reads the Categories sheet and returns only active categories
 * for use in category name resolution.
 *
 * @returns Array of active categories
 */
function loadActiveCategories(): Category[] {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const categoriesSheet = spreadsheet.getSheetByName(MANUAL_OVERRIDE_CONFIG.categoriesSheetName);

    if (!categoriesSheet) {
      Logger.error(`Categories sheet "${MANUAL_OVERRIDE_CONFIG.categoriesSheetName}" not found`);
      return [];
    }

    const lastRow = categoriesSheet.getLastRow();
    if (lastRow <= 1) {
      Logger.warning('Categories sheet is empty (no data rows)');
      return [];
    }

    // Read all category data (assuming standard Categories sheet structure)
    // Columns: ID, Name, Description, Examples, Is Active, Created At, Modified At
    const data = categoriesSheet.getRange(2, 1, lastRow - 1, 7).getValues();

    const categories: Category[] = [];

    for (const row of data) {
      const [id, name, description, examples, isActive, createdAt, modifiedAt] = row;

      // Skip inactive categories
      if (!isActive) {
        continue;
      }

      // Skip rows with missing required fields
      if (!id || !name) {
        continue;
      }

      categories.push({
        id: id.toString(),
        name: name.toString(),
        description: description?.toString() || '',
        examples: examples?.toString() || '',
        isActive: Boolean(isActive),
        createdAt: createdAt instanceof Date ? createdAt : new Date(createdAt),
        modifiedAt: modifiedAt instanceof Date ? modifiedAt : new Date(modifiedAt)
      });
    }

    Logger.info(`Loaded ${categories.length} active categories`);
    return categories;

  } catch (error) {
    Logger.error(`Error loading active categories: ${error}`);
    return [];
  }
}

/**
 * Install the onEdit trigger (for installable trigger setup)
 *
 * Simple triggers have limitations (no external services, limited quotas).
 * For production use, install this as an installable trigger with:
 *
 * 1. Go to Extensions > Apps Script
 * 2. Click on Triggers (clock icon)
 * 3. Add Trigger:
 *    - Function: onEdit
 *    - Event source: From spreadsheet
 *    - Event type: On edit
 *    - Failure notification: Daily
 *
 * Or run this function once to programmatically install it.
 */
function installOnEditTrigger(): void {
  // Remove existing onEdit triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create new installable trigger
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  Logger.info('Installable onEdit trigger installed');
}

/**
 * Uninstall the onEdit trigger (for cleanup)
 */
function uninstallOnEditTrigger(): void {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;

  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
      count++;
    }
  }

  Logger.info(`Removed ${count} onEdit trigger(s)`);
}

// Export types for testing
export { onEdit, installOnEditTrigger, uninstallOnEditTrigger, loadActiveCategories };
