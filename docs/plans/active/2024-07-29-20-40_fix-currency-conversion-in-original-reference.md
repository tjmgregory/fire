# Plan: Fix Currency Conversion Issues in Original Reference Generation

## Architecture Overview
This plan addresses two key issues in our data normalization strategy:

1. Unnecessary currency conversion for sheets that already have a GBP column (e.g., Yonder)
2. Including converted amounts in the `originalReference`, which could lead to inconsistencies when exchange rates change

## Technical Components
- Update ADR-001 to improve original reference generation strategy
- Modify the reference generation logic in the transaction normalization system
- Update example code in documentation

## Implementation Steps

- [x] **Step 1: Update ADR-001 to revise reference generation strategy**
  - Remove amount from `originalReference` generation formula
  - Add bank-specific reference generation logic
  - Specify currency conversion prioritization rules
  - Add a note about using stable identifiers only

- [ ] **Step 2: Revise the currency conversion rules in implementation**
  - For sheets with a GBP amount column (like Yonder), use that value directly
  - Only apply currency conversion when no GBP amount is available
  - Implement priority order for amount selection:
    1. Use "Amount (GBP)" if available
    2. Use amount if currency is already GBP
    3. Apply currency conversion only if neither condition is met

- [ ] **Step 3: Modify the original reference generation implementation**
  - Remove amount from the reference generation formula
  - Use only stable identifying information (date, time, transaction type)
  - For Monzo: keep using the native transaction ID
  - For Revolut: use `${date}T${time}_${type}`
  - For Yonder: use `${date}T${time}_${description.substring(0, 20).trim()}`

- [ ] **Step 4: Update code documentation**
  - Add comments explaining the rationale for reference stability
  - Document the currency conversion priorities
  - Add code examples showing the implementation

- [ ] **Step 5: Add tests for new reference generation**
  - Test Yonder transactions to verify direct use of GBP amount
  - Test Revolut transactions to verify stable reference generation
  - Test exchange rate stability impact

- [ ] **Step 6: Re-assess the plan and implementation**
  - Review changes for completeness
  - Verify that all currency-related edge cases are handled
  - Check that no new issues have been introduced

## Timeline
Implementation can be completed within 1-2 days.

## Security Considerations
No security impact. This is a data processing change only.

## Maintenance Notes
- This change will provide more stable transaction references that don't change with exchange rates
- Will improve deduplication reliability across time

## Test Cases
- Test with Yonder transactions to verify GBP amount is used directly
- Test with Revolut EUR transactions to verify proper conversion only for normalized amount
- Test with Monzo transactions to verify original IDs are preserved
- Verify references remain stable when exchange rates change

## Edge Cases Handled
- Transactions with multiple currency values
- Missing currency information
- Incomplete date/time information 