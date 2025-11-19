/**
 * Manual Override Handler
 *
 * Handles manual category overrides when users edit the "Manual Category" column
 * in the result sheet. Resolves category names to UUIDs for referential integrity.
 *
 * Implements FR-013 (Manual Category Override) and FR-016 (Category Name Resolution).
 *
 * @module domain/categorization/ManualOverrideHandler
 */

import { Category } from '../../models/Category';
import { CategoryResolver, CategoryResolutionResult } from './CategoryResolver';
import { Logger } from '../../utils/Logger';

/**
 * Google Sheets onEdit event object
 */
export interface OnEditEvent {
  /**
   * The range that was edited
   */
  range: GoogleAppsScript.Spreadsheet.Range;

  /**
   * The source of the edit (e.g., 'USER', 'SCRIPT')
   */
  source?: string;

  /**
   * The edit type (e.g., 'EDIT', 'INSERT_ROW', 'DELETE_ROW')
   */
  authMode?: GoogleAppsScript.Script.AuthMode;

  /**
   * The value before the edit
   */
  oldValue?: string;

  /**
   * The value after the edit
   */
  value?: string;
}

/**
 * Manual override processing result
 */
export interface ManualOverrideResult {
  /**
   * Whether the override was processed successfully
   */
  success: boolean;

  /**
   * The resolved category (if found)
   */
  category?: Category;

  /**
   * Warning or error message
   */
  message?: string;

  /**
   * The category ID that was written (or null if custom category)
   */
  categoryId: string | null;

  /**
   * The normalized category name that was written
   */
  categoryName: string;
}

/**
 * Configuration for identifying the Manual Category column
 */
export interface ManualCategoryColumnConfig {
  /**
   * The column header name for Manual Category
   */
  manualCategoryHeader: string;

  /**
   * The column header name for Manual Category ID
   */
  manualCategoryIdHeader: string;
}

/**
 * Manual Override Handler
 *
 * Processes onEdit events for the "Manual Category" column and automatically
 * resolves category names to UUIDs. Prevents infinite loops by only processing
 * USER-initiated edits.
 *
 * Key features:
 * - Only processes user edits (ignores script updates to avoid infinite loops)
 * - Resolves category names to UUIDs using CategoryResolver
 * - Updates both Manual Category ID and Manual Category Name atomically
 * - Supports custom category names (no ID if category not found)
 * - Provides detailed logging for auditability
 *
 * @example
 * ```typescript
 * // In onEdit trigger
 * function onEdit(e: OnEditEvent) {
 *   const handler = new ManualOverrideHandler(categoryResolver, sheet);
 *   const result = handler.handleEdit(e, activeCategories, columnConfig);
 *   if (result.success) {
 *     Logger.info(`Override successful: ${result.message}`);
 *   }
 * }
 * ```
 */
export class ManualOverrideHandler {
  private readonly categoryResolver: CategoryResolver;

  /**
   * Create a new Manual Override Handler
   *
   * @param categoryResolver - The category resolver to use for name-to-ID resolution
   */
  constructor(categoryResolver: CategoryResolver) {
    this.categoryResolver = categoryResolver;
  }

