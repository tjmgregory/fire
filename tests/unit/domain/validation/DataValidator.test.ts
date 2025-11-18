/**
 * DataValidator Tests
 *
 * Tests validation and sanitization logic from SAD 7.2.3 (Security Requirements)
 * Validates data integrity and security requirements for:
 * - FR-011: Data validation and sanitization
 * - UC-001: Import and Normalize Transactions
 * - UC-005: Execute Scheduled Normalization
 *
 * Security Requirements Tested:
 * - SR-01: Prevent formula injection in spreadsheet cells
 * - SR-02: Sanitize error messages to remove sensitive data
 * - SR-03: Validate all external input data
 * - SR-04: Prevent XSS attacks through input sanitization
 * - SR-05: Enforce data type and format constraints
 *
 * Business Rules Tested:
 * - BR-DV-01: All dates must be valid and parseable
 * - BR-DV-02: All amounts must be finite numbers
 * - BR-DV-03: Currency codes must be ISO 4217 format (3 letters)
 * - BR-DV-04: UUIDs must be valid RFC 4122 format
 * - BR-DV-05: Required strings must be non-empty
 * - BR-DV-06: Optional fields return null when empty
 */

import { describe, test, expect } from 'vitest';
import { DataValidator, ValidationError } from '../../../../src/apps-script/domain/validation/DataValidator';
import { CurrencyCode } from '../../../../src/apps-script/models/Transaction';

