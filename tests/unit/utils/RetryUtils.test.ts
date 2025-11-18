/**
 * RetryUtils Tests
 *
 * Tests exponential backoff retry logic per FR-009
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { RetryUtils, RetryExhaustedError } from '../../../src/apps-script/utils/RetryUtils';

describe('RetryUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('retry', () => {
    test('Given successful function on first attempt, when retried, then executes once and returns result', async () => {
      // Arrange
      const successFn = vi.fn().mockResolvedValue('success');

      // Act
      const result = await RetryUtils.retry(successFn);

      // Assert
      expect(result).toBe('success');
      expect(successFn).toHaveBeenCalledTimes(1);
    });

    test('Given function fails once then succeeds, when retried, then retries and returns result', async () => {
      // Arrange
      const failOnceFn = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValue('success on retry');

      // Act
      const result = await RetryUtils.retry(failOnceFn);

      // Assert
      expect(result).toBe('success on retry');
      expect(failOnceFn).toHaveBeenCalledTimes(2);
    });

    test('Given function fails all attempts, when retried, then throws RetryExhaustedError', async () => {
      // Arrange
      const alwaysFailFn = vi.fn().mockRejectedValue(new Error('Always fails'));

      // Act & Assert
      await expect(RetryUtils.retry(alwaysFailFn, { maxAttempts: 3 }))
        .rejects.toThrow(RetryExhaustedError);

      expect(alwaysFailFn).toHaveBeenCalledTimes(3);
    });

    test('Given function fails 4 times then succeeds, when retried with 5 attempts, then eventually succeeds', async () => {
      // Arrange
      let attempts = 0;
      const failFourTimesFn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 5) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return 'success on attempt 5';
      });

      // Act
      const result = await RetryUtils.retry(failFourTimesFn, { maxAttempts: 5 });

      // Assert
      expect(result).toBe('success on attempt 5');
      expect(failFourTimesFn).toHaveBeenCalledTimes(5);
    });

    test('Given non-retryable error, when retried with isRetryable filter, then fails immediately', async () => {
      // Arrange
      const nonRetryableError = new Error('Non-retryable error');
      const failFn = vi.fn().mockRejectedValue(nonRetryableError);
      const isRetryable = () => false;

      // Act & Assert
      await expect(RetryUtils.retry(failFn, { maxAttempts: 5, isRetryable }))
        .rejects.toThrow('Non-retryable error');

      expect(failFn).toHaveBeenCalledTimes(1); // Only called once
    });

    test('Given retryable error, when retried with isRetryable filter, then retries until exhausted', async () => {
      // Arrange
      const retryableError = new Error('Rate limit exceeded');
      const failFn = vi.fn().mockRejectedValue(retryableError);
      const isRetryable = (error: Error) => error.message.includes('Rate limit');

      // Act & Assert
      await expect(RetryUtils.retry(failFn, { maxAttempts: 3, isRetryable }))
        .rejects.toThrow(RetryExhaustedError);

      expect(failFn).toHaveBeenCalledTimes(3);
    });

    test('Given onRetry callback, when retry occurs, then callback is invoked with attempt info', async () => {
      // Arrange
      const onRetry = vi.fn();
      const failOnceFn = vi.fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValue('success');

      // Act
      await RetryUtils.retry(failOnceFn, { onRetry });

      // Assert
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        2, // Attempt number
        expect.any(Error), // The error
        expect.any(Number) // Delay in ms
      );
    });
  });

  describe('retrySyncAsAsync', () => {
    test('Given synchronous function, when retried, then wraps in Promise and executes', async () => {
      // Arrange
      const syncFn = vi.fn().mockReturnValue('sync result');

      // Act
      const result = await RetryUtils.retrySyncAsAsync(syncFn);

      // Assert
      expect(result).toBe('sync result');
      expect(syncFn).toHaveBeenCalledTimes(1);
    });

    test('Given synchronous function that throws, when retried, then retries until exhausted', async () => {
      // Arrange
      const syncFailFn = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });

      // Act & Assert
      await expect(RetryUtils.retrySyncAsAsync(syncFailFn, { maxAttempts: 3 }))
        .rejects.toThrow(RetryExhaustedError);

      expect(syncFailFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('isNetworkError', () => {
    test('Given network timeout error, when checked, then returns true', () => {
      // Arrange
      const error = new Error('Request timeout after 30s');

      // Act
      const result = RetryUtils.isNetworkError(error);

      // Assert
      expect(result).toBe(true);
    });

    test('Given ECONNREFUSED error, when checked, then returns true', () => {
      // Arrange
      const error = new Error('ECONNREFUSED: Connection refused');

      // Act
      const result = RetryUtils.isNetworkError(error);

      // Assert
      expect(result).toBe(true);
    });

    test('Given 429 rate limit error, when checked, then returns true', () => {
      // Arrange
      const error = new Error('HTTP 429: Too Many Requests');

      // Act
      const result = RetryUtils.isNetworkError(error);

      // Assert
      expect(result).toBe(true);
    });

    test('Given 500 server error, when checked, then returns true', () => {
      // Arrange
      const error = new Error('HTTP 500: Internal Server Error');

      // Act
      const result = RetryUtils.isNetworkError(error);

      // Assert
      expect(result).toBe(true);
    });

    test('Given validation error, when checked, then returns false', () => {
      // Arrange
      const error = new Error('Validation failed: amount must be positive');

      // Act
      const result = RetryUtils.isNetworkError(error);

      // Assert
      expect(result).toBe(false);
    });

    test('Given business logic error, when checked, then returns false', () => {
      // Arrange
      const error = new Error('Transaction already exists');

      // Act
      const result = RetryUtils.isNetworkError(error);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('makeRetryable', () => {
    test('Given regular async function, when wrapped with makeRetryable, then returns retryable version', async () => {
      // Arrange
      const regularFn = vi.fn().mockResolvedValue('result');
      const retryableFn = RetryUtils.makeRetryable(regularFn);

      // Act
      const result = await retryableFn();

      // Assert
      expect(result).toBe('result');
      expect(regularFn).toHaveBeenCalledTimes(1);
    });

    test('Given function with arguments, when wrapped and called, then preserves arguments', async () => {
      // Arrange
      const fnWithArgs = vi.fn().mockImplementation(async (a: number, b: string) => {
        return `${a}-${b}`;
      });
      const retryableFn = RetryUtils.makeRetryable(fnWithArgs);

      // Act
      const result = await retryableFn(42, 'test');

      // Assert
      expect(result).toBe('42-test');
      expect(fnWithArgs).toHaveBeenCalledWith(42, 'test');
    });

    test('Given function that fails then succeeds, when wrapped and called, then retries automatically', async () => {
      // Arrange
      const unstableFn = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');
      const retryableFn = RetryUtils.makeRetryable(unstableFn);

      // Act
      const result = await retryableFn();

      // Assert
      expect(result).toBe('success');
      expect(unstableFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('RetryExhaustedError', () => {
    test('Given retry exhausted, when error created, then contains attempt count and last error', () => {
      // Arrange
      const lastError = new Error('Final attempt failed');

      // Act
      const error = new RetryExhaustedError('All retries failed', 5, lastError);

      // Assert
      expect(error.message).toBe('All retries failed');
      expect(error.attempts).toBe(5);
      expect(error.lastError).toBe(lastError);
      expect(error.name).toBe('RetryExhaustedError');
    });
  });
});
