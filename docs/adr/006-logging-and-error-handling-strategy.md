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
   - Create informative errors with context
   - Catch errors only at top-level entry points
   - Log all errors with stack traces
   - Allow errors to propagate through the call stack

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
// Simple logging functions
function logInfo(functionName, message) {
  console.log(`[INFO] [${functionName}] ${message}`);
  // Also log to spreadsheet with timestamp
  logToSheet("INFO", functionName, message);
}

function logError(functionName, error) {
  // Get the actual Error object with stack trace
  const errorObj = error instanceof Error ? error : new Error(error);
  
  // Log to console with stack trace
  console.error(`[ERROR] [${functionName}] ${errorObj.message}`, errorObj.stack);
  
  // Log to spreadsheet with stack trace
  logToSheet("ERROR", functionName, errorObj.message, errorObj.stack);
}

// Create descriptive errors
function createError(functionName, message, details = {}) {
  // Create error with context in the message
  const detailsStr = Object.keys(details).length > 0 ? 
    ` (${JSON.stringify(details)})` : '';
  
  return new Error(`[${functionName}] ${message}${detailsStr}`);
}

// Clean validation with guard clauses - throws informative errors
function parseData(input) {
  // Guard clauses for validation
  if (!input) {
    throw createError("parseData", "Input is null or undefined");
  }
  
  if (typeof input !== 'string') {
    throw createError("parseData", "Input is not a string", { type: typeof input });
  }
  
  try {
    const parsed = JSON.parse(input);
    
    if (!parsed) {
      throw createError("parseData", "Parsed result is empty");
    }
    
    if (!parsed.data) {
      throw createError("parseData", "No data property found", { keys: Object.keys(parsed) });
    }
    
    return parsed.data;
  } catch (err) {
    // Only catch JSON.parse errors, then create a more informative error and throw it
    if (err.name === 'SyntaxError') {
      throw createError("parseData", `Invalid JSON format: ${err.message}`);
    }
    // Otherwise just let the error propagate (already handled guard clauses)
    throw err;
  }
}

// Top-level error handling at entry points
function processNewTransactions() {
  try {
    logInfo("processNewTransactions", "Starting transaction processing");
    
    const sourceSheets = config.getSourceSheets();
    const outputSheet = config.getOutputSheet();
    
    // Process each source sheet
    sourceSheets.forEach(sheet => {
      logInfo("processNewTransactions", `Processing sheet: ${sheet.getName()}`);
      
      try {
        const transactions = getNewTransactions(sheet);
        logInfo("processNewTransactions", `Found ${transactions.length} transactions`);
        
        // Further processing...
      } catch (err) {
        // Log and re-throw with more context
        logError("processNewTransactions", err);
        throw createError("processNewTransactions", 
                          `Failed to process sheet ${sheet.getName()}`, 
                          { originalError: err.message });
      }
    });
    
    logInfo("processNewTransactions", "Transaction processing complete");
    return true;
  } catch (err) {
    // Top-level catch logs the error and gracefully exits
    logError("processNewTransactions", err);
    return false;
  }
}

// Entry point - only place we need to catch errors
function onTrigger() {
  try {
    processNewTransactions();
  } catch (err) {
    // This is where we ensure the script doesn't crash
    logError("onTrigger", err);
    // We could notify admin here if needed
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