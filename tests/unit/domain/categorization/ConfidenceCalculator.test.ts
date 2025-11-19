/**
 * Confidence Calculator Tests
 *
 * Tests confidence score calculation combining AI confidence with historical patterns.
 * Validates behaviors required by:
 * - FR-005: AI provides confidence scores stored for auditability
 * - FR-014: Historical Transaction Learning
 *
 * Business Rules Tested:
 * - BR-CONF-01: Confidence scores must be between 0-100
 * - BR-CONF-02: AI and historical weights must sum to 1.0
 * - BR-CONF-03: Historical matches boost confidence
 * - BR-CONF-04: Manual overrides increase confidence more than AI-only matches
 * - BR-CONF-05: Consensus agreement provides bonus
 * - BR-CONF-06: Conflict with historical patterns applies penalty
 * - BR-CONF-07: Multiple matches increase confidence more than single match
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  ConfidenceCalculator,
  DEFAULT_CONFIDENCE_CONFIG,
  ConfidenceConfig,
  ConfidenceInputs,
  ConfidenceBreakdown,
  HistoricalSuggestion
} from '../../../../src/apps-script/domain/categorization/ConfidenceCalculator';
import { SimilarityMatch } from '../../../../src/apps-script/domain/categorization/HistoricalPatternLearner';

describe('ConfidenceCalculator', () => {
  let calculator: ConfidenceCalculator;

  beforeEach(() => {
    calculator = new ConfidenceCalculator();
  });

  // Test fixture factories
  function createSimilarityMatch(overrides: Partial<SimilarityMatch> = {}): SimilarityMatch {
    return {
      pattern: {
        description: 'Tesco Metro',
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
        wasManualOverride: false,
        confidenceScore: 85,
        amountGbp: 23.45,
        transactionDate: new Date('2025-11-01')
      },
      score: 100,
      weightedScore: 100,
      matchType: 'exact',
      ...overrides
    };
  }

  describe('Constructor and Configuration', () => {
    test('should initialize with default configuration', () => {
      expect(calculator).toBeDefined();
    });

    test('should accept custom configuration', () => {
      const customConfig: ConfidenceConfig = {
        aiWeight: 0.7,
        historicalWeight: 0.3,
        consensusBonus: 10,
        conflictPenalty: -10,
        minHistoricalMatches: 3,
        manualOverrideBoost: 3
      };

      const customCalculator = new ConfidenceCalculator(customConfig);
      expect(customCalculator).toBeDefined();
    });

    test('should throw error if weights do not sum to 1.0', () => {
      const invalidConfig: ConfidenceConfig = {
        ...DEFAULT_CONFIDENCE_CONFIG,
        aiWeight: 0.7,
        historicalWeight: 0.4 // Sum = 1.1
      };

      expect(() => new ConfidenceCalculator(invalidConfig)).toThrow(
        'Weights must sum to 1.0'
      );
    });

    test('should throw error if aiWeight is out of range', () => {
      const invalidConfig: ConfidenceConfig = {
        ...DEFAULT_CONFIDENCE_CONFIG,
        aiWeight: 1.5,
        historicalWeight: -0.5
      };

      expect(() => new ConfidenceCalculator(invalidConfig)).toThrow(
        'Invalid aiWeight'
      );
    });

    test('should throw error if consensusBonus is out of range', () => {
      const invalidConfig: ConfidenceConfig = {
        ...DEFAULT_CONFIDENCE_CONFIG,
        consensusBonus: 25 // Max is 20
      };

      expect(() => new ConfidenceCalculator(invalidConfig)).toThrow(
        'Invalid consensusBonus'
      );
    });

    test('should throw error if conflictPenalty is out of range', () => {
      const invalidConfig: ConfidenceConfig = {
        ...DEFAULT_CONFIDENCE_CONFIG,
        conflictPenalty: -25 // Min is -20
      };

      expect(() => new ConfidenceCalculator(invalidConfig)).toThrow(
        'Invalid conflictPenalty'
      );
    });

    test('should throw error if manualOverrideBoost is out of range', () => {
      const invalidConfig: ConfidenceConfig = {
        ...DEFAULT_CONFIDENCE_CONFIG,
        manualOverrideBoost: 15 // Max is 10
      };

      expect(() => new ConfidenceCalculator(invalidConfig)).toThrow(
        'Invalid manualOverrideBoost'
      );
    });
  });

  describe('Basic Confidence Calculation', () => {
    test('should calculate confidence with AI only (no historical matches)', () => {
      const inputs: ConfidenceInputs = {
        aiConfidence: 85,
        aiCategoryId: 'cat-groceries',
        historicalMatches: []
      };

      const result = calculator.calculate(inputs);

      expect(result.finalScore).toBeGreaterThan(0);
      expect(result.finalScore).toBeLessThanOrEqual(100);
      expect(result.aiScore).toBe(85);
      expect(result.historicalScore).toBe(0);
      expect(result.consensusBoost).toBe(0);
      expect(result.conflictPenalty).toBe(0);
      expect(result.historicalMatchCount).toBe(0);
    });

    test('should calculate confidence with high AI confidence', () => {
      const inputs: ConfidenceInputs = {
        aiConfidence: 95,
        aiCategoryId: 'cat-groceries',
        historicalMatches: []
      };

      const result = calculator.calculate(inputs);

      // With 60% AI weight, 95 * 0.6 = 57
      expect(result.finalScore).toBeGreaterThanOrEqual(55);
      expect(result.finalScore).toBeLessThanOrEqual(60);
    });

    test('should calculate confidence with low AI confidence', () => {
      const inputs: ConfidenceInputs = {
        aiConfidence: 30,
        aiCategoryId: 'cat-groceries',
        historicalMatches: []
      };

      const result = calculator.calculate(inputs);

      // With 60% AI weight, 30 * 0.6 = 18
      expect(result.finalScore).toBeGreaterThanOrEqual(15);
      expect(result.finalScore).toBeLessThanOrEqual(20);
    });

    test('should throw error for invalid AI confidence (< 0)', () => {
      const inputs: ConfidenceInputs = {
        aiConfidence: -5,
        historicalMatches: []
      };

      expect(() => calculator.calculate(inputs)).toThrow('Invalid aiConfidence');
    });

    test('should throw error for invalid AI confidence (> 100)', () => {
      const inputs: ConfidenceInputs = {
        aiConfidence: 105,
        aiCategoryId: 'cat-groceries',
        historicalMatches: []
      };

      expect(() => calculator.calculate(inputs)).toThrow('Invalid aiConfidence');
    });

    test('should use calculateScore convenience method', () => {
      const inputs: ConfidenceInputs = {
        aiConfidence: 75,
        aiCategoryId: 'cat-groceries',
        historicalMatches: []
      };

      const score = calculator.calculateScore(inputs);
      const breakdown = calculator.calculate(inputs);

      expect(score).toBe(breakdown.finalScore);
    });
  });

  describe('Historical Confidence Calculation', () => {
    test('should boost confidence with single exact historical match', () => {
      const match = createSimilarityMatch({
        score: 100,
        weightedScore: 100,
        matchType: 'exact'
      });

      const inputs: ConfidenceInputs = {
        aiConfidence: 60,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [match]
      };

      const result = calculator.calculate(inputs);

      expect(result.historicalScore).toBeGreaterThan(0);
      expect(result.historicalMatchCount).toBe(1);
      // Historical score should be reduced for single match (0.7x multiplier)
      expect(result.historicalScore).toBeLessThan(100);
    });

    test('should boost confidence more with multiple historical matches', () => {
      const match1 = createSimilarityMatch({ score: 100, weightedScore: 100 });
      const match2 = createSimilarityMatch({ score: 95, weightedScore: 95 });
      const match3 = createSimilarityMatch({ score: 90, weightedScore: 90 });

      const inputsSingle: ConfidenceInputs = {
        aiConfidence: 60,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [match1]
      };

      const inputsMultiple: ConfidenceInputs = {
        aiConfidence: 60,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [match1, match2, match3]
      };

      const resultSingle = calculator.calculate(inputsSingle);
      const resultMultiple = calculator.calculate(inputsMultiple);

      expect(resultMultiple.historicalScore).toBeGreaterThan(resultSingle.historicalScore);
    });

    test('should count manual overrides correctly', () => {
      // Test that manual overrides are tracked properly
      const aiMatches = [
        createSimilarityMatch({
          pattern: {
            description: 'Tesco Metro',
            categoryId: 'cat-groceries',
            categoryName: 'Groceries',
            wasManualOverride: false,
            amountGbp: 23.45,
            transactionDate: new Date()
          },
          score: 100,
          weightedScore: 100
        }),
        createSimilarityMatch({
          pattern: {
            description: 'Sainsburys',
            categoryId: 'cat-groceries',
            categoryName: 'Groceries',
            wasManualOverride: false,
            amountGbp: 30.00,
            transactionDate: new Date()
          },
          score: 100,
          weightedScore: 100
        })
      ];

      const manualMatches = [
        createSimilarityMatch({
          pattern: {
            description: 'Tesco Metro',
            categoryId: 'cat-groceries',
            categoryName: 'Groceries',
            wasManualOverride: true,
            amountGbp: 23.45,
            transactionDate: new Date()
          },
          score: 100,
          weightedScore: 200
        }),
        createSimilarityMatch({
          pattern: {
            description: 'Sainsburys',
            categoryId: 'cat-groceries',
            categoryName: 'Groceries',
            wasManualOverride: true,
            amountGbp: 30.00,
            transactionDate: new Date()
          },
          score: 100,
          weightedScore: 200
        })
      ];

      const inputsAi: ConfidenceInputs = {
        aiConfidence: 60,
        aiCategoryId: 'cat-groceries',
        historicalMatches: aiMatches
      };

      const inputsManual: ConfidenceInputs = {
        aiConfidence: 60,
        aiCategoryId: 'cat-groceries',
        historicalMatches: manualMatches
      };

      const resultAi = calculator.calculate(inputsAi);
      const resultManual = calculator.calculate(inputsManual);

      // Should correctly count manual overrides
      expect(resultManual.manualOverrideCount).toBe(2);
      expect(resultAi.manualOverrideCount).toBe(0);

      // Historical scores should be normalized to same range despite different weighted scores
      expect(resultManual.historicalScore).toBeGreaterThanOrEqual(0);
      expect(resultManual.historicalScore).toBeLessThanOrEqual(100);
      expect(resultAi.historicalScore).toBeGreaterThanOrEqual(0);
      expect(resultAi.historicalScore).toBeLessThanOrEqual(100);
    });

    test('should handle fuzzy and amount range matches', () => {
      const fuzzyMatch = createSimilarityMatch({
        score: 75,
        weightedScore: 75,
        matchType: 'fuzzy'
      });

      const amountMatch = createSimilarityMatch({
        score: 60,
        weightedScore: 60,
        matchType: 'amount_range'
      });

      const inputs: ConfidenceInputs = {
        aiConfidence: 70,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [fuzzyMatch, amountMatch]
      };

      const result = calculator.calculate(inputs);

      expect(result.historicalScore).toBeGreaterThan(0);
      expect(result.historicalScore).toBeLessThan(100);
    });
  });

  describe('Consensus and Conflict Adjustments', () => {
    test('should apply consensus bonus when AI matches historical consensus', () => {
      const match1 = createSimilarityMatch({ score: 100, weightedScore: 100 });
      const match2 = createSimilarityMatch({ score: 95, weightedScore: 95 });

      const inputs: ConfidenceInputs = {
        aiConfidence: 70,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [match1, match2],
        historicalSuggestion: {
          categoryId: 'cat-groceries',
          categoryName: 'Groceries',
          confidence: 85
        }
      };

      const result = calculator.calculate(inputs);

      expect(result.consensusBoost).toBe(DEFAULT_CONFIDENCE_CONFIG.consensusBonus);
      expect(result.conflictPenalty).toBe(0);
    });

    test('should apply conflict penalty when AI conflicts with historical consensus', () => {
      const match1 = createSimilarityMatch({ score: 100, weightedScore: 100 });
      const match2 = createSimilarityMatch({ score: 95, weightedScore: 95 });

      const inputs: ConfidenceInputs = {
        aiConfidence: 70,
        aiCategoryId: 'cat-dining',  // AI chose dining
        historicalMatches: [match1, match2],
        historicalSuggestion: {
          categoryId: 'cat-groceries',  // History suggests groceries
          categoryName: 'Groceries',
          confidence: 85
        }
      };

      const result = calculator.calculate(inputs);

      expect(result.consensusBoost).toBe(0);
      expect(result.conflictPenalty).toBe(DEFAULT_CONFIDENCE_CONFIG.conflictPenalty);
      expect(result.conflictPenalty).toBeLessThan(0);
    });

    test('should not apply consensus/conflict adjustments with insufficient matches', () => {
      const match = createSimilarityMatch();

      const inputsConsensus: ConfidenceInputs = {
        aiConfidence: 70,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [match], // Only 1 match, need 2 minimum
        historicalSuggestion: {
          categoryId: 'cat-groceries',
          categoryName: 'Groceries',
          confidence: 85
        }
      };

      const inputsConflict: ConfidenceInputs = {
        aiConfidence: 70,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [match],
        historicalSuggestion: {
          categoryId: 'cat-dining',
          categoryName: 'Dining',
          confidence: 85
        }
      };

      const resultConsensus = calculator.calculate(inputsConsensus);
      const resultConflict = calculator.calculate(inputsConflict);

      expect(resultConsensus.consensusBoost).toBe(0);
      expect(resultConflict.conflictPenalty).toBe(0);
    });

    test('should apply extra boost for manual override consensus', () => {
      const match1 = createSimilarityMatch({
        pattern: {
          description: 'Tesco Metro',
          categoryId: 'cat-groceries',
          categoryName: 'Groceries',
          wasManualOverride: true,
          amountGbp: 23.45,
          transactionDate: new Date()
        },
        score: 100,
        weightedScore: 200
      });

      const match2 = createSimilarityMatch({
        pattern: {
          description: 'Tesco Express',
          categoryId: 'cat-groceries',
          categoryName: 'Groceries',
          wasManualOverride: true,
          amountGbp: 15.50,
          transactionDate: new Date()
        },
        score: 95,
        weightedScore: 190
      });

      const inputs: ConfidenceInputs = {
        aiConfidence: 70,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [match1, match2],
        historicalSuggestion: {
          categoryId: 'cat-groceries',
          categoryName: 'Groceries',
          confidence: 85
        }
      };

      const result = calculator.calculate(inputs);

      // Should get base consensus bonus + manual override boost
      expect(result.consensusBoost).toBeGreaterThan(DEFAULT_CONFIDENCE_CONFIG.consensusBonus);
      expect(result.manualOverrideCount).toBe(2);
    });

    test('should apply stronger penalty for manual override conflict', () => {
      const match1 = createSimilarityMatch({
        pattern: {
          description: 'Tesco Metro',
          categoryId: 'cat-groceries',
          categoryName: 'Groceries',
          wasManualOverride: true,
          amountGbp: 23.45,
          transactionDate: new Date()
        },
        score: 100,
        weightedScore: 200
      });

      const match2 = createSimilarityMatch({
        pattern: {
          description: 'Tesco Express',
          categoryId: 'cat-groceries',
          categoryName: 'Groceries',
          wasManualOverride: false,
          amountGbp: 15.50,
          transactionDate: new Date()
        },
        score: 95,
        weightedScore: 95
      });

      const inputs: ConfidenceInputs = {
        aiConfidence: 70,
        aiCategoryId: 'cat-dining',  // AI chose dining
        historicalMatches: [match1, match2],
        historicalSuggestion: {
          categoryId: 'cat-groceries',  // History suggests groceries (conflict!)
          categoryName: 'Groceries',
          confidence: 85
        }
      };

      const result = calculator.calculate(inputs);

      // Should get 1.5x stronger penalty due to manual override conflict
      expect(result.conflictPenalty).toBeLessThan(DEFAULT_CONFIDENCE_CONFIG.conflictPenalty);
      expect(result.manualOverrideCount).toBe(1);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle zero AI confidence', () => {
      const inputs: ConfidenceInputs = {
        aiConfidence: 0,
        aiCategoryId: 'cat-groceries',
        historicalMatches: []
      };

      const result = calculator.calculate(inputs);

      expect(result.finalScore).toBe(0);
      expect(result.aiScore).toBe(0);
    });

    test('should handle maximum AI confidence', () => {
      const inputs: ConfidenceInputs = {
        aiConfidence: 100,
        aiCategoryId: 'cat-groceries',
        historicalMatches: []
      };

      const result = calculator.calculate(inputs);

      expect(result.finalScore).toBeGreaterThan(0);
      expect(result.finalScore).toBeLessThanOrEqual(100);
      expect(result.aiScore).toBe(100);
    });

    test('should cap final score at 100', () => {
      const match1 = createSimilarityMatch({ score: 100, weightedScore: 200 });
      const match2 = createSimilarityMatch({ score: 100, weightedScore: 200 });

      const inputs: ConfidenceInputs = {
        aiConfidence: 100,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [match1, match2],
        historicalSuggestion: {
          categoryId: 'cat-groceries',
          categoryName: 'Groceries',
          confidence: 85
        }
      };

      const result = calculator.calculate(inputs);

      expect(result.finalScore).toBeLessThanOrEqual(100);
    });

    test('should floor final score at 0', () => {
      const inputs: ConfidenceInputs = {
        aiConfidence: 10,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [
          createSimilarityMatch({ score: 10, weightedScore: 10 }),
          createSimilarityMatch({ score: 10, weightedScore: 10 })
        ],
        historicalSuggestion: {
          categoryId: 'cat-dining',
          categoryName: 'Dining',
          confidence: 85
        }
      };

      const result = calculator.calculate(inputs);

      expect(result.finalScore).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty historical matches array', () => {
      const inputs: ConfidenceInputs = {
        aiConfidence: 75,
        aiCategoryId: 'cat-groceries',
        historicalMatches: [],
        matchesHistoricalConsensus: undefined
      };

      const result = calculator.calculate(inputs);

      expect(result.historicalScore).toBe(0);
      expect(result.historicalMatchCount).toBe(0);
      expect(result.consensusBoost).toBe(0);
      expect(result.conflictPenalty).toBe(0);
    });
  });

  

  describe('Integration Scenarios', () => {
    test('scenario: high AI confidence with supporting historical matches', () => {
      const matches = [
        createSimilarityMatch({ score: 100, weightedScore: 100 }),
        createSimilarityMatch({ score: 95, weightedScore: 95 }),
        createSimilarityMatch({ score: 90, weightedScore: 90 })
      ];

      const inputs: ConfidenceInputs = {
        aiConfidence: 85,
        aiCategoryId: 'cat-groceries',
        historicalMatches: matches,
        historicalSuggestion: {
          categoryId: 'cat-groceries',
          categoryName: 'Groceries',
          confidence: 85
        }
      };

      const result = calculator.calculate(inputs);

      // Should have very high confidence
      expect(result.finalScore).toBeGreaterThan(80);
      expect(result.consensusBoost).toBeGreaterThan(0);
    });

    test('scenario: low AI confidence with strong manual override consensus', () => {
      const matches = [
        createSimilarityMatch({
          pattern: {
            description: 'Tesco Metro',
            categoryId: 'cat-groceries',
            categoryName: 'Groceries',
            wasManualOverride: true,
            amountGbp: 23.45,
            transactionDate: new Date()
          },
          score: 100,
          weightedScore: 200
        }),
        createSimilarityMatch({
          pattern: {
            description: 'Tesco Express',
            categoryId: 'cat-groceries',
            categoryName: 'Groceries',
            wasManualOverride: true,
            amountGbp: 15.50,
            transactionDate: new Date()
          },
          score: 100,
          weightedScore: 200
        })
      ];

      const inputs: ConfidenceInputs = {
        aiConfidence: 40,
        aiCategoryId: 'cat-groceries',
        historicalMatches: matches,
        historicalSuggestion: {
          categoryId: 'cat-groceries',
          categoryName: 'Groceries',
          confidence: 85
        }
      };

      const result = calculator.calculate(inputs);

      // Manual overrides should boost confidence significantly
      expect(result.finalScore).toBeGreaterThan(40);
      expect(result.manualOverrideCount).toBe(2);
    });

    test('scenario: high AI confidence conflicting with manual overrides', () => {
      const matches = [
        createSimilarityMatch({
          pattern: {
            description: 'Tesco Metro',
            categoryId: 'cat-groceries',
            categoryName: 'Groceries',
            wasManualOverride: true,
            amountGbp: 23.45,
            transactionDate: new Date()
          },
          score: 100,
          weightedScore: 200
        }),
        createSimilarityMatch({
          pattern: {
            description: 'Tesco Express',
            categoryId: 'cat-groceries',
            categoryName: 'Groceries',
            wasManualOverride: true,
            amountGbp: 15.50,
            transactionDate: new Date()
          },
          score: 100,
          weightedScore: 200
        })
      ];

      const inputs: ConfidenceInputs = {
        aiConfidence: 90,
        aiCategoryId: 'cat-groceries',
        historicalMatches: matches,
        historicalSuggestion: {
          categoryId: 'cat-dining',
          categoryName: 'Dining',
          confidence: 85
        }
      };

      const result = calculator.calculate(inputs);

      // Should have reduced confidence due to manual override conflict
      expect(result.finalScore).toBeLessThan(90);
      expect(result.conflictPenalty).toBeLessThan(0);
    });
  });
});
