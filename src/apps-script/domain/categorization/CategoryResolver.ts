/**
 * Category Resolver
 *
 * Handles resolution of category names to Category entities.
 * Used by the manual override onEdit trigger to resolve user-typed category names
 * to category UUIDs for referential integrity.
 *
 * @module domain/categorization/CategoryResolver
 */

import { Category } from '../../models/Category';
import { Logger } from '../../utils/Logger';

/**
 * Result of a category name resolution attempt
 */
export interface CategoryResolutionResult {
  /**
   * Whether a matching category was found
   */
  found: boolean;

  /**
   * The resolved category entity (if found)
   */
  category?: Category;

  /**
   * Warning message if category not found or using custom name
   */
  warning?: string;
}

/**
 * Category name resolver
 *
 * Resolves category names to Category entities by searching the active
 * category list. Supports case-insensitive exact matching.
 */
export class CategoryResolver {
  private readonly logger: Logger;

  constructor(logger: Logger = new Logger()) {
    this.logger = logger;
  }

  /**
   * Resolve a category name to a Category entity
   *
   * Searches for exact match (case-insensitive) among active categories.
   * If no match found, logs warning but allows custom category name.
   *
   * @param categoryName - The category name to resolve (e.g., "Groceries")
   * @param activeCategories - List of active categories to search
   * @returns Resolution result with category if found
   *
   * @example
   * ```typescript
   * const result = resolver.resolveCategoryName("Groceries", categories);
   * if (result.found) {
   *   console.log(`Resolved to category ID: ${result.category.id}`);
   * } else {
   *   console.warn(result.warning);
   * }
   * ```
   */
  resolveCategoryName(
    categoryName: string,
    activeCategories: Category[]
  ): CategoryResolutionResult {
    // Handle empty/invalid input
    if (!categoryName || categoryName.trim().length === 0) {
      return {
        found: false,
        warning: 'Category name is empty'
      };
    }

    const normalizedInput = categoryName.trim().toLowerCase();

    // Search for exact match (case-insensitive) among active categories
    const matchedCategory = activeCategories.find(cat => {
      return cat.isActive && cat.name.toLowerCase() === normalizedInput;
    });

    if (matchedCategory) {
      this.logger.info(
        `Resolved category "${categoryName}" to ID ${matchedCategory.id}`
      );
      return {
        found: true,
        category: matchedCategory
      };
    }

    // No match found - log warning but allow custom category
    const warning = `Custom category name "${categoryName}" not found in Categories sheet. ` +
      `This category will be stored but won't have referential integrity. ` +
      `Consider adding it to the Categories sheet for consistent tracking.`;

    this.logger.warn(warning);

    return {
      found: false,
      warning
    };
  }

  /**
   * Resolve multiple category names in batch
   *
   * Efficiently resolves multiple category names by loading categories once.
   * Useful for processing multiple manual overrides.
   *
   * @param categoryNames - Array of category names to resolve
   * @param activeCategories - List of active categories to search
   * @returns Map of category name to resolution result
   *
   * @example
   * ```typescript
   * const names = ["Groceries", "Transport", "CustomCategory"];
   * const results = resolver.resolveCategoryNames(names, categories);
   * results.forEach((result, name) => {
   *   console.log(`${name}: ${result.found ? 'found' : 'not found'}`);
   * });
   * ```
   */
  resolveCategoryNames(
    categoryNames: string[],
    activeCategories: Category[]
  ): Map<string, CategoryResolutionResult> {
    const results = new Map<string, CategoryResolutionResult>();

    for (const categoryName of categoryNames) {
      const result = this.resolveCategoryName(categoryName, activeCategories);
      results.set(categoryName, result);
    }

    this.logger.info(
      `Batch resolved ${categoryNames.length} category names: ` +
      `${Array.from(results.values()).filter(r => r.found).length} found, ` +
      `${Array.from(results.values()).filter(r => !r.found).length} custom`
    );

    return results;
  }

  /**
   * Get similar category suggestions for a non-matching name
   *
   * Provides fuzzy matching suggestions when exact match fails.
   * Uses simple string similarity (starts with, contains) to suggest alternatives.
   *
   * @param categoryName - The category name that didn't match
   * @param activeCategories - List of active categories to search
   * @param maxSuggestions - Maximum number of suggestions to return (default: 3)
   * @returns Array of suggested category names
   *
   * @example
   * ```typescript
   * const suggestions = resolver.getSuggestions("Groc", categories);
   * // Returns: ["Groceries"]
   * ```
   */
  getSuggestions(
    categoryName: string,
    activeCategories: Category[],
    maxSuggestions: number = 3
  ): string[] {
    if (!categoryName || categoryName.trim().length === 0) {
      return [];
    }

    const normalizedInput = categoryName.trim().toLowerCase();
    const suggestions: Array<{ name: string; score: number }> = [];

    for (const category of activeCategories) {
      if (!category.isActive) {
        continue;
      }

      const categoryNameLower = category.name.toLowerCase();
      let score = 0;

      // Exact match (already handled by resolveCategoryName, but include for completeness)
      if (categoryNameLower === normalizedInput) {
        score = 100;
      }
      // Starts with input
      else if (categoryNameLower.startsWith(normalizedInput)) {
        score = 80;
      }
      // Contains input
      else if (categoryNameLower.includes(normalizedInput)) {
        score = 60;
      }
      // Input contains category name (partial word match)
      else if (normalizedInput.includes(categoryNameLower)) {
        score = 40;
      }

      if (score > 0) {
        suggestions.push({ name: category.name, score });
      }
    }

    // Sort by score (descending) and take top N
    suggestions.sort((a, b) => b.score - a.score);

    return suggestions.slice(0, maxSuggestions).map(s => s.name);
  }

  /**
   * Validate that a category name can be safely resolved
   *
   * Checks if category name exists in active categories and provides
   * actionable feedback for invalid names.
   *
   * @param categoryName - Category name to validate
   * @param activeCategories - List of active categories
   * @returns Validation result with helpful message
   */
  validateCategoryName(
    categoryName: string,
    activeCategories: Category[]
  ): { valid: boolean; message: string } {
    if (!categoryName || categoryName.trim().length === 0) {
      return {
        valid: false,
        message: 'Category name cannot be empty'
      };
    }

    const result = this.resolveCategoryName(categoryName, activeCategories);

    if (result.found) {
      return {
        valid: true,
        message: `Valid category: ${result.category!.name}`
      };
    }

    // Provide suggestions for non-matching names
    const suggestions = this.getSuggestions(categoryName, activeCategories);
    const suggestionText = suggestions.length > 0
      ? ` Did you mean: ${suggestions.join(', ')}?`
      : '';

    return {
      valid: false,
      message: `Category "${categoryName}" not found in active categories.${suggestionText} ` +
        `You can use this custom name, but it won't have referential integrity.`
    };
  }
}
