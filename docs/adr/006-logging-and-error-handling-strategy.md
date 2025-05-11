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
   - Create informative errors with context directly where they occur
   - Catch errors only at top-level entry points
   - Log all errors with stack traces
   - Allow errors to propagate naturally through the call stack

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
// Simple logging functions - separate from error handling
function logInfo(functionName, message) {
  console.log(`[INFO] [${functionName}] ${message}`);
  // Also log to spreadsheet with timestamp
  logToSheet("INFO", functionName, message);
}

function logError(functionName, error) {
  // Get the actual Error object with stack trace (already created with proper context)
  const errorObj = error instanceof Error ? error : new Error(error);
  
  // Log to console with stack trace
  console.error(`[ERROR] [${functionName}] ${errorObj.message}`, errorObj.stack);
  
  // Log to spreadsheet with stack trace
  logToSheet("ERROR", functionName, errorObj.message, errorObj.stack);
}

// Clean validation with guard clauses - throws informative errors directly
function parseData(input) {
  // Guard clauses for validation
  if (!input) {
    throw new Error(`Input is null or undefined`);
  }
  
  if (typeof input !== 'string') {
    throw new Error(`Input is not a string (type: ${typeof input})`);
  }
  
  try {
    const parsed = JSON.parse(input);
    
    if (!parsed) {
      throw new Error(`Parsed result is empty`);
    }
    
    if (!parsed.data) {
      throw new Error(`No data property found in: ${Object.keys(parsed).join(', ')}`);
    }
    
    return parsed.data;
  } catch (err) {
    // Only catch JSON.parse errors, then create a more informative error and throw it
    if (err.name === 'SyntaxError') {
      throw new Error(`Invalid JSON format: ${err.message}`);
    }
    // Otherwise just let the error propagate (already handled guard clauses)
    throw err;
  }
}

// Top-level handler shows error flows
function processNewTransactions() {
  try {
    logInfo("processNewTransactions", "Starting transaction processing");
    
    const sourceSheets = config.getSourceSheets();
    const outputSheet = config.getOutputSheet();
    
    // Process each source sheet - errors will naturally propagate
    sourceSheets.forEach(sheet => {
      logInfo("processNewTransactions", `Processing sheet: ${sheet.getName()}`);
      
      // These function calls will throw errors if there are problems
      const transactions = getNewTransactions(sheet);
      logInfo("processNewTransactions", `Found ${transactions.length} transactions`);
      
      writeTransactions(transactions, outputSheet);
      
      logInfo("processNewTransactions", `Processed sheet: ${sheet.getName()}`);
    });
    
    logInfo("processNewTransactions", "Transaction processing complete");
  } catch (err) {
    // Log the error at the top level
    logError("processNewTransactions", err);
    // Re-throw to the entry point
    throw err;
  }
}

// Entry point - only place we need to catch and swallow errors
function onTrigger() {
  try {
    processNewTransactions();
    return true; // Only return values that mean something
  } catch (err) {
    // This is where we ensure the script doesn't crash
    logError("onTrigger", err);
    // We could notify admin here if needed
    return false; // Only return values that mean something
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