# Acceptance Tests

**Document Version**: 1.0
**Last Updated**: 2025-11-18
**Phase**: Elaboration
**Traceability**: References [requirements-catalogue.md](../01-inception/requirements-catalogue.md), [test-strategy.md](../01-inception/test-strategy.md), [use-cases.md](use-cases.md)

## Document Purpose

This document defines acceptance tests for the FIRE project. Acceptance tests validate that requirements are met from the user's perspective and serve as the bridge between requirements specification and implementation verification.

## Acceptance Testing Philosophy

### Key Principles

1. **User-Centric**: Tests validate user-facing behaviors, not implementation details
2. **Requirement-Driven**: Each test traces directly to one or more requirements
3. **Independent**: Tests can be executed in any order without dependencies
4. **Reproducible**: Tests use defined test data and produce consistent results
5. **Behavior-Focused**: Tests validate "what" the system does, not "how" it does it

### Test Organization

Acceptance tests are organized by:
- **Functional Requirements (AT-FR-xxx)**: User-visible features and behaviors
- **Non-Functional Requirements (AT-NFR-xxx)**: Quality attributes and constraints
- **Use Case Scenarios (AT-UC-xxx)**: Complete user workflows

### Test Data Strategy

Following the test strategy principles:
- **Acceptance tests use static reference datasets** for consistency and manual verification
- **Test data is documented and version controlled** in `test-data/acceptance/`
- **Edge cases are explicitly represented** in the test dataset
- **Tests are designed for manual execution** during UAT and release validation

---

## Test Index

### Functional Requirement Tests

| Test ID | Requirement | Test Name | Priority |
|---------|-------------|-----------|----------|
| AT-FR-001 | FR-001 | Transaction Normalization from Multiple Sources | Must Have |
| AT-FR-002 | FR-002 | Concurrent Transaction Handling | Must Have |
| AT-FR-003 | FR-003 | Currency Standardization to GBP | Must Have |
| AT-FR-004 | FR-004 | Currency Conversion from Non-GBP | Must Have |
| AT-FR-005 | FR-005 | Asynchronous AI Categorization | Must Have |
| AT-FR-006 | FR-006 | Multi-Bank Schema Support | Must Have |
| AT-FR-007 | FR-007 | Exchange Rate API Integration | Must Have |
| AT-FR-008 | FR-008 | Error Handling and Logging | Must Have |
| AT-FR-009 | FR-009 | Network Retry Mechanism | Must Have |
| AT-FR-010 | FR-010 | Transaction Deduplication | Must Have |
| AT-FR-011 | FR-011 | Data Validation | Must Have |
| AT-FR-012 | FR-012 | Source Sheet ID Backfilling | Must Have |
| AT-FR-013 | FR-013 | Manual Category Override | Must Have |
| AT-FR-014 | FR-014 | Historical Transaction Learning | Should Have |
| AT-FR-015 | FR-015 | Category Definitions Management | Must Have |
| AT-FR-016 | FR-016 | Category Name Resolution via onEdit Trigger | Must Have |

### Non-Functional Requirement Tests

| Test ID | Requirement | Test Name | Priority |
|---------|-------------|-----------|----------|
| AT-NFR-001 | NFR-001 | Data Integrity Verification | Must Have |
| AT-NFR-002 | NFR-002 | Performance Under Expected Load | Must Have |
| AT-NFR-003 | NFR-003 | Reliability and Error Recovery | Must Have |
| AT-NFR-004 | NFR-004 | Auditability and Traceability | Should Have |
| AT-NFR-005 | NFR-005 | Maintainability and Extensibility | Should Have |
| AT-NFR-006 | NFR-006 | Two-Phase Processing Architecture | Must Have |

### Use Case Scenario Tests

| Test ID | Use Case | Test Name | Priority |
|---------|----------|-----------|----------|
| AT-UC-001 | UC-001 | Import and Normalize Transactions End-to-End | Must Have |
| AT-UC-002 | UC-002 | Review Categorized Transactions | Must Have |
| AT-UC-003 | UC-003 | Override Transaction Category | Must Have |
| AT-UC-004 | UC-004 | Monitor Processing Status | Must Have |
| AT-UC-005 | UC-005 | Execute Scheduled Normalization | Must Have |
| AT-UC-006 | UC-006 | Execute Scheduled Categorization | Must Have |
| AT-UC-007 | UC-007 | Configure Category Definitions | Must Have |

---

## Functional Requirement Tests

### AT-FR-001: Transaction Normalization from Multiple Sources

**Requirement**: FR-001 - Transaction Normalization

**Objective**: Verify that transactions from multiple source sheets with different schemas are normalized into a single target sheet with standardized format.

**Test Setup**:
- Prepare 3 source sheets (Monzo, Revolut, Yonder) with different column schemas
- Each source sheet contains 5 test transactions
- Result sheet is empty

**Test Data**:
```
Monzo: 5 transactions with Monzo schema
Revolut: 5 transactions with Revolut schema
Yonder: 5 transactions with Yonder schema
Total: 15 transactions
```

**Test Steps**:
1. Create source sheets with defined schemas (Monzo, Revolut, Yonder)
2. Populate each source sheet with 5 transactions
3. Execute normalization process (manually or via trigger)
4. Review result sheet

**Expected Results**:
- ✅ Result sheet contains exactly 15 rows (one per transaction)
- ✅ All rows have standardized column headers
- ✅ All transactions preserve original data (date, description, amount, currency)
- ✅ Column mapping correctly translates source-specific fields to standard fields
- ✅ No data loss or corruption occurs
- ✅ Processing status shows "NORMALISED"

**Acceptance Criteria** (from FR-001):
- ✅ Accept input from N source sheets (N=3 in this test)
- ✅ Map all source columns to standardized schema
- ✅ Preserve all original transaction data

**Traceability**: FR-001, UC-001, UC-005

---

### AT-FR-002: Concurrent Transaction Handling

**Requirement**: FR-002 - Concurrent Transaction Handling

**Objective**: Verify that simultaneous additions to multiple source sheets result in all transactions appearing in the result sheet without loss or duplication.

**Test Setup**:
- 2 source sheets (Monzo, Revolut)
- Result sheet is empty
- Mechanism to add transactions to both sheets simultaneously

**Test Data**:
```
Monzo: 3 new transactions added at T=0
Revolut: 3 new transactions added at T=0
Total: 6 transactions added concurrently
```

**Test Steps**:
1. Prepare two source sheets with initial state
2. Simultaneously add 3 transactions to Monzo sheet
3. Simultaneously add 3 transactions to Revolut sheet
4. Wait for normalization trigger (or manually trigger)
5. Review result sheet

**Expected Results**:
- ✅ Result sheet contains exactly 6 rows
- ✅ All 3 Monzo transactions appear
- ✅ All 3 Revolut transactions appear
- ✅ No duplicate rows exist
- ✅ All transactions have unique IDs
- ✅ Transaction ordering is preserved where deterministic

**Acceptance Criteria** (from FR-002):
- ✅ No transactions lost when multiple writes occur concurrently
- ✅ No duplicate transactions created
- ✅ Transaction ordering preserved where possible

**Traceability**: FR-002, FR-010, UC-001, UC-005

**Note**: This is a high-risk test due to Google Sheets concurrency limitations. May require manual verification or specialized test setup.

---

### AT-FR-003: Currency Standardization to GBP

**Requirement**: FR-003 - Currency Standardization

**Objective**: Verify that all transaction amounts on the result sheet are displayed in GBP, with original currency preserved.

**Test Setup**:
- Source sheet with transactions in multiple currencies (GBP, USD, EUR)
- Result sheet is empty

**Test Data**:
```
5 transactions in GBP (no conversion needed)
3 transactions in USD (require conversion)
2 transactions in EUR (require conversion)
Total: 10 transactions
```

**Test Steps**:
1. Populate source sheet with transactions in various currencies
2. Execute normalization process
3. Review result sheet

**Expected Results**:
- ✅ "Amount (GBP)" column shows all amounts in GBP
- ✅ "Original Amount" column preserves original amounts
- ✅ "Original Currency" column preserves original currency codes
- ✅ GBP transactions show same value in both original and GBP columns
- ✅ Non-GBP transactions show converted values in GBP column
- ✅ All amounts are numeric and properly formatted

**Acceptance Criteria** (from FR-003):
- ✅ All amounts on result sheet are in GBP
- ✅ Original currency information preserved for reference

