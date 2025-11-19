/**
 * Historical Pattern Learner
 *
 * Learns from historical transaction patterns to improve categorization accuracy.
 * Uses similarity matching based on merchant names and amount ranges.
 * Prioritizes manual overrides to reflect user preferences.
 *
 * Satisfies:
 * - FR-014: Historical Transaction Learning
 *
 * @module domain/categorization/HistoricalPatternLearner
 */

import { Transaction, TransactionValidator } from '../../models/Transaction';

/**
 * Historical transaction pattern for learning
 */
export interface HistoricalPattern {
  /**
   * Transaction ID
   */
  transactionId: string;

  /**
   * Transaction description
   */
  description: string;

  /**
   * Category ID assigned (AI or manual)
   */
  categoryId: string;

  /**
   * Category name assigned (AI or manual)
   */
  categoryName: string;

  /**
   * Whether this was a manual override (higher priority)
   */
  wasManualOverride: boolean;

  /**
   * AI confidence score (if applicable)
   */
  confidenceScore?: number;

  /**
   * Transaction amount (for range matching)
   */
  amountGbp: number;

  /**
   * Transaction date (for recency filtering)
   */
  transactionDate: Date;
}

/**
 * Similarity match result
 */
export interface SimilarityMatch {
  /**
   * Historical pattern that matched
   */
  pattern: HistoricalPattern;

  /**
   * Similarity score (0-100)
   */
  score: number;

  /**
   * Weighted score (accounts for manual override 2x multiplier)
   */
  weightedScore: number;

  /**
   * Type of match
   */
  matchType: 'exact' | 'fuzzy' | 'amount_range';
}

/**
 * Configuration for historical pattern learning
 */
export interface LearnerConfig {
  /**
   * Lookback window in days (default: 90)
   * FR-014: Search last 90 days only
   */
  lookbackDays: number;

  /**
   * Weight multiplier for manual overrides (default: 2.0)
   * FR-014: Prioritize manual overrides 2x
   */
  manualOverrideWeight: number;

  /**
   * Minimum similarity score for fuzzy matching (0-100)
   */
  fuzzyMatchThreshold: number;

  /**
   * Percentage range for amount matching (e.g., 0.1 = ±10%)
   */
  amountRangeTolerance: number;
}

/**
 * Default learner configuration
 */
export const DEFAULT_LEARNER_CONFIG: LearnerConfig = {
  lookbackDays: 90,
  manualOverrideWeight: 2.0,
  fuzzyMatchThreshold: 60,
  amountRangeTolerance: 0.1 // ±10%
};

/**
 * Historical Pattern Learner
 *
 * Learns from historical transaction patterns to suggest categories for new transactions.
 * Implements FR-014: Historical Transaction Learning with similarity matching.
 */
export class HistoricalPatternLearner {
  private config: LearnerConfig;

  /**
   * Initialize historical pattern learner
   *
   * @param config - Learner configuration (optional)
   */
  constructor(config: LearnerConfig = DEFAULT_LEARNER_CONFIG) {
    this.config = config;
  }

  /**
   * Find similar historical transactions for a given transaction
   *
   * Implements FR-014: Similarity matching using exact merchant, fuzzy match, and amount range.
   * Prioritizes manual overrides 2x and searches last 90 days only.
   *
   * @param transaction - Transaction to find similar patterns for
   * @param historicalTransactions - Pool of historical categorized transactions
   * @param limit - Maximum number of similar patterns to return
   * @returns Array of similar patterns ordered by weighted score (highest first)
   */
  findSimilarPatterns(
    transaction: Transaction,
    historicalTransactions: Transaction[],
    limit: number = 5
  ): SimilarityMatch[] {
    // Validate input transaction
    TransactionValidator.validate(transaction);

    // Filter to only categorized transactions within lookback window
    const eligibleTransactions = this.filterEligibleTransactions(
      historicalTransactions,
      transaction.transactionDate
    );

    if (eligibleTransactions.length === 0) {
      return [];
    }

    // Convert to historical patterns
    const patterns = eligibleTransactions.map(t => this.toHistoricalPattern(t));

    // Find matches
    const matches: SimilarityMatch[] = [];

    // 1. Try exact merchant match first (highest priority)
    const exactMatches = this.findExactMatches(transaction, patterns);
    matches.push(...exactMatches);

    // 2. Try fuzzy merchant match
    const fuzzyMatches = this.findFuzzyMatches(transaction, patterns);
    matches.push(...fuzzyMatches);

    // 3. Try amount range match
    const amountMatches = this.findAmountRangeMatches(transaction, patterns);
    matches.push(...amountMatches);

    // Remove duplicates (prefer exact over fuzzy over amount)
    const uniqueMatches = this.deduplicateMatches(matches);

    // Sort by weighted score (descending)
    uniqueMatches.sort((a, b) => b.weightedScore - a.weightedScore);

    // Return top N matches
    return uniqueMatches.slice(0, limit);
  }

