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

1. **Consistent Logging Approach**
   - Use native console methods with appropriate severity levels (error, warn, info, debug)
   - Add structured context to log messages (function name, operation)
   - Keep detailed logs in the console for debugging
   - Ensure all errors include stack traces

2. **Guard Clause Pattern**
   - Early returns from functions when validation fails
   - Use direct validation at function entry points
   - Avoid nested conditionals where possible

3. **Consistent Error Handling**
   - Create informative errors with context directly where they occur
   - Catch errors only at top-level entry points
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
// Use native console methods with appropriate severity levels
// These add structure to logging without additional complexity
function parseData(input) {
  // Guard clauses for validation
  if (!input) {
    console.error(`[parseData] Input is null or undefined`);
    throw new Error(`Input is null or undefined`);
  }
  
  if (typeof input !== 'string') {
    console.error(`[parseData] Input is not a string (type: ${typeof input})`);
    throw new Error(`Input is not a string (type: ${typeof input})`);
  }
  
  try {
    console.debug(`[parseData] Parsing JSON string of length ${input.length}`);
    const parsed = JSON.parse(input);
    
    if (!parsed) {
      console.error(`[parseData] Parsed result is empty`);
      throw new Error(`Parsed result is empty`);
    }
    
    if (!parsed.data) {
      console.error(`[parseData] No data property found in: ${Object.keys(parsed).join(', ')}`);
      throw new Error(`No data property found in: ${Object.keys(parsed).join(', ')}`);
    }
    
    console.debug(`[parseData] Successfully parsed data object with keys: ${Object.keys(parsed.data).join(', ')}`);
    return parsed.data;
  } catch (err) {
    // Only catch JSON.parse errors, then create a more informative error and throw it
    if (err.name === 'SyntaxError') {
      console.error(`[parseData] Invalid JSON format: ${err.message}`);
      throw new Error(`Invalid JSON format: ${err.message}`);
    }
    // Otherwise just let the error propagate (already handled guard clauses)
    throw err;
  }
}

// Top-level handler shows error flows
function processNewTransactions() {
  try {
    console.info(`[processNewTransactions] Starting transaction processing`);
    
    const sourceSheets = config.getSourceSheets();
    console.debug(`[processNewTransactions] Found ${sourceSheets.length} source sheets to process`);
    
    const outputSheet = config.getOutputSheet();
    
    // Process each source sheet - errors will naturally propagate
    sourceSheets.forEach(sheet => {
      console.info(`[processNewTransactions] Processing sheet: ${sheet.getName()}`);
      
      // These function calls will throw errors if there are problems
      const transactions = getNewTransactions(sheet);
      console.info(`[processNewTransactions] Found ${transactions.length} transactions in ${sheet.getName()}`);
      
      writeTransactions(transactions, outputSheet);
      
      console.info(`[processNewTransactions] Processed sheet: ${sheet.getName()}`);
    });
    
    console.info(`[processNewTransactions] Transaction processing complete`);
  } catch (err) {
    // Log the full error with stack trace to console
    console.error(`[processNewTransactions] Error: ${err.message}`, err.stack);
    
    // Re-throw to the entry point
    throw err;
  }
}

// Entry point - only place we need to catch and swallow errors
function onTrigger() {
  try {
    console.info(`[onTrigger] Starting scheduled execution`);
    processNewTransactions();
    console.info(`[onTrigger] Execution completed successfully`);
    return true;
  } catch (err) {
    // This is where we ensure the script doesn't crash
    console.error(`[onTrigger] Execution failed: ${err.message}`, err.stack);
    // We could notify admin here if needed
    return false;
  }
}
```

## Consequences

### Positive
- Better error traceability with consistent stack traces
- Reduced likelihood of unexpected script termination
- Cleaner code without unnecessary else clauses
- Improved visibility into application flow with appropriate severity levels
- Simpler logging implementation

### Negative
- Need to refactor existing code to use the new pattern
- Small learning curve for new logging approach

### Neutral
- Some loss of log persistence compared to sheet-based logging
- Potential need for additional monitoring in production environments

## Implementation Notes

1. Update code to use appropriate console methods (error, warn, info, debug)
2. Update error handling in top-level functions
3. Implement guard clauses in validation logic
4. Document logging and error handling best practices

## Implementation Plan
See corresponding implementation plan: `plans/2025-05-11-12-40_logging_and_error_handling_implementation.md` 