**Traceability**: FR-003, FR-004, FR-007, UC-001

---

### AT-FR-004: Currency Conversion from Non-GBP

**Requirement**: FR-004 - Currency Conversion

**Objective**: Verify that transactions in non-GBP currencies are converted to GBP using current exchange rates.

**Test Setup**:
- Source sheet with non-GBP transactions (USD, EUR, JPY)
- Exchange rate API accessible
- Result sheet is empty

**Test Data**:
```
Transaction 1: $100 USD (expect conversion to ~£75 at typical rate)
Transaction 2: €50 EUR (expect conversion to ~£42 at typical rate)
Transaction 3: ¥10000 JPY (expect conversion to ~£55 at typical rate)
```

**Test Steps**:
1. Note current exchange rates for USD, EUR, JPY → GBP
2. Add test transactions in non-GBP currencies
3. Execute normalization process
4. Review result sheet conversions

**Expected Results**:
- ✅ "Amount (GBP)" shows converted amounts
- ✅ Conversions are within ±1% of expected values (accounting for rate fluctuations)
- ✅ "Original Amount" preserves original values ($100, €50, ¥10000)
- ✅ "Original Currency" shows original currency codes (USD, EUR, JPY)
- ✅ Exchange rates are fetched from reliable provider
- ✅ Conversion formula: GBP Amount = Original Amount × Exchange Rate

**Acceptance Criteria** (from FR-004):
- ✅ Convert non-GBP amounts to GBP using current exchange rates
- ✅ Store both original amount/currency and converted GBP amount
- ✅ Exchange rate data from reliable provider

**Traceability**: FR-004, FR-007, UC-001

---

### AT-FR-005: Asynchronous AI Categorization

**Requirement**: FR-005 - Asynchronous AI Categorization

**Objective**: Verify that transactions are categorized using AI in scheduled batches, with confidence scores and tracking.

**Test Setup**:
- Result sheet with 25 normalized but uncategorized transactions (status = "NORMALISED")
- Categories sheet with defined category list
- OpenAI API accessible
- Categorization schedule configured (e.g., hourly)

**Test Data**:
```
25 transactions covering various merchants:
- 5 grocery transactions (Tesco, Sainsbury's, etc.)
- 5 transport transactions (TfL, Uber, etc.)
- 5 dining transactions (restaurants, cafes)
- 5 entertainment transactions (cinema, streaming)
- 5 miscellaneous transactions (edge cases)
```

**Test Steps**:
1. Populate result sheet with 25 normalized transactions
2. Verify all transactions have status = "NORMALISED"
3. Wait for scheduled categorization trigger (or manually execute)
4. Review result sheet after categorization

**Expected Results**:
- ✅ Categorization processes transactions in batches (e.g., batches of 10)
- ✅ All 25 transactions are categorized (status = "CATEGORISED")
- ✅ "AI Category ID" column populated for all transactions
- ✅ "AI Category" column shows category names (cached for display)
- ✅ "Confidence Score" column shows values between 0-100%
- ✅ All categories are from predefined Categories sheet
- ✅ Similar transactions receive similar categories
- ✅ Timestamp Categorised is populated for all transactions
- ✅ Only uncategorized transactions were processed

**Acceptance Criteria** (from FR-005):
- ✅ Categorization runs on defined schedule (less frequent than normalization)
- ✅ Process transactions in batches (e.g., batches of 10)
- ✅ Only uncategorized transactions processed
- ✅ Categories selected from predefined list
- ✅ AI provides confidence scores (0-100%)
- ✅ Confidence scores stored alongside categories
- ✅ System tracks which transactions categorized
- ✅ Recent similar transactions included as context

**Traceability**: FR-005, FR-015, UC-002, UC-006

---

### AT-FR-006: Multi-Bank Schema Support

**Requirement**: FR-006 - Source Sheet Schema Support

**Objective**: Verify that the system correctly handles transactions from Monzo, Revolut, and Yonder, each with their specific schemas.

**Test Setup**:
- 3 source sheets with bank-specific schemas
- Result sheet is empty

**Test Data**:
```
Monzo Transaction:
  Date: 2025-11-01
  Time: 14:30
  Name: Tesco
  Description: Grocery shopping
  Amount: -45.67
  Currency: GBP
  Category: (Monzo's category)
  Type: Purchase
  Transaction ID: tx_monzo_001
  Notes and #tags: #groceries

Revolut Transaction:
  Started Date: 2025-11-01 10:00
  Completed Date: 2025-11-01 10:05
  Description: Amazon UK
  Amount: -29.99
  Currency: GBP
  Type: CARD_PAYMENT
  ID: rev_12345
  Product: Standard

Yonder Transaction:
  Date/Time of transaction: 01/11/2025 16:45
  Description: Pret A Manger
  Amount (GBP): -8.50
  Currency: GBP
  Category: Food & Drink
  Debit or Credit: Debit
  Country: United Kingdom
```

**Test Steps**:
1. Create source sheets with exact bank schemas
2. Add one transaction to each bank sheet
3. Execute normalization process
4. Review result sheet

**Expected Results**:
- ✅ All 3 transactions appear in result sheet
- ✅ Monzo date/time correctly combined into standard timestamp
- ✅ Revolut "Completed Date" used (not Started Date)
- ✅ Yonder date/time parsed correctly from UK format
- ✅ All amounts normalized to standard format
- ✅ Transaction IDs preserved (Monzo ID, Revolut ID, generated for Yonder)
- ✅ Descriptions mapped correctly from each schema
- ✅ Bank source identified for each transaction

**Acceptance Criteria** (from FR-006):
- ✅ Support Monzo schema with all specified fields
- ✅ Support Revolut schema with all specified fields
- ✅ Support Yonder schema with all specified fields
- ✅ Column mapping configurable per source sheet
- ✅ System validates required columns exist before processing

**Traceability**: FR-006, UC-001

---

### AT-FR-007: Exchange Rate API Integration

**Requirement**: FR-007 - Exchange Rate API Integration

**Objective**: Verify that exchange rates are fetched once per run and applied consistently to all non-GBP transactions.

**Test Setup**:
- Source sheet with 10 transactions in USD, 5 in EUR, 3 in JPY
- Exchange rate API accessible
- Result sheet is empty

**Test Data**:
```
10 USD transactions with various amounts
5 EUR transactions with various amounts
3 JPY transactions with various amounts
Total: 18 non-GBP transactions requiring conversion
```

**Test Steps**:
1. Monitor API calls during normalization (via logs)
2. Add test transactions to source sheet
3. Execute normalization process
4. Review logs for API call count
5. Review result sheet conversions

**Expected Results**:
- ✅ Exchange rate API called only ONCE per currency per run (3 calls total: USD, EUR, JPY)
- ✅ All USD transactions use same exchange rate within run
- ✅ All EUR transactions use same exchange rate within run
- ✅ All JPY transactions use same exchange rate within run
- ✅ Exchange rates are from reliable provider (e.g., exchangerate-api.com)
- ✅ Supported currencies include: USD, EUR, CAD, AUD, JPY, MAD, THB, SGD, HKD, ZAR, NOK, CNY, SEK
- ✅ ISO 4217 currency codes used throughout

**Acceptance Criteria** (from FR-007):
- ✅ Exchange rates fetched only once per run (not per transaction)
- ✅ Only fetched if non-GBP transactions exist
- ✅ System handles common currencies using ISO 4217 codes
- ✅ Conversion rates applied consistently across all transactions in run

**Traceability**: FR-007, FR-004, UC-005

---

### AT-FR-008: Error Handling and Logging

**Requirement**: FR-008 - Error Handling and Logging

**Objective**: Verify that processing errors are logged with sufficient detail and incomplete transactions are marked appropriately.

**Test Setup**:
- Source sheet with mix of valid and invalid transactions
- Result sheet is empty
- Access to system logs

**Test Data**:
```
Valid transactions: 5
Invalid transactions:
  - Transaction with missing date
  - Transaction with non-numeric amount
  - Transaction with missing description
  - Transaction with unsupported currency
  - Transaction with malformed data
Total: 10 transactions (5 valid, 5 invalid)
```

**Test Steps**:
1. Populate source sheet with valid and invalid transactions
2. Execute normalization process
3. Review result sheet
4. Review system logs (Google Apps Script logs)

