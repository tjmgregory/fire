# System Use Cases

This document defines the user-facing use cases for the FIRE transaction categorisation system. Use cases describe how actors (primarily the Financial Tracker user) achieve their goals through interactions with the system.

## Use Case Index

### Primary Use Cases (User Goals)

1. [UC-001: Import and Normalize Transactions](#uc-001-import-and-normalize-transactions) - Must Have
2. [UC-002: Review Categorized Transactions](#uc-002-review-categorized-transactions) - Must Have
3. [UC-003: Override Transaction Category](#uc-003-override-transaction-category) - Must Have
4. [UC-004: Monitor Processing Status](#uc-004-monitor-processing-status) - Must Have

### System Use Cases (Automated Workflows)

5. [UC-005: Execute Scheduled Normalization](#uc-005-execute-scheduled-normalization) - Must Have
6. [UC-006: Execute Scheduled Categorization](#uc-006-execute-scheduled-categorization) - Must Have

### Administrative Use Cases

7. [UC-007: Configure Category Definitions](#uc-007-configure-category-definitions) - Must Have

---

## Actors

### Primary Actors

**User (Financial Tracker)**

- Person tracking their financial transactions
- Manages multiple bank accounts (Monzo, Revolut, Yonder)
- Reviews and corrects AI categorization
- Accesses system through Google Sheets interface
- Goals: Understand spending patterns, track expenses, achieve financial independence

**Developer/Administrator**

- Technical owner of the FIRE system
- Configures bank sources and categories
- Monitors system logs and resolves errors
- Updates system configuration

### Secondary Actors

**Google Sheets Platform**

- Provides data storage (source and result sheets)
- Executes formulas (category override logic)
- Triggers scheduled executions
- Hosts Google Apps Script runtime

**OpenAI API (GPT-4)**

- External AI service for transaction categorization
- Receives transaction context and returns category + confidence score

**Exchange Rate API**

- External service providing currency conversion rates
- Responds to API requests with current rates

---

## Primary Use Cases

### UC-001: Import and Normalize Transactions

**Goal**: User wants their bank transactions from multiple sources to appear in a single, standardized sheet with consistent formatting and GBP amounts.

**Primary Actor**: User (Financial Tracker)

**Supporting Actor**: System (automated processing)

**Trigger**: User adds new transactions to one or more source sheets (Monzo, Revolut, or Yonder)

**Preconditions**:

- User has access to Google Sheets with FIRE system installed
- At least one bank source sheet exists with transactions
- Result sheet is configured and accessible
- Scheduled normalization is enabled (or user manually triggers it)

**Main Success Scenario**:

1. User adds new transaction(s) to bank source sheet(s) (e.g., exports from Monzo)
2. User waits for scheduled normalization (every 15 minutes) OR manually triggers normalization
3. System processes new transactions from all source sheets
4. User opens result sheet
5. User sees new transactions appear with:
   - Standardized column format
   - All amounts converted to GBP
   - Status showing "NORMALISED"
   - Timestamp indicating when normalization occurred
6. User can now see all their transactions from multiple banks in one place

**Alternative Flows**:

**3a. Transaction data is invalid**:

- 3a1. System detects invalid data (missing date, invalid amount, etc.)
- 3a2. System creates row in result sheet with status "ERROR"
- 3a3. User sees error status and can review error message
- 3a4. User corrects data in source sheet and waits for next normalization run

**3b. Duplicate transaction detected**:

- 3b1. System detects transaction already exists (by transaction ID)
- 3b2. System skips duplicate (does not create new row)
- 3b3. User sees original transaction unchanged in result sheet

**5a. Non-GBP currency conversion fails**:

- 5a1. System cannot fetch exchange rate for transaction currency
- 5a2. Transaction appears with status "ERROR" and error message
- 5a3. User sees which transactions failed conversion
- 5a4. User can retry manually or wait for next scheduled run

**Postconditions**:

- New valid transactions appear in result sheet with status "NORMALISED"
- All amounts are shown in GBP (with original currency preserved)
- Duplicate transactions are prevented
- User can see which transactions require attention (ERROR status)
- System is ready for categorization phase

**Requirements Satisfied**: FR-001, FR-002, FR-003, FR-004, FR-006, FR-007, FR-010, FR-011, FR-012, NFR-001, NFR-006

**Related Use Cases**: UC-005 (system automation of this workflow)

---

### UC-002: Review Categorized Transactions

**Goal**: User wants to see their transactions automatically categorized by AI so they can understand their spending patterns without manual categorization.

**Primary Actor**: User (Financial Tracker)

**Supporting Actor**: System (automated AI categorization)

**Trigger**: User opens result sheet to review transactions after categorization has run

**Preconditions**:

- Result sheet contains normalized transactions (from UC-001)
- AI categorization has completed (runs hourly)
- User has access to result sheet

**Main Success Scenario**:

1. User opens result sheet in Google Sheets
2. User sees transactions with populated category information:
   - "AI Category" column shows AI's suggestion
   - "Category" column shows the effective category
   - "Confidence Score" shows AI's confidence (0-100%)
   - Status shows "CATEGORISED"
3. User reviews categories for accuracy
4. User identifies patterns in their spending (e.g., "Transport", "Groceries")
5. User can filter, sort, and analyze transactions by category

**Alternative Flows**:

**2a. Transaction has low confidence score (< 50%)**:

- 2a1. User sees low confidence score for transaction
- 2a2. User reviews AI's suggested category
- 2a3. User decides whether to accept or override (**see UC-003**)
- 2a4. Resume at step 3

**2b. Transaction categorization failed**:

- 2b1. User sees transaction with status "ERROR"
- 2b2. User reads error message (e.g., "AI categorization failed")
- 2b3. User can manually override category (**see UC-003**)
- 2b4. System will retry categorization on next scheduled run

**2c. Some transactions not yet categorized**:

- 2c1. User sees transactions with status "NORMALISED" (not yet categorized)
- 2c2. User waits for next categorization run (hourly)
- 2c3. User can manually trigger categorization if urgent
- 2c4. Resume at step 2 after categorization completes

**3a. User disagrees with AI category**:

- 3a1. User identifies incorrect categorization
- 3a2. User proceeds to **UC-003: Override Transaction Category**
- 3a3. Resume at step 4

**Postconditions**:

- User understands their spending patterns
- User has identified any categories needing correction
- User can make informed financial decisions based on categorized data
- User knows which transactions need manual review (low confidence or errors)

**Requirements Satisfied**: FR-005, FR-014, NFR-004

**Related Use Cases**: UC-003 (override categories), UC-006 (system automation)

---

### UC-003: Override Transaction Category

**Goal**: User wants to correct an AI-generated category that is incorrect or insufficiently specific.

**Primary Actor**: User (Financial Tracker)

**Trigger**: User identifies incorrect AI categorization while reviewing transactions

**Preconditions**:

- Transaction exists in result sheet
- Transaction has been categorized (AI category is populated)
- User has edit access to result sheet

**Main Success Scenario**:

1. User opens result sheet in Google Sheets
2. User identifies transaction with incorrect AI category
   - Example: AI categorized "Tesco" as "Shopping" but user wants "Groceries"
3. User clicks on "Manual Category" column cell for that transaction
4. User types desired category name (e.g., "Groceries")
5. User presses Enter to confirm
6. onEdit trigger automatically resolves "Groceries" to category ID and updates "Manual Category ID"
7. Google Sheets formula automatically updates "Category" column to show "Groceries"
8. User sees immediate change reflected in all views and analyses
9. Future similar transactions benefit from this correction (historical learning)

**Alternative Flows**:

**4a. User types category name not in Categories sheet**:

- 4a1. User types category not in predefined list (e.g., "Weekend Treats")
- 4a2. onEdit trigger searches Categories sheet but finds no match
- 4a3. Trigger logs warning but allows custom category name
- 4a4. "Manual Category ID" remains empty (no foreign key reference)
- 4a5. Category name appears in "Category" column
- 4a6. Future AI runs may learn from this custom category
- 4a7. Resume at step 8

**4b. User wants to clear previous manual override**:

- 4b1. User selects "Manual Category" cell
- 4b2. User deletes content (makes cell empty)
- 4b3. onEdit trigger clears "Manual Category ID" as well
- 4b4. "Category" column reverts to showing AI category
- 4b5. Resume at step 8

**6a. onEdit trigger fails to execute**:

- 6a1. Trigger error occurs (permissions, script disabled, etc.)
- 6a2. User sees category name but ID is not populated
- 6a3. Category still appears in "Category" column (name-based)
- 6a4. User can continue working; ID resolution can happen later
- 6a5. Resume at step 8

**3a. Transaction not yet categorized by AI**:

- 3a1. "AI Category" column is empty
- 3a2. User can still enter manual category
- 3a3. Manual category will be used immediately
- 3a4. Resume at step 4

**Postconditions**:

- "Manual Category" column contains user's typed category name
- "Manual Category ID" contains resolved category ID (if match found)
- "Category" column displays user's chosen category (via formula)
- Original AI category remains preserved for audit
- Manual override persists across all system runs
- Category ID enables referential integrity and category renaming
- System learns from override for future similar transactions (FR-014)
- User's financial analysis reflects corrected category

**Requirements Satisfied**: FR-013, FR-014, FR-016, NFR-004

**Related Use Cases**: UC-002 (discovering need to override)

---

### UC-004: Monitor Processing Status

**Goal**: User wants to check whether the system is working correctly and identify any transactions that require attention.

**Primary Actor**: User (Financial Tracker)

**Trigger**: User wants to verify system health or troubleshoot issues

**Preconditions**:

- Result sheet exists and contains transactions
- User has access to result sheet and system logs

**Main Success Scenario**:

1. User opens result sheet in Google Sheets
2. User reviews "Processing Status" column across transactions:
   - "NORMALISED" = transaction normalized, awaiting categorization
   - "CATEGORISED" = fully processed and ready for analysis
   - "ERROR" = processing failed, needs attention
3. User filters or sorts by status to see any issues
4. For transactions with "ERROR" status:
   - User reads error message in "Error Message" column
   - User understands what went wrong
5. User checks timestamps to see when processing occurred:
   - "Timestamp Normalised" shows when transaction was imported
   - "Timestamp Categorised" shows when AI categorization completed
6. User confirms system is processing transactions regularly

**Alternative Flows**:

**4a. User finds ERROR transactions**:

- 4a1. User identifies transactions with ERROR status
- 4a2. User reads error messages:
  - "Exchange rate unavailable" → currency conversion issue
  - "Invalid data" → source data problem
  - "AI categorization failed" → API issue
- 4a3. User decides on action:
  - If source data issue: correct in source sheet, wait for reprocessing
  - If system issue: contact administrator or wait for retry
  - If urgent: manually enter category (**UC-003**)
- 4a4. Resume at step 6

**4b. User notices no recent timestamps**:

- 4b1. User sees transactions with old timestamps
- 4b2. User checks if scheduled triggers are running
- 4b3. User may manually trigger processing
- 4b4. User contacts administrator if issue persists

**6a. User needs detailed logs**:

- 6a1. User navigates to Google Apps Script execution logs
- 6a2. User reviews detailed log entries
- 6a3. User shares relevant logs with administrator if needed

**Postconditions**:

- User understands current system health
- User knows which transactions need attention
- User can identify patterns in errors (e.g., specific currency failing)
- User can make informed decision about whether intervention needed
- User has visibility into processing timeline

**Requirements Satisfied**: FR-008, NFR-003, NFR-004

---

## System Use Cases

These use cases describe automated workflows where the system acts independently on a schedule.

### UC-005: Execute Scheduled Normalization

**Goal**: System automatically processes new transactions from source sheets every 15 minutes.

**Primary Actor**: System (Scheduled Trigger)

**Trigger**: Time-based trigger (every 15 minutes) OR manual execution by User/Developer

**Preconditions**:

- Google Apps Script time-driven trigger is configured
- Source sheets exist and are accessible
- Result sheet is accessible

**Main Success Scenario**:

1. Scheduled trigger fires (every 15 minutes)
2. System reads all active bank source configurations
3. For each bank source (Monzo, Revolut, Yonder):
   - System reads transactions from source sheet
   - System validates and normalizes data
   - System converts currencies to GBP
   - System generates missing transaction IDs (for Revolut/Yonder)
   - System checks for duplicates
   - System appends new normalized transactions to result sheet
   - System sets status to "NORMALISED"
4. System logs summary: transactions processed, succeeded, failed
5. System updates processing run record
6. Normalized transactions are ready for categorization (**UC-006**)

**Alternative Flows**:

**3a. Source sheet inaccessible**:

- 3a1. System logs error and continues with other sources
- 3a2. Developer reviews logs

**3b. Exchange rate API fails**:

- 3b1. System retries with exponential backoff (up to 5 attempts)
- 3b2. If all retries fail, marks affected transactions as ERROR
- 3b3. System continues with other transactions

**Postconditions**:

- New transactions appear in result sheet with status "NORMALISED"
- Processing run is logged
- System ready for next scheduled run
- User can see results immediately (**UC-001**)

**Requirements Satisfied**: FR-001, FR-002, FR-003, FR-004, FR-006, FR-007, FR-009, FR-010, FR-011, FR-012, NFR-001, NFR-002, NFR-003, NFR-006

**Related Use Cases**: UC-001 (user-facing result)

**Technical Details**: See [System Workflows](system-workflows.md) for detailed implementation

---

### UC-006: Execute Scheduled Categorization

**Goal**: System automatically categorizes normalized transactions using AI every hour.

**Primary Actor**: System (Scheduled Trigger)

**Secondary Actor**: OpenAI API (GPT-4)

**Trigger**: Time-based trigger (every hour) OR manual execution by User/Developer

**Preconditions**:

- Google Apps Script time-driven trigger is configured
- Result sheet contains transactions with status "NORMALISED"
- OpenAI API credentials are configured
- Category definitions are loaded

**Main Success Scenario**:

1. Scheduled trigger fires (every hour)
2. System queries for uncategorized transactions (status = "NORMALISED")
3. System processes transactions in batches (e.g., 10 at a time)
4. For each batch:
   - System searches for similar historical transactions
   - System sends batch to OpenAI API with context
   - System receives categories and confidence scores
   - System validates categories against approved list
   - System updates transactions with AI categories
   - System sets status to "CATEGORISED"
5. System logs summary: transactions categorized, confidence scores, failures
6. Categorized transactions available for user review (**UC-002**)

**Alternative Flows**:

**2a. No uncategorized transactions**:

- 2a1. System logs "No transactions to categorize" and exits successfully

**4a. OpenAI API request fails**:

- 4a1. System retries with exponential backoff (up to 5 attempts)
- 4a2. If all retries fail, marks batch transactions as ERROR
- 4a3. System continues with next batch

**Postconditions**:

- Processed transactions have AI categories and confidence scores
- Processing run is logged
- System ready for next scheduled run
- User can review categorized transactions (**UC-002**)

**Requirements Satisfied**: FR-005, FR-009, FR-014, FR-015, NFR-002, NFR-004, NFR-006

**Related Use Cases**: UC-002 (user-facing result)

**Technical Details**: See [System Workflows](system-workflows.md) for detailed implementation

---

## Administrative Use Cases

### UC-007: Configure Category Definitions

**Goal**: Developer wants to add, update, or deactivate transaction categories used by the AI.

**Primary Actor**: Developer/Administrator

**Trigger**: Need to modify category definitions (new spending pattern, incorrect category, etc.)

**Preconditions**:

- Developer has access to Google Sheets
- Categories configuration sheet exists

**Main Success Scenario**:

1. Developer opens the "Categories" configuration sheet
2. Developer reviews current category list with descriptions and examples
3. Developer makes desired changes:
   - **Add**: New row with category name, description, and examples
   - **Update**: Modify description or examples for existing category row
   - **Deactivate**: Set category `isActive` column to FALSE (soft delete)
4. Developer saves changes (automatic in Google Sheets)
5. System automatically loads new categories on next processing run
6. Future categorizations use updated category definitions

**Alternative Flows**:

**3a. Developer adds duplicate category**:

- 3a1. System validation detects duplicate name
- 3a2. System rejects change with error message
- 3a3. Developer uses unique name
- 3a4. Resume at step 4

**3b. Developer wants to delete category with existing usage**:

- 3b1. Developer should not delete the row (would break historical references)
- 3b2. Developer sets `isActive` to FALSE instead (soft delete)
- 3b3. Category remains visible in old transactions but unavailable for new categorizations
- 3b4. Resume at step 4

**5a. Major category changes require re-categorization**:

- 5a1. Developer manually triggers re-categorization for all/filtered transactions
- 5a2. System re-runs categorization with new definitions
- 5a3. User sees updated categories

**Postconditions**:

- Category definitions are updated
- Changes are logged for audit
- AI uses new categories for future categorizations
- Existing transactions retain their categories (unless re-categorization triggered)
- Inactive categories preserved for historical data integrity

**Requirements Satisfied**: FR-015, NFR-005

**Related Use Cases**: UC-006 (uses these category definitions)

---

## Use Case Relationships

### User Journey Flow

```text
User adds transactions to source sheet
        ↓
   [UC-001: Import and Normalize]
        ↓
   [UC-002: Review Categories]
        ↓
   [UC-003: Override if needed]
        ↓
   [UC-004: Monitor status]
```

### System Automation Flow

```text
Every 15 minutes: [UC-005: Scheduled Normalization]
        ↓
Every hour: [UC-006: Scheduled Categorization]
        ↓
User sees results: [UC-002: Review Categories]
```

### Support Flow

```text
[UC-007: Configure Categories] → affects → [UC-006: Categorization]
                                              ↓
                                        [UC-002: Review]
```

---

## Use Case Traceability Matrix

| Use Case | Requirements Satisfied | Primary Benefit |
|----------|------------------------|-----------------|
| UC-001 | FR-001, FR-002, FR-003, FR-004, FR-006, FR-007, FR-010, FR-011, FR-012, NFR-001, NFR-006 | Multi-bank transaction consolidation |
| UC-002 | FR-005, FR-014, NFR-004 | Automated spending analysis |
| UC-003 | FR-013, FR-014, FR-016, NFR-004 | User control and accuracy |
| UC-004 | FR-008, NFR-003, NFR-004 | System transparency |
| UC-005 | FR-001, FR-002, FR-003, FR-004, FR-006, FR-007, FR-009, FR-010, FR-011, FR-012, NFR-001, NFR-002, NFR-003, NFR-006 | Automation reliability |
| UC-006 | FR-005, FR-009, FR-014, FR-015, NFR-002, NFR-004, NFR-006 | AI categorization automation |
| UC-007 | FR-015, NFR-005 | System adaptability |

---

## Non-Functional Considerations

### Performance

- **UC-005**: Completes within 2 minutes for typical volume (100 transactions/day)
- **UC-006**: Batch processing optimizes API costs and latency
- **UC-001**: Near real-time visibility (15-minute normalization cycle)

### Reliability

- Both UC-005 and UC-006 include retry mechanisms (FR-009)
- Errors don't block progress (fail-safe processing)
- Partial failures are acceptable (NFR-003)

### Usability

- **UC-003**: Immediate feedback (Google Sheets formula updates instantly)
- **UC-004**: Clear status indicators help users understand system state
- **UC-002**: Confidence scores guide user attention to uncertain categorizations

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-18 | 1.0 | Initial use case document | AI (Claude) |
| 2025-11-18 | 2.0 | Refactored to user-centric use cases | AI (Claude) |

---

## References

- [Requirements Catalogue](../01-inception/requirements-catalogue.md)
- [Entity Models](entity-models.md)
- [Vision Statement](../01-inception/VISION.md)
- [System Workflows](system-workflows.md) - Technical implementation details