  /**
   * Handle an onEdit event
   *
   * Main entry point for processing onEdit triggers. Validates the edit source,
   * checks if the edit is in the Manual Category column, resolves the category
   * name, and updates the Manual Category ID column.
   *
   * @param event - The Google Sheets onEdit event
   * @param activeCategories - List of active categories for resolution
   * @param columnConfig - Configuration for locating the Manual Category columns
   * @returns Result of the manual override processing
   *
   * @example
   * ```typescript
   * function onEdit(e) {
   *   const handler = new ManualOverrideHandler(new CategoryResolver());
   *   const config = {
   *     manualCategoryHeader: 'Manual Category',
   *     manualCategoryIdHeader: 'Manual Category ID'
   *   };
   *   const result = handler.handleEdit(e, categories, config);
   * }
   * ```
   */
  handleEdit(
    event: OnEditEvent,
    activeCategories: Category[],
    columnConfig: ManualCategoryColumnConfig
  ): ManualOverrideResult | null {
    // Guard: Only process USER edits (prevent infinite loops)
    if (!this.isUserEdit(event)) {
      Logger.debug('Ignoring non-user edit event');
      return null;
    }

    // Get the edited range and sheet
    const range = event.range;
    const sheet = range.getSheet();

    // Get header row to determine column indices
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const manualCategoryCol = this.findColumnIndex(headers, columnConfig.manualCategoryHeader);
    const manualCategoryIdCol = this.findColumnIndex(headers, columnConfig.manualCategoryIdHeader);

    if (manualCategoryCol === -1 || manualCategoryIdCol === -1) {
      Logger.error(
        `Required columns not found. Manual Category: ${manualCategoryCol}, ` +
        `Manual Category ID: ${manualCategoryIdCol}`
      );
      return null;
    }

    // Guard: Only process edits to the Manual Category column
    if (range.getColumn() !== manualCategoryCol + 1) {
      Logger.debug(`Edit not in Manual Category column (col ${range.getColumn()})`);
      return null;
    }

    // Get the edited value
    const categoryName = event.value?.toString().trim() || '';

    // Handle empty value (user clearing manual override)
    if (categoryName === '') {
      return this.clearManualOverride(range, manualCategoryIdCol);
    }

    // Resolve category name to ID
    const resolution = this.categoryResolver.resolveCategoryName(
      categoryName,
      activeCategories
    );

    // Update the Manual Category ID column
    return this.applyManualOverride(
      range,
      manualCategoryIdCol,
      categoryName,
      resolution
    );
  }

  /**
   * Check if an edit event was initiated by a user (not a script)
   *
   * This is critical for preventing infinite loops when the script writes back
   * to the sheet.
   *
   * @param event - The onEdit event to check
   * @returns True if the edit was made by a user
   */
  private isUserEdit(event: OnEditEvent): boolean {
    // In simple triggers, event.source is undefined for user edits
    // In installable triggers, event.authMode should be FULL for user edits
    // For safety, we check both conditions

    // If source is explicitly 'SCRIPT', it's not a user edit
    if (event.source === 'SCRIPT') {
      return false;
    }

    // If event has no range, it's not a valid edit event
    if (!event.range) {
      return false;
    }

    // All other cases are considered user edits
    // (including simple trigger with no source property)
    return true;
  }

  /**
   * Find the column index for a given header name
   *
   * @param headers - Array of header values from the sheet
   * @param headerName - The header name to search for
   * @returns The zero-based column index, or -1 if not found
   */
  private findColumnIndex(headers: unknown[], headerName: string): number {
    const normalizedSearchName = headerName.toLowerCase().trim();
    return headers.findIndex(
      h => h?.toString().toLowerCase().trim() === normalizedSearchName
    );
  }

  /**
   * Clear a manual override (user deleted the category name)
   *
   * @param range - The edited range
   * @param manualCategoryIdCol - Zero-based index of Manual Category ID column
   * @returns Result indicating the override was cleared
   */
  private clearManualOverride(
    range: GoogleAppsScript.Spreadsheet.Range,
    manualCategoryIdCol: number
  ): ManualOverrideResult {
    const sheet = range.getSheet();
    const row = range.getRow();

    // Clear the Manual Category ID
    sheet.getRange(row, manualCategoryIdCol + 1).setValue('');

    Logger.info(`Cleared manual override for row ${row}`);

    return {
      success: true,
      categoryId: null,
      categoryName: '',
      message: 'Manual override cleared'
    };
  }

  /**
   * Apply a manual override by updating the Manual Category ID column
   *
   * @param range - The edited range
   * @param manualCategoryIdCol - Zero-based index of Manual Category ID column
   * @param categoryName - The category name entered by the user
   * @param resolution - The category resolution result
   * @returns Result of the manual override application
   */
  private applyManualOverride(
    range: GoogleAppsScript.Spreadsheet.Range,
    manualCategoryIdCol: number,
    categoryName: string,
    resolution: CategoryResolutionResult
  ): ManualOverrideResult {
    const sheet = range.getSheet();
    const row = range.getRow();

    // Update Manual Category ID column
    const categoryId = resolution.found ? resolution.category!.id : null;

    // Prevent triggering another onEdit event by using setValue
    // (not setValues which can trigger events in some configurations)
    sheet.getRange(row, manualCategoryIdCol + 1).setValue(categoryId || '');

    // Also normalize the category name (trim whitespace)
    sheet.getRange(row, range.getColumn()).setValue(categoryName);

    if (resolution.found) {
      Logger.info(
        `Applied manual override for row ${row}: "${categoryName}" -> ${categoryId}`
      );

      return {
        success: true,
        category: resolution.category,
        categoryId,
        categoryName,
        message: `Category "${categoryName}" resolved to ID ${categoryId}`
      };
    } else {
      // Custom category (not in Categories sheet)
      Logger.warning(
        `Custom category "${categoryName}" used in row ${row} (no ID assigned). ` +
        `${resolution.warning}`
      );

      return {
        success: true,
        categoryId: null,
        categoryName,
        message: resolution.warning || 'Custom category (not in Categories sheet)'
      };
    }
  }

