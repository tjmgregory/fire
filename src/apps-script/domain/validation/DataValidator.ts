/**
 * Data Validator
 *
 * Validates and sanitizes input data for security and data integrity.
 * Implements FR-011 (data validation) and security requirements from SAD 7.2.3.
 *
 * @module domain/validation/DataValidator
 */

/**
 * Validation error with details about what failed
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Data Validator
 *
 * Provides validation and sanitization methods for transaction data.
 */
export class DataValidator {
  /**
   * Validate and parse a date string
   *
   * Accepts:
   * - ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
   * - Common date formats (DD/MM/YYYY, MM/DD/YYYY)
   * - Date objects
   *
   * @param value - Date value to validate
   * @param fieldName - Field name for error messages
   * @returns Parsed Date object
   * @throws ValidationError if date is invalid
   */
  static validateDate(value: unknown, fieldName: string = 'date'): Date {
    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        throw new ValidationError(`Invalid ${fieldName}`, fieldName, value);
      }
      return value;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ValidationError(`${fieldName} must be a non-empty string or Date`, fieldName, value);
    }

    const trimmed = value.trim();

    // Try parsing as ISO 8601
    const isoDate = new Date(trimmed);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try common formats: DD/MM/YYYY, DD-MM-YYYY
    const ddmmyyyy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
    const match = trimmed.match(ddmmyyyy);
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    throw new ValidationError(
      `${fieldName} must be a valid date (ISO 8601 or DD/MM/YYYY)`,
      fieldName,
      value
    );
  }

  /**
   * Validate and parse a numeric amount
   *
   * @param value - Amount value to validate
   * @param fieldName - Field name for error messages
   * @returns Parsed number
   * @throws ValidationError if amount is invalid
   */
  static validateAmount(value: unknown, fieldName: string = 'amount'): number {
    if (typeof value === 'number') {
      if (isNaN(value) || !isFinite(value)) {
        throw new ValidationError(`${fieldName} must be a finite number`, fieldName, value);
      }
      return value;
    }

    if (typeof value === 'string') {
      // Remove common formatting (commas, currency symbols)
      const cleaned = value.trim().replace(/[,£$€]/g, '');
      const parsed = parseFloat(cleaned);

      if (isNaN(parsed) || !isFinite(parsed)) {
        throw new ValidationError(`${fieldName} must be a valid number`, fieldName, value);
      }

      return parsed;
    }

    throw new ValidationError(`${fieldName} must be a number or numeric string`, fieldName, value);
  }

  /**
   * Validate a required string field
   *
   * @param value - String value to validate
   * @param fieldName - Field name for error messages
   * @param minLength - Minimum length (default: 1)
   * @param maxLength - Maximum length (optional)
   * @returns Trimmed string
   * @throws ValidationError if string is invalid
   */
  static validateRequiredString(
    value: unknown,
    fieldName: string,
    minLength: number = 1,
    maxLength?: number
  ): string {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName, value);
    }

    const trimmed = value.trim();

    if (trimmed.length < minLength) {
      throw new ValidationError(
        `${fieldName} must be at least ${minLength} character(s)`,
        fieldName,
        value
      );
    }

    if (maxLength !== undefined && trimmed.length > maxLength) {
      throw new ValidationError(
        `${fieldName} must be at most ${maxLength} character(s)`,
        fieldName,
        value
      );
    }

    return trimmed;
  }

  /**
   * Sanitize string input to prevent injection attacks
   *
   * Removes or escapes potentially dangerous characters:
   * - Formula injection (=, +, -, @)
   * - Script tags
   * - SQL injection patterns
   *
   * @param value - String to sanitize
   * @returns Sanitized string
   */
  static sanitizeString(value: string): string {
    if (typeof value !== 'string') {
      return String(value);
    }

    let sanitized = value.trim();

    // Prevent formula injection in spreadsheets
    // If starts with =, +, -, @ then prefix with single quote
    if (/^[=+\-@]/.test(sanitized)) {
      sanitized = "'" + sanitized;
    }

    // Remove script tags (basic XSS prevention)
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');

    // Remove other potentially dangerous HTML
    sanitized = sanitized.replace(/<[^>]+>/g, '');

    return sanitized;
  }

  /**
   * Sanitize error message to remove sensitive data
   *
   * Removes:
   * - API keys (patterns like "key:", "token:", etc.)
   * - URLs with credentials
   * - Email addresses
   *
   * @param message - Error message to sanitize
   * @returns Sanitized message
   */
  static sanitizeErrorMessage(message: string): string {
    if (typeof message !== 'string') {
      return String(message);
    }

    let sanitized = message;

    // Remove API keys (common patterns)
    sanitized = sanitized.replace(/\b(api[_-]?key|token|secret|password|auth)[:\s=]["']?[\w-]+["']?/gi, '$1=***');

    // Remove URLs with credentials
    sanitized = sanitized.replace(/https?:\/\/[^:]+:[^@]+@/gi, 'https://***:***@');

    // Remove email addresses
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***');

    return sanitized;
  }

  /**
   * Validate currency code (ISO 4217)
   *
   * @param value - Currency code to validate
   * @param fieldName - Field name for error messages
   * @returns Uppercase currency code
   * @throws ValidationError if currency code is invalid
   */
  static validateCurrencyCode(value: unknown, fieldName: string = 'currency'): string {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName, value);
    }

    const code = value.trim().toUpperCase();

    // ISO 4217 currency codes are exactly 3 letters
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new ValidationError(
        `${fieldName} must be a valid 3-letter currency code`,
        fieldName,
        value
      );
    }

    return code;
  }

  /**
   * Validate UUID format
   *
   * @param value - UUID to validate
   * @param fieldName - Field name for error messages
   * @returns Lowercase UUID
   * @throws ValidationError if UUID is invalid
   */
  static validateUUID(value: unknown, fieldName: string = 'id'): string {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName, value);
    }

    const trimmed = value.trim().toLowerCase();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    if (!uuidRegex.test(trimmed)) {
      throw new ValidationError(
        `${fieldName} must be a valid UUID`,
        fieldName,
        value
      );
    }

    return trimmed;
  }

  /**
   * Validate an optional field
   *
   * If value is null/undefined/empty, returns null.
   * Otherwise validates using the provided validator function.
   *
   * @param value - Value to validate
   * @param validator - Validation function
   * @returns Validated value or null
   */
  static validateOptional<T>(
    value: unknown,
    validator: (value: unknown) => T
  ): T | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      return null;
    }

    return validator(value);
  }

  /**
   * Validate enum value
   *
   * @param value - Value to validate
   * @param enumObject - Enum object to validate against
   * @param fieldName - Field name for error messages
   * @returns Validated enum value
   * @throws ValidationError if value is not in enum
   */
  static validateEnum<T extends Record<string, string>>(
    value: unknown,
    enumObject: T,
    fieldName: string
  ): T[keyof T] {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName, value);
    }

    const upperValue = value.trim().toUpperCase();
    const validValues = Object.values(enumObject);

    if (!validValues.includes(upperValue as T[keyof T])) {
      throw new ValidationError(
        `${fieldName} must be one of: ${validValues.join(', ')}`,
        fieldName,
        value
      );
    }

    return upperValue as T[keyof T];
  }
}
