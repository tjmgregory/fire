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
  }>;
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
    if (transactions.length <= 10) {
      return this.categorizeBatchInternal(transactions, categories, context);
    }

    // For larger batches, chunk into groups of 10
    const results: CategorizationResult[] = [];
    const chunkSize = 10;

    for (let i = 0; i < transactions.length; i += chunkSize) {
      const chunk = transactions.slice(i, i + chunkSize);
      const chunkResults = await this.categorizeBatchInternal(chunk, categories, context);
      results.push(...chunkResults);

      // Small delay between chunks to avoid rate limiting
      if (i + chunkSize < transactions.length) {
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

    const response = await RetryUtils.retry(
      async () => this.callOpenAI(prompt),
      {
        maxAttempts: 3,
        initialDelay: 2000,
        isRetryable: RetryUtils.isNetworkError
      }
    );

    const parsed = this.parseResponse(response, transactions, categories);
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

    const transactionList = transactions.map(t =>
      `- ID: ${t.id}, Description: "${t.description}", Amount: ${t.gbpAmountValue.toFixed(2)} GBP, Type: ${t.transactionType}`
    ).join('\n');

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

Transactions to categorize:
${transactionList}

Respond in JSON format with an array of objects, each containing:
- transactionId: the transaction ID
- categoryId: the category ID
- categoryName: the category name
- confidenceScore: your confidence (0-100)
- reasoning: brief explanation (optional)

Example response:
[
  {"transactionId": "abc123", "categoryId": "cat-1", "categoryName": "Groceries", "confidenceScore": 95, "reasoning": "Tesco is a supermarket"}
]

Respond ONLY with the JSON array, no other text.`;
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
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
      max_tokens: this.maxTokens
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
    return data.choices[0]?.message?.content || '';
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
      parsed = JSON.parse(jsonContent);
    } catch (e) {
      logger.error(`Failed to parse AI response: ${response}`, e as Error);
      // Return uncategorized results
      return transactions.map(t => this.createFallbackResult(t, categories));
    }

    // Map parsed results back to transactions
    const transactionMap = new Map(transactions.map(t => [t.id, t]));
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    for (const item of parsed) {
      const transaction = transactionMap.get(item.transactionId);
      if (!transaction) {
        logger.warning(`AI returned unknown transaction ID: ${item.transactionId}`);
        continue;
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
