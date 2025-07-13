# Bug Tracker

This document tracks known bugs and issues in the FIRE project. Each bug entry should include:
- A unique identifier
- Description
- Status (Open, In Progress, Fixed)
- Priority (High, Medium, Low)
- Related documentation
- Date reported
- Last updated

## Active Bugs

### BUG-002: Credit/Debit Normalization
- **Status**: Open
- **Priority**: High
- **Description**: The transaction normalization process needs to be updated to properly handle credits vs debits. Currently, it assumes all transactions are debits and needs to be modified to respect the transaction type from source sheets.
- **Related Documentation**: [ADR 001: Data Normalization Strategy](/docs/adr/001-data-normalization-strategy.md)
- **Date Reported**: 2025-05-10
- **Last Updated**: 2025-05-10
- **Impact**: Affects financial reporting accuracy by incorrectly handling credit transactions.

## Bug Resolution Process

1. **Reporting**
   - New bugs should be added to this tracker with a unique identifier
   - Include all required fields (description, priority, etc.)
   - Link to relevant documentation

2. **Tracking**
   - Update status as work progresses
   - Add implementation plan reference when work begins
   - Document resolution steps

3. **Resolution**
   - Mark as fixed when resolved
   - Add resolution date
   - Link to relevant commit or implementation plan
   - Move to "Resolved Bugs" section

## Resolved Bugs

### BUG-001: Duplicate Transaction Processing
- **Status**: Fixed
- **Priority**: High
- **Description**: The normalization process currently re-adds every row from input sheets on each run due to broken logic for checking existing transactions.
- **Related Documentation**: [ADR 001: Data Normalization Strategy](/docs/adr/001-data-normalization-strategy.md)
- **Date Reported**: 2025-05-10
- **Last Updated**: 2025-07-13
- **Resolution Date**: 2025-07-13
- **Impact**: Affects data integrity by creating duplicate entries in the output sheet.
- **Resolution**: Fixed duplicate detection logic by:
  - Filtering empty references from existing transactions
  - Using a Set for faster O(1) duplicate lookups
  - Normalizing references before comparison (trim whitespace)
  - Adding new references to the Set during processing to prevent duplicates within the same run
  - Added detailed logging for duplicate detection 