/**
 * Confidence Calculator
 *
 * Computes categorization confidence scores by combining multiple signals:
 * - AI model confidence
 * - Historical pattern matching strength
 * - Manual override patterns
 *
 * Satisfies:
 * - FR-005: AI provides confidence scores stored for auditability
 * - FR-014: Historical Transaction Learning
 *
 * @module domain/categorization/ConfidenceCalculator
 */

import { SimilarityMatch } from './HistoricalPatternLearner';

/**
 * Historical category suggestion from HistoricalPatternLearner
 */
export interface HistoricalSuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
}

/**
 * Confidence score inputs
 */
export interface ConfidenceInputs {
  /**
   * Raw AI model confidence score (0-100)
   * Direct output from LLM categorization
   */
  aiConfidence: number;

  /**
   * AI's chosen category ID (for comparison with historical suggestion)
   */
  aiCategoryId: string;

  /**
   * Similar historical patterns (if available)
   * Empty array if no historical context used
   */
  historicalMatches: SimilarityMatch[];

  /**
   * Historical category suggestion from HistoricalPatternLearner.getSuggestedCategory()
   * Null if no historical data or no clear suggestion
   */
  historicalSuggestion?: HistoricalSuggestion | null;
}

/**
 * Confidence score breakdown for auditability
 */
export interface ConfidenceBreakdown {
  /**
   * Final combined confidence score (0-100)
   */
  finalScore: number;

  /**
   * AI model contribution (0-100)
   */
  aiScore: number;

  /**
   * Historical pattern contribution (0-100)
   */
  historicalScore: number;

  /**
   * Boost from consensus agreement (0-20)
   */
  consensusBoost: number;

  /**
   * Penalty from conflict (-20-0)
   */
  conflictPenalty: number;

  /**
   * Manual override pattern count
   */
  manualOverrideCount: number;

  /**
   * Total historical matches considered
   */
  historicalMatchCount: number;
}

/**
 * Configuration for confidence calculation
 */
export interface ConfidenceConfig {
  /**
   * Weight for AI confidence in final score (0-1)
   * Default: 0.6 (60% weight)
   */
  aiWeight: number;

  /**
   * Weight for historical confidence in final score (0-1)
   * Default: 0.4 (40% weight)
   */
  historicalWeight: number;

  /**
   * Bonus points for consensus agreement (0-20)
   * Default: 15
   */
  consensusBonus: number;

  /**
   * Penalty points for conflict (-20-0)
   * Default: -15
   */
  conflictPenalty: number;

  /**
   * Minimum number of historical matches to consider them significant
   * Default: 2
   */
  minHistoricalMatches: number;

  /**
   * Extra boost per manual override match (0-10)
   * Default: 5
   */
  manualOverrideBoost: number;
}

/**
 * Default confidence calculation configuration
 */
export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  aiWeight: 0.6,
  historicalWeight: 0.4,
  consensusBonus: 15,
  conflictPenalty: -15,
  minHistoricalMatches: 2,
  manualOverrideBoost: 5
};

/**
 * Confidence Calculator
 *
 * Combines AI confidence with historical pattern matching to produce
 * a more reliable confidence score for transaction categorization.
 */
export class ConfidenceCalculator {
  private config: ConfidenceConfig;

