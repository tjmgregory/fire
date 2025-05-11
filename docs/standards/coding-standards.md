# Coding Standards

This document outlines the coding standards and best practices for the Transaction Categorization System. These standards are derived from the architectural decision in [ADR 006](../adr/006-logging-and-error-handling-strategy.md).

## Logging Standards

### Log Levels
We use the following console methods with specific purposes:

1. **Error Level (`console.error`)**
   - Use for errors that prevent normal operation
   - Always include stack traces
   - Only log at error handling points
   - Include relevant context

2. **Warning Level (`console.warn`)**
   - Use for potential issues that don't prevent operation
   - Flag deprecated feature usage
   - Highlight unexpected but handled conditions

3. **Info Level (`console.info`)**
   - Use for tracking main program flow
   - Log important state changes
   - Record process start/end points

4. **Debug Level (`console.debug`)**
   - Use for detailed execution information
   - Log function parameters
   - Record intermediate calculation results

### Log Message Format
```javascript
console.[level]('[functionName] Message', contextObject);
```

## Error Handling Standards

### Guard Clauses
- Place validation at function entry points
- Use early returns for invalid conditions
- Avoid nested conditionals
- Include specific error messages

### Error Propagation
- Let errors propagate naturally through the call stack
- Only catch errors when they can be meaningfully handled
- Never catch an error just to log and rethrow it
- Add context when rethrowing errors

### Try/Catch Usage
- Use try/catch blocks only for specific error-prone operations
- Keep try/catch blocks focused and minimal
- Convert caught errors to more meaningful ones
- Include relevant context in error messages

## Code Examples

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
function parseData(input) {
  // Guard clauses for validation
  if (!input) {
    throw new Error(`Input is null or undefined`);
  }
  
  if (typeof input !== 'string') {
    throw new Error(`Input is not a string (type: ${typeof input})`);
  }
  
  // Debug log for normal operation
  console.debug(`[parseData] Parsing JSON string of length ${input.length}`);
  
  // Focused try/catch only around the operation that might throw a specific error
  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err.message}`);
  }
  
  // Continue with normal validation flow outside the try/catch
  if (!parsed) {
    throw new Error(`Parsed result is empty`);
  }
  
  if (!parsed.data) {
    throw new Error(`No data property found in: ${Object.keys(parsed).join(', ')}`);
  }
  
  console.debug(`[parseData] Successfully parsed data object with keys: ${Object.keys(parsed.data).join(', ')}`);
  return parsed.data;
}

// Top-level handler: only catch errors when we can handle them
function onTrigger() {
  try {
    console.info(`[onTrigger] Starting scheduled execution`);
    processNewTransactions();
    console.info(`[onTrigger] Execution completed successfully`);
    return true;
  } catch (err) {
    console.error(`[onTrigger] Execution failed: ${err.message}`, err.stack);
    return false;
  }
}
```

## Best Practices

1. **Error Messages**
   - Be specific about what went wrong
   - Include relevant context (IDs, values, etc.)
   - Use consistent formatting
   - Avoid exposing sensitive information

2. **Logging Context**
   - Always include function name in square brackets
   - Add relevant context objects
   - Use consistent message structure
   - Keep messages concise but informative

3. **Error Handling**
   - Validate early with guard clauses
   - Let errors propagate naturally
   - Only catch errors you can handle
   - Add context when rethrowing errors
   - Log errors only at handling points

4. **Performance Considerations**
   - Use appropriate log levels
   - Avoid logging sensitive data
   - Keep debug logs focused
   - Consider log volume in loops

## Testing Requirements

1. **Unit Tests**
   - Test guard clauses
   - Verify error propagation
   - Check error messages
   - Validate logging calls

2. **Integration Tests**
   - Test error handling across functions
   - Verify error context preservation
   - Check error recovery
   - Validate logging consistency

3. **Error Scenarios**
   - Invalid input
   - Missing data
   - API failures
   - Timeout conditions
   - Concurrent errors 