/**
 * Category Entity Model
 *
 * Represents a transaction category used for classification.
 * Categories use stable UUIDs to support reordering and soft deletion.
 *
 * @module models/Category
 */

/**
 * Category entity
 *
 * Represents a transaction category with stable UUID-based identity
 * independent of row position in the Categories sheet.
 */
export interface Category {
  /**
   * Unique identifier (UUID)
   * Stable regardless of row position in Categories sheet
   */
  id: string;

  /**
   * Unique category name
   * Examples: "Groceries", "Transport", "Entertainment"
   */
  name: string;

  /**
   * Detailed description of what transactions belong in this category
   */
  description: string;

  /**
   * Example merchants/descriptions for this category
   * Helps AI and users understand category scope
   */
  examples: string;

  /**
   * Whether category is currently available for assignment
   * Inactive categories remain for historical reference but cannot be assigned to new transactions
   */
  isActive: boolean;

  /**
   * When category was created
   */
  createdAt: Date;

  /**
   * Last modification timestamp
   */
  modifiedAt: Date;
}

/**
 * Validation error thrown when category data is invalid
 */
export class CategoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryValidationError';
  }
}

/**
 * Category validation and utility methods
 */
export class CategoryValidator {
  /**
   * Validate a category object
   *
   * @param category - Category to validate
   * @throws CategoryValidationError if validation fails
   */
  static validate(category: Category): void {
    // Required fields
    if (!category.id) {
      throw new CategoryValidationError('Category ID is required');
    }

    if (!this.isValidUUID(category.id)) {
      throw new CategoryValidationError('Category ID must be a valid UUID');
    }

    if (!category.name || category.name.trim().length === 0) {
      throw new CategoryValidationError('Category name is required');
    }

    if (!category.description || category.description.trim().length === 0) {
      throw new CategoryValidationError('Category description is required');
    }

    if (!category.examples || category.examples.trim().length === 0) {
      throw new CategoryValidationError('Category examples are required');
    }

    // Boolean validation
    if (typeof category.isActive !== 'boolean') {
      throw new CategoryValidationError('isActive must be a boolean');
    }

    // Date validation
    if (!(category.createdAt instanceof Date) || isNaN(category.createdAt.getTime())) {
      throw new CategoryValidationError('Created timestamp must be a valid date');
    }

    if (!(category.modifiedAt instanceof Date) || isNaN(category.modifiedAt.getTime())) {
      throw new CategoryValidationError('Modified timestamp must be a valid date');
    }

    // Modified must be >= created
    if (category.modifiedAt < category.createdAt) {
      throw new CategoryValidationError('Modified timestamp cannot be before created timestamp');
    }
  }

  /**
   * Validate category name uniqueness among active categories
   *
   * @param name - Category name to check
   * @param existingCategories - List of existing active categories
   * @param excludeId - Category ID to exclude from check (for updates)
   * @throws CategoryValidationError if name is not unique
   */
  static validateUniqueName(
    name: string,
    existingCategories: Category[],
    excludeId?: string
  ): void {
    const normalizedName = name.trim().toLowerCase();

    const duplicate = existingCategories.find(cat => {
      if (excludeId && cat.id === excludeId) {
        return false; // Exclude current category when updating
      }
      return cat.isActive && cat.name.toLowerCase() === normalizedName;
    });

    if (duplicate) {
      throw new CategoryValidationError(
        `Category name "${name}" already exists (ID: ${duplicate.id})`
      );
    }
  }

  /**
   * Check if a category can be safely deleted
   *
   * Categories with transaction references should use soft delete (isActive=false)
   * instead of hard deletion.
   *
   * @param category - Category to check
   * @param hasTransactionReferences - Whether transactions reference this category
   * @returns True if hard delete is safe
   */
  static canHardDelete(_category: Category, hasTransactionReferences: boolean): boolean {
    return !hasTransactionReferences;
  }

  /**
   * Validate UUID format (RFC 4122)
   *
   * @param uuid - String to validate
   * @returns True if valid UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Generate a new UUID v4
   *
   * Uses Google Apps Script's Utilities.getUuid() when available,
   * falls back to crypto.randomUUID() for testing environments.
   *
   * @returns New UUID string
   */
  static generateUUID(): string {
    // Google Apps Script environment
    if (typeof Utilities !== 'undefined' && Utilities.getUuid) {
      return Utilities.getUuid();
    }

    // Testing/Node.js environment
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback implementation (RFC 4122 v4)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

/**
 * Category factory methods
 */
export class CategoryFactory {
  /**
   * Create a new category with generated UUID and timestamps
   *
   * @param name - Category name
   * @param description - Category description
   * @param examples - Category examples
   * @param isActive - Whether category is active (default: true)
   * @returns New category object
   */
  static create(
    name: string,
    description: string,
    examples: string,
    isActive: boolean = true
  ): Category {
    const now = new Date();

    const category: Category = {
      id: CategoryValidator.generateUUID(),
      name: name.trim(),
      description: description.trim(),
      examples: examples.trim(),
      isActive,
      createdAt: now,
      modifiedAt: now
    };

    CategoryValidator.validate(category);
    return category;
  }

  /**
   * Update an existing category
   *
   * @param existing - Existing category
   * @param updates - Partial updates to apply
   * @returns Updated category
   */
  static update(
    existing: Category,
    updates: Partial<Pick<Category, 'name' | 'description' | 'examples' | 'isActive'>>
  ): Category {
    const updated: Category = {
      ...existing,
      ...updates,
      modifiedAt: new Date()
    };

    // Trim string fields if updated
    if (updates.name !== undefined) {
      updated.name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      updated.description = updates.description.trim();
    }
    if (updates.examples !== undefined) {
      updated.examples = updates.examples.trim();
    }

    CategoryValidator.validate(updated);
    return updated;
  }

  /**
   * Soft delete a category (mark as inactive)
   *
   * @param category - Category to soft delete
   * @returns Updated category with isActive=false
   */
  static softDelete(category: Category): Category {
    return this.update(category, { isActive: false });
  }

  /**
   * Reactivate a soft-deleted category
   *
   * @param category - Category to reactivate
   * @returns Updated category with isActive=true
   */
  static reactivate(category: Category): Category {
    return this.update(category, { isActive: true });
  }
}
