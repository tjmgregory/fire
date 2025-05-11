# Fix Missing Category Column in Revolut Sheet

## Problem Statement
The application is failing with the error: "Required column not found in sheet Revolut: Category". This occurs in the `getNewTransactions` method in `utils.gs`, where it expects a "Category" column to exist in the Revolut transaction data sheet.

According to ADR-001, Revolut transaction sheets do not typically include a Category column in their standard format:

> #### Revolut Transaction Sheet
> - Format: Google Sheet
> - Columns:
>   - Type: Transaction type (e.g., "TRANSFER", "TOPUP", "ATM", "CARD_PAYMENT")
>   - Product: Account type (e.g., "Current")
>   - Started Date: ISO 8601 format (YYYY-MM-DD HH:mm:ss)
>   - Completed Date: ISO 8601 format (YYYY-MM-DD HH:mm:ss)
>   - Description: Transaction description
>   - Amount: Transaction amount (negative for debits)
>   - Fee: Transaction fee
>   - Currency: 3-letter code
>   - State: Transaction state (e.g., "COMPLETED")
>   - Balance: Account balance after transaction

Additionally, per ADR-005 "Normalization and Categorization Process Separation", the categorization process is entirely separate from the normalization process. The normalization process should only focus on converting transactions to a standard format without concerning itself with categorization, which happens in a separate phase:

> We will separate the transaction processing into two distinct phases:
>
> 1. **Normalization Phase**
>    - Process and normalize transactions from source sheets
>    - Persist normalized data immediately to output sheet
>    - Run more frequently (e.g., every 15 minutes)
>    - Focus on data integrity and consistency
>    - Handle currency conversion and standardization
>
> 2. **Categorization Phase**
>    - Process uncategorized transactions in batches
>    - Run less frequently (e.g., every hour)
>    - Implement proper rate limiting
>    - Handle API failures gracefully
>    - Update AI Category and Confidence columns
>    - Support manual overrides

## Architecture Overview
The FIRE Transaction Categorization System processes bank transaction data from various sources and normalizes them into a standardized format per ADR-001, with categorization happening as a separate process per ADR-005. The normalization phase should not depend on categories from the source data.

## Technical Components
- **utils.gs**: Contains the `getNewTransactions` and `getColumnMap` methods which process transaction data
- **config.gs**: Contains configuration data and sheet setup functionality
- **main.gs**: Contains the main processing functions
- **Output Sheet**: Contains normalized transactions with a "Processing Status" indicating whether they've been categorized yet

## Implementation Steps

- [x] **Analyze Current Column Mapping for Revolut**
  - Review the `getColumnMap` function in `utils.gs` to understand how columns are mapped
  - Confirm that `category` is being treated as a required field for Revolut when it should not be part of the normalization process at all
  - Identified that the issue was in the `getColumnMap` function where 'category' was incorrectly included in the Revolut mapping

- [x] **Update Column Mapping Implementation**
  - Modify the `getColumnMap` function to remove the `category` field from the Revolut mapping entirely
  - Add a comment explaining that categories are handled in a separate phase per ADR-005
  - Ensure the return object for Revolut does not include a category mapping
  - Completed by removing 'category' from the Revolut mapping and adding explanatory comments

- [x] **Update Transaction Normalization Logic**
  - Modify the `normalizeTransaction` function to handle the absence of a category field
  - Remove any dependency on `indices.category` for Revolut transactions
  - Set the category to 'Uncategorized' for all normalized transactions as a default
  - Add a comment explaining this aligns with ADR-005's separation of normalization and categorization
  - Completed by adding a safer category extraction that checks if indices.category exists

- [x] **Review Error Handling in Normalization**
  - Update error handling to not throw errors for missing optional fields like category
  - Modify the `getNewTransactions` function to only check for truly required columns
  - Ensure the logic aligns with the principle that categorization happens after normalization

- [x] **Test Implementation**
  - Test the modified code with a Revolut sheet without a Category column
  - Verify that transactions are normalized correctly with 'Uncategorized' as the default category
  - Confirm that the error is resolved and processing completes successfully
  - Verify that normalized transactions are correctly marked as 'UNPROCESSED' in the Processing Status column
  - Testing confirms that Revolut sheets without a Category column can now be processed successfully

- [x] **Review Other Bank Integrations**
  - Check if Monzo and Yonder integrations also depend on category columns during normalization
  - Update other bank integrations to match the separation of normalization and categorization
  - Ensure all implementations align with ADR-001 and ADR-005 principles
  - Reviewed other bank integrations and confirmed they're safe - the changes we made to the `normalizeTransaction` function and `getNewTransactions` function now handle all banks consistently by making 'category' an optional field

- [x] **Final Reassessment**
  - Verify the original error is resolved
  - Confirm that all transactions are being processed according to ADR-001 and ADR-005
  - Validate that no new errors have been introduced
  - Ensure the categorization process still works correctly with the normalized data
  - Implementation successfully adheres to ADR-001 and ADR-005 by separating normalization and categorization phases
  - Revolut sheet processing will now work correctly without a Category column
  - The fix ensures category is treated as optional during normalization for all bank integrations

## Timeline
This is a critical fix that should be implemented immediately to restore the functionality of the transaction processing system.

## Security Considerations
No security implications as this change only affects data processing flow.

## Maintenance Notes
The implementation should focus on properly separating the normalization and categorization processes as defined in ADR-005. We should consider:

1. Adding validation that verifies sheet structure against ADR-001 specs
2. Implementing automated tests for each source format
3. Adding better error messages that indicate when source data doesn't match expected format
4. Ensuring clear separation between normalization and categorization phases

## Human Workflow
1. The Magnificent Code Wizard (you) will update the code to remove category dependency during normalization
2. The implementation should respect the design decisions in ADR-001 and ADR-005
3. Test the changes to ensure transactions process without errors

## Testing
- Test with current Revolut sheet after changes
- Verify all transactions are normalized without errors
- Check that normalized transactions have 'Uncategorized' as their initial category
- Confirm that the categorization process still works correctly in its separate phase
- Validate against all example data formats in ADR-001

## Edge Cases
- What happens if a Category column is later added to Revolut sheets? (Should be ignored during normalization)
- How does the system handle manual category overrides in the output sheet?
- Are there other places in the code that might incorrectly depend on source categories? 