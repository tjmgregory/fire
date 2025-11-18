# Requirements Catalogue

## Functional Requirements

### FR-001: Transaction Normalization

**Description**: The system must normalize transactions from multiple source sheets with different column schemas into a single, normalized target sheet. The system operates within the Google Sheets environment.

**Acceptance Criteria**:

- Accept input from N source sheets, each with potentially different column names and ordering
- Map all source columns to a standardized schema in the target sheet
- Preserve all original transaction data during normalization

**Priority**: Must Have
**Risk**: Medium (schema mapping complexity)

### FR-002: Concurrent Transaction Handling

**Description**: When two or more transactions are added to source sheets simultaneously, the system must be resilient and ensure all rows appear on the result sheet without loss or duplication.

**Acceptance Criteria**:

- No transactions are lost when multiple writes occur concurrently
- No duplicate transactions are created
- Transaction ordering is preserved where possible

**Priority**: Must Have
**Risk**: High (Google Sheets concurrency limitations)

### FR-003: Currency Standardization

**Description**: The result sheet must display all transaction amounts in GBP (the required target currency for this version).

**Acceptance Criteria**:

- All amounts on the result sheet are in GBP
- Original currency information is preserved for reference

**Priority**: Must Have
**Risk**: Low

### FR-004: Currency Conversion

**Description**: When a source transaction does not contain an amount in GBP, the system must perform a conversion using the current exchange rate.

**Acceptance Criteria**:

- Convert non-GBP amounts to GBP using current exchange rates
- Store both original amount/currency and converted GBP amount
- Exchange rate data is sourced from a reliable provider

**Priority**: Must Have
**Risk**: Medium (exchange rate API dependency)

### FR-005: Asynchronous AI Categorization

**Description**: The system must categorize transactions using AI through batch processing. This process runs on a schedule to populate category fields for any rows that haven't been categorized since the last run.

**Acceptance Criteria**:

- Categorization runs on a defined schedule (not real-time), less frequently than normalization (e.g., hourly)
- Process transactions in batches (e.g., batches of 10) to optimize API usage and costs
- Only uncategorized transactions are processed in each run
- Categories are selected from a predefined list of valid categories
- AI provides confidence scores (0-100%) for each categorization
- Confidence scores are stored alongside categories for auditability
- System tracks which transactions have been categorized
- Include recent similar transactions as context for better accuracy

**Priority**: Must Have
**Risk**: Medium (AI model accuracy and reliability, API costs)

### FR-006: Source Sheet Schema Support

**Description**: The system must support transactions from three specific bank sources (Monzo, Revolut, Yonder), each with their own column schemas.

**Acceptance Criteria**:

- Support Monzo schema: Date, Time, Name, Description, Amount, Currency, Category, Type, Transaction ID, Notes and #tags
- Support Revolut schema: Started Date/Completed Date, Description, Amount, Currency, Type, ID, Product
- Support Yonder schema: Date/Time of transaction, Description, Amount (GBP), Currency, Category, Debit or Credit, Country
- Column mapping is configurable per source sheet
- System validates required columns exist before processing

**Priority**: Must Have
**Risk**: Low (well-defined schemas)

### FR-007: Exchange Rate API Integration

**Description**: The system must use a reliable exchange rate provider for currency conversion, and optimize API usage by fetching rates only once per system run for all new non-GBP transactions.

**Acceptance Criteria**:

- Exchange rates are fetched from a reliable external provider only once per processing run, and only if there are transactions in non-GBP currencies that have not previously been converted in this run
- System handles common currencies (USD, EUR, CAD, AUD, JPY, MAD, THB, SGD, HKD, ZAR, NOK, CNY, SEK) using ISO 4217 codes.
- Conversion rates are applied consistently and efficiently across all relevant transactions within a single run

**Priority**: Must Have  
**Risk**: Medium (external API dependency, risk of stale rates if run duration is long)

### FR-008: Error Handling and Logging

**Description**: When any failure occurs that prevents a result row from completing, the system must log the error and expect the developer to review the logs.

**Acceptance Criteria**:

- All processing errors are logged with sufficient detail for debugging
- Incomplete transactions are marked with error status
- Error logs include transaction reference, timestamp, and error message
- Developers can review logs to identify and resolve issues

**Priority**: Must Have
**Risk**: Low

### FR-009: Network Retry Mechanism

**Description**: The system must implement a basic backoff strategy for network calls with a maximum of 5 retry attempts.

**Acceptance Criteria**:

- Failed network calls are retried up to 5 times
- Exponential backoff is used between retry attempts
- After 5 failed attempts, error is logged and processing continues
- Retry logic applies to exchange rate API and any other network operations

**Priority**: Must Have
**Risk**: Low

### FR-010: Transaction Deduplication

**Description**: The system must detect and prevent duplicate transactions from being added to the result sheet.

**Acceptance Criteria**:

- Each transaction has a unique identifier (original reference)
- System checks for existing transactions before adding new ones
- Duplicate transactions are skipped with appropriate logging
- Deduplication works across concurrent writes

**Priority**: Must Have
**Risk**: Medium (related to FR-002 concurrent handling)

### FR-011: Data Validation

**Description**: The system must validate transaction data before normalization and reject invalid entries.

**Acceptance Criteria**:

- Date formats are validated and standardized to UTC ISO format
- Amount values are numeric and non-null
- Required fields (date, amount, description) are present
- Invalid transactions are logged with clear error messages

**Priority**: Must Have
**Risk**: Low

### FR-012: Source Sheet ID Backfilling

**Description**: The system must automatically populate missing transaction IDs on source sheets that don't provide native identifiers, eliminating the need for manual UUID entry.