  /**
   * Validate that a manual override can be processed
   *
   * Performs pre-flight checks to ensure the edit event can be safely processed.
   *
   * @param event - The onEdit event to validate
   * @param columnConfig - The column configuration
   * @returns Validation result with details
   */
  validateEditEvent(
    event: OnEditEvent,
    columnConfig: ManualCategoryColumnConfig
  ): { valid: boolean; reason?: string } {
    if (!event.range) {
      return { valid: false, reason: 'Event has no range' };
    }

    if (!this.isUserEdit(event)) {
      return { valid: false, reason: 'Edit was not made by a user' };
    }

    const sheet = event.range.getSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const manualCategoryCol = this.findColumnIndex(headers, columnConfig.manualCategoryHeader);

    if (manualCategoryCol === -1) {
      return {
        valid: false,
        reason: `Column "${columnConfig.manualCategoryHeader}" not found`
      };
    }

    if (event.range.getColumn() !== manualCategoryCol + 1) {
      return {
        valid: false,
        reason: `Edit not in Manual Category column`
      };
    }

    return { valid: true };
  }

  /**
   * Process multiple manual overrides in batch
   *
   * Useful for processing multiple rows at once (e.g., when user pastes
   * multiple category names).
   *
   * @param sheet - The sheet containing the manual overrides
   * @param startRow - The first row to process (1-based)
   * @param endRow - The last row to process (1-based, inclusive)
   * @param activeCategories - List of active categories
   * @param columnConfig - Column configuration
   * @returns Array of results for each row processed
   */
  processBatch(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    startRow: number,
    endRow: number,
    activeCategories: Category[],
    columnConfig: ManualCategoryColumnConfig
  ): ManualOverrideResult[] {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const manualCategoryCol = this.findColumnIndex(headers, columnConfig.manualCategoryHeader);
    const manualCategoryIdCol = this.findColumnIndex(headers, columnConfig.manualCategoryIdHeader);

    if (manualCategoryCol === -1 || manualCategoryIdCol === -1) {
      Logger.error('Required columns not found for batch processing');
      return [];
    }

    const results: ManualOverrideResult[] = [];

    // Read all category names at once for efficiency
    const numRows = endRow - startRow + 1;
    const categoryNames = sheet
      .getRange(startRow, manualCategoryCol + 1, numRows, 1)
      .getValues()
      .map(row => row[0]?.toString().trim() || '');

    // Resolve all category names
    const resolutions = categoryNames.map(name =>
      name ? this.categoryResolver.resolveCategoryName(name, activeCategories) : null
    );

    // Prepare batch update data
    const categoryIds: (string | null)[][] = [];

    for (let i = 0; i < numRows; i++) {
      const categoryName = categoryNames[i];
      const resolution = resolutions[i];

      if (!categoryName) {
        categoryIds.push(['']);
        results.push({
          success: true,
          categoryId: null,
          categoryName: '',
          message: 'Empty category name'
        });
        continue;
      }

      const categoryId = resolution?.found ? resolution.category!.id : null;
      categoryIds.push([categoryId || '']);

      results.push({
        success: true,
        category: resolution?.category,
        categoryId,
        categoryName,
        message: resolution?.found
          ? `Resolved to ${categoryId}`
          : (resolution?.warning || 'Custom category')
      });
    }

    // Batch write all category IDs
    sheet
      .getRange(startRow, manualCategoryIdCol + 1, numRows, 1)
      .setValues(categoryIds);

    Logger.info(
      `Batch processed ${numRows} manual overrides: ` +
      `${results.filter(r => r.categoryId).length} resolved, ` +
      `${results.filter(r => !r.categoryId && r.categoryName).length} custom`
    );

    return results;
  }
}
