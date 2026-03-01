/**
 * Logger Utility
 *
 * Simple logging utility for Google Apps Script environment.
 * Satisfies FR-008: Error Handling and Logging.
 *
 * @module utils/Logger
 */

/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

/**
 * Logger interface for Google Apps Script
 *
 * Provides structured logging with context and different log levels.
 * In Apps Script environment, uses Logger.log() and console methods.
 */
export class Logger {
  /**
   * Log debug message
   *
   * @param message - Log message
   * @param context - Optional context object
   */
  static debug(message: string, context?: Record<string, unknown>): void {
    Logger.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   *
   * @param message - Log message
   * @param context - Optional context object
   */
  static info(message: string, context?: Record<string, unknown>): void {
    Logger.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   *
   * @param message - Log message
   * @param context - Optional context object
   */
  static warning(message: string, context?: Record<string, unknown>): void {
    Logger.log(LogLevel.WARNING, message, context);
  }

  /**
   * Log error message
   *
   * @param message - Error message
   * @param error - Error object or context
   */
  static error(message: string, error?: Error | Record<string, unknown>): void {
    const context = error instanceof Error
      ? {
          error: error.message,
          stack: error.stack
        }
      : error;

    Logger.log(LogLevel.ERROR, message, context);
  }

  /**
   * Internal log method
   *
   * @param level - Log level
   * @param message - Log message
   * @param context - Optional context object
   */
  private static log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? JSON.stringify(context) : '';

    const logMessage = contextStr
      ? `[${timestamp}] [${level}] ${message} ${contextStr}`
      : `[${timestamp}] [${level}] ${message}`;

    // Use console.log for all levels — Google Apps Script only supports console.log
    if (typeof console !== 'undefined') {
      console.log(logMessage);
    }

    // Note: Google Apps Script Logger would be used here in production
    // but is not available in test environment
  }
}
