/**
 * AI Categorization Adapter
 *
 * Implements AICategorizationPort for OpenAI-powered transaction categorization.
 * Part of hexagonal architecture - isolates OpenAI API calls.
 *
 * @module infrastructure/adapters/AICategorizationAdapter
 */

import {
  AICategorizationPort,
  CategoryInfo,
  HistoricalContext,
  CategorizationResult
} from '../../domain/ports/AICategorizationPort';
import { Transaction } from '../../models/Transaction';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { RetryUtils } from '../../utils/RetryUtils';
import { logger } from '../logging/ErrorLogger';

/**
 * OpenAI API response structure
 */
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
}

/**
 * Internal result from callOpenAI with truncation info
 */
interface OpenAIResult {
  content: string;
  truncated: boolean;
}

/**
 * Parsed categorization from AI response
 */
interface ParsedCategorization {
  transactionId: string;
  categoryId: string;
  categoryName: string;
  confidenceScore: number;
  reasoning?: string;
}

/**
 * AI Categorization Adapter
 *
 * Calls OpenAI API for intelligent transaction categorization.
 * Handles batching, retries, and response parsing.
 */
export class AICategorizationAdapter implements AICategorizationPort {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private chunkSize: number = 10;

  constructor() {
    const config = ConfigurationManager.getOpenAIConfig();
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
  }

  /**
   * Categorize a batch of transactions
   */
  async categorizeBatch(
    transactions: Transaction[],
    categories: CategoryInfo[],
    context?: HistoricalContext
  ): Promise<CategorizationResult[]> {
    if (transactions.length === 0) {
      return [];
    }

    // For small batches, process directly
    if (transactions.length <= this.chunkSize) {
      return this.categorizeBatchInternal(transactions, categories, context);
    }

    // For larger batches, chunk into groups
    const results: CategorizationResult[] = [];

    for (let i = 0; i < transactions.length; i += this.chunkSize) {
      const chunk = transactions.slice(i, i + this.chunkSize);
      const chunkResults = await this.categorizeBatchInternal(chunk, categories, context);
      results.push(...chunkResults);

      // Small delay between chunks to avoid rate limiting
      if (i + this.chunkSize < transactions.length) {
        await this.sleep(500);
      }
    }

    return results;
  }

  /**
   * Categorize a single transaction
   */
  async categorizeSingle(
    transaction: Transaction,
    categories: CategoryInfo[],
    context?: HistoricalContext
  ): Promise<CategorizationResult> {
    const results = await this.categorizeBatch([transaction], categories, context);
    return results[0];
  }

  // ============ Private Helper Methods ============

  /**
   * Internal batch categorization with retry logic
   */
  private async categorizeBatchInternal(
    transactions: Transaction[],
    categories: CategoryInfo[],
    context?: HistoricalContext
  ): Promise<CategorizationResult[]> {
    const prompt = this.buildPrompt(transactions, categories, context);

    const result = await RetryUtils.retry(
      async () => this.callOpenAI(prompt),
      {
        maxAttempts: 3,
        initialDelay: 2000,
        isRetryable: RetryUtils.isNetworkError
      }
    );

    // If response was truncated and batch is splittable, halve chunk size and retry
    if (result.truncated && transactions.length > 1) {
      this.chunkSize = Math.max(1, Math.ceil(transactions.length / 2));
      logger.warning(`AI response truncated, reducing chunk size to ${this.chunkSize} for remaining batches`);
      // Re-process this batch with the new smaller chunk size
      return this.categorizeBatch(transactions, categories, context);
    }

    const parsed = this.parseResponse(result.content, transactions, categories);
    logger.info(`Categorized ${parsed.length} transactions via AI`);

    return parsed;
  }

  /**
   * Build the prompt for OpenAI
   */
  private buildPrompt(
    transactions: Transaction[],
    categories: CategoryInfo[],
    context?: HistoricalContext
  ): string {
    const categoryList = categories.map(c =>
      `- ${c.name} (ID: ${c.id}): ${c.description}. Examples: ${c.examples}`
    ).join('\n');

    const transactionList = transactions.map(t => {
      let line = `- ID: ${t.id}, Description: "${t.description}", Amount: ${t.gbpAmountValue.toFixed(2)} GBP, Type: ${t.transactionType}`;
      if (t.originalCategory) {
        line += `, Bank Category: "${t.originalCategory}"`;
      }
      return line;
    }).join('\n');

    let contextSection = '';
    if (context?.similarTransactions && context.similarTransactions.length > 0) {
      const historicalExamples = context.similarTransactions.slice(0, 5).map(h =>
        `- "${h.description}" was categorized as "${h.categoryName}"${h.wasManualOverride ? ' (manual)' : ''}`
      ).join('\n');
      contextSection = `\n\nHistorical context (similar past transactions):\n${historicalExamples}`;
    }

    return `You are a financial transaction categorizer. Categorize each transaction into exactly one category.

Available categories:
${categoryList}
${contextSection}

Some transactions include a "Bank Category" — this is the original category assigned by the bank. It may be a useful hint, but do NOT blindly trust it. Banks use their own category schemes which may not match ours, and they are often inaccurate. Use the description and amount as your primary signals.

Transactions to categorize:
${transactionList}

Respond with a JSON object containing a "results" array. Each element must have:
- transactionId: the transaction ID
- categoryId: the category ID
- categoryName: the category name
- confidenceScore: your confidence (0-100)

Keep the response compact. Do NOT include reasoning or any extra fields.

Example response:
{"results": [{"transactionId": "abc123", "categoryId": "cat-1", "categoryName": "Groceries", "confidenceScore": 95}]}`;
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<OpenAIResult> {
    const url = 'https://api.openai.com/v1/chat/completions';

    const payload = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a precise financial transaction categorizer. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: this.temperature,
      max_completion_tokens: this.maxTokens,
      response_format: { type: 'json_object' }
    };

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      const errorBody = response.getContentText();
      throw new Error(`OpenAI API returned ${statusCode}: ${errorBody}`);
    }

