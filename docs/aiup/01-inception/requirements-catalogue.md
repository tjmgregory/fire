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

**Description**: The system must categorize transactions using AI. This process runs on a schedule to populate category fields for any rows that haven't been categorized since the last run.

**Acceptance Criteria**:

- Categorization runs on a defined schedule (not real-time)
- Only uncategorized transactions are processed in each run
- Categories are populated in the result sheet
- System tracks which transactions have been categorized

**Priority**: Must Have
**Risk**: Medium (AI model accuracy and reliability)

---

## Non-Functional Requirements

### NFR-001: Data Integrity

**Description**: No transaction data shall be lost during normalization, conversion, or categorization processes.

**Priority**: Must Have

---

## Open Questions

- What is the expected transaction volume (per day/month)?
- What are the specific source sheet schemas we need to support?
- How should the system handle exchange rate API failures?
- What retry/error recovery mechanisms are needed?