  /**
   * Filter transactions to only those eligible for learning
   *
   * FR-014: Search last 90 days only
   *
   * @param transactions - All historical transactions
   * @param referenceDate - Reference date for lookback window
   * @returns Filtered transactions
   */
  private filterEligibleTransactions(
    transactions: Transaction[],
    referenceDate: Date
  ): Transaction[] {
    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() - this.config.lookbackDays);

    return transactions.filter(t => {
      // Must be categorized (AI or manual)
      if (!TransactionValidator.isCategorized(t)) {
        return false;
      }

      // Must be within lookback window
      if (t.transactionDate < cutoffDate) {
        return false;
      }

      // Must have valid processing status
      if (t.processingStatus === 'ERROR' || t.processingStatus === 'UNPROCESSED') {
        return false;
      }

      return true;
    });
  }

  /**
   * Convert transaction to historical pattern
   *
   * @param transaction - Transaction to convert
   * @returns Historical pattern
   */
  private toHistoricalPattern(transaction: Transaction): HistoricalPattern {
    const category = TransactionValidator.getEffectiveCategory(transaction);

    if (!category) {
      throw new Error(`Transaction ${transaction.id} is not categorized`);
    }

    return {
      transactionId: transaction.id,
      description: transaction.description,
      categoryId: category.id,
      categoryName: category.name,
      wasManualOverride: transaction.categoryManualId !== null,
      confidenceScore: transaction.categoryConfidenceScore ?? undefined,
      amountGbp: transaction.gbpAmountValue,
      transactionDate: transaction.transactionDate
    };
  }

  /**
   * Find exact merchant name matches
   *
   * FR-014: Exact merchant matching
   *
   * @param transaction - Transaction to match
   * @param patterns - Historical patterns to search
   * @returns Exact matches with scores
   */
  private findExactMatches(
    transaction: Transaction,
    patterns: HistoricalPattern[]
  ): SimilarityMatch[] {
    const matches: SimilarityMatch[] = [];
    const normalizedDescription = this.normalizeDescription(transaction.description);

    for (const pattern of patterns) {
      const patternDescription = this.normalizeDescription(pattern.description);

      if (normalizedDescription === patternDescription) {
        const score = 100; // Perfect match
        const weightedScore = this.calculateWeightedScore(score, pattern.wasManualOverride);

        matches.push({
          pattern,
          score,
          weightedScore,
          matchType: 'exact'
        });
      }
    }

    return matches;
  }

  /**
   * Find fuzzy merchant name matches
   *
   * FR-014: Fuzzy merchant matching
   *
   * @param transaction - Transaction to match
   * @param patterns - Historical patterns to search
   * @returns Fuzzy matches with scores
   */
  private findFuzzyMatches(
    transaction: Transaction,
    patterns: HistoricalPattern[]
  ): SimilarityMatch[] {
    const matches: SimilarityMatch[] = [];
    const transactionTokens = this.tokenizeDescription(transaction.description);

    for (const pattern of patterns) {
      const patternTokens = this.tokenizeDescription(pattern.description);

      // Calculate Jaccard similarity (intersection / union)
      const score = this.calculateJaccardSimilarity(transactionTokens, patternTokens);

      // Only include if above threshold and not 100% (100% would be an exact match)
      if (score >= this.config.fuzzyMatchThreshold && score < 100) {
        const weightedScore = this.calculateWeightedScore(score, pattern.wasManualOverride);

        matches.push({
          pattern,
          score,
          weightedScore,
          matchType: 'fuzzy'
        });
      }
    }

    return matches;
  }

  /**
   * Find matches based on amount range
   *
   * FR-014: Amount range matching
   *
   * @param transaction - Transaction to match
   * @param patterns - Historical patterns to search
   * @returns Amount range matches with scores
   */
  private findAmountRangeMatches(
    transaction: Transaction,
    patterns: HistoricalPattern[]
  ): SimilarityMatch[] {
    const matches: SimilarityMatch[] = [];
    const amount = Math.abs(transaction.gbpAmountValue);
    const tolerance = amount * this.config.amountRangeTolerance;

    for (const pattern of patterns) {
      const patternAmount = Math.abs(pattern.amountGbp);

      // Check if within tolerance range
      if (Math.abs(amount - patternAmount) <= tolerance) {
        // Score based on how close to exact match (100 = exact, 0 = at edge of tolerance)
        const difference = Math.abs(amount - patternAmount);
        const score = Math.round(100 * (1 - difference / tolerance));

        const weightedScore = this.calculateWeightedScore(score, pattern.wasManualOverride);

        matches.push({
          pattern,
          score,
          weightedScore,
          matchType: 'amount_range'
        });
      }
    }

    return matches;
  }

  /**
   * Calculate weighted score with manual override multiplier
   *
   * FR-014: Prioritize manual overrides 2x
   *
   * @param baseScore - Base similarity score (0-100)
   * @param wasManualOverride - Whether pattern was from manual override
   * @returns Weighted score
   */
  private calculateWeightedScore(baseScore: number, wasManualOverride: boolean): number {
    return wasManualOverride
      ? baseScore * this.config.manualOverrideWeight
      : baseScore;
  }

  /**
   * Normalize description for exact matching
   *
   * @param description - Raw description
   * @returns Normalized description
   */
  private normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, ''); // Remove punctuation
  }

  /**
   * Tokenize description for fuzzy matching
   *
   * @param description - Raw description
   * @returns Set of normalized tokens
   */
  private tokenizeDescription(description: string): Set<string> {
    const normalized = this.normalizeDescription(description);
    const tokens = normalized.split(/\s+/).filter(token => token.length > 0);
    return new Set(tokens);
  }

  /**
   * Calculate Jaccard similarity coefficient
   *
   * Jaccard = |intersection| / |union|
   *
   * @param set1 - First token set
   * @param set2 - Second token set
   * @returns Similarity score (0-100)
   */
  private calculateJaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(token => set2.has(token)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) {
      return 0;
    }

    return Math.round((intersection.size / union.size) * 100);
  }

  /**
   * Remove duplicate matches, preferring higher quality match types
   *
   * Priority: exact > fuzzy > amount_range
   *
   * Each unique historical transaction should only appear once in the results,
   * matched by the best available method (exact beats fuzzy beats amount_range).
   *
   * @param matches - All matches
   * @returns Deduplicated matches
   */
  private deduplicateMatches(matches: SimilarityMatch[]): SimilarityMatch[] {
    const matchTypeRank = { exact: 1, fuzzy: 2, amount_range: 3 };
    const uniqueMap = new Map<string, SimilarityMatch>();

    for (const match of matches) {
      // Use transaction ID as the unique key - each transaction should only appear once
      const key = match.pattern.transactionId;
      const existing = uniqueMap.get(key);

      if (!existing) {
        uniqueMap.set(key, match);
      } else {
        // Keep the match with better type, or higher weighted score if same type
        const existingRank = matchTypeRank[existing.matchType];
        const newRank = matchTypeRank[match.matchType];

        if (newRank < existingRank ||
            (newRank === existingRank && match.weightedScore > existing.weightedScore)) {
          uniqueMap.set(key, match);
        }
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Get suggested category based on similar patterns
   *
   * Analyzes similar patterns and returns the most commonly suggested category
   * weighted by similarity scores and manual override preference.
   *
   * @param similarMatches - Similar pattern matches
   * @returns Suggested category ID and confidence, or null if no clear suggestion
   */
  getSuggestedCategory(
    similarMatches: SimilarityMatch[]
  ): { categoryId: string; categoryName: string; confidence: number } | null {
    if (similarMatches.length === 0) {
      return null;
    }

    // Group by category and sum weighted scores
    const categoryScores = new Map<string, {
      name: string;
      totalScore: number;
      count: number;
      matches: SimilarityMatch[];
    }>();

    for (const match of similarMatches) {
      const existing = categoryScores.get(match.pattern.categoryId);

      if (existing) {
        existing.totalScore += match.weightedScore;
        existing.count += 1;
        existing.matches.push(match);
      } else {
        categoryScores.set(match.pattern.categoryId, {
          name: match.pattern.categoryName,
          totalScore: match.weightedScore,
          count: 1,
          matches: [match]
        });
      }
    }

    // Find category with highest total weighted score
    let bestCategory: {
      id: string;
      name: string;
      score: number;
      count: number;
      matches: SimilarityMatch[];
    } | null = null;

    for (const [categoryId, data] of categoryScores.entries()) {
      if (!bestCategory || data.totalScore > bestCategory.score) {
        bestCategory = {
          id: categoryId,
          name: data.name,
          score: data.totalScore,
          count: data.count,
          matches: data.matches
        };
      }
    }

    if (!bestCategory) {
      return null;
    }

    // Calculate confidence based on multiple factors:
    // 1. Agreement ratio: What % of all matches voted for the winner?
    // 2. Match quality: How good were the matches that voted for the winner?
    // 3. Manual override presence: Does the winner have manual override backing?

    const agreementRatio = bestCategory.count / similarMatches.length;

    // Calculate average match quality for the winning category
    // This is the average base score (not weighted) to get true match quality
    const avgBaseScore = bestCategory.matches.reduce((sum, m) => sum + m.score, 0) / bestCategory.count;

    // Normalize base score to 0-1 scale (max base score is 100)
    const normalizedQuality = avgBaseScore / 100;

    // Check if winner has manual override support
    const hasManualOverride = bestCategory.matches.some(m => m.pattern.wasManualOverride);
    const manualOverrideBonus = hasManualOverride ? 0.1 : 0;

    // Combine factors:
    // - 50% weight on agreement (how many agree)
    // - 40% weight on match quality (how good are the matches)
    // - Up to 10% bonus if backed by manual override
    const confidence = Math.min(100, Math.round(
      (agreementRatio * 50) +
      (normalizedQuality * 40) +
      (manualOverrideBonus * 100)
    ));

    return {
      categoryId: bestCategory.id,
      categoryName: bestCategory.name,
      confidence
    };
  }
}