    const data = JSON.parse(response.getContentText()) as OpenAIResponse;
    const choice = data.choices[0];
    const truncated = choice?.finish_reason === 'length';

    if (truncated) {
      logger.warning('OpenAI response was truncated due to max_completion_tokens limit');
    }

    return {
      content: choice?.message?.content || '',
      truncated
    };
  }

  /**
   * Parse AI response into categorization results
   */
  private parseResponse(
    response: string,
    transactions: Transaction[],
    categories: CategoryInfo[]
  ): CategorizationResult[] {
    const results: CategorizationResult[] = [];

    // Try to extract JSON from response
    let jsonContent = response.trim();

    // Handle responses wrapped in markdown code blocks
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    let parsed: ParsedCategorization[];
    try {
      const json = JSON.parse(jsonContent);
      parsed = Array.isArray(json) ? json : json.results;
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array and has no "results" array');
      }
    } catch (e) {
      logger.error(`Failed to parse AI response: ${response}`, e as Error);
      // Return uncategorized results
      return transactions.map(t => this.createFallbackResult(t, categories));
    }

    // Map parsed results back to transactions
    const transactionMap = new Map(transactions.map(t => [t.id, t]));
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    for (const item of parsed) {
      let transaction = transactionMap.get(item.transactionId);

      // LLMs occasionally hallucinate 1-2 characters in UUIDs. With batch sizes ≤10
      // and 32 hex-char UUIDs, a false positive match at edit distance ≤2 has probability
      // ≈ 9 × (32×15)² / 16^32 ≈ 0 — effectively impossible.
      if (!transaction) {
        const fuzzyMatch = this.findClosestTransactionId(item.transactionId, transactionMap);
        if (fuzzyMatch) {
          logger.warning(`AI returned hallucinated transaction ID: ${item.transactionId}, fuzzy-matched to ${fuzzyMatch.id}`);
          transaction = fuzzyMatch;
          item.transactionId = fuzzyMatch.id;
        } else {
          logger.warning(`AI returned unknown transaction ID: ${item.transactionId}`);
          continue;
        }
      }

      // Validate category exists
      const category = categoryMap.get(item.categoryId);
      if (!category) {
        logger.warning(`AI returned unknown category ID: ${item.categoryId}`);
        results.push(this.createFallbackResult(transaction, categories));
        continue;
      }

      results.push({
        transactionId: item.transactionId,
        categoryId: item.categoryId,
        categoryName: item.categoryName || category.name,
        confidenceScore: Math.min(100, Math.max(0, item.confidenceScore || 50)),
        reasoning: item.reasoning
      });

      transactionMap.delete(item.transactionId);
    }

    // Handle any transactions not in the response
    for (const [, transaction] of transactionMap) {
      logger.warning(`AI did not categorize transaction: ${transaction.id}`);
      results.push(this.createFallbackResult(transaction, categories));
    }

    return results;
  }

  /**
   * Find the closest transaction ID within edit distance 2.
   * Returns the matching transaction or undefined if no close match exists.
   */
  private findClosestTransactionId(
    hallucinated: string,
    transactionMap: Map<string, Transaction>
  ): Transaction | undefined {
    for (const [id, transaction] of transactionMap) {
      if (this.editDistance(hallucinated, id) <= 2) {
        return transaction;
      }
    }
    return undefined;
  }

  /**
   * Calculate Levenshtein edit distance between two strings.
   * Bails out early if distance exceeds maxDist.
   */
  private editDistance(a: string, b: string, maxDist: number = 2): number {
    if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let rowMin = i;
      const curr = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > maxDist) return maxDist + 1;
      prev.splice(0, prev.length, ...curr);
    }
    return prev[b.length];
  }

  /**
   * Create a fallback result when AI categorization fails
   */
  private createFallbackResult(
    transaction: Transaction,
    categories: CategoryInfo[]
  ): CategorizationResult {
    // Use "Other" or first category as fallback
    const fallback = categories.find(c => c.name.toLowerCase() === 'other') || categories[0];

    return {
      transactionId: transaction.id,
      categoryId: fallback?.id || 'unknown',
      categoryName: fallback?.name || 'Unknown',
      confidenceScore: 0,
      reasoning: 'AI categorization failed, using fallback'
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      if (typeof Utilities !== 'undefined' && Utilities.sleep) {
        Utilities.sleep(ms);
        resolve();
      } else {
        setTimeout(resolve, ms);
      }
    });
  }
}
