/**
 * Tests for CategoryResolver
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CategoryResolver } from '../CategoryResolver';
import { Category, CategoryFactory } from '../../../models/Category';
import { Logger } from '../../../utils/Logger';

describe('CategoryResolver', () => {
  let resolver: CategoryResolver;
  let activeCategories: Category[];

  beforeEach(() => {
    // Spy on Logger static methods
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warning').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});

    resolver = new CategoryResolver();

    // Create test categories
    activeCategories = [
      CategoryFactory.create(
        'Groceries',
        'Food and household items',
        'Tesco, Sainsburys, Waitrose'
      ),
      CategoryFactory.create(
        'Transport',
        'Travel and commuting',
        'TfL, Uber, Train tickets'
      ),
      CategoryFactory.create(
        'Entertainment',
        'Leisure activities',
        'Cinema, Theatre, Concerts'
      ),
      CategoryFactory.create(
        'Dining Out',
        'Restaurants and cafes',
        'Nandos, Pret, Starbucks'
      )
    ];

    // Add one inactive category
    const inactiveCategory = CategoryFactory.create(
      'Old Category',
      'Deprecated category',
      'Legacy'
    );
    activeCategories.push(
      CategoryFactory.update(inactiveCategory, { isActive: false })
    );
  });

  describe('resolveCategoryName', () => {
    it('should resolve exact match case-insensitively', () => {
      const result = resolver.resolveCategoryName('groceries', activeCategories);

      expect(result.found).toBe(true);
      expect(result.category).toBeDefined();
      expect(result.category!.name).toBe('Groceries');
      expect(result.warning).toBeUndefined();
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Resolved category "groceries"')
      );
    });

    it('should resolve exact match with different case', () => {
      const result = resolver.resolveCategoryName('TRANSPORT', activeCategories);

      expect(result.found).toBe(true);
      expect(result.category!.name).toBe('Transport');
    });

    it('should resolve exact match with extra whitespace', () => {
      const result = resolver.resolveCategoryName('  Entertainment  ', activeCategories);

      expect(result.found).toBe(true);
      expect(result.category!.name).toBe('Entertainment');
    });

    it('should not match inactive categories', () => {
      const result = resolver.resolveCategoryName('Old Category', activeCategories);

      expect(result.found).toBe(false);
      expect(result.category).toBeUndefined();
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('not found in Categories sheet');
    });

    it('should return warning for non-matching category', () => {
      const result = resolver.resolveCategoryName('Unknown Category', activeCategories);

      expect(result.found).toBe(false);
      expect(result.category).toBeUndefined();
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('Custom category name');
      expect(result.warning).toContain('not found in Categories sheet');
      expect(Logger.warning).toHaveBeenCalledWith(
        expect.stringContaining('Custom category name')
      );
    });

    it('should handle empty category name', () => {
      const result = resolver.resolveCategoryName('', activeCategories);

      expect(result.found).toBe(false);
      expect(result.warning).toBe('Category name is empty');
    });

    it('should handle whitespace-only category name', () => {
      const result = resolver.resolveCategoryName('   ', activeCategories);

      expect(result.found).toBe(false);
      expect(result.warning).toBe('Category name is empty');
    });

    it('should handle multi-word category names', () => {
      const result = resolver.resolveCategoryName('dining out', activeCategories);

      expect(result.found).toBe(true);
      expect(result.category!.name).toBe('Dining Out');
    });

    it('should be case-insensitive for multi-word names', () => {
      const result = resolver.resolveCategoryName('DINING OUT', activeCategories);

      expect(result.found).toBe(true);
      expect(result.category!.name).toBe('Dining Out');
    });
  });

  describe('resolveCategoryNames', () => {
    it('should resolve multiple category names in batch', () => {
      const names = ['Groceries', 'Transport', 'Unknown'];
      const results = resolver.resolveCategoryNames(names, activeCategories);

      expect(results.size).toBe(3);
      expect(results.get('Groceries')!.found).toBe(true);
      expect(results.get('Transport')!.found).toBe(true);
      expect(results.get('Unknown')!.found).toBe(false);
    });

    it('should handle empty array', () => {
      const results = resolver.resolveCategoryNames([], activeCategories);

      expect(results.size).toBe(0);
    });

    it('should log batch summary', () => {
      const names = ['Groceries', 'Transport', 'Unknown', 'Custom'];
      resolver.resolveCategoryNames(names, activeCategories);

      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Batch resolved 4 category names')
      );
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('2 found')
      );
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('2 custom')
      );
    });

    it('should handle duplicate names in input', () => {
      const names = ['Groceries', 'Groceries', 'Transport'];
      const results = resolver.resolveCategoryNames(names, activeCategories);

      // Map deduplicates keys, so we expect 2 unique entries
      expect(results.size).toBe(2);
      expect(results.get('Groceries')!.found).toBe(true);
      expect(results.get('Transport')!.found).toBe(true);
    });
  });

  describe('getSuggestions', () => {
    it('should suggest categories that start with input', () => {
      const suggestions = resolver.getSuggestions('Groc', activeCategories);

      expect(suggestions).toContain('Groceries');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest categories that contain input', () => {
      const suggestions = resolver.getSuggestions('port', activeCategories);

      expect(suggestions).toContain('Transport');
    });

    it('should limit suggestions to maxSuggestions', () => {
      const suggestions = resolver.getSuggestions('e', activeCategories, 2);

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should prioritize starts-with over contains', () => {
      const suggestions = resolver.getSuggestions('Ent', activeCategories);

      // "Entertainment" starts with "Ent", should be first
      expect(suggestions[0]).toBe('Entertainment');
    });

    it('should handle no matches', () => {
      const suggestions = resolver.getSuggestions('XYZ', activeCategories);

      expect(suggestions).toEqual([]);
    });

    it('should handle empty input', () => {
      const suggestions = resolver.getSuggestions('', activeCategories);

      expect(suggestions).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const suggestions = resolver.getSuggestions('GROC', activeCategories);

      expect(suggestions).toContain('Groceries');
    });

    it('should not suggest inactive categories', () => {
      const suggestions = resolver.getSuggestions('Old', activeCategories);

      expect(suggestions).not.toContain('Old Category');
    });

    it('should handle partial word matches', () => {
      const suggestions = resolver.getSuggestions('Din', activeCategories);

      expect(suggestions).toContain('Dining Out');
    });
  });

  describe('validateCategoryName', () => {
    it('should validate existing category name', () => {
      const result = resolver.validateCategoryName('Groceries', activeCategories);

      expect(result.valid).toBe(true);
      expect(result.message).toContain('Valid category');
      expect(result.message).toContain('Groceries');
    });

    it('should invalidate empty category name', () => {
      const result = resolver.validateCategoryName('', activeCategories);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Category name cannot be empty');
    });

    it('should invalidate unknown category with suggestions', () => {
      const result = resolver.validateCategoryName('Groc', activeCategories);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('not found in active categories');
      expect(result.message).toContain('Did you mean');
      expect(result.message).toContain('Groceries');
    });

    it('should invalidate unknown category without suggestions', () => {
      const result = resolver.validateCategoryName('XYZ', activeCategories);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('not found in active categories');
      expect(result.message).not.toContain('Did you mean');
      expect(result.message).toContain('custom name');
    });

    it('should be case-insensitive for validation', () => {
      const result = resolver.validateCategoryName('GROCERIES', activeCategories);

      expect(result.valid).toBe(true);
    });

    it('should handle whitespace in validation', () => {
      const result = resolver.validateCategoryName('  Groceries  ', activeCategories);

      expect(result.valid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty active categories list', () => {
      const result = resolver.resolveCategoryName('Groceries', []);

      expect(result.found).toBe(false);
      expect(result.warning).toBeDefined();
    });

    it('should handle categories with special characters', () => {
      const specialCategory = CategoryFactory.create(
        'Bills & Utilities',
        'Household bills',
        'Electric, Gas, Water'
      );
      const categoriesWithSpecial = [...activeCategories, specialCategory];

      const result = resolver.resolveCategoryName('Bills & Utilities', categoriesWithSpecial);

      expect(result.found).toBe(true);
      expect(result.category!.name).toBe('Bills & Utilities');
    });

    it('should handle very long category names', () => {
      const longName = 'A'.repeat(100);
      const result = resolver.resolveCategoryName(longName, activeCategories);

      expect(result.found).toBe(false);
      expect(result.warning).toBeDefined();
    });

    it('should handle unicode characters in category names', () => {
      const unicodeCategory = CategoryFactory.create(
        'Café & Dining',
        'Coffee and dining',
        'Starbucks, Pret'
      );
      const categoriesWithUnicode = [...activeCategories, unicodeCategory];

      const result = resolver.resolveCategoryName('café & dining', categoriesWithUnicode);

      expect(result.found).toBe(true);
      expect(result.category!.name).toBe('Café & Dining');
    });
  });

  describe('performance', () => {
    it('should handle large category lists efficiently', () => {
      // Create 1000 categories
      const largeList: Category[] = [];
      for (let i = 0; i < 1000; i++) {
        largeList.push(
          CategoryFactory.create(
            `Category ${i}`,
            `Description ${i}`,
            `Example ${i}`
          )
        );
      }

      const startTime = Date.now();
      resolver.resolveCategoryName('Category 999', largeList);
      const endTime = Date.now();

      // Should complete in under 100ms even with 1000 categories
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle batch resolution efficiently', () => {
      // Create 100 names to resolve
      const names: string[] = [];
      for (let i = 0; i < 100; i++) {
        names.push(`Category ${i % 10}`); // Mix of found/not found
      }

      const startTime = Date.now();
      resolver.resolveCategoryNames(names, activeCategories);
      const endTime = Date.now();

      // Batch resolution should be efficient
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