**Acceptance Criteria**:

- When processing transactions, detect rows in source sheets without an ID
- Generate and write back unique identifiers to the source sheet ID column
- Ensure generated IDs are persistent and consistent across multiple runs
- Support backfilling for Revolut and Yonder sheets (which lack native IDs)
- Preserve existing IDs on sheets that already have them (e.g., Monzo)
- ID generation happens before or during normalization to ensure traceability

**Priority**: Must Have
**Risk**: Medium (write-back to source sheets, potential for concurrent write conflicts)

**Note**: This requirement works in conjunction with FR-002 (Concurrent Transaction Handling) and FR-010 (Transaction Deduplication) to ensure stable, unique identifiers across the system.

### FR-013: Manual Category Override

**Description**: Users must be able to manually override AI-generated transaction categories, and these manual overrides must take precedence over AI categorizations.

**Acceptance Criteria**:

- Result sheet includes three category-related columns:
  - "AI Category" - populated by the AI categorization process
  - "Manual Override" - for user input (empty by default)
  - "Category" - a calculated column using a Google Sheets formula
- The "Category" column uses a formula: `=IF(ManualOverride<>"", ManualOverride, AICategory)`
- Formula is set by the script when creating new rows, but calculated by Google Sheets (not by script)
- Manual overrides are preserved across system runs
- AI categorization only writes to "AI Category" column, never "Manual Override" or "Category"
- Manual overrides are tracked for auditability

**Priority**: Must Have
**Risk**: Low

**Note**: Google Sheets formulas are fully supported and this approach ensures the Category column updates instantly when users enter manual overrides, without requiring a script re-run.

### FR-014: Historical Transaction Learning

**Description**: The AI categorization system must leverage historical transaction data and manual overrides to improve categorization accuracy for similar transactions.

**Acceptance Criteria**:

- Before categorizing a new transaction, search for similar historical transactions
- Similarity matching considers description, amount range, and merchant patterns
- Manual overrides from historical transactions are prioritized over AI suggestions
- If a similar transaction with manual override exists, suggest that category
- System provides context to AI about historical categorization patterns
- Similarity search is efficient and doesn't significantly slow down processing

**Priority**: Should Have
**Risk**: Medium (similarity matching complexity, potential performance impact)

**Note**: This requirement enhances FR-005 (Asynchronous AI Categorization) by providing context from FR-013 (Manual Category Override) to improve accuracy over time.

### FR-015: Category Definitions Management

**Description**: The system must maintain a predefined set of transaction categories that the AI uses for categorization.

**Acceptance Criteria**:

- Categories are stored in a dedicated configuration location
- Category list includes descriptions and examples for each category
- AI categorization only assigns categories from this approved list
- Categories can be updated by developers through configuration changes
- Category changes are logged for audit purposes

**Priority**: Must Have
**Risk**: Low

---

## Non-Functional Requirements

### NFR-001: Data Integrity

**Description**: No transaction data shall be lost during normalization, conversion, or categorization processes.

**Priority**: Must Have

### NFR-002: Performance

**Description**: The system must handle the expected transaction volume efficiently without degradation.

**Acceptance Criteria**:

- Process up to 100 transactions per day
- Normalization completes within reasonable time for user workflow
- Categorization batch processing completes within scheduled window

**Priority**: Must Have
**Risk**: Low (volume is manageable)

### NFR-003: Reliability

**Description**: The system must operate reliably within the Google Sheets environment despite platform limitations.

**Acceptance Criteria**:

- Handle Google Sheets API rate limits gracefully
- Recover from transient failures automatically (via retry mechanism)
- Log all errors for developer review
- Maintain data consistency even when partial failures occur

**Priority**: Must Have
**Risk**: Medium (Google Sheets concurrency and API limitations)

### NFR-004: Auditability

**Description**: The system must maintain sufficient audit trail for transaction processing and categorization.

**Acceptance Criteria**:

- Track processing timestamps for each transaction
- Log all categorization decisions with confidence scores
- Maintain original transaction data alongside normalized data
- Enable manual override tracking for user corrections

**Priority**: Should Have
**Risk**: Low

### NFR-005: Maintainability

**Description**: The system must be maintainable and extensible for adding new bank sources.

**Acceptance Criteria**:

- Bank-specific schema mappings are clearly defined and isolated
- Adding a new bank source requires minimal code changes
- Configuration is separate from logic
- Code follows consistent patterns across all bank integrations

**Priority**: Should Have
**Risk**: Low

### NFR-006: Two-Phase Processing Architecture

**Description**: The system architecture must separate transaction processing into two distinct phases - normalization and categorization - each running on independent schedules to optimize reliability and cost-efficiency.

**Acceptance Criteria**:

- Normalization phase runs frequently (e.g., every 15 minutes) to ensure new transactions are captured quickly
- Categorization phase runs less frequently (e.g., hourly) to batch process and optimize API usage
- Normalized transactions are persisted immediately to the output sheet with status "NORMALIZED"
- Categorization updates existing rows, changing status to "CATEGORIZED" upon completion
- Each phase can fail independently without affecting the other
- Processing status column tracks current state: "UNPROCESSED", "NORMALIZED", "CATEGORIZED", "ERROR"
- Failed categorizations don't block normalization of new transactions

**Priority**: Must Have
**Risk**: Medium (more complex state management and scheduling)

**Rationale**: This architectural constraint ensures:

- **Data Integrity** (NFR-001): Normalized data is persisted immediately
- **Performance** (NFR-002): Categorization batching optimizes API costs
- **Reliability** (NFR-003): Independent failure handling for each phase
