/**
 * Error Logger
 *
 * Centralized error logging with sanitization and multiple output targets.
 * Implements FR-008 (error logging and auditability).
 *
 * @module infrastructure/logging/ErrorLogger
 */

import { DataValidator } from '../../domain/validation/DataValidator';
import { Transaction } from '../../models/Transaction';

/**
 * Log level severity
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  transactionId?: string;
  stackTrace?: string;
}

/**
 * Error Logger
 *
 * Provides centralized logging with automatic sanitization and multiple outputs.
 */
export class ErrorLogger {
  private static instance: ErrorLogger;
  private logs: LogEntry[] = [];

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Log a debug message
   *
   * @param message - Debug message
   * @param context - Additional context
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   *
   * @param message - Info message
   * @param context - Additional context
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning
   *
   * @param message - Warning message
   * @param context - Additional context
   */
  warning(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARNING, message, context);
  }

  /**
   * Log an error
   *
   * @param message - Error message
   * @param error - Error object (optional)
   * @param context - Additional context
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log a critical error
   *
   * @param message - Critical error message
   * @param error - Error object (optional)
   * @param context - Additional context
   */
  critical(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  /**
   * Log an error with transaction context
   *
   * @param message - Error message
   * @param transaction - Transaction that caused the error
   * @param error - Error object (optional)
   */
  errorWithTransaction(message: string, transaction: Transaction, error?: Error): void {
    const context = {
      transactionId: transaction.id,
      bankSource: transaction.bankSourceId,
      description: transaction.description,
      amount: transaction.originalAmountValue,
      currency: transaction.originalAmountCurrency,
      status: transaction.processingStatus
    };

    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message: DataValidator.sanitizeErrorMessage(message),
      context,
      error,
      transactionId: transaction.id,
      stackTrace: error?.stack
    };

    this.addEntry(entry);
  }

  /**
   * Core logging method
   *
   * @param level - Log level
   * @param message - Log message
   * @param context - Additional context
   * @param error - Error object
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message: DataValidator.sanitizeErrorMessage(message),
      context: context ? this.sanitizeContext(context) : undefined,
      error,
      stackTrace: error?.stack
    };

    this.addEntry(entry);
  }

  /**
   * Add log entry and write to outputs
   *
   * @param entry - Log entry to add
   */
  private addEntry(entry: LogEntry): void {
    this.logs.push(entry);

    // Write to Google Apps Script Logger
    this.writeToConsole(entry);

    // For errors and critical, also write to sheet (if available)
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.CRITICAL) {
      this.writeToSheet(entry);
    }
  }

  /**
   * Write log entry to console/Apps Script Logger
   *
   * @param entry - Log entry
   */
  private writeToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const contextStr = entry.context ? JSON.stringify(entry.context) : '';
    const errorStr = entry.error ? `\nError: ${entry.error.message}` : '';
    const stackStr = entry.stackTrace ? `\nStack: ${entry.stackTrace}` : '';

    const logMessage = `[${timestamp}] [${entry.level}] ${entry.message}${contextStr}${errorStr}${stackStr}`;

    // Use Google Apps Script Logger if available
    if (typeof Logger !== 'undefined') {
      Logger.log(logMessage);
    } else {
      // Fallback to console for testing
      console.log(logMessage);
    }
  }

  /**
   * Write error to Result Sheet error column
   *
   * @param entry - Log entry
   */
  private writeToSheet(entry: LogEntry): void {
    try {
      // Only write transaction-specific errors to sheet
      if (!entry.transactionId) {
        return;
      }

      // This would be implemented by SheetDataPort in real usage
      // For now, just log that we would write to sheet
      if (typeof Logger !== 'undefined') {
        Logger.log(`Would write error to sheet for transaction ${entry.transactionId}`);
      }
    } catch (error) {
      // Don't throw if sheet write fails - log to console instead
      console.error('Failed to write error to sheet:', error);
    }
  }

  /**
   * Sanitize context object to remove sensitive data
   *
   * @param context - Context object
   * @returns Sanitized context
   */
  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      // Sanitize string values
      if (typeof value === 'string') {
        sanitized[key] = DataValidator.sanitizeErrorMessage(value);
      }
      // Redact sensitive keys
      else if (this.isSensitiveKey(key)) {
        sanitized[key] = '***';
      }
      // Copy other values as-is (numbers, booleans, etc.)
      else if (typeof value !== 'object') {
        sanitized[key] = value;
      }
      // For objects, recursively sanitize
      else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeContext(value as Record<string, unknown>);
      }
    }

    return sanitized;
  }

  /**
   * Check if a key name suggests sensitive data
   *
   * @param key - Key name
   * @returns True if key is sensitive
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /api[_-]?key/i,
      /token/i,
      /secret/i,
      /password/i,
      /auth/i,
      /credential/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(key));
  }

  /**
   * Get all log entries
   *
   * @param level - Filter by log level (optional)
   * @returns Array of log entries
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(entry => entry.level === level);
    }
    return [...this.logs];
  }

  /**
   * Get error count by level
   *
   * @returns Map of level to count
   */
  getErrorCounts(): Map<LogLevel, number> {
    const counts = new Map<LogLevel, number>();

    for (const entry of this.logs) {
      counts.set(entry.level, (counts.get(entry.level) || 0) + 1);
    }

    return counts;
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON string
   *
   * @param level - Filter by log level (optional)
   * @returns JSON string of logs
   */
  exportLogs(level?: LogLevel): string {
    const logs = this.getLogs(level);
    return JSON.stringify(logs, null, 2);
  }
}

/**
 * Global logger instance
 */
export const logger = ErrorLogger.getInstance();
