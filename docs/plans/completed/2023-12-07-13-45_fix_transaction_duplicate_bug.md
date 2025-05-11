# Fix for Transaction Normalization Duplicate Bug: Implementation Plan

## 1. Architecture Overview

The bug occurs in the normalization layer of our transaction processing system:

```
+------------------------+      +------------------------+      +------------------------+      +------------------------+
| Source Google Sheets   |      | Normalization Layer    |      | Categorization Layer  |      | Output/Analysis Sheet  |
| - Monzo transactions   | ---> | - Google Apps Script   | ---> | - ChatGPT 4.1 nano    | ---> | - Categories as columns|
| - Revolut transactions |      | - Data standardization |      | - Batch processing    |      | - Months as rows      |
| - Yonder transactions  |      | - Currency conversion  |      | - Learning mechanism  |      | - Monthly summaries   |
+------------------------+      +------------------------+      +------------------------+      +------------------------+
                                        ↑ BUG HERE ↑
```

## 2. Problem Description

The system currently re-adds every row from each input sheet when it runs. The core issue is broken logic in the system that checks whether a transaction has already been processed and added. 

According to ADR-001, we have a specification for generating deterministic transaction references that should allow us to uniquely identify transactions. However, the implementation of this reference system is either incomplete or inconsistent, causing the system to treat existing transactions as new ones during each processing run.

## 3. Implementation Checklist

### Analysis Phase
- [x] Review existing normalization code implementation
- [x] Trace the reference generation logic and compare to ADR-001 specifications
- [x] Examine how transaction comparisons are currently performed
- [x] Identify the specific function or logic that's failing to detect duplicates
- [x] Investigate how transaction references are stored and retrieved
- [x] Confirm the bug is consistent across all transaction sources (Monzo, Revolut, Yonder)

### Design Phase
- [x] Document the exact reference generation implementation based on ADR-001
- [x] Design an efficient lookup mechanism for detecting duplicates
- [x] Consider persistence approach for tracking processed transactions
- [x] Plan for handling edge cases (near-duplicates, changes to existing transactions)
- [x] Outline logging and error handling approach

### Implementation Phase
- [x] Create or update the transaction reference generation function
  - [x] Ensure it follows ADR-001 specifications exactly
  - [x] Make it consistent across all transaction sources
  - [x] Add comprehensive unit tests for the function
- [x] Implement a robust duplicate detection mechanism
  - [x] Use a cache, lookup table, or database query for efficiency
  - [x] Add appropriate error handling and logging
- [x] Add transaction tracking system
  - [x] Track processed transaction references
  - [x] Implement comparison logic to identify and skip duplicates
- [x] Enhance error handling and reporting
  - [x] Add detailed logging for duplicate detection
  - [x] Create error messages that help diagnose issues

### Testing Phase
- [x] Create test cases that mimic real-world usage patterns
- [x] Test with actual transaction data from each source
- [x] Verify performance with large sets of transactions
- [x] Ensure edge cases are properly handled
  - [x] Transactions with identical timestamps but different merchants
  - [x] Transactions with identical amounts but different times
  - [x] Transactions from different sources with potentially overlapping reference patterns
- [x] Test trigger system with the updated code

### Deployment Phase
- [x] Deploy the fix to the development environment
- [x] Run validation tests on a copy of production data
- [x] Monitor processing logs for any issues
- [x] Deploy to production with careful monitoring
- [x] Verify fix works in production environment

## 4. Technical Design Details

### Reference Generation Implementation

Based on ADR-001, transaction references should be generated as follows:

1. For accounts with native transaction IDs (e.g., Monzo):
   - Store original ID in `originalReference` field
   
2. For accounts without native transaction IDs (e.g., Revolut, Yonder):
   - Generate `originalReference` using:
     - Transaction date (YYYY-MM-DD-hh-mm)
     - Amount (with 2 decimal places)
     - Example: "2025-02-05T21:54_-0.01"

The fix will ensure this logic is consistently applied and properly used for duplicate detection.

### Duplicate Detection Algorithm

1. Generate the deterministic reference for each incoming transaction
2. Before processing a transaction, check if its reference already exists in our system
3. If it exists, skip the transaction
4. If it doesn't exist, process the transaction and store its reference

### Data Structures

The duplicate checking could use one of several approaches:
1. In-memory cache of processed transaction references
2. Lookup against existing sheet data
3. Dedicated "processed transactions" tracking sheet or database

The choice will depend on performance considerations and system architecture.

## 5. Security Considerations

- Ensure proper error handling to prevent any system failures
- Add appropriate logging (without exposing sensitive transaction details)
- Maintain data integrity during the transition

## 6. Potential Challenges and Solutions

- **Performance Impact**: Optimize lookup operations for large transaction sets
- **Reference Collisions**: Ensure the reference generation is truly unique across sources
- **Data Integrity**: Verify no legitimate transactions are lost during processing
- **Transition Strategy**: Consider how to handle existing duplicate data

## 7. Estimated Timeline

- Analysis: 1 hour
- Design: 1 hour
- Implementation: 2 hours
- Testing: 2 hours
- Deployment and validation: 1 hour

Total estimated time: 7 hours

## 8. Maintenance Considerations

- Document the fix thoroughly
- Add monitoring for duplicate detection rates
- Consider adding a periodic integrity check
- Update relevant documentation (including the main implementation plan)

## 9. Success Criteria

- Transactions are only added once, regardless of how many times the process runs
- Performance impact is minimal
- No legitimate transactions are lost
- System maintains backward compatibility with existing data

## 10. Conclusion

The transaction duplication bug has been successfully fixed. The key changes made were:

1. Fixed the core issue in the `processNewTransactions` function by:
   - Checking for duplicate transactions using `originalReference` instead of `id`
   - Adding detailed logging and diagnostics for duplicate detection

2. Enhanced the `generateOriginalReference` function with:
   - Improved error handling
   - Better logging to help diagnose issues
   - Consistent implementation across all transaction sources

3. Added a new `checkForDuplicates` utility function that:
   - Provides detailed information about potential duplicates
   - Helps diagnose edge cases and reference conflicts
   - Creates statistics for monitoring the system

4. Created comprehensive test cases to validate the fix across:
   - All transaction sources (Monzo, Revolut, Yonder)
   - Edge cases involving transactions with similar attributes
   - Various data patterns and volumes

5. Implemented a deployment process with:
   - Data backup capabilities
   - Validation checks
   - Easy rollout to production

The fix ensures that transactions are only processed once, maintaining data integrity while following the principles outlined in ADR-001. The system now properly handles transaction references from all sources and includes extensive logging to help diagnose any future issues. 