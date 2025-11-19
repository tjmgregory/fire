/**
 * Unit tests for ManualOverrideHandler
 *
 * Tests manual category override handling, including:
 * - User vs script edit detection
 * - Category name resolution
 * - Manual Category ID updates
 * - Custom category handling
 * - Batch processing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ManualOverrideHandler,
  OnEditEvent,
  ManualCategoryColumnConfig
} from '../../../../src/apps-script/domain/categorization/ManualOverrideHandler';
import { CategoryResolver } from '../../../../src/apps-script/domain/categorization/CategoryResolver';
import { Category } from '../../../../src/apps-script/models/Category';

describe('ManualOverrideHandler', () => {
  let handler: ManualOverrideHandler;
  let categoryResolver: CategoryResolver;
  let mockSheet: any;
  let activeCategories: Category[];
  let columnConfig: ManualCategoryColumnConfig;

  beforeEach(() => {
    categoryResolver = new CategoryResolver();
    handler = new ManualOverrideHandler(categoryResolver);

    // Mock Google Sheets API
    mockSheet = {
      getRange: vi.fn().mockReturnThis(),
      getValues: vi.fn(),
      setValue: vi.fn(),
      setValues: vi.fn(),
      getLastColumn: vi.fn(() => 15),
      getSheet: vi.fn()
    };

    mockSheet.getSheet.mockReturnValue(mockSheet);

    // Sample active categories
    activeCategories = [
      {
        id: 'cat-001',
        name: 'Groceries',
        description: 'Food and household essentials',
        examples: 'Tesco, Sainsbury\'s',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        modifiedAt: new Date('2024-01-01')
      },
      {
        id: 'cat-002',
        name: 'Transport',
        description: 'Travel and commuting',
        examples: 'TfL, Uber',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        modifiedAt: new Date('2024-01-01')
      },
      {
        id: 'cat-003',
        name: 'Dining Out',
        description: 'Restaurants and takeaways',
        examples: 'Nando\'s, Deliveroo',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        modifiedAt: new Date('2024-01-01')
      },
      {
        id: 'cat-004',
        name: 'Inactive Category',
        description: 'This is inactive',
        examples: 'N/A',
        isActive: false,
        createdAt: new Date('2024-01-01'),
        modifiedAt: new Date('2024-01-01')
      }
    ];

    // Column configuration
    columnConfig = {
      manualCategoryHeader: 'Manual Category',
      manualCategoryIdHeader: 'Manual Category ID'
    };
  });

  describe('User vs Script Edit Detection', () => {
    it('should identify user edits correctly', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        source: undefined, // Simple trigger - user edit
        value: 'Groceries'
      };

      // Mock header row
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Amount', 'AI Category', 'Manual Category', 'Manual Category ID'
      ]]);

      mockSheet.getColumn = vi.fn(() => 5); // Manual Category column
      mockSheet.getRow = vi.fn(() => 2);

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      // Should process the edit
      expect(result).not.toBeNull();
    });

    it('should ignore script edits to prevent infinite loops', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        source: 'SCRIPT',
        value: 'Groceries'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      // Should NOT process the edit
      expect(result).toBeNull();
    });

    it('should ignore edits with no range', () => {
      const event: OnEditEvent = {
        range: null as any,
        value: 'Groceries'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result).toBeNull();
    });
  });

  describe('Column Detection', () => {
    it('should only process edits in Manual Category column', () => {
      // Mock header row
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Amount', 'AI Category', 'Manual Category', 'Manual Category ID'
      ]]);

      mockSheet.getColumn = vi.fn(() => 3); // Amount column (not Manual Category)
      mockSheet.getRow = vi.fn(() => 2);

      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Groceries'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      // Should ignore edits to other columns
      expect(result).toBeNull();
    });

    it('should process edits in Manual Category column', () => {
      // Mock header row
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Amount', 'AI Category', 'Manual Category', 'Manual Category ID'
      ]]);

      mockSheet.getColumn = vi.fn(() => 5); // Manual Category column (index 4, col 5)
      mockSheet.getRow = vi.fn(() => 2);

      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Groceries'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      // Should process the edit
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    it('should handle missing columns gracefully', () => {
      // Mock header row without required columns
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Amount'
      ]]);

      mockSheet.getColumn = vi.fn(() => 2);
      mockSheet.getRow = vi.fn(() => 2);

      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Groceries'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      // Should return null when columns not found
      expect(result).toBeNull();
    });
  });

  describe('Category Name Resolution', () => {
    beforeEach(() => {
      // Mock header row
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Amount', 'AI Category', 'Manual Category', 'Manual Category ID'
      ]]);

      mockSheet.getColumn = vi.fn(() => 5); // Manual Category column
      mockSheet.getRow = vi.fn(() => 2);
    });

    it('should resolve exact category name to ID', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Groceries'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.category?.id).toBe('cat-001');
      expect(result?.categoryId).toBe('cat-001');
      expect(result?.categoryName).toBe('Groceries');
      expect(mockSheet.setValue).toHaveBeenCalledWith('cat-001');
    });

    it('should resolve category names case-insensitively', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'TRANSPORT'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result?.success).toBe(true);
      expect(result?.category?.id).toBe('cat-002');
      expect(result?.categoryId).toBe('cat-002');
      expect(mockSheet.setValue).toHaveBeenCalledWith('cat-002');
    });

    it('should trim whitespace from category names', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: '  Dining Out  '
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result?.success).toBe(true);
      expect(result?.category?.id).toBe('cat-003');
      expect(result?.categoryName).toBe('Dining Out');
      expect(mockSheet.setValue).toHaveBeenCalledWith('cat-003');
    });

    it('should ignore inactive categories', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Inactive Category'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result?.success).toBe(true);
      expect(result?.categoryId).toBeNull(); // Should NOT resolve to inactive category
      expect(result?.message).toContain('not found');
    });

    it('should handle custom category names gracefully', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'My Custom Category'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result?.success).toBe(true);
      expect(result?.categoryId).toBeNull();
      expect(result?.categoryName).toBe('My Custom Category');
      expect(result?.message).toContain('Custom category');
      expect(mockSheet.setValue).toHaveBeenCalledWith(''); // Empty ID for custom category
    });

    it('should handle empty category name (clearing override)', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: ''
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result?.success).toBe(true);
      expect(result?.categoryId).toBeNull();
      expect(result?.categoryName).toBe('');
      expect(result?.message).toContain('cleared');
      expect(mockSheet.setValue).toHaveBeenCalledWith('');
    });
  });

  describe('Sheet Updates', () => {
    beforeEach(() => {
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Amount', 'AI Category', 'Manual Category', 'Manual Category ID'
      ]]);

      mockSheet.getColumn = vi.fn(() => 5); // Manual Category column (index 4)
      mockSheet.getRow = vi.fn(() => 3); // Row 3
    });

    it('should update Manual Category ID column atomically', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Transport'
      };

      handler.handleEdit(event, activeCategories, columnConfig);

      // Should call setValue on the Manual Category ID column (index 5, column 6)
      expect(mockSheet.getRange).toHaveBeenCalledWith(3, 6);
      expect(mockSheet.setValue).toHaveBeenCalledWith('cat-002');
    });

    it('should normalize the category name in place', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: '  GROCERIES  ' // Extra whitespace and wrong case
      };

      handler.handleEdit(event, activeCategories, columnConfig);

      // Should normalize the name back to the cell (trimmed)
      expect(mockSheet.getRange).toHaveBeenCalledWith(3, 5);
      // The handler trims whitespace when saving
      expect(mockSheet.setValue).toHaveBeenCalledWith('GROCERIES');
    });

    it('should clear Manual Category ID when category cleared', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: ''
      };

      handler.handleEdit(event, activeCategories, columnConfig);

      expect(mockSheet.getRange).toHaveBeenCalledWith(3, 6); // Manual Category ID column
      expect(mockSheet.setValue).toHaveBeenCalledWith('');
    });
  });

  describe('Validation', () => {
    it('should validate valid edit events', () => {
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Manual Category', 'Manual Category ID'
      ]]);

      mockSheet.getColumn = vi.fn(() => 3); // Manual Category column

      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Groceries'
      };

      const validation = handler.validateEditEvent(event, columnConfig);

      expect(validation.valid).toBe(true);
      expect(validation.reason).toBeUndefined();
    });

    it('should reject events with no range', () => {
      const event: OnEditEvent = {
        range: null as any,
        value: 'Groceries'
      };

      const validation = handler.validateEditEvent(event, columnConfig);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('no range');
    });

    it('should reject script edits', () => {
      mockSheet.getColumn = vi.fn(() => 3);

      const event: OnEditEvent = {
        range: mockSheet as any,
        source: 'SCRIPT',
        value: 'Groceries'
      };

      const validation = handler.validateEditEvent(event, columnConfig);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('not made by a user');
    });

    it('should reject edits in wrong column', () => {
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Manual Category', 'Manual Category ID'
      ]]);

      mockSheet.getColumn = vi.fn(() => 2); // Wrong column

      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Groceries'
      };

      const validation = handler.validateEditEvent(event, columnConfig);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('not in Manual Category column');
    });

    it('should reject when required column not found', () => {
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Amount' // Missing Manual Category
      ]]);

      mockSheet.getColumn = vi.fn(() => 2);

      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Groceries'
      };

      const validation = handler.validateEditEvent(event, columnConfig);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('not found');
    });
  });

  describe('Batch Processing', () => {
    beforeEach(() => {
      mockSheet.getValues
        .mockReturnValueOnce([[ // Header row
          'ID', 'Description', 'Manual Category', 'Manual Category ID'
        ]])
        .mockReturnValueOnce([ // Data rows
          ['Groceries'],
          ['Transport'],
          ['Custom Category'],
          ['']
        ]);
    });

    it('should process multiple rows efficiently', () => {
      const results = handler.processBatch(
        mockSheet,
        2, // Start row
        5, // End row (4 rows total)
        activeCategories,
        columnConfig
      );

      expect(results).toHaveLength(4);

      // Row 2: Groceries (found)
      expect(results[0].success).toBe(true);
      expect(results[0].categoryId).toBe('cat-001');
      expect(results[0].categoryName).toBe('Groceries');

      // Row 3: Transport (found)
      expect(results[1].success).toBe(true);
      expect(results[1].categoryId).toBe('cat-002');
      expect(results[1].categoryName).toBe('Transport');

      // Row 4: Custom Category (not found)
      expect(results[2].success).toBe(true);
      expect(results[2].categoryId).toBeNull();
      expect(results[2].categoryName).toBe('Custom Category');

      // Row 5: Empty (cleared)
      expect(results[3].success).toBe(true);
      expect(results[3].categoryId).toBeNull();
      expect(results[3].categoryName).toBe('');
    });

    it('should batch write all category IDs at once', () => {
      handler.processBatch(mockSheet, 2, 5, activeCategories, columnConfig);

      // Should call setValues once with all IDs
      expect(mockSheet.setValues).toHaveBeenCalledWith([
        ['cat-001'],   // Groceries
        ['cat-002'],   // Transport
        [''],          // Custom Category
        ['']           // Empty
      ]);
    });

    it('should return empty array when columns not found', () => {
      // Reset the mock to clear previous data
      mockSheet.getValues.mockReset();
      mockSheet.getValues.mockReturnValueOnce([[
        'ID', 'Description' // Missing required columns
      ]]);

      const results = handler.processBatch(
        mockSheet,
        2,
        5,
        activeCategories,
        columnConfig
      );

      expect(results).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Manual Category', 'Manual Category ID'
      ]]);

      mockSheet.getColumn = vi.fn(() => 3);
      mockSheet.getRow = vi.fn(() => 2);
    });

    it('should handle category names with special characters', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Food & Drink'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result?.success).toBe(true);
      expect(result?.categoryName).toBe('Food & Drink');
    });

    it('should handle very long category names', () => {
      const longName = 'A'.repeat(500);

      const event: OnEditEvent = {
        range: mockSheet as any,
        value: longName
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result?.success).toBe(true);
      expect(result?.categoryName).toBe(longName);
    });

    it('should handle numeric category names', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: '12345'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result?.success).toBe(true);
      expect(result?.categoryName).toBe('12345');
    });

    it('should handle category names with only whitespace', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: '   '
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      // Should treat as empty
      expect(result?.success).toBe(true);
      expect(result?.categoryId).toBeNull();
      expect(result?.categoryName).toBe('');
    });
  });

  describe('Integration with CategoryResolver', () => {
    beforeEach(() => {
      mockSheet.getValues.mockReturnValue([[
        'ID', 'Description', 'Manual Category', 'Manual Category ID'
      ]]);

      mockSheet.getColumn = vi.fn(() => 3);
      mockSheet.getRow = vi.fn(() => 2);
    });

    it('should use CategoryResolver for name resolution', () => {
      const resolveSpy = vi.spyOn(categoryResolver, 'resolveCategoryName');

      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Groceries'
      };

      handler.handleEdit(event, activeCategories, columnConfig);

      expect(resolveSpy).toHaveBeenCalledWith('Groceries', activeCategories);
    });

    it('should handle CategoryResolver warnings for custom categories', () => {
      const event: OnEditEvent = {
        range: mockSheet as any,
        value: 'Nonexistent Category'
      };

      const result = handler.handleEdit(event, activeCategories, columnConfig);

      expect(result?.categoryId).toBeNull();
      expect(result?.message).toContain('Custom category');
    });
  });
});
