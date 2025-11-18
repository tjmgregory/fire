/**
 * Retry Utilities
 *
 * Implements exponential backoff retry logic for API calls.
 * Implements FR-009 (retry with exponential backoff).
 *
 * @module utils/RetryUtils
 */

import { logger } from '../infrastructure/logging/ErrorLogger';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 5)
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds (default: 2000ms)
   */
  initialDelay?: number;

  /**
   * Backoff multiplier (default: 2 for exponential backoff)
   */
  backoffMultiplier?: number;

  /**
   * Maximum delay in milliseconds (default: 32000ms)
   */
  maxDelay?: number;

  /**
   * Function to determine if error is retryable (default: all errors are retryable)
   */
  isRetryable?: (error: Error) => boolean;

  /**
   * Callback invoked before each retry attempt
   */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Default retry configuration per FR-009
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 5,
  initialDelay: 2000,      // 2 seconds
  backoffMultiplier: 2,
  maxDelay: 32000,         // 32 seconds
  isRetryable: () => true  // All errors are retryable by default
};

/**
 * Retry error thrown when all retry attempts are exhausted
 */
export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Retry Utilities
 *
 * Provides generic retry logic with exponential backoff for API calls.
 */
export class RetryUtils {
  /**
   * Execute a function with retry logic
   *
   * Implements exponential backoff:
   * - Attempt 1: immediate
   * - Attempt 2: 2s delay
   * - Attempt 3: 4s delay
   * - Attempt 4: 8s delay
   * - Attempt 5: 16s delay
   * - Attempt 6: 32s delay (if maxAttempts > 5)
   *
   * @param fn - Function to execute
   * @param options - Retry options
   * @returns Result from successful execution
   * @throws RetryExhaustedError if all attempts fail
   */
  static async retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        // First attempt has no delay
        if (attempt > 1) {
          const delay = this.calculateDelay(attempt - 1, config);

          // Log retry attempt
          logger.info(`Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms delay`);

          // Invoke callback if provided
          if (options.onRetry && lastError) {
            options.onRetry(attempt, lastError, delay);
          }

          // Wait before retrying
          await this.sleep(delay);
        }

        // Execute function
        const result = await fn();

        // Success - log if this wasn't first attempt
        if (attempt > 1) {
          logger.info(`Retry succeeded on attempt ${attempt}/${config.maxAttempts}`);
        }

        return result;

      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!config.isRetryable(lastError)) {
          logger.warning(`Error is not retryable: ${lastError.message}`);
          throw lastError;
        }

        // Log error
        logger.warning(
          `Attempt ${attempt}/${config.maxAttempts} failed: ${lastError.message}`,
          { attempt, maxAttempts: config.maxAttempts }
        );

        // If this was the last attempt, throw RetryExhaustedError
        if (attempt === config.maxAttempts) {
          const exhaustedError = new RetryExhaustedError(
            `All ${config.maxAttempts} retry attempts exhausted. Last error: ${lastError.message}`,
            config.maxAttempts,
            lastError
          );

          logger.error('Retry attempts exhausted', exhaustedError);
          throw exhaustedError;
        }
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new RetryExhaustedError(
      'Unexpected retry completion',
      config.maxAttempts,
      lastError || new Error('Unknown error')
    );
  }

  /**
   * Execute a synchronous function with retry logic
   *
   * @param fn - Function to execute
   * @param options - Retry options
   * @returns Result from successful execution
   * @throws RetryExhaustedError if all attempts fail
   */
  static retrySyncAsAsync<T>(
    fn: () => T,
    options: RetryOptions = {}
  ): Promise<T> {
    return this.retry(() => Promise.resolve(fn()), options);
  }

  /**
   * Calculate delay for a given attempt using exponential backoff
   *
   * Formula: min(initialDelay * (backoffMultiplier ^ (attempt - 1)), maxDelay)
   *
   * @param attempt - Attempt number (1-indexed)
   * @param config - Retry configuration
   * @returns Delay in milliseconds
   */
  private static calculateDelay(
    attempt: number,
    config: Required<Omit<RetryOptions, 'onRetry'>>
  ): number {
    const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Sleep for a specified duration
   *
   * @param ms - Duration in milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      // Use Utilities.sleep if available (Apps Script environment)
      if (typeof Utilities !== 'undefined' && Utilities.sleep) {
        Utilities.sleep(ms);
        resolve();
      } else {
        // Fallback to setTimeout for testing/Node.js
        setTimeout(resolve, ms);
      }
    });
  }

  /**
   * Check if an error is a network/API error (commonly retryable)
   *
   * @param error - Error to check
   * @returns True if error appears to be network/API related
   */
  static isNetworkError(error: Error): boolean {
    const networkPatterns = [
      /network/i,
      /timeout/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /rate limit/i,
      /429/,  // Too Many Requests
      /500/,  // Internal Server Error
      /502/,  // Bad Gateway
      /503/,  // Service Unavailable
      /504/   // Gateway Timeout
    ];

    const message = error.message || '';
    return networkPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Create a retryable function from a regular function
   *
   * @param fn - Function to wrap
   * @param options - Retry options
   * @returns Wrapped function with retry logic
   */
  static makeRetryable<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    options: RetryOptions = {}
  ): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => {
      return this.retry(() => fn(...args), options);
    };
  }
}
