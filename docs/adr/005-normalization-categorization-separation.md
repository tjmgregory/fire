# ADR 005: Normalization and Categorization Process Separation

## Status

Proposed

## Context

The transaction processing system currently handles both normalization and categorization in a single process. This creates several challenges:
- Risk of data loss if categorization fails
- Difficulty in optimizing API usage for categorization
- Complex error handling for mixed concerns
- Limited flexibility in handling API rate limits
- Challenges in debugging and maintaining the system

## Architecture Overview

```
+------------------------+      +------------------------+      +------------------------+      +------------------------+
| Source Google Sheets   |      | Normalization Layer    |      | Categorization Layer  |      | Output/Analysis Sheet  |
| - Monzo transactions   | ---> | - Google Apps Script   | ---> | - ChatGPT 4.1 nano    | ---> | - Categories as columns|
| - Revolut transactions |      | - Data standardization |      | - Batch processing    |      | - Months as rows      |
| - Yonder transactions  |      | - Currency conversion  |      | - Learning mechanism  |      | - Monthly summaries   |
+------------------------+      +------------------------+      +------------------------+      +------------------------+
```

## Decision

We will separate the transaction processing into two distinct phases:

1. **Normalization Phase**
   - Process and normalize transactions from source sheets
   - Persist normalized data immediately to output sheet
   - Run more frequently (e.g., every 15 minutes)
   - Focus on data integrity and consistency
   - Handle currency conversion and standardization

2. **Categorization Phase**
   - Process uncategorized transactions in batches
   - Run less frequently (e.g., every hour)
   - Implement proper rate limiting
   - Handle API failures gracefully
   - Update AI Category and Confidence columns
   - Support manual overrides

## Consequences

### Positive
- Improved data integrity
- Better error handling
- More efficient API usage
- Easier debugging
- Clearer separation of concerns
- More flexible processing schedules
- Better handling of API rate limits

### Negative
- More complex trigger management
- Need to maintain state between phases
- Additional storage requirements
- More complex testing scenarios

## Implementation Notes

1. Modify `processNewTransactions()` to:
   - First persist normalized transactions
   - Then trigger separate categorization process
   - Add status column for tracking

2. Create new batch categorization function with:
   - Batch processing logic
   - Rate limiting
   - Error handling
   - Status updates

3. Update trigger system to:
   - Run normalization more frequently
   - Run categorization less frequently
   - Add specific triggers for manual overrides

4. Add monitoring for:
   - Normalization success rate
   - Categorization success rate
   - API usage
   - Processing times

## Related ADRs
- ADR 001: Data Normalization Strategy
- ADR 002: Transaction Categorization Strategy
- ADR 003: Output Sheet Structure
- ADR 004: Trigger System Design 