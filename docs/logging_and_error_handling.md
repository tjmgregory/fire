# Logging and Error Handling Guidelines

This document provides guidelines and examples for implementing logging and error handling in the Transaction Categorization System, following the principles defined in ADR 006.

## Log Levels

### 1. Error Level (`console.error`)
Use for errors that prevent normal operation or require immediate attention.

```javascript
// Example: Error in transaction processing
if (!transaction) {
  throw new Error('Transaction object is required');
}

// Example: Error in API call
try {
  const response = await api.getTransaction(id);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
} catch (error) {
  console.error('[processTransaction] Failed to fetch transaction:', error);
  throw error; // Let error propagate to caller
}
```

### 2. Warning Level (`console.warn`)
Use for potential issues that don't prevent operation but should be reviewed.

```javascript
// Example: Unexpected but handled condition
if (transaction.amount > 1000) {
  console.warn('[validateTransaction] Large transaction detected:', {
    amount: transaction.amount,
    description: transaction.description
  });
}

// Example: Deprecated feature usage
console.warn('[processTransaction] Using deprecated field "oldField", please update to "newField"');
```

### 3. Info Level (`console.info`)
Use for tracking main program flow and important state changes.

```javascript
// Example: Process start/end
console.info('[processNewTransactions] Starting transaction processing...');
// ... processing logic ...
console.info('[processNewTransactions] Transaction processing complete.');

// Example: Important state change
console.info('[categorizeTransaction] Transaction categorized:', {
  id: transaction.id,
  category: transaction.category,
  confidence: transaction.confidence
});
```

### 4. Debug Level (`console.debug`)
Use for detailed execution information useful during development.

```javascript
// Example: Detailed function parameters
console.debug('[normalizeTransaction] Processing transaction:', {
  rawAmount: transaction.amount,
  rawDescription: transaction.description,
  sourceSheet: transaction.sourceSheet
});

// Example: Intermediate calculation results
console.debug('[calculateConfidence] Confidence factors:', {
  descriptionMatch: 0.8,
  amountMatch: 0.6,
  categoryMatch: 0.9
});
```

## Error Handling Patterns

### 1. Guard Clauses
Use guard clauses for early validation of required parameters and conditions.

```javascript
function processTransaction(transaction, sheet) {
  // Guard clause for required parameters
  if (!transaction) {
    throw new Error('Transaction object is required');
  }
  if (!sheet) {
    throw new Error('Sheet parameter is required');
  }
  
  // Guard clause for transaction state
  if (transaction.processed) {
    throw new Error('Transaction already processed');
  }
  
  // Main function logic...
}
```

### 2. Error Propagation
Let errors propagate naturally to the appropriate handler.

```javascript
// Low-level function: Let error propagate
function validateTransaction(transaction) {
  if (!transaction.amount) {
    throw new Error('Transaction amount is required');
  }
  // More validation...
}

// Mid-level function: Add context and propagate
function processTransaction(transaction) {
  try {
    validateTransaction(transaction);
    // More processing...
  } catch (error) {
    throw new Error(`Failed to process transaction ${transaction.id}: ${error.message}`);
  }
}

// Top-level function: Log and handle error
function onTrigger() {
  try {
    processTransaction(transaction);
  } catch (error) {
    console.error('[onTrigger] Transaction processing failed:', error);
    // Handle error appropriately
  }
}
```

### 3. Focused Try/Catch Blocks
Use try/catch blocks only for specific error-prone operations.

```javascript
function updateTransaction(transaction) {
  // Normal validation outside try/catch
  if (!transaction) {
    throw new Error('Transaction object is required');
  }
  
  // Try/catch only around specific error-prone operation
  try {
    const response = await api.updateTransaction(transaction);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to update transaction ${transaction.id}: ${error.message}`);
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

## Common Patterns

### 1. Function Entry/Exit Logging
```javascript
function processTransactions(transactions) {
  console.info('[processTransactions] Starting processing of', transactions.length, 'transactions');
  
  // Processing logic...
  
  console.info('[processTransactions] Completed processing');
}
```

### 2. State Change Logging
```javascript
function updateTransactionStatus(transaction, newStatus) {
  console.info('[updateTransactionStatus] Updating status:', {
    transactionId: transaction.id,
    oldStatus: transaction.status,
    newStatus: newStatus
  });
  
  // Update logic...
}
```

### 3. Error Context Addition
```javascript
function categorizeTransaction(transaction) {
  try {
    // Categorization logic...
  } catch (error) {
    throw new Error(`Failed to categorize transaction ${transaction.id}: ${error.message}`);
  }
}
```

### 4. Validation Logging
```javascript
function validateTransaction(transaction) {
  console.debug('[validateTransaction] Validating transaction:', {
    id: transaction.id,
    amount: transaction.amount,
    description: transaction.description
  });
  
  // Validation logic...
}
```

## Testing Error Handling

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