**Expected Results**:
- ✅ 5 valid transactions appear with status "NORMALISED"
- ✅ 5 invalid transactions appear with status "ERROR"
- ✅ "Error Message" column populated for each error transaction
- ✅ Error messages are descriptive:
  - "Missing required field: date"
  - "Invalid amount: non-numeric value"
  - "Missing required field: description"
  - "Unsupported currency: XYZ"
- ✅ System logs contain detailed error information:
  - Transaction reference
  - Timestamp
  - Error message
  - Stack trace (if applicable)
- ✅ Processing continues despite errors (doesn't halt on first error)

**Acceptance Criteria** (from FR-008):
- ✅ All processing errors logged with sufficient detail for debugging
- ✅ Incomplete transactions marked with error status
- ✅ Error logs include transaction reference, timestamp, error message
- ✅ Developers can review logs to identify and resolve issues

**Traceability**: FR-008, NFR-003, UC-004

---

### AT-FR-009: Network Retry Mechanism

**Requirement**: FR-009 - Network Retry Mechanism

**Objective**: Verify that failed network calls are retried up to 5 times with exponential backoff.

**Test Setup**:
- Controlled environment to simulate network failures
- Source sheet with transaction requiring API call (e.g., non-GBP currency)
- Access to system logs

**Test Data**:
```
Transaction 1: $100 USD (requires exchange rate API call)
Simulated API behavior: Fail 3 times, then succeed
```

**Test Steps**:
1. Configure test environment to simulate intermittent API failures
2. Add transaction requiring API call
3. Execute normalization process
4. Review logs for retry attempts
5. Review result sheet

**Expected Results**:
- ✅ System makes initial API call (attempt 1)
- ✅ System retries on failure (attempts 2, 3)
- ✅ Exponential backoff observed between retries:
  - Wait ~1s before attempt 2
  - Wait ~2s before attempt 3
  - Wait ~4s before attempt 4
- ✅ System succeeds on attempt 4
- ✅ Transaction appears in result sheet with correct conversion
- ✅ Logs show retry attempts with timestamps

**Alternative Test** (all retries fail):
- Simulate API failure for all 5 attempts
- ✅ System attempts 5 times total
- ✅ After 5 failures, error is logged
- ✅ Transaction marked with status "ERROR"
- ✅ Processing continues with other transactions

**Acceptance Criteria** (from FR-009):
- ✅ Failed network calls retried up to 5 times
- ✅ Exponential backoff used between retry attempts
- ✅ After 5 failed attempts, error logged and processing continues
- ✅ Retry logic applies to exchange rate API and other network operations

**Traceability**: FR-009, FR-007, NFR-003

---

### AT-FR-010: Transaction Deduplication

**Requirement**: FR-010 - Transaction Deduplication

**Objective**: Verify that duplicate transactions are detected and prevented from being added to the result sheet.

**Test Setup**:
- Source sheet with transactions
- Result sheet with existing transactions

**Test Data**:
```
Existing in result sheet:
  Transaction A: ID=tx_001, Date=2025-11-01, Amount=-45.67, Description=Tesco
  Transaction B: ID=tx_002, Date=2025-11-01, Amount=-29.99, Description=Amazon

New in source sheet:
  Transaction C: ID=tx_003 (genuinely new)
  Transaction A: ID=tx_001 (exact duplicate)
  Transaction D: ID=tx_001 (same ID, different data - edge case)
```

**Test Steps**:
1. Pre-populate result sheet with existing transactions
2. Add new and duplicate transactions to source sheet
3. Execute normalization process
4. Review result sheet

**Expected Results**:
- ✅ Transaction C (new) is added to result sheet
- ✅ Transaction A (duplicate) is NOT added (duplicate detected by ID)
- ✅ Result sheet still contains only one instance of tx_001
- ✅ Transaction D (same ID, different data) is logged as error or skipped
- ✅ Duplicate detection works across concurrent writes (see AT-FR-002)
- ✅ System logs indicate: "Duplicate transaction skipped: tx_001"

**Acceptance Criteria** (from FR-010):
- ✅ Each transaction has unique identifier (original reference)
- ✅ System checks for existing transactions before adding new ones
- ✅ Duplicate transactions skipped with appropriate logging
- ✅ Deduplication works across concurrent writes

**Traceability**: FR-010, FR-002, FR-012, UC-001

---

### AT-FR-011: Data Validation

**Requirement**: FR-011 - Data Validation

**Objective**: Verify that transaction data is validated before normalization and invalid entries are rejected with clear error messages.

**Test Setup**:
- Source sheet with mix of valid and invalid transactions
- Result sheet is empty

**Test Data**:
```
Valid transaction:
  Date: 2025-11-01, Amount: -45.67, Description: Tesco, Currency: GBP

Invalid transactions:
  1. Date: "not-a-date" (invalid date format)
  2. Date: 2025-13-40 (impossible date)
  3. Amount: "abc" (non-numeric)
  4. Amount: null (missing required field)
  5. Description: "" (empty required field)
  6. Description: null (missing required field)
```

**Test Steps**:
1. Populate source sheet with valid and invalid transactions
2. Execute normalization process
3. Review result sheet
4. Review error messages

**Expected Results**:
- ✅ Valid transaction appears with status "NORMALISED"
- ✅ Invalid transactions appear with status "ERROR"
- ✅ Date validation errors:
  - "Invalid date format: not-a-date"
  - "Invalid date: 2025-13-40"
- ✅ Amount validation errors:
  - "Amount must be numeric: abc"
  - "Required field missing: amount"
- ✅ Description validation errors:
  - "Required field missing: description"
- ✅ Dates are standardized to UTC ISO format (YYYY-MM-DDTHH:mm:ssZ)
- ✅ All errors are clearly logged

**Acceptance Criteria** (from FR-011):
- ✅ Date formats validated and standardized to UTC ISO format
- ✅ Amount values are numeric and non-null
- ✅ Required fields (date, amount, description) are present
- ✅ Invalid transactions logged with clear error messages

**Traceability**: FR-011, FR-008, UC-001

---

### AT-FR-012: Source Sheet ID Backfilling

**Requirement**: FR-012 - Source Sheet ID Backfilling

**Objective**: Verify that missing transaction IDs are automatically generated and written back to source sheets.

**Test Setup**:
- Monzo source sheet with native transaction IDs
- Revolut source sheet without IDs (ID column empty)
- Yonder source sheet without IDs (ID column empty)
- Result sheet is empty

**Test Data**:
```
Monzo transactions (3):
  tx_monzo_001, tx_monzo_002, tx_monzo_003 (already have IDs)

Revolut transactions (3):
  [empty ID], [empty ID], [empty ID] (need IDs)

Yonder transactions (3):
  [empty ID], [empty ID], [empty ID] (need IDs)
```

**Test Steps**:
1. Populate source sheets with transactions (some without IDs)
2. Execute normalization process
3. Review source sheets for backfilled IDs
4. Review result sheet for transaction IDs
5. Re-run normalization to verify ID persistence

**Expected Results**:
- ✅ Monzo transactions keep original IDs (tx_monzo_001, etc.)
- ✅ Revolut transactions receive generated IDs (written back to source sheet)
- ✅ Yonder transactions receive generated IDs (written back to source sheet)
- ✅ Generated IDs are unique and stable (UUIDs or similar)
- ✅ Re-running normalization uses same IDs (no new IDs generated)
- ✅ All transactions in result sheet have IDs
- ✅ No duplicate IDs across all transactions
- ✅ ID generation happens before deduplication check

**Acceptance Criteria** (from FR-012):
- ✅ Detect rows in source sheets without ID
- ✅ Generate and write back unique identifiers to source sheet ID column
- ✅ Generated IDs persistent and consistent across multiple runs
- ✅ Support backfilling for Revolut and Yonder sheets (lack native IDs)
- ✅ Preserve existing IDs on sheets that already have them (Monzo)
- ✅ ID generation happens before or during normalization for traceability

**Traceability**: FR-012, FR-010, FR-002, UC-001

**Note**: High risk due to write-back to source sheets and potential concurrent write conflicts.

---

### AT-FR-013: Manual Category Override

**Requirement**: FR-013 - Manual Category Override

**Objective**: Verify that users can manually override AI-generated categories and that these overrides persist and take precedence.

**Test Setup**:
- Result sheet with categorized transactions
- Categories sheet with defined categories

**Test Data**:
```
Transaction 1:
  Description: Tesco
  AI Category ID: 3
  AI Category: Shopping
  Manual Category ID: [empty]
  Manual Category: [empty]
  Category: =IF(ManualCategory<>"", ManualCategory, AICategory) → "Shopping"

Pre-defined categories:
  1: Groceries
  2: Transport
  3: Shopping
  4: Entertainment
```

**Test Steps**:
1. Review transaction with AI category "Shopping"
2. User types "Groceries" in "Manual Category" column
3. onEdit trigger executes
4. Review updated transaction

**Expected Results**:
- ✅ Result sheet has columns: AI Category ID, AI Category, Manual Category ID, Manual Category, Category
- ✅ User can type category name directly in "Manual Category" column
- ✅ onEdit trigger resolves "Groceries" to category ID "1"
- ✅ "Manual Category ID" automatically populated with "1"
- ✅ "Manual Category" shows "Groceries"
- ✅ "Category" column displays "Groceries" (manual override takes precedence)
- ✅ "AI Category" and "AI Category ID" remain unchanged (preserved for audit)
- ✅ Manual override persists across system re-runs
- ✅ AI categorization does NOT overwrite "Manual Category ID" or "Manual Category"
- ✅ Both ID and name stored for auditability

**Alternative Scenario** (clearing override):
- User deletes content from "Manual Category" column
- ✅ "Manual Category ID" is also cleared
- ✅ "Category" column reverts to showing AI category

**Acceptance Criteria** (from FR-013):
- ✅ Result sheet includes category-related columns (AI Category ID, AI Category, Manual Category ID, Manual Category, Category)
- ✅ Users type category names directly in "Manual Category" column
- ✅ onEdit trigger resolves category name to ID automatically
- ✅ Manual overrides preserved across system runs
- ✅ AI categorization only writes to "AI Category ID" and "AI Category" columns
- ✅ Manual overrides tracked for auditability via dual ID/name storage

**Traceability**: FR-013, FR-016, UC-003

---

### AT-FR-014: Historical Transaction Learning

**Requirement**: FR-014 - Historical Transaction Learning

**Objective**: Verify that AI categorization leverages historical transactions and manual overrides to improve accuracy.

**Test Setup**:
- Result sheet with historical transactions including manual overrides
- New uncategorized transaction similar to historical one

**Test Data**:
```
Historical transactions:
  Transaction A: Description="Tesco Metro", AI Category="Shopping", Manual Category="Groceries"
  Transaction B: Description="Tesco Express", AI Category="Shopping", Manual Category="Groceries"
  Transaction C: Description="Tesco Superstore", AI Category="Shopping", Manual Category="Groceries"
  (Pattern: User consistently overrides Tesco transactions from "Shopping" to "Groceries")

New transaction:
  Transaction D: Description="Tesco Extra" (uncategorized)
```

**Test Steps**:
1. Review historical transactions with manual override pattern
2. Add new similar transaction
3. Execute AI categorization
4. Review new transaction's category

**Expected Results**:
- ✅ System searches for similar historical transactions before categorizing
- ✅ Similarity matching considers description (merchant pattern: "Tesco")
- ✅ System identifies 3 similar transactions with manual override "Groceries"
- ✅ AI categorization suggests "Groceries" (learning from overrides)
- ✅ Confidence score is high (due to consistent historical pattern)
- ✅ If AI suggests "Groceries", user does not need to override
- ✅ Categorization performance is not significantly impacted (similarity search is efficient)

**Alternative Test** (amount range and merchant):
```
Historical: "Pret A Manger £8.50" → "Dining Out"
New: "Pret A Manger £9.20" → Should suggest "Dining Out"
```

**Acceptance Criteria** (from FR-014):
- ✅ Search for similar historical transactions before categorizing new transaction
- ✅ Similarity matching considers description, amount range, merchant patterns
- ✅ Manual overrides from historical transactions prioritized over AI suggestions
- ✅ If similar transaction with manual override exists, suggest that category
- ✅ System provides context to AI about historical categorization patterns
- ✅ Similarity search is efficient (doesn't significantly slow processing)

**Traceability**: FR-014, FR-005, FR-013, UC-006

**Priority**: Should Have

---

### AT-FR-015: Category Definitions Management

**Requirement**: FR-015 - Category Definitions Management

**Objective**: Verify that categories are stored in a dedicated sheet and can be managed by users.

**Test Setup**:
- Categories configuration sheet
- Result sheet with transactions

**Test Data**:
```
Categories sheet:
  Row 1 (ID=1): Name="Groceries", Description="Food and household items", Examples="Tesco, Sainsbury's", isActive=TRUE
  Row 2 (ID=2): Name="Transport", Description="Travel expenses", Examples="TfL, Uber", isActive=TRUE
  Row 3 (ID=3): Name="Dining Out", Description="Restaurants and cafes", Examples="Pret, Nando's", isActive=TRUE
  Row 4 (ID=4): Name="Old Category", Description="Deprecated", Examples="N/A", isActive=FALSE
```

**Test Steps**:
1. Review Categories sheet structure
2. Verify categorization uses only active categories
3. Add new category to Categories sheet
4. Update category description
5. Deactivate (soft delete) a category
6. Re-run categorization

**Expected Results**:
- ✅ Categories sheet has columns: id (row number), name, description, examples, isActive
- ✅ Row number serves as stable category ID for foreign key references
- ✅ Each category includes name, description, examples, isActive flag
- ✅ AI categorization only assigns active categories (isActive=TRUE)
- ✅ Users can update categories directly in Categories sheet
- ✅ Adding new category: Next system run includes new category in AI options
- ✅ Deactivating category (isActive=FALSE): AI no longer assigns it to new transactions
- ✅ Deactivated categories still referenced by old transactions (referential integrity preserved)
- ✅ Categories CANNOT be deleted (would break references); must use soft delete

**Acceptance Criteria** (from FR-015):
- ✅ Categories stored in dedicated "Categories" configuration sheet
- ✅ Each category row includes id (row number), name, description, examples, isActive flag
- ✅ Row number serves as stable category ID for foreign key references
- ✅ Category list includes descriptions and examples
- ✅ AI categorization only assigns active categories
- ✅ Categories can be updated by users directly in sheet
- ✅ Category changes take effect on next processing run
- ✅ Categories cannot be deleted (soft delete via isActive=FALSE)

**Traceability**: FR-015, FR-005, UC-007

---

### AT-FR-016: Category Name Resolution via onEdit Trigger

**Requirement**: FR-016 - Category Name Resolution via onEdit Trigger

**Objective**: Verify that the onEdit trigger automatically resolves category names to IDs when users manually edit categories.

**Test Setup**:
- Result sheet with transactions
- Categories sheet with defined categories
- onEdit trigger enabled

**Test Data**:
```
Categories:
  1: Groceries
  2: Transport
  3: Dining Out

Transaction:
  Manual Category: [empty]
  Manual Category ID: [empty]
```

**Test Steps**:
1. User clicks "Manual Category" cell
2. User types "Groceries"
3. User presses Enter
4. Observe trigger execution
5. Review updated cells

**Expected Results**:
- ✅ onEdit trigger monitors "Manual Category" column for edits
- ✅ When user types "Groceries", trigger searches Categories sheet
- ✅ Trigger finds exact match: Category ID=1, Name="Groceries", isActive=TRUE
- ✅ Trigger writes "1" to "Manual Category ID" column
- ✅ Trigger only responds to human edits (not script-generated updates)
- ✅ Trigger performance is fast (executes in <1 second)

**Alternative Test** (category not found):
- User types "Unknown Category"
- ✅ Trigger searches Categories sheet, finds no match
- ✅ "Manual Category ID" remains empty
- ✅ Warning logged: "Category 'Unknown Category' not found in Categories sheet"
- ✅ Category name still appears in "Manual Category" column

**Alternative Test** (avoid infinite loops):
- Script updates "AI Category" column
- ✅ onEdit trigger does NOT fire for script-generated updates
- ✅ No infinite loop occurs

**Acceptance Criteria** (from FR-016):
- ✅ onEdit trigger monitors "Manual Category" column for user edits
- ✅ When user types category name, trigger searches Categories sheet for matching active category
- ✅ If exact match found, trigger writes category ID to "Manual Category ID" column
- ✅ Trigger only responds to human edits, not script-generated updates (avoid infinite loops)
- ✅ If category name not found, "Manual Category ID" remains empty and warning logged
- ✅ Trigger performance does not degrade user experience (executes quickly)

**Traceability**: FR-016, FR-013, UC-003

---

## Non-Functional Requirement Tests

### AT-NFR-001: Data Integrity Verification

**Requirement**: NFR-001 - Data Integrity

**Objective**: Verify that no transaction data is lost during normalization, conversion, or categorization processes.

**Test Setup**:
- Source sheets with known transactions
- Result sheet tracking

**Test Data**:
```
100 transactions across 3 source sheets:
  Monzo: 40 transactions
  Revolut: 35 transactions
  Yonder: 25 transactions
Various amounts, currencies, dates
```

**Test Steps**:
1. Count transactions in source sheets (100 total)
2. Execute normalization process
3. Count transactions in result sheet
4. Verify all data fields preserved
5. Execute categorization process
6. Re-verify data integrity

**Expected Results**:
- ✅ Result sheet contains exactly 100 transactions (no loss)
- ✅ Every transaction from source sheets appears in result sheet
- ✅ All data fields preserved:
  - Dates match source dates
  - Amounts match source amounts (or correctly converted)
  - Descriptions match source descriptions
  - Currency information preserved
- ✅ No truncation or corruption of data fields
- ✅ After categorization, all 100 transactions still present (no loss)
- ✅ Original data fields unchanged after categorization

**Verification Method**:
- Generate checksums or hashes for critical fields
- Compare source → result mappings
- Automated count verification: source count = result count

**Acceptance Criteria** (from NFR-001):
- ✅ No transaction data lost during normalization
- ✅ No transaction data lost during conversion
- ✅ No transaction data lost during categorization

**Traceability**: NFR-001, FR-001, FR-002, FR-005

---

### AT-NFR-002: Performance Under Expected Load

**Requirement**: NFR-002 - Performance

**Objective**: Verify that the system handles expected transaction volume efficiently without degradation.

**Test Setup**:
- Source sheets with typical daily volume
- Performance monitoring enabled

**Test Data**:
```
100 transactions distributed across sources (typical daily volume)
Mix of currencies requiring conversion
Mix of merchants requiring categorization
```

**Test Steps**:
1. Record start time
2. Execute normalization process for 100 transactions
3. Record normalization completion time
4. Execute categorization process for 100 transactions
5. Record categorization completion time
6. Review performance logs

**Expected Results**:
- ✅ Normalization completes within 2 minutes for 100 transactions
- ✅ Categorization completes within scheduled window (e.g., 10 minutes for hourly batches)
- ✅ No performance degradation over multiple runs
- ✅ User workflow not significantly delayed (15-minute normalization cycle acceptable)
- ✅ API rate limits not exceeded
- ✅ Memory usage remains stable

**Performance Targets** (from NFR-002):
- ✅ Process up to 100 transactions per day
- ✅ Normalization completes within reasonable time for user workflow
- ✅ Categorization batch processing completes within scheduled window

**Traceability**: NFR-002, NFR-006

---

### AT-NFR-003: Reliability and Error Recovery

**Requirement**: NFR-003 - Reliability

**Objective**: Verify that the system operates reliably within Google Sheets environment and recovers from failures.

**Test Setup**:
- Google Sheets environment with rate limits
- Simulated transient failures

**Test Data**:
```
Scenarios:
  1. Google Sheets API rate limit exceeded
  2. OpenAI API temporary failure
  3. Exchange rate API timeout
  4. Network interruption
```

**Test Steps**:
1. Trigger Google Sheets API rate limit (rapid requests)
2. Observe system behavior and recovery
3. Simulate OpenAI API failure during categorization
4. Observe retry mechanism and error handling
5. Simulate exchange rate API timeout
6. Verify transaction handling

**Expected Results**:
- ✅ System handles Google Sheets API rate limits gracefully (backs off, retries)
- ✅ Transient failures automatically recovered via retry mechanism (up to 5 attempts)
- ✅ All errors logged for developer review
- ✅ Data consistency maintained even when partial failures occur:
  - If categorization fails, transactions remain in NORMALISED state (can retry)
  - If normalization fails, source data unchanged (can retry)
- ✅ System does not crash or corrupt data on failure
- ✅ User sees clear status indicators (ERROR status, error messages)

**Acceptance Criteria** (from NFR-003):
- ✅ Handle Google Sheets API rate limits gracefully
- ✅ Recover from transient failures automatically (via retry mechanism)
- ✅ Log all errors for developer review
- ✅ Maintain data consistency even when partial failures occur

**Traceability**: NFR-003, FR-008, FR-009

---

### AT-NFR-004: Auditability and Traceability

**Requirement**: NFR-004 - Auditability

**Objective**: Verify that the system maintains sufficient audit trail for transaction processing and categorization.

**Test Setup**:
- Result sheet with processed transactions
- System logs accessible

**Test Data**:
```
10 transactions with various processing outcomes:
  - Successfully normalized and categorized
  - Manually overridden categories
  - Failed transactions (errors)
```

**Test Steps**:
1. Process transactions through normalization and categorization
2. Review audit data in result sheet
3. Review system logs
4. Verify traceability of all actions

**Expected Results**:
- ✅ Processing timestamps tracked for each transaction:
  - "Timestamp Normalised"
  - "Timestamp Categorised"
- ✅ All categorization decisions logged with confidence scores:
  - "AI Category ID"
  - "AI Category"
  - "Confidence Score"
- ✅ Original transaction data preserved alongside normalized data:
  - "Original Amount"
  - "Original Currency"
- ✅ Manual override tracking enabled:
  - "Manual Category ID"
  - "Manual Category"
  - Both AI and manual categories visible for comparison
- ✅ Error tracking:
  - "Processing Status" (ERROR)
  - "Error Message" with details
- ✅ System logs contain detailed audit trail:
  - User actions (manual overrides)
  - System actions (categorization runs)
  - Processing summaries

**Acceptance Criteria** (from NFR-004):
- ✅ Track processing timestamps for each transaction
- ✅ Log all categorization decisions with confidence scores
- ✅ Maintain original transaction data alongside normalized data
- ✅ Enable manual override tracking for user corrections

**Traceability**: NFR-004, FR-013, FR-008

---

### AT-NFR-005: Maintainability and Extensibility

**Requirement**: NFR-005 - Maintainability

**Objective**: Verify that the system is maintainable and extensible for adding new bank sources.

**Test Setup**:
- Existing system with 3 bank sources (Monzo, Revolut, Yonder)
- Documentation review
- Code structure review

**Test Data**:
```
Hypothetical new bank: "Chase Bank"
Schema: Date, Merchant, Amount, Currency, Type, Reference
```

**Test Steps**:
1. Review bank-specific schema mapping configuration
2. Identify changes needed to add new bank source
3. Document steps required
4. Assess impact on existing code

**Expected Results**:
- ✅ Bank-specific schema mappings clearly defined and isolated (in configuration)
- ✅ Adding new bank source requires minimal code changes:
  - Add new schema mapping configuration
  - No changes to core normalization logic
  - No changes to categorization logic
- ✅ Configuration separate from logic (schema maps in config, not hardcoded)
- ✅ Code follows consistent patterns across all bank integrations:
  - Same normalization flow
  - Same validation approach
  - Same error handling
- ✅ Documentation exists for adding new bank source

**Acceptance Criteria** (from NFR-005):
- ✅ Bank-specific schema mappings clearly defined and isolated
- ✅ Adding new bank source requires minimal code changes
- ✅ Configuration is separate from logic
- ✅ Code follows consistent patterns across all bank integrations

**Traceability**: NFR-005, FR-006

**Note**: This test is more of a code review / architectural assessment than a functional test.

---

### AT-NFR-006: Two-Phase Processing Architecture

**Requirement**: NFR-006 - Two-Phase Processing Architecture

**Objective**: Verify that normalization and categorization run independently on separate schedules.

**Test Setup**:
- Normalization schedule: Every 15 minutes
- Categorization schedule: Every hour
- Source sheet with new transactions

**Test Data**:
```
Time T=0: Add 10 new transactions to source sheet
Expected timeline:
  T+15min: Normalization completes (status = NORMALISED)
  T+60min: Categorization completes (status = CATEGORISED)
```

**Test Steps**:
1. Add 10 transactions to source sheet at T=0
2. Wait for normalization trigger (T+15min)
3. Verify transactions normalized but not categorized
4. Wait for categorization trigger (T+60min)
5. Verify transactions categorized

**Expected Results**:
- ✅ Normalization runs frequently (every 15 minutes)
- ✅ Categorization runs less frequently (every hour)
- ✅ After normalization (T+15min):
  - Transactions appear in result sheet
  - Status = "NORMALISED"
  - "AI Category ID" is empty
  - "AI Category" is empty
- ✅ After categorization (T+60min):
  - Status changes to "CATEGORISED"
  - "AI Category ID" populated
  - "AI Category" populated
  - "Timestamp Categorised" updated
- ✅ Each phase can fail independently:
  - Simulate categorization failure → normalization still works
  - Simulate normalization failure → previous categorizations unaffected
- ✅ Processing status column tracks state: "UNPROCESSED" → "NORMALISED" → "CATEGORISED" (or "ERROR")

**Acceptance Criteria** (from NFR-006):
- ✅ Normalization runs frequently (e.g., every 15 minutes)
- ✅ Categorization runs less frequently (e.g., hourly)
- ✅ Normalized transactions persisted immediately with status "NORMALISED"
- ✅ Categorization updates existing rows, changing status to "CATEGORISED"
- ✅ Each phase can fail independently without affecting the other
- ✅ Processing status column tracks state: "UNPROCESSED", "NORMALISED", "CATEGORISED", "ERROR"
- ✅ Failed categorizations don't block normalization of new transactions

**Traceability**: NFR-006, FR-005, UC-005, UC-006

**Rationale** (from NFR-006):
- Ensures data integrity (NFR-001): Normalized data persisted immediately
- Optimizes performance (NFR-002): Categorization batching reduces API costs
- Improves reliability (NFR-003): Independent failure handling

---

## Use Case Scenario Tests

### AT-UC-001: Import and Normalize Transactions End-to-End

**Use Case**: UC-001 - Import and Normalize Transactions

**Objective**: Verify complete user workflow from adding transactions to seeing normalized results.

**Test Narrative**: User exports transactions from their banks (Monzo, Revolut, Yonder) and wants to see them consolidated in a single sheet with standardized format.

**Test Setup**:
- 3 bank source sheets (Monzo, Revolut, Yonder)
- Result sheet is empty
- Normalization scheduled or manual trigger available

**Test Data**:
```
User adds:
  - 3 transactions to Monzo sheet (exported from Monzo app)
  - 2 transactions to Revolut sheet (exported from Revolut app)
  - 2 transactions to Yonder sheet (exported from Yonder app)
Total: 7 new transactions

Includes variety:
  - GBP and non-GBP currencies
  - Different transaction types (purchases, refunds)
  - Various merchants
```

**Test Steps** (User Journey):
1. **User Action**: User adds new transactions to source sheets
2. **User Action**: User waits for scheduled normalization (or manually triggers)
3. **System Action**: System processes new transactions
4. **User Action**: User opens result sheet
5. **User Verification**: User sees new transactions with:
   - Standardized columns
   - GBP amounts
   - Status "NORMALISED"
   - Timestamps
6. **User Action**: User confirms all transactions from multiple banks visible in one place

**Expected Results**:
- ✅ All 7 transactions appear in result sheet
- ✅ Standardized column format (consistent headers)
- ✅ All amounts converted to GBP
- ✅ Original currency preserved
- ✅ Status shows "NORMALISED"
- ✅ Timestamp indicates when normalization occurred
- ✅ User can now analyze all transactions together
- ✅ No duplicates if transactions re-processed

**Alternative Flow** (Invalid Data):
- User adds transaction with missing date
- ✅ Transaction appears with status "ERROR"
- ✅ Error message explains issue
- ✅ User corrects source data and waits for reprocessing

**Alternative Flow** (Currency Conversion Fails):
- Exchange rate API unavailable for specific currency
- ✅ Transaction status shows "ERROR"
- ✅ User sees which transactions failed conversion
- ✅ User can retry or contact administrator

**Success Criteria**:
- ✅ User successfully sees multi-bank transactions in one normalized sheet
- ✅ User understands processing status
- ✅ User can identify and resolve errors

**Traceability**: UC-001, FR-001, FR-002, FR-003, FR-004, FR-006, FR-010, FR-011

---

### AT-UC-002: Review Categorized Transactions

**Use Case**: UC-002 - Review Categorized Transactions

**Objective**: Verify user workflow for reviewing AI-categorized transactions.

**Test Narrative**: User opens result sheet to review their spending after AI categorization has completed, with the goal of understanding spending patterns.

**Test Setup**:
- Result sheet with 20 normalized and categorized transactions
- Variety of categories assigned
- Mix of confidence scores (high, medium, low)

**Test Data**:
```
20 transactions categorized:
  - 8 high confidence (>80%)
  - 7 medium confidence (50-80%)
  - 5 low confidence (<50%)

Categories include:
  - Groceries: 5 transactions
  - Transport: 4 transactions
  - Dining Out: 4 transactions
  - Entertainment: 3 transactions
  - Shopping: 4 transactions
```

**Test Steps** (User Journey):
1. **User Action**: User opens result sheet
2. **User Observation**: User sees transactions with category information:
   - "AI Category" column shows categories
   - "Category" column shows effective category
   - "Confidence Score" shows percentage
   - Status shows "CATEGORISED"
3. **User Action**: User reviews categories for accuracy
4. **User Action**: User identifies spending patterns (filters/sorts by category)
5. **User Action**: User notes any incorrect categories for override

**Expected Results**:
- ✅ User can see all transactions with populated categories
- ✅ Confidence scores visible (0-100%)
- ✅ User can sort/filter by category to see spending patterns
- ✅ User can identify transactions needing review (low confidence)
- ✅ User can analyze spending: "I spent £200 on Groceries this month"

**Alternative Flow** (Low Confidence Transaction):
- User sees transaction with 35% confidence
- ✅ User reviews AI's suggestion
- ✅ User decides to override category (proceeds to UC-003)

**Alternative Flow** (Categorization Failed):
- User sees transaction with status "ERROR"
- ✅ Error message explains failure
- ✅ User can manually override category
- ✅ System will retry on next run

**Alternative Flow** (Not Yet Categorized):
- User sees transactions with status "NORMALISED" (awaiting categorization)
- ✅ User understands categorization is pending
- ✅ User waits for next hourly categorization run

**Success Criteria**:
- ✅ User successfully reviews categorized transactions
- ✅ User understands spending patterns
- ✅ User knows which transactions need manual attention
- ✅ User can make informed financial decisions

**Traceability**: UC-002, FR-005, FR-014

---

### AT-UC-003: Override Transaction Category

**Use Case**: UC-003 - Override Transaction Category

**Objective**: Verify user workflow for manually correcting an AI-generated category.

**Test Narrative**: User identifies that AI categorized "Tesco" as "Shopping" but user prefers the more specific "Groceries" category. User wants to correct this and have the override persist.

**Test Setup**:
- Result sheet with categorized transaction
- Categories sheet with "Groceries" and "Shopping" categories
- onEdit trigger enabled

**Test Data**:
```
Transaction (before override):
  Description: Tesco Metro
  AI Category ID: 3
  AI Category: Shopping
  Manual Category ID: [empty]
  Manual Category: [empty]
  Category: Shopping (formula shows AI category)

Categories sheet includes:
  1: Groceries
  2: Transport
  3: Shopping
```

**Test Steps** (User Journey):
1. **User Action**: User opens result sheet
2. **User Observation**: User sees transaction categorized as "Shopping"
3. **User Thought**: "This should be Groceries, not Shopping"
4. **User Action**: User clicks "Manual Category" cell
5. **User Action**: User types "Groceries"
6. **User Action**: User presses Enter
7. **System Action**: onEdit trigger resolves "Groceries" to ID "1"
8. **User Observation**: "Category" column now shows "Groceries"
9. **User Verification**: User sees "AI Category" still shows "Shopping" (audit trail)

**Expected Results**:
- ✅ User can easily type category name (no need to look up ID)
- ✅ "Manual Category ID" automatically populated with "1"
- ✅ "Manual Category" shows "Groceries"
- ✅ "Category" column immediately displays "Groceries" (override takes precedence)
- ✅ "AI Category" remains "Shopping" (preserved for audit)
- ✅ Override persists after system re-runs (AI doesn't overwrite)
- ✅ Future similar transactions may learn from this override

**Alternative Flow** (Invalid Category Name):
- User types "Weekend Treats" (not in Categories sheet)
- ✅ "Manual Category ID" remains empty
- ✅ Category name still appears in "Manual Category" column
- ✅ Warning logged (but doesn't block user)

**Alternative Flow** (Clearing Override):
- User deletes "Manual Category" content
- ✅ "Manual Category ID" also cleared
- ✅ "Category" column reverts to "Shopping" (AI category)

**Success Criteria**:
- ✅ User successfully overrides AI category
- ✅ Override persists across sessions
- ✅ User experience is seamless (type name, not ID)
- ✅ Audit trail preserved (both AI and manual categories visible)

**Traceability**: UC-003, FR-013, FR-016

---

### AT-UC-004: Monitor Processing Status

**Use Case**: UC-004 - Monitor Processing Status

**Objective**: Verify user workflow for checking system health and identifying transactions needing attention.

**Test Narrative**: User wants to verify that the system is working correctly and identify any transactions that require manual intervention.

**Test Setup**:
- Result sheet with mix of transaction statuses:
  - NORMALISED (awaiting categorization)
  - CATEGORISED (fully processed)
  - ERROR (various failures)

**Test Data**:
```
20 transactions:
  - 10 CATEGORISED (healthy)
  - 5 NORMALISED (awaiting categorization)
  - 5 ERROR:
    - 2 with "Exchange rate unavailable"
    - 2 with "Invalid data: missing date"
    - 1 with "AI categorization failed"
```

**Test Steps** (User Journey):
1. **User Action**: User opens result sheet
2. **User Action**: User reviews "Processing Status" column
3. **User Action**: User filters/sorts by status
4. **User Action**: For ERROR transactions:
   - User reads "Error Message" column
   - User understands what went wrong
5. **User Action**: User checks timestamps:
   - "Timestamp Normalised"
   - "Timestamp Categorised"
6. **User Decision**: User determines action needed:
   - Correct source data?
   - Wait for retry?
   - Manual intervention?

**Expected Results**:
- ✅ User can see status at a glance:
  - "CATEGORISED" = ready for analysis
  - "NORMALISED" = awaiting categorization
  - "ERROR" = needs attention
- ✅ Error messages are clear and actionable:
  - "Exchange rate unavailable for currency MAD" → wait for retry
  - "Invalid data: missing date" → fix source data
  - "AI categorization failed" → retry or manual override
- ✅ Timestamps show processing timeline:
  - Recent timestamps = system is active
  - Old timestamps = potential issue
- ✅ User can identify patterns (e.g., specific currency failing repeatedly)
- ✅ User knows when to intervene vs. wait for automatic retry

**Alternative Flow** (No Recent Activity):
- User notices all timestamps are >24 hours old
- ✅ User checks if scheduled triggers are running
- ✅ User may manually trigger processing
- ✅ User contacts administrator if issue persists

**Alternative Flow** (Needs Detailed Logs):
- User needs more information about specific error
- ✅ User navigates to Google Apps Script execution logs
- ✅ User finds detailed log entry with stack trace
- ✅ User shares log with administrator

**Success Criteria**:
- ✅ User understands current system health
- ✅ User knows which transactions need attention
- ✅ User can identify error patterns
- ✅ User can decide on appropriate action

**Traceability**: UC-004, FR-008, NFR-003, NFR-004

---

### AT-UC-005: Execute Scheduled Normalization

**Use Case**: UC-005 - Execute Scheduled Normalization (System Use Case)

**Objective**: Verify that the system automatically processes new transactions every 15 minutes.

**Test Narrative**: System scheduled trigger fires every 15 minutes to check for new transactions and normalize them.

**Test Setup**:
- Time-driven trigger configured for every 15 minutes
- Source sheets with new transactions
- Result sheet tracking

**Test Data**:
```
T=0: Add 5 transactions to Monzo sheet
T=0: Add 3 transactions to Revolut sheet
T=15min: Scheduled trigger fires
```

**Test Steps** (Automated System Workflow):
1. **System Action** (T=15min): Scheduled trigger fires
2. **System Action**: Read all bank source configurations (Monzo, Revolut, Yonder)
3. **System Action**: For each bank:
   - Read transactions from source sheet
   - Validate and normalize data
   - Convert currencies to GBP
   - Generate missing transaction IDs
   - Check for duplicates
   - Append new normalized transactions to result sheet
   - Set status to "NORMALISED"
4. **System Action**: Log summary (8 transactions processed, 8 succeeded, 0 failed)
5. **System Action**: Update processing run record

**Expected Results**:
- ✅ Trigger fires automatically every 15 minutes
- ✅ All 8 new transactions appear in result sheet
- ✅ Status = "NORMALISED" for all
- ✅ "Timestamp Normalised" populated
- ✅ Processing summary logged:
  - "Normalization run completed at 2025-11-18 15:15:00"
  - "Processed: 8, Succeeded: 8, Failed: 0"
- ✅ Transactions ready for categorization phase
- ✅ Next trigger scheduled for T=30min

**Alternative Flow** (Source Sheet Inaccessible):
- Revolut sheet has permission error
- ✅ System logs error: "Cannot access Revolut source sheet"
- ✅ System continues processing Monzo and Yonder
- ✅ 5 Monzo transactions normalized successfully
- ✅ Developer reviews logs to fix permission issue

**Alternative Flow** (Exchange Rate API Fails):
- API timeout for EUR transaction
- ✅ System retries up to 5 times
- ✅ If all retries fail, marks EUR transaction as ERROR
- ✅ Other transactions (GBP) processed successfully
- ✅ Error logged for developer review

**Success Criteria**:
- ✅ Normalization runs automatically on schedule
- ✅ New transactions processed reliably
- ✅ Processing logged for audit
- ✅ System ready for next run
- ✅ Failures don't block entire run

**Traceability**: UC-005, FR-001, FR-002, FR-003, FR-004, FR-006, FR-007, FR-009, FR-010, FR-011, FR-012, NFR-001, NFR-002, NFR-003, NFR-006

---

### AT-UC-006: Execute Scheduled Categorization

**Use Case**: UC-006 - Execute Scheduled Categorization (System Use Case)

**Objective**: Verify that the system automatically categorizes normalized transactions every hour.

**Test Narrative**: System scheduled trigger fires every hour to categorize transactions using OpenAI API.

**Test Setup**:
- Time-driven trigger configured for hourly execution
- Result sheet with 25 uncategorized transactions (status = "NORMALISED")
- OpenAI API accessible
- Categories sheet with defined categories

**Test Data**:
```
25 uncategorized transactions:
  - 5 grocery merchants
  - 5 transport providers
  - 5 restaurants
  - 5 entertainment venues
  - 5 miscellaneous

Processing in batches of 10
```

**Test Steps** (Automated System Workflow):
1. **System Action** (T=hourly): Scheduled trigger fires
2. **System Action**: Query for uncategorized transactions (status = "NORMALISED")
3. **System Action**: Find 25 transactions to process
4. **System Action**: Process in batches:
   - Batch 1 (10 transactions): Search for similar historical transactions
   - Batch 1: Send to OpenAI API with context
   - Batch 1: Receive categories and confidence scores
   - Batch 1: Validate categories against approved list
   - Batch 1: Update transactions (status = "CATEGORISED")
   - Batch 2 (10 transactions): Repeat process
   - Batch 3 (5 transactions): Repeat process
5. **System Action**: Log summary (25 categorized, confidence scores, 0 failures)

**Expected Results**:
- ✅ Trigger fires automatically every hour
- ✅ 25 transactions identified for categorization
- ✅ Processed in batches of 10 (3 batches total)
- ✅ All transactions categorized:
  - "AI Category ID" populated
  - "AI Category" populated
  - "Confidence Score" populated
  - Status changed to "CATEGORISED"
  - "Timestamp Categorised" populated
- ✅ Categories are from approved Categories sheet
- ✅ Similar transactions receive similar categories (historical learning)
- ✅ Processing summary logged:
  - "Categorization run completed at 2025-11-18 16:00:00"
  - "Categorized: 25, Average Confidence: 78%"
- ✅ Next trigger scheduled for T+1 hour

**Alternative Flow** (No Uncategorized Transactions):
- Query finds 0 transactions with status = "NORMALISED"
- ✅ System logs: "No transactions to categorize"
- ✅ System exits successfully
- ✅ No API calls made

**Alternative Flow** (OpenAI API Fails):
- Batch 2 API request times out
- ✅ System retries up to 5 times with exponential backoff
- ✅ If all retries fail, marks Batch 2 transactions as ERROR
- ✅ System continues with Batch 3
- ✅ Error logged: "AI categorization failed for 10 transactions"

**Success Criteria**:
- ✅ Categorization runs automatically on schedule
- ✅ Transactions categorized in batches (API optimization)
- ✅ Historical learning applied (similar transactions)
- ✅ Processing logged for audit
- ✅ System ready for next run
- ✅ Failures don't block entire run

**Traceability**: UC-006, FR-005, FR-009, FR-014, FR-015, NFR-002, NFR-004, NFR-006

---

### AT-UC-007: Configure Category Definitions

**Use Case**: UC-007 - Configure Category Definitions

**Objective**: Verify developer workflow for managing transaction categories.

**Test Narrative**: Developer wants to add a new category "Health & Wellness" for fitness and healthcare expenses, update description for "Groceries", and deactivate deprecated "Old Category".

**Test Setup**:
- Categories configuration sheet with existing categories
- Result sheet with categorized transactions

**Test Data**:
```
Existing Categories:
  1: Groceries, Description: "Food and household items", isActive: TRUE
  2: Transport, Description: "Travel expenses", isActive: TRUE
  3: Dining Out, Description: "Restaurants and cafes", isActive: TRUE
  4: Old Category, Description: "Deprecated", isActive: FALSE

Changes to make:
  - Add: Health & Wellness
  - Update: Groceries description
  - Deactivate: (already inactive)
```

**Test Steps** (Developer Journey):
1. **Developer Action**: Open Categories sheet
2. **Developer Action**: Review current categories
3. **Developer Action**: Add new row:
   - Row 5
   - Name: "Health & Wellness"
   - Description: "Fitness, healthcare, prescriptions"
   - Examples: "Gym membership, pharmacy, dentist"
   - isActive: TRUE
4. **Developer Action**: Update existing category:
   - Row 1 (Groceries)
   - Change description to: "Supermarket shopping and household essentials"
5. **Developer Action**: Save changes (automatic in Google Sheets)
6. **Developer Action**: Trigger categorization manually to test
7. **Developer Verification**: Review categorization using new category

**Expected Results**:
- ✅ Categories sheet has columns: id (row number), name, description, examples, isActive
- ✅ New category added successfully (row 5)
- ✅ Existing category description updated
- ✅ Next categorization run includes new "Health & Wellness" category
- ✅ AI can now assign "Health & Wellness" to fitness/healthcare transactions
- ✅ Updated Groceries description improves AI context
- ✅ Row number serves as stable ID (5 = Health & Wellness)
- ✅ Changes logged for audit

**Alternative Flow** (Deactivate Category):
- Developer wants to stop using "Old Category"
- Developer sets isActive = FALSE for row 4
- ✅ AI no longer assigns "Old Category" to new transactions
- ✅ Old transactions with "Old Category" still display correctly (referential integrity)
- ✅ Category row NOT deleted (would break historical references)

**Alternative Flow** (Re-categorization Needed):
- Major category changes require existing transactions to be re-categorized
- Developer manually triggers re-categorization for all/filtered transactions
- ✅ System re-runs categorization with new definitions
- ✅ User sees updated categories

**Success Criteria**:
- ✅ Developer can add, update, deactivate categories
- ✅ Changes take effect on next processing run
- ✅ AI uses updated category definitions
- ✅ Historical data integrity preserved (soft delete)
- ✅ System is adaptable to changing user needs

**Traceability**: UC-007, FR-015, NFR-005

---

## Test Execution Guidance

### Test Execution Schedule

**Phase 1: Elaboration (Current)**
- Focus on defining acceptance criteria
- Manual test case execution for validation
- Tests serve as requirements clarification

**Phase 2: Construction**
- Execute acceptance tests manually after each implementation
- Build automated test infrastructure where possible
- Focus on regression prevention

**Phase 3: Transition (Pre-Release)**
- Execute full acceptance test suite
- User Acceptance Testing (UAT) by primary stakeholder
- Performance and reliability testing under load
- Security testing

### Test Data Management

**Reference Dataset Location**: `test-data/acceptance/`

**Dataset Structure**:
```
test-data/
  acceptance/
    AT-FR-001-multi-source-transactions.csv
    AT-FR-002-concurrent-transactions.csv
    AT-FR-003-currency-standardization.csv
    ...
    AT-UC-001-end-to-end-normalization/
      monzo-source.csv
      revolut-source.csv
      yonder-source.csv
      expected-result.csv
```

**Dataset Principles**:
- Each test has dedicated test data file(s)
- Test data is version controlled
- Expected results documented alongside input data
- Test data includes edge cases explicitly

### Test Result Documentation

**Test Execution Template**:
```
Test ID: AT-FR-001
Test Name: Transaction Normalization from Multiple Sources
Executed By: [Name]
Execution Date: [Date]
Execution Environment: [Dev/Staging/Production]

Results:
  ✅ Pass / ❌ Fail / ⚠️ Partial

Evidence:
  - Screenshot: [link]
  - Result Sheet: [link]
  - Logs: [link]

Notes:
  [Any observations, deviations, or issues]

Defects:
  [Link to beads issue if test failed]
```

**Test Results Storage**: `test-results/acceptance/YYYY-MM-DD/`

### Test Traceability

Every test maps to:
- **Requirements**: Which FR/NFR does this test verify?
- **Use Cases**: Which user workflow does this test validate?
- **Risk**: What risk does this test mitigate?

**Traceability Matrix**: See individual test definitions above.

### Quality Gates

**Pre-Release Quality Gate**:
- ✅ All "Must Have" acceptance tests pass
- ✅ All "Should Have" acceptance tests pass OR documented as known limitation
- ✅ No P0/P1 defects open
- ✅ UAT approved by stakeholder
- ✅ Performance targets met (AT-NFR-002)
- ✅ Data integrity verified (AT-NFR-001)

---

## Test Coverage Summary

### Requirements Coverage

| Requirement Type | Total | Covered by Tests | Coverage % |
|------------------|-------|------------------|------------|
| Functional (FR) | 16 | 16 | 100% |
| Non-Functional (NFR) | 6 | 6 | 100% |
| Use Cases (UC) | 7 | 7 | 100% |

### Test Distribution

| Test Type | Count | Percentage |
|-----------|-------|------------|
| Functional Requirement Tests | 16 | 55% |
| Non-Functional Requirement Tests | 6 | 21% |
| Use Case Scenario Tests | 7 | 24% |
| **Total** | **29** | **100%** |

### Priority Distribution

| Priority | Count | Percentage |
|----------|-------|------------|
| Must Have | 27 | 93% |
| Should Have | 2 | 7% |

---

## References

### Project Documentation

- [Requirements Catalogue](../01-inception/requirements-catalogue.md)
- [Test Strategy](../01-inception/test-strategy.md)
- [Use Cases](use-cases.md)
- [Vision Statement](../01-inception/VISION.md)
- [Software Architecture Document](software-architecture-document.md)

### Testing Resources

- [Test Data Directory](../../../test-data/)
- [Test Results Archive](../../../test-results/)
- [Coding Standards](../../coding-standards/)

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-18 | 1.0 | Initial acceptance test document created | AI (Claude) |

---

## Notes

### Test Automation Opportunities

While these acceptance tests are designed for manual execution during UAT and release validation, several tests could be automated in future phases:

**High Automation Potential**:
- AT-FR-001, AT-FR-003, AT-FR-010, AT-FR-011 (deterministic, repeatable)
- AT-NFR-001, AT-NFR-002 (data integrity, performance)

**Medium Automation Potential**:
- AT-FR-005, AT-FR-014 (AI categorization - requires mocked API)
- AT-FR-016 (onEdit trigger - requires Apps Script test framework)

**Low Automation Potential**:
- AT-UC-002, AT-UC-003, AT-UC-004 (user experience, visual review)
- AT-NFR-005 (maintainability - code review focus)

### Risk-Based Testing Priorities

**High Risk Tests** (execute first, most frequently):
- AT-FR-002: Concurrent Transaction Handling
- AT-FR-010: Transaction Deduplication
- AT-FR-012: Source Sheet ID Backfilling
- AT-NFR-001: Data Integrity Verification
- AT-NFR-006: Two-Phase Processing Architecture

**Medium Risk Tests**:
- AT-FR-004, AT-FR-007: Currency conversion (external API dependency)
- AT-FR-005: AI Categorization (external API, accuracy)
- AT-FR-009: Network Retry Mechanism
- AT-NFR-003: Reliability and Error Recovery

**Low Risk Tests** (well-defined, low complexity):
- AT-FR-003, AT-FR-006, AT-FR-011, AT-FR-015
- AT-UC-007: Configure Category Definitions
