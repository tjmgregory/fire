# ADR 006: Error Handling and Logging Strategy

## Status

Proposed

## Context

Our current logging and error handling approach has several issues:
1. Duplicate logging - Both `console.error` and `utils.logError` are often called together
2. Error propagation - Errors are thrown after logging, potentially causing script termination
3. Inconsistent error handling patterns - Some functions have try/catch blocks, others throw directly
4. Validation logic often uses unnecessary else clauses
5. No standardized approach to general application logging
6. Lack of log levels for differentiating information types

These issues make the codebase harder to maintain and debug, while potentially causing unexpected termination of scripts and making it difficult to trace program execution.

## Decision

We will implement a centralized logging and error handling system with the following components:

1. **Unified Logger Class**
   - Handles both error and general application logging
   - Logs all errors with stack traces
   - Supports different severity levels (FATAL, ERROR, WARNING, INFO, DEBUG)
   - Allows for controlled error propagation
   - Provides context-aware reporting
   - Standardizes log format and storage

2. **Guard Clause Pattern**
   - Early returns from functions when validation fails
   - Use direct validation at function entry points
   - Avoid nested conditionals where possible

3. **Consistent Error Handling**
   - Errors should be logged but not allowed to terminate program flow unless explicitly intended
   - All error logs must include stack traces
   - Error context should be captured when available
   - Standardized approach across the codebase

## Code Samples

### Before: Current Error Handling Pattern

```javascript
/**
 * Parse date and time with inconsistent error handling
 */
parseDateTime(dateStr, timeStr, sourceSheet) {
  let date, time, dateTime;

  // No check for undefined/null
  
  if (sourceSheet.toLowerCase() === 'monzo') {
    if (dateStr instanceof Date) {
      dateTime = new Date(dateStr);
      
      if (timeStr) {
        console.log(`[parseDateTime] Monzo timeStr type: ${typeof timeStr}, value: ${timeStr}`);
        
        if (typeof timeStr === 'string') {
          // If timeStr is a string in format HH:mm:ss
          const [hours, minutes, seconds] = timeStr.split(':');
          dateTime.setHours(hours, minutes, seconds);
        } else if (timeStr instanceof Date) {
          // If timeStr is a Date object, extract time components from it
          const hours = timeStr.getHours();
          const minutes = timeStr.getMinutes();
          const seconds = timeStr.getSeconds();
          dateTime.setHours(hours, minutes, seconds);
        }
      }
    } else {
      const msg = `[parseDateTime] Monzo dateStr is not a Date object: ${dateStr}`;
      this.logError('parseDateTime', msg);
      console.error(`[parseDateTime] ${msg}`); // Duplicate logging
      throw new Error(msg); // Error propagation stops execution
    }
  } else if (sourceSheet.toLowerCase() === 'revolut') {
    // Different handling approach
    // ...
  }
  
  // Deep nesting and multiple returns
  return result;
}
```

### After: Improved Error Handling and Logging Pattern

```javascript
/**
 * Parse date and time with consistent error handling
 */
parseDateTime(dateStr, timeStr, sourceSheet) {
  // Guard clause for validation
  if (!dateStr) {
    // Single logging call with appropriate level, context captured
    return logger.error('parseDateTime', 'dateStr is undefined/null', { sourceSheet });
  }
  
  if (!sourceSheet) {
    return logger.error('parseDateTime', 'sourceSheet is undefined/null');
  }
  
  // Normalized sheet name to avoid repetition
  const sheetName = sourceSheet.toLowerCase();
  
  // Early return pattern with appropriate logging
  if (sheetName === 'monzo') {
    // Log at INFO level for normal operation
    logger.info('parseDateTime', 'Processing Monzo date format', { dateType: typeof dateStr });
    
    // Guard clause
    if (!(dateStr instanceof Date)) {
      return logger.error('parseDateTime', 'Monzo dateStr is not a Date object', { 
        dateValue: String(dateStr),
        dateType: typeof dateStr
      });
    }
    
    // Continue with normal operation
    const dateTime = new Date(dateStr);
    
    // Process the time if available (no else needed)
    if (timeStr) {
      return processMonzoTime(dateTime, timeStr);
    }
    
    return formatDateTime(dateTime);
  }
  
  if (sheetName === 'revolut') {
    // Similar pattern for Revolut
    // ...
  }
  
  // If we reach here, the sheet type is unknown
  return logger.error('parseDateTime', 'Unknown sheet type', { sheetName });
}

/**
 * Example of a function using safeExecute for protected execution
 */
processNewTransactions() {
  logger.info('processNewTransactions', 'Starting transaction processing');
  
  // Safe execution that won't terminate the program
  return logger.safeExecute(
    () => {
      const sourceSheets = config.getSourceSheets();
      const outputSheet = config.getOutputSheet();
      
      // Get existing transaction IDs
      const existingIds = getExistingTransactionIds(outputSheet);
      
      // Process each source sheet
      sourceSheets.forEach(sheet => {
        logger.debug('processNewTransactions', `Processing sheet: ${sheet.getName()}`);
        
        try {
          const transactions = utils.getNewTransactions(sheet)
            .map(t => ({ ...t, sourceSheet: sheet.getName() }));
          
          // Filter out already processed transactions
          const newTransactions = transactions.filter(t => !existingIds.includes(t.id));
          
          logger.info('processNewTransactions', `Found ${newTransactions.length} new transactions`, {
            sheetName: sheet.getName()
          });
          
          if (newTransactions.length > 0) {
            utils.writeNormalizedTransactions(newTransactions, outputSheet);
          }
        } catch (err) {
          // Log but continue processing other sheets
          logger.error('processNewTransactions', `Error processing sheet: ${sheet.getName()}`, {
            error: err
          });
          // Continue with the next sheet rather than terminating
        }
      });
      
      logger.info('processNewTransactions', 'Transaction processing complete');
    },
    'processNewTransactions',
    [], // No arguments
    {
      rethrow: false,
      onError: (err) => logger.warning('processNewTransactions', 'Process completed with errors'),
      defaultValue: false
    }
  );
}
```

## Consequences

### Positive
- Better error traceability with consistent stack traces
- Reduced likelihood of unexpected script termination
- Cleaner code without unnecessary else clauses
- Centralized logging for easier debugging and application monitoring
- Ability to categorize messages by severity
- Improved context for faster issue resolution
- Better visibility into application flow and state

### Negative
- Need to refactor existing code to use the new pattern
- Small learning curve for new logging approach
- Slight increase in code complexity with additional class

### Neutral
- Different logging approach than standard Google Apps Script practices
- Added indirection through Logger class
- Potential increase in log storage requirements

## Implementation Notes

1. Create a dedicated Logger class with error handling capabilities
2. Modify Utils class to use Logger
3. Update existing code to use new logging pattern
4. Add tests for logging and error handling scenarios
5. Document logging and error handling best practices

## Implementation Plan
See corresponding implementation plan: `plans/2025-05-11_12:40_logging_and_error_handling_improvement.md` 