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
- [ ] Review existing normalization code implementation
- [ ] Trace the reference generation logic and compare to ADR-001 specifications
- [ ] Examine how transaction comparisons are currently performed
- [ ] Identify the specific function or logic that's failing to detect duplicates
- [ ] Investigate how transaction references are stored and retrieved
- [ ] Confirm the bug is consistent across all transaction sources (Monzo, Revolut, Yonder)

### Design Phase
- [ ] Document the exact reference generation implementation based on ADR-001
- [ ] Design an efficient lookup mechanism for detecting duplicates
- [ ] Consider persistence approach for tracking processed transactions
- [ ] Plan for handling edge cases (near-duplicates, changes to existing transactions)
- [ ] Outline logging and error handling approach

### Implementation Phase
- [ ] Create or update the transaction reference generation function
  - [ ] Ensure it follows ADR-001 specifications exactly
  - [ ] Make it consistent across all transaction sources
  - [ ] Add comprehensive unit tests for the function
- [ ] Implement a robust duplicate detection mechanism
  - [ ] Use a cache, lookup table, or database query for efficiency
  - [ ] Add appropriate error handling and logging
- [ ] Add transaction tracking system
  - [ ] Track processed transaction references
  - [ ] Implement comparison logic to identify and skip duplicates
- [ ] Enhance error handling and reporting
  - [ ] Add detailed logging for duplicate detection
  - [ ] Create error messages that help diagnose issues

### Testing Phase
- [ ] Create test cases that mimic real-world usage patterns
- [ ] Test with actual transaction data from each source
- [ ] Verify performance with large sets of transactions
- [ ] Ensure edge cases are properly handled
  - [ ] Transactions with identical timestamps but different merchants
  - [ ] Transactions with identical amounts but different times
  - [ ] Transactions from different sources with potentially overlapping reference patterns
- [ ] Test trigger system with the updated code

### Deployment Phase
- [ ] Deploy the fix to the development environment
- [ ] Run validation tests on a copy of production data
- [ ] Monitor processing logs for any issues
- [ ] Deploy to production with careful monitoring
- [ ] Verify fix works in production environment

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