# Coding Guidelines: Error Handling and Logging Strategy

We will implement a centralized logging and error handling system with the following components:

1. **Consistent Logging Approach**
   - Use native console methods with appropriate severity levels (error, warn, info, log)
   - Use console.log for debug-level logging (since console.log is not available in Google Apps Script)
   - Add structured context to log messages (function name, operation)
   - Keep detailed logs in the console for debugging
   - Ensure all errors include stack traces

2. **Guard Clause Pattern**
   - Early returns from functions when validation fails
   - Use direct validation at function entry points
   - Avoid nested conditionals where possible

3. **Consistent Error Handling**
   - Create informative errors with context directly where they occur
   - Only catch errors when they can be meaningfully handled
   - Never catch an error just to log and rethrow it
   - Allow errors to propagate naturally through the call stack
   - Log errors only at the point where they are handled
   - Use try/catch blocks only when necessary and keep them focused around specific operations

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
// Middle-tier functions: throw errors but don't log them
// This avoids duplicate logging
function parseData(input) {
  // Guard clauses for validation
  if (!input) {
    throw new Error(`Input is null or undefined`);
  }
  
  if (typeof input !== 'string') {
    throw new Error(`Input is not a string (type: ${typeof input})`);
  }
  
  // Debug log for normal operation
  console.log(`[parseData] Parsing JSON string of length ${input.length}`);
  
  // Focused try/catch only around the operation that might throw a specific error
  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    // Only catch JSON.parse errors, then create a more informative error
    throw new Error(`Invalid JSON format: ${err.message}`);
  }
  
  // Continue with normal validation flow outside the try/catch
  if (!parsed) {
    throw new Error(`Parsed result is empty`);
  }
  
  if (!parsed.data) {
    throw new Error(`No data property found in: ${Object.keys(parsed).join(', ')}`);
  }
  
  // Debug log for successful operation
  console.log(`[parseData] Successfully parsed data object with keys: ${Object.keys(parsed.data).join(', ')}`);
  return parsed.data;
}

// Intermediate function: throws errors without logging
function processData(data) {
  console.info(`[processData] Processing data...`);
  
  // Call functions that might throw errors
  const parsedData = parseData(data);
  const result = transformData(parsedData);
  
  console.info(`[processData] Data processing complete`);
  return result;
}

// Top-level handler: only catch errors when we can handle them
function processNewTransactions() {
  console.info(`[processNewTransactions] Starting transaction processing`);
  
  const sourceSheets = config.getSourceSheets();
  console.log(`[processNewTransactions] Found ${sourceSheets.length} source sheets to process`);
  
  const outputSheet = config.getOutputSheet();
  
  // Process each source sheet - errors will naturally propagate
  sourceSheets.forEach(sheet => {
    console.info(`[processNewTransactions] Processing sheet: ${sheet.getName()}`);
    
    // These function calls will throw errors without logging them
    const transactions = getNewTransactions(sheet);
    console.info(`[processNewTransactions] Found ${transactions.length} transactions in ${sheet.getName()}`);
    
    writeTransactions(transactions, outputSheet);
    
    console.info(`[processNewTransactions] Processed sheet: ${sheet.getName()}`);
  });
  
  console.info(`[processNewTransactions] Transaction processing complete`);
}

// Entry point - only place we need to catch and handle errors
function onTrigger() {
  try {
    console.info(`[onTrigger] Starting scheduled execution`);
    processNewTransactions();
    console.info(`[onTrigger] Execution completed successfully`);
    return true;
  } catch (err) {
    // This is where we ensure the script doesn't crash
    // Log the error ONLY at the place where it's caught and handled
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
- No duplicate logging of the same error
- Focused, minimal try/catch blocks