  /**
   * Initialize confidence calculator
   *
   * @param config - Configuration (optional)
   */
  constructor(config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG) {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * Calculate confidence score with full breakdown
   *
   * Combines AI confidence with historical pattern strength.
   * Provides bonus for consensus and penalty for conflicts.
   *
   * @param inputs - Confidence calculation inputs
   * @returns Confidence breakdown with final score
   */
  calculate(inputs: ConfidenceInputs): ConfidenceBreakdown {
    // Validate inputs
    this.validateInputs(inputs);

    // Calculate AI score component
    const aiScore = this.normalizeScore(inputs.aiConfidence);

    // Calculate historical score component
    const historicalScore = this.calculateHistoricalScore(inputs.historicalMatches);

    // Count manual overrides in matches
    const manualOverrideCount = inputs.historicalMatches.filter(
      match => match.pattern.wasManualOverride
    ).length;

    // Calculate consensus/conflict adjustments based on historical suggestion
    let consensusBoost = 0;
    let conflictPenalty = 0;

    // Determine if AI matches historical consensus
    const matchesHistoricalConsensus = inputs.historicalSuggestion
      ? inputs.aiCategoryId === inputs.historicalSuggestion.categoryId
      : undefined;

    if (inputs.historicalMatches.length >= this.config.minHistoricalMatches && matchesHistoricalConsensus !== undefined) {
      if (matchesHistoricalConsensus === true) {
        consensusBoost = this.config.consensusBonus;

        // Additional boost for manual override agreement
        if (manualOverrideCount > 0) {
          consensusBoost += Math.min(
            this.config.manualOverrideBoost * manualOverrideCount,
            10 // Cap the boost
          );
        }
      } else if (matchesHistoricalConsensus === false) {
        conflictPenalty = this.config.conflictPenalty;

        // Stronger penalty if conflicting with manual overrides
        if (manualOverrideCount > 0) {
          conflictPenalty *= 1.5;
        }
      }
    }

    // Combine weighted scores
    const baseScore =
      (aiScore * this.config.aiWeight) +
      (historicalScore * this.config.historicalWeight);

    // Apply consensus/conflict adjustments
    const finalScore = this.normalizeScore(
      baseScore + consensusBoost + conflictPenalty
    );

    return {
      finalScore,
      aiScore,
      historicalScore,
      consensusBoost,
      conflictPenalty,
      manualOverrideCount,
      historicalMatchCount: inputs.historicalMatches.length
    };
  }

  /**
   * Calculate simple confidence score (convenience method)
   *
   * @param inputs - Confidence calculation inputs
   * @returns Final confidence score (0-100)
   */
  calculateScore(inputs: ConfidenceInputs): number {
    return this.calculate(inputs).finalScore;
  }

  /**
   * Calculate historical confidence score from similarity matches
   *
   * Considers:
   * - Strength of matches (weighted scores)
   * - Number of matches (more = higher confidence)
   * - Manual override presence (higher weight)
   *
   * @param matches - Historical similarity matches
   * @returns Historical confidence score (0-100)
   */
  private calculateHistoricalScore(matches: SimilarityMatch[]): number {
    if (matches.length === 0) {
      return 0;
    }

    // Calculate average weighted score
    const totalWeightedScore = matches.reduce(
      (sum, match) => sum + match.weightedScore,
      0
    );

    // Account for manual override weight multiplier (typically 2x)
    // Need to normalize back to 0-100 range
    const maxManualOverrides = matches.filter(m => m.pattern.wasManualOverride).length;
    const maxPossibleScore = matches.length * 100 * (maxManualOverrides > 0 ? 2 : 1);

    const averageScore = maxPossibleScore > 0
      ? (totalWeightedScore / maxPossibleScore) * 100
      : 0;

    // Apply diminishing returns for number of matches
    // 1 match: 0.7x, 2 matches: 0.85x, 3+ matches: 1.0x
    let matchCountMultiplier = 1.0;
    if (matches.length === 1) {
      matchCountMultiplier = 0.7;
    } else if (matches.length === 2) {
      matchCountMultiplier = 0.85;
    }

    return this.normalizeScore(averageScore * matchCountMultiplier);
  }

  /**
   * Normalize score to 0-100 range
   *
   * @param score - Raw score
   * @returns Normalized score (0-100)
   */
  private normalizeScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Validate configuration
   *
   * @param config - Configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateConfig(config: ConfidenceConfig): void {
    if (config.aiWeight < 0 || config.aiWeight > 1) {
      throw new Error(`Invalid aiWeight: ${config.aiWeight}. Must be between 0 and 1.`);
    }

    if (config.historicalWeight < 0 || config.historicalWeight > 1) {
      throw new Error(`Invalid historicalWeight: ${config.historicalWeight}. Must be between 0 and 1.`);
    }

    const totalWeight = config.aiWeight + config.historicalWeight;
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(
        `Weights must sum to 1.0. Current sum: ${totalWeight} (aiWeight: ${config.aiWeight}, historicalWeight: ${config.historicalWeight})`
      );
    }

    if (config.consensusBonus < 0 || config.consensusBonus > 20) {
      throw new Error(`Invalid consensusBonus: ${config.consensusBonus}. Must be between 0 and 20.`);
    }

    if (config.conflictPenalty < -20 || config.conflictPenalty > 0) {
      throw new Error(`Invalid conflictPenalty: ${config.conflictPenalty}. Must be between -20 and 0.`);
    }

    if (config.minHistoricalMatches < 0) {
      throw new Error(`Invalid minHistoricalMatches: ${config.minHistoricalMatches}. Must be >= 0.`);
    }

    if (config.manualOverrideBoost < 0 || config.manualOverrideBoost > 10) {
      throw new Error(`Invalid manualOverrideBoost: ${config.manualOverrideBoost}. Must be between 0 and 10.`);
    }
  }

  /**
   * Validate inputs
   *
   * @param inputs - Inputs to validate
   * @throws Error if inputs are invalid
   */
  private validateInputs(inputs: ConfidenceInputs): void {
    if (inputs.aiConfidence < 0 || inputs.aiConfidence > 100) {
      throw new Error(`Invalid aiConfidence: ${inputs.aiConfidence}. Must be between 0 and 100.`);
    }

    if (!inputs.aiCategoryId || typeof inputs.aiCategoryId !== 'string') {
      throw new Error('aiCategoryId must be a non-empty string');
    }

    if (!Array.isArray(inputs.historicalMatches)) {
      throw new Error('historicalMatches must be an array');
    }

    if (inputs.historicalSuggestion !== undefined && inputs.historicalSuggestion !== null) {
      if (!inputs.historicalSuggestion.categoryId || typeof inputs.historicalSuggestion.categoryId !== 'string') {
        throw new Error('historicalSuggestion.categoryId must be a non-empty string');
      }
      if (inputs.historicalSuggestion.confidence < 0 || inputs.historicalSuggestion.confidence > 100) {
        throw new Error(`Invalid historicalSuggestion.confidence: ${inputs.historicalSuggestion.confidence}. Must be between 0 and 100.`);
      }
    }
  }
}
