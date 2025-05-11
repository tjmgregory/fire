# Logging and Error Handling Improvement Plan

## Architecture Overview
This plan implements the logging and error handling strategy defined in ADR 006. The current implementation has several issues:

1. Duplicate logging - Both `console.error` and `utils.logError` are often called together
2. Error propagation - Some errors are being thrown after logging, potentially causing script termination
3. Inconsistent error handling patterns - Some functions have try/catch blocks, others throw directly
4. Validation logic often uses unnecessary else clauses
5. No standardized approach to general application logging
6. Lack of log levels for differentiating information types

## Technical Components
1. **Logger Class**: A centralized logging system that will:
   - Handle both general application logging and error reporting
   - Log errors with stack traces
   - Provide consistent logging patterns
   - Support different severity levels (FATAL, ERROR, WARNING, INFO, DEBUG)
   - Prevent unnecessary script termination
   - Add context to messages
   - Format logs consistently

2. **Logging Improvements**:
   - Consolidate duplicate logging
   - Add severity levels
   - Ensure all error logs include stack traces
   - Add color coding to log entries by severity
   - Standardize log format
   - Enable filtering by log level

3. **Guard Clause Implementation**:
   - Use early returns for validation failures
   - Simplify conditional logic
   - Reduce nesting in code

## Implementation Steps

1. [x] Document logging and error handling approach in ADR 006
   - [x] Define logging and error handling requirements
   - [x] Outline technical components
   - [x] Document consequences and implementation notes

2. [ ] Create a new Logger class in logger.gs
   - [ ] Implement severity level constants (FATAL, ERROR, WARNING, INFO, DEBUG)
   - [ ] Create consistent logging methods for all severity levels
   - [ ] Ensure all errors are logged with stack traces
   - [ ] Add context tracking for messages
   - [ ] Add log coloring based on severity
   - [ ] Create specialized methods for each severity level
   - [ ] Implement safeExecute method for protected function execution
   - [ ] Add assertion utilities
   - [ ] Add log filtering capabilities

3. [ ] Update Utils class to use the new Logger
   - [ ] Replace logError method with Logger.error
   - [ ] Remove duplicate console.error calls
   - [ ] Add appropriate INFO and DEBUG logging
   - [ ] Refactor try/catch blocks to use Logger.safeExecute
   - [ ] Update validation logic to use guard clauses

4. [ ] Update main.gs to incorporate Logger
   - [ ] Add structured logging throughout the application flow
   - [ ] Add error handling to processNewTransactions
   - [ ] Add error handling to onSheetEdit
   - [ ] Add error handling to categorizeTransactions
   - [ ] Add INFO level logging for application state

5. [ ] Create examples and tests
   - [ ] Add example for general application logging
   - [ ] Add example for handling validation errors
   - [ ] Add example for handling API errors
   - [ ] Add example for handling unexpected errors
   - [ ] Create test function to verify log filtering
   - [ ] Create test function to verify error logging
   - [ ] Create test function to verify stack traces
   - [ ] Create test function to verify error context

## Timeline
- Design and implementation of Logger: 1 day
- Code refactoring of existing codebase: 1 day
- Testing: 1 day
- Documentation: 0.5 day

## Security Considerations
- Ensure no sensitive data is included in logs
- Implement proper access controls for log sheet
- Consider adding encryption for sensitive log details
- Ensure error messages don't leak implementation details to users
- Add ability to redact sensitive information from logs

## Maintenance Notes
- Regular review of logs to identify common issues
- Periodic cleanup of logs to prevent spreadsheet size issues
- Document common error codes and their resolution steps
- Consider adding a logging dashboard for easy monitoring
- Implement log rotation or archiving for long-term storage

## Test Cases
1. Function throws error with stack trace
   - Call a function that deliberately throws an error
   - Verify the error is logged with a stack trace
   - Verify the program continues execution

2. Function returns error without terminating execution
   - Call a function that encounters an error but uses Logger.error
   - Verify the error is logged but execution continues
   - Verify the function returns an appropriate fallback value

3. Validation fails with appropriate error message
   - Call a function with invalid parameters
   - Verify the validation is handled with guard clauses
   - Verify the error message is clear and helpful

4. Multiple errors in sequence are all properly logged
   - Call multiple functions that each generate errors
   - Verify all errors are logged in sequence
   - Verify the program continues execution

5. Error in one function doesn't prevent others from executing
   - Call a batch function that processes multiple items with errors in some
   - Verify errors are logged for failing items
   - Verify successful items are processed correctly

6. Validation logic works without unnecessary else clauses
   - Review code for guard clause pattern implementation
   - Verify early returns on validation failures
   - Verify minimal nesting in validation logic

7. General application logging provides clear flow information
   - Verify INFO level logs show application state transitions
   - Verify DEBUG level logs provide detailed execution information
   - Verify logs can be filtered by severity level

## Edge Cases
1. Errors in the logging system itself
   - Ensure fallback to console logging when sheet logging fails
   - Add defensive programming in logger

2. Very large stack traces exceeding cell size limits
   - Truncate stack traces that exceed Google Sheets cell limits
   - Add pagination for large stack traces

3. High volume of logs causing performance issues
   - Add throttling for logging
   - Consider buffering logs for batch writing
   - Implement log level filtering in production

4. Circular error references
   - Detect and break circular references in log context
   - Use JSON.stringify with circular reference handling 