describe('DataValidator', () => {
  describe('validateDate - Date parsing (BR-DV-01)', () => {
    test('UC-005: Given valid Date object, when validated, then returns the date', () => {
      // Arrange
      const date = new Date('2025-11-15');

      // Act
      const result = DataValidator.validateDate(date, 'transactionDate');

      // Assert - BR-DV-01: Valid dates must be accepted
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString().split('T')[0]).toBe('2025-11-15');
    });

    test('UC-001: Given ISO 8601 date string, when validated, then parses correctly', () => {
      // Arrange
      const isoDate = '2025-11-15T14:30:00Z';

      // Act
      const result = DataValidator.validateDate(isoDate);

      // Assert
      expect(result).toBeInstanceOf(Date);
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
    });

    test('FR-011: Given DD/MM/YYYY format, when validated, then parses correctly', () => {
      // Arrange
      const ukDate = '15/11/2025';

      // Act
      const result = DataValidator.validateDate(ukDate);

      // Assert
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(10); // November (0-indexed)
      expect(result.getFullYear()).toBe(2025);
    });

    test('FR-011: Given DD-MM-YYYY format, when validated, then parses correctly', () => {
      // Arrange
      const dashedDate = '15-11-2025';

      // Act
      const result = DataValidator.validateDate(dashedDate);

      // Assert
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(10);
    });

    test('BR-DV-01: Given invalid Date object (NaN), when validated, then throws ValidationError', () => {
      // Arrange
      const invalidDate = new Date('invalid');

      // Act & Assert
      expect(() => DataValidator.validateDate(invalidDate, 'date'))
        .toThrow(ValidationError);
      expect(() => DataValidator.validateDate(invalidDate, 'date'))
        .toThrow('Invalid date');
    });

    test('SR-03: Given empty string, when validated, then throws ValidationError', () => {
      // Arrange
      const emptyString = '   ';

      // Act & Assert - SR-03: All external input must be validated
      expect(() => DataValidator.validateDate(emptyString))
        .toThrow(ValidationError);
      expect(() => DataValidator.validateDate(emptyString))
        .toThrow('must be a non-empty string or Date');
    });

    test('SR-03: Given non-date value, when validated, then throws ValidationError', () => {
      // Arrange
      const invalidValue = 12345;

      // Act & Assert
      expect(() => DataValidator.validateDate(invalidValue as unknown))
        .toThrow(ValidationError);
    });

    test('FR-011: Given invalid date string, when validated, then throws with helpful message', () => {
      // Arrange
      const invalidDateStr = 'not-a-date';

      // Act & Assert
      expect(() => DataValidator.validateDate(invalidDateStr, 'transactionDate'))
        .toThrow('transactionDate must be a valid date (ISO 8601 or DD/MM/YYYY)');
    });
  });

  describe('validateAmount - Numeric validation (BR-DV-02)', () => {
    test('UC-005: Given valid numeric amount, when validated, then returns the number', () => {
      // Arrange
      const amount = 123.45;

      // Act
      const result = DataValidator.validateAmount(amount);

      // Assert - BR-DV-02: Valid amounts must be finite numbers
      expect(result).toBe(123.45);
      expect(typeof result).toBe('number');
    });

    test('FR-011: Given numeric string, when validated, then parses to number', () => {
      // Arrange
      const stringAmount = '123.45';

      // Act
      const result = DataValidator.validateAmount(stringAmount);

      // Assert
      expect(result).toBe(123.45);
    });

    test('FR-011: Given formatted string with commas, when validated, then removes formatting', () => {
      // Arrange
      const formattedAmount = '1,234.56';

      // Act
      const result = DataValidator.validateAmount(formattedAmount);

      // Assert - Should strip commas
      expect(result).toBe(1234.56);
    });

    test('FR-011: Given amount with currency symbols, when validated, then removes symbols', () => {
      // Arrange
      const amounts = ['£123.45', '$123.45', '€123.45'];

      // Act & Assert
      amounts.forEach(amount => {
        const result = DataValidator.validateAmount(amount);
        expect(result).toBe(123.45);
      });
    });

    test('BR-DV-02: Given NaN, when validated, then throws ValidationError', () => {
      // Arrange
      const nanValue = NaN;

      // Act & Assert
      expect(() => DataValidator.validateAmount(nanValue))
        .toThrow(ValidationError);
      expect(() => DataValidator.validateAmount(nanValue))
        .toThrow('must be a finite number');
    });

    test('BR-DV-02: Given Infinity, when validated, then throws ValidationError', () => {
      // Arrange
      const infiniteValue = Infinity;

      // Act & Assert - BR-DV-02: Amounts must be finite
      expect(() => DataValidator.validateAmount(infiniteValue))
        .toThrow(ValidationError);
    });

    test('SR-03: Given non-numeric string, when validated, then throws ValidationError', () => {
      // Arrange
      const invalidString = 'not-a-number';

      // Act & Assert
      expect(() => DataValidator.validateAmount(invalidString, 'amount'))
        .toThrow('amount must be a valid number');
    });

    test('SR-03: Given null or undefined, when validated, then throws ValidationError', () => {
      // Act & Assert
      expect(() => DataValidator.validateAmount(null as unknown))
        .toThrow(ValidationError);
      expect(() => DataValidator.validateAmount(undefined as unknown))
        .toThrow(ValidationError);
    });
  });

  describe('validateRequiredString - String validation (BR-DV-05)', () => {
    test('UC-001: Given valid string, when validated, then returns trimmed string', () => {
      // Arrange
      const description = '  Tesco Metro  ';

      // Act
      const result = DataValidator.validateRequiredString(description, 'description');

      // Assert - BR-DV-05: Required strings must be non-empty
      expect(result).toBe('Tesco Metro');
    });

    test('FR-011: Given string with minimum length, when validated with minLength, then accepts', () => {
      // Arrange
      const value = 'ABC';

      // Act
      const result = DataValidator.validateRequiredString(value, 'code', 3);

      // Assert
      expect(result).toBe('ABC');
    });

    test('FR-011: Given string with maximum length, when validated with maxLength, then accepts', () => {
      // Arrange
      const value = 'ABCDE';

      // Act
      const result = DataValidator.validateRequiredString(value, 'code', 1, 5);

      // Assert
      expect(result).toBe('ABCDE');
    });

    test('BR-DV-05: Given string shorter than minLength, when validated, then throws ValidationError', () => {
      // Arrange
      const shortString = 'AB';

      // Act & Assert
      expect(() => DataValidator.validateRequiredString(shortString, 'code', 3))
        .toThrow('code must be at least 3 character(s)');
    });

    test('BR-DV-05: Given string longer than maxLength, when validated, then throws ValidationError', () => {
      // Arrange
      const longString = 'ABCDEFGHIJ';

      // Act & Assert
      expect(() => DataValidator.validateRequiredString(longString, 'code', 1, 5))
        .toThrow('code must be at most 5 character(s)');
    });

    test('SR-03: Given empty string, when validated, then throws ValidationError', () => {
      // Arrange
      const emptyString = '   ';

      // Act & Assert - SR-03: External input must be validated
      expect(() => DataValidator.validateRequiredString(emptyString, 'field'))
        .toThrow(ValidationError);
    });

    test('SR-03: Given non-string value, when validated, then throws ValidationError', () => {
      // Arrange
      const nonString = 12345;

      // Act & Assert
      expect(() => DataValidator.validateRequiredString(nonString as unknown, 'field'))
        .toThrow('field must be a string');
    });
  });

  describe('sanitizeString - Security sanitization (SR-01, SR-04)', () => {
    test('SR-01: Given string starting with =, when sanitized, then prefixes with quote', () => {
      // Arrange - Formula injection attempt
      const formulaInjection = '=1+1';

      // Act
      const result = DataValidator.sanitizeString(formulaInjection);

      // Assert - SR-01: Prevent formula injection
      expect(result).toBe("'=1+1");
    });

    test('SR-01: Given string starting with +, when sanitized, then prefixes with quote', () => {
      // Arrange
      const plusFormula = '+1+1';

      // Act
      const result = DataValidator.sanitizeString(plusFormula);

      // Assert
      expect(result).toBe("'+1+1");
    });

    test('SR-01: Given string starting with -, when sanitized, then prefixes with quote', () => {
      // Arrange
      const minusFormula = '-1+1';

      // Act
      const result = DataValidator.sanitizeString(minusFormula);

      // Assert
      expect(result).toBe("'-1+1");
    });

    test('SR-01: Given string starting with @, when sanitized, then prefixes with quote', () => {
      // Arrange
      const atFormula = '@SUM(A1:A10)';

      // Act
      const result = DataValidator.sanitizeString(atFormula);

      // Assert
      expect(result).toBe("'@SUM(A1:A10)");
    });

    test('SR-04: Given string with script tags, when sanitized, then removes script tags', () => {
      // Arrange - XSS attempt
      const xssAttempt = 'Hello<script>alert("xss")</script>World';

      // Act
      const result = DataValidator.sanitizeString(xssAttempt);

      // Assert - SR-04: Prevent XSS attacks
      expect(result).toBe('HelloWorld');
      expect(result).not.toContain('<script>');
    });

    test('SR-04: Given string with HTML tags, when sanitized, then removes HTML tags', () => {
      // Arrange
      const htmlString = '<div>Hello</div><span>World</span>';

      // Act
      const result = DataValidator.sanitizeString(htmlString);

      // Assert
      expect(result).toBe('HelloWorld');
    });

    test('UC-001: Given normal transaction description, when sanitized, then returns unchanged', () => {
      // Arrange
      const normalDescription = 'Tesco Metro';

      // Act
      const result = DataValidator.sanitizeString(normalDescription);

      // Assert
      expect(result).toBe('Tesco Metro');
    });

    test('FR-011: Given non-string value, when sanitized, then converts to string', () => {
      // Arrange
      const numberValue = 12345;

      // Act
      const result = DataValidator.sanitizeString(numberValue as unknown as string);

      // Assert
      expect(result).toBe('12345');
    });
  });

  describe('sanitizeErrorMessage - Security sanitization (SR-02)', () => {
    test('SR-02: Given error with API key, when sanitized, then masks API key', () => {
      // Arrange
      const errorMessage = 'API request failed with api_key=abc123xyz';

      // Act
      const result = DataValidator.sanitizeErrorMessage(errorMessage);

      // Assert - SR-02: Sanitize error messages to remove sensitive data
      expect(result).toContain('api_key=***');
      expect(result).not.toContain('abc123xyz');
    });

    test('SR-02: Given error with token, when sanitized, then masks token', () => {
      // Arrange
      const errorMessage = 'Authentication failed: token=secret123';

      // Act
      const result = DataValidator.sanitizeErrorMessage(errorMessage);

      // Assert
      expect(result).toContain('token=***');
      expect(result).not.toContain('secret123');
    });

    test('SR-02: Given error with URL credentials, when sanitized, then masks credentials', () => {
      // Arrange
      const errorMessage = 'Failed to connect to https://user:password@example.com';

      // Act
      const result = DataValidator.sanitizeErrorMessage(errorMessage);

      // Assert
      expect(result).toContain('https://***:***@');
      expect(result).not.toContain('user:password');
    });

    test('SR-02: Given error with email address, when sanitized, then masks email', () => {
      // Arrange
      const errorMessage = 'User john.doe@example.com not found';

      // Act
      const result = DataValidator.sanitizeErrorMessage(errorMessage);

      // Assert
      expect(result).toContain('***@***');
      expect(result).not.toContain('john.doe@example.com');
    });

    test('SR-02: Given error with password, when sanitized, then masks password', () => {
      // Arrange
      const errorMessage = 'Login failed: password="mySecret123"';

      // Act
      const result = DataValidator.sanitizeErrorMessage(errorMessage);

      // Assert
      expect(result).toContain('password=***');
      expect(result).not.toContain('mySecret123');
    });

    test('UC-005: Given benign error message, when sanitized, then returns unchanged', () => {
      // Arrange
      const errorMessage = 'Transaction validation failed: amount is required';

      // Act
      const result = DataValidator.sanitizeErrorMessage(errorMessage);

      // Assert
      expect(result).toBe(errorMessage);
    });
  });

  describe('validateCurrencyCode - Currency validation (BR-DV-03)', () => {
    test('UC-001: Given valid 3-letter currency code, when validated, then returns uppercase code', () => {
      // Arrange
      const currencyCode = 'gbp';

      // Act
      const result = DataValidator.validateCurrencyCode(currencyCode);

      // Assert - BR-DV-03: Currency codes must be ISO 4217 format
      expect(result).toBe('GBP');
    });

    test('FR-011: Given uppercase currency code, when validated, then returns as-is', () => {
      // Arrange
      const currencyCode = 'USD';

      // Act
      const result = DataValidator.validateCurrencyCode(currencyCode);

      // Assert
      expect(result).toBe('USD');
    });

    test('FR-011: Given currency code with whitespace, when validated, then trims and validates', () => {
      // Arrange
      const currencyCode = '  EUR  ';

      // Act
      const result = DataValidator.validateCurrencyCode(currencyCode);

      // Assert
      expect(result).toBe('EUR');
    });

    test('BR-DV-03: Given 2-letter code, when validated, then throws ValidationError', () => {
      // Arrange
      const invalidCode = 'US';

      // Act & Assert
      expect(() => DataValidator.validateCurrencyCode(invalidCode))
        .toThrow('must be a valid 3-letter currency code');
    });

    test('BR-DV-03: Given 4-letter code, when validated, then throws ValidationError', () => {
      // Arrange
      const invalidCode = 'USDD';

      // Act & Assert
      expect(() => DataValidator.validateCurrencyCode(invalidCode))
        .toThrow('must be a valid 3-letter currency code');
    });

    test('BR-DV-03: Given numeric code, when validated, then throws ValidationError', () => {
      // Arrange
      const numericCode = '123';

      // Act & Assert - ISO 4217 codes are letters only
      expect(() => DataValidator.validateCurrencyCode(numericCode))
        .toThrow('must be a valid 3-letter currency code');
    });

    test('SR-03: Given non-string value, when validated, then throws ValidationError', () => {
      // Arrange
      const nonString = 123;

      // Act & Assert
      expect(() => DataValidator.validateCurrencyCode(nonString as unknown))
        .toThrow('currency must be a string');
    });
  });

  describe('validateUUID - UUID validation (BR-DV-04)', () => {
    test('UC-001: Given valid UUID v4, when validated, then returns lowercase UUID', () => {
      // Arrange
      const uuid = '123E4567-E89B-12D3-A456-426614174000';

      // Act
      const result = DataValidator.validateUUID(uuid);

      // Assert - BR-DV-04: UUIDs must be valid RFC 4122 format
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    test('FR-011: Given lowercase UUID, when validated, then returns as lowercase', () => {
      // Arrange
      const uuid = '123e4567-e89b-12d3-a456-426614174000';

      // Act
      const result = DataValidator.validateUUID(uuid);

      // Assert
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    test('FR-011: Given UUID with whitespace, when validated, then trims and validates', () => {
      // Arrange
      const uuid = '  123e4567-e89b-12d3-a456-426614174000  ';

      // Act
      const result = DataValidator.validateUUID(uuid);

      // Assert
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    test('BR-DV-04: Given invalid UUID format, when validated, then throws ValidationError', () => {
      // Arrange
      const invalidUUID = '123-456-789';

      // Act & Assert
      expect(() => DataValidator.validateUUID(invalidUUID, 'transactionId'))
        .toThrow('transactionId must be a valid UUID');
    });

    test('BR-DV-04: Given UUID with invalid characters, when validated, then throws ValidationError', () => {
      // Arrange
      const invalidUUID = '123e4567-e89b-12d3-a456-42661417400g'; // 'g' is invalid

      // Act & Assert
      expect(() => DataValidator.validateUUID(invalidUUID))
        .toThrow('must be a valid UUID');
    });

    test('SR-03: Given non-string value, when validated, then throws ValidationError', () => {
      // Arrange
      const nonString = 12345;

      // Act & Assert
      expect(() => DataValidator.validateUUID(nonString as unknown))
        .toThrow('id must be a string');
    });
  });

  describe('validateOptional - Optional field handling (BR-DV-06)', () => {
    test('UC-001: Given null value, when validated, then returns null', () => {
      // Arrange
      const nullValue = null;

      // Act
      const result = DataValidator.validateOptional(
        nullValue,
        (v) => DataValidator.validateRequiredString(v, 'notes')
      );

      // Assert - BR-DV-06: Optional fields return null when empty
      expect(result).toBeNull();
    });

    test('UC-001: Given undefined value, when validated, then returns null', () => {
      // Arrange
      const undefinedValue = undefined;

      // Act
      const result = DataValidator.validateOptional(
        undefinedValue,
        (v) => DataValidator.validateRequiredString(v, 'country')
      );

      // Assert
      expect(result).toBeNull();
    });

    test('BR-DV-06: Given empty string, when validated, then returns null', () => {
      // Arrange
      const emptyString = '   ';

      // Act
      const result = DataValidator.validateOptional(
        emptyString,
        (v) => DataValidator.validateRequiredString(v, 'notes')
      );

      // Assert
      expect(result).toBeNull();
    });

    test('UC-001: Given valid value, when validated, then applies validator function', () => {
      // Arrange
      const validValue = 'Some notes';

      // Act
      const result = DataValidator.validateOptional(
        validValue,
        (v) => DataValidator.validateRequiredString(v, 'notes')
      );

      // Assert
      expect(result).toBe('Some notes');
    });

    test('FR-011: Given invalid value, when validated, then throws from validator', () => {
      // Arrange
      const invalidValue = 'AB'; // Too short

      // Act & Assert
      expect(() => DataValidator.validateOptional(
        invalidValue,
        (v) => DataValidator.validateRequiredString(v, 'code', 3)
      )).toThrow('code must be at least 3 character(s)');
    });
  });

  describe('validateEnum - Enum validation (SR-05)', () => {
    test('UC-001: Given valid enum value, when validated, then returns uppercase value', () => {
      // Arrange
      const value = 'gbp';

      // Act
      const result = DataValidator.validateEnum(value, CurrencyCode, 'currency');

      // Assert - SR-05: Enforce data type and format constraints
      expect(result).toBe('GBP');
    });

    test('FR-011: Given uppercase enum value, when validated, then returns value', () => {
      // Arrange
      const value = 'USD';

      // Act
      const result = DataValidator.validateEnum(value, CurrencyCode, 'currency');

      // Assert
      expect(result).toBe('USD');
    });

    test('FR-011: Given enum value with whitespace, when validated, then trims and validates', () => {
      // Arrange
      const value = '  EUR  ';

      // Act
      const result = DataValidator.validateEnum(value, CurrencyCode, 'currency');

      // Assert
      expect(result).toBe('EUR');
    });

    test('SR-05: Given invalid enum value, when validated, then throws with valid options', () => {
      // Arrange
      const invalidValue = 'INVALID';

      // Act & Assert
      expect(() => DataValidator.validateEnum(invalidValue, CurrencyCode, 'currency'))
        .toThrow('currency must be one of:');
    });

    test('SR-03: Given non-string value, when validated, then throws ValidationError', () => {
      // Arrange
      const nonString = 123;

      // Act & Assert
      expect(() => DataValidator.validateEnum(nonString as unknown, CurrencyCode, 'currency'))
        .toThrow('currency must be a string');
    });
  });

  describe('ValidationError - Error structure', () => {
    test('FR-011: Given validation error, when constructed, then includes field and value', () => {
      // Arrange & Act
      const error = new ValidationError('Test error', 'testField', 'testValue');

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Test error');
      expect(error.field).toBe('testField');
      expect(error.value).toBe('testValue');
      expect(error.name).toBe('ValidationError');
    });
  });
});
