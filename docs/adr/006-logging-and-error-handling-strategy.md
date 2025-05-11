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

### Before: Current Error Handling Issues

```javascript
// Issue 1: Duplicate logging
function processData(data) {
  try {
    // Process data
  } catch (err) {
    console.error("Error processing data:", err); // Console log
    this.logError("processData", err);            // Spreadsheet log
    throw err;  // Re-throws, terminating execution
  }
}

// Issue 2: Deep nesting and complex conditionals
function parseData(input) {
  if (input) {
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        if (parsed) {
          if (parsed.data) {
            return parsed.data;
          } else {
            console.error("No data property found");
            return null;
          }
        } else {
          console.error("Parsed result is empty");
          return null;
        }
      } catch (err) {
        console.error("Error parsing JSON:", err);
        return null;
      }
    } else {
      console.error("Input is not a string");
      return null;
    }
  } else {
    console.error("Input is null or undefined");
    return null;
  }
}
```

### After: Simplified and Consistent Approach

```javascript
// Centralized logging with severity levels
function logInfo(functionName, message) {
  console.log(`[INFO] [${functionName}] ${message}`);
  // Also log to spreadsheet with timestamp
  logToSheet("INFO", functionName, message);
}

function logError(functionName, error, context = {}) {
  // Ensure we have a proper Error object with stack trace
  const errorObj = error instanceof Error ? error : new Error(error);
  
  // Log to console with stack trace
  console.error(`[ERROR] [${functionName}] ${errorObj.message}`, errorObj.stack);
  
  // Log to spreadsheet with context and stack trace
  logToSheet("ERROR", functionName, errorObj.message, errorObj.stack, context);
  
  // Return the error for convenience
  return errorObj;
}

// Simplified error handling with guard clauses
function processData(data) {
  try {
    logInfo("processData", "Starting data processing");
    
    // Process data
    // ...
    
    logInfo("processData", "Data processing complete");
    return result;
  } catch (err) {
    // Single logging call that captures stack trace
    logError("processData", err);
    // Don't throw, allows script to continue
    return null;
  }
}

// Early returns instead of deep nesting
function parseData(input) {
  // Guard clauses for validation
  if (!input) {
    logError("parseData", "Input is null or undefined");
    return null;
  }
  
  if (typeof input !== 'string') {
    logError("parseData", "Input is not a string");
    return null;
  }
  
  try {
    const parsed = JSON.parse(input);
    
    if (!parsed) {
      logError("parseData", "Parsed result is empty");
      return null;
    }
    
    if (!parsed.data) {
      logError("parseData", "No data property found");
      return null;
    }
    
    return parsed.data;
  } catch (err) {
    logError("parseData", `Error parsing JSON: ${err.message}`);
    return null;
  }
}

// Main function with try/catch for top-level error handling
function processNewTransactions() {
  logInfo("processNewTransactions", "Starting transaction processing");
  
  try {
    const sourceSheets = config.getSourceSheets();
    const outputSheet = config.getOutputSheet();
    
    // Process each source sheet
    sourceSheets.forEach(sheet => {
      try {
        logInfo("processNewTransactions", `Processing sheet: ${sheet.getName()}`);
        
        const transactions = getNewTransactions(sheet);
        
        // Continue processing...
        logInfo("processNewTransactions", `Found ${transactions.length} transactions`);
      } catch (err) {
        // Log errors but continue with other sheets
        logError("processNewTransactions", 
                `Error processing sheet ${sheet.getName()}: ${err.message}`);
        // No throw, so loop continues
      }
    });
    
    logInfo("processNewTransactions", "Transaction processing complete");
  } catch (err) {
    // Catch and log any unexpected errors
    logError("processNewTransactions", "Unexpected error in transaction processing", err);
    // We could throw here if needed, but generally we want to avoid terminating
  }
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