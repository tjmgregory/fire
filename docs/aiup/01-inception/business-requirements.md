# Business Requirements Catalog

**Document Version**: 1.0
**Last Updated**: 2025-11-18
**Phase**: Inception
**Traceability**: References [VISION.md](../VISION.md)

## Document Purpose

This catalog documents all business requirements for the FIRE project. Each requirement traces back to the project vision and forward to use cases, specifications, and test cases.

## Requirement Categories

Requirements are organized into these categories:

- **FREQ** - Functional Requirements
- **NREQ** - Non-Functional Requirements
- **DREQ** - Data Requirements
- **IREQ** - Integration Requirements
- **SREQ** - Security Requirements

## Functional Requirements

### Transaction Processing

#### FREQ-001: Multi-Bank Transaction Import

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "Universal Transaction Normalization"

**Description**: The system shall accept transaction data from multiple banks in their native CSV export formats.

**Acceptance Criteria**:

- System accepts Monzo CSV format
- System accepts Revolut CSV format
- System accepts Yonder CSV format
- Each format is normalized to internal standard
- Original transaction data is preserved

**Test Cases**: TC-001, TC-002, TC-003

---

#### FREQ-002: Transaction Normalization

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "Universal Transaction Normalization"

**Description**: The system shall normalize all transactions to a consistent internal format regardless of source bank.

**Acceptance Criteria**:

- All banks produce identical normalized format
- Dates converted to consistent YYYY-MM-DD format
- Amounts converted to numeric values
- Currency codes preserved
- Merchant names standardized
- Transaction IDs generated uniquely

**Test Cases**: TC-010, TC-011, TC-012

**Related ADR**: [ADR-001 Data Normalization Strategy](../../adr/001-data-normalization-strategy.md)

---

#### FREQ-003: AI-Powered Categorization

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "AI-Powered Categorization"

**Description**: The system shall automatically categorize transactions using AI (GPT-4) based on merchant, amount, and contextual information.

**Acceptance Criteria**:

- Each transaction receives exactly one category
- Categories match predefined category list
- Categorization happens automatically
- Processing completes within 10 seconds per 100 transactions
- API failures are logged and handled gracefully

**Test Cases**: TC-020, TC-021, TC-022

**Related ADR**: [ADR-002 Transaction Categorization Strategy](../../adr/002-transaction-categorization-strategy.md)

---

#### FREQ-004: Manual Override Capability

**Priority**: P1 (High)
**Status**: Implemented
**Traces to**: VISION.md - "Transparency & Control"

**Description**: The system shall allow users to manually override AI-generated categories.

**Acceptance Criteria**:

- Users can change category for any transaction
- Manual overrides are preserved
- System does not re-categorize manually overridden transactions
- Manual override indicator is visible
- Override history is logged

**Test Cases**: TC-030, TC-031

---

#### FREQ-005: Duplicate Detection

**Priority**: P1 (High)
**Status**: Planned
**Traces to**: VISION.md - "Data Integrity"

**Description**: The system shall detect and prevent duplicate transaction imports.

**Acceptance Criteria**:

- Duplicate transactions are identified by transaction ID
- Duplicates are skipped during import
- Warning logged when duplicates detected
- User notified of duplicate count
- Original transaction preserved

**Test Cases**: TC-040

---

### Currency Handling

#### FREQ-010: Multi-Currency Support

**Priority**: P1 (High)
**Status**: Implemented
**Traces to**: VISION.md - "Multiple Account Complexity"

**Description**: The system shall handle transactions in multiple currencies (GBP, USD, EUR).

**Acceptance Criteria**:

- Currency code preserved from source
- Amounts remain in original currency
- Currency code visible in output
- No automatic conversion applied
- Currency indicated clearly

**Test Cases**: TC-050, TC-051

---

#### FREQ-011: Currency Conversion (Future)

**Priority**: P3 (Low)
**Status**: Planned
**Traces to**: VISION.md - "Phase 2: Intelligence"

**Description**: The system shall provide optional currency conversion to user's base currency.

**Acceptance Criteria**:

- TBD (future feature)

**Test Cases**: TBD

---

### Transaction Types

#### FREQ-020: Refund Handling

**Priority**: P2 (Medium)
**Status**: Implemented
**Traces to**: VISION.md - "Handle edge cases"

**Description**: The system shall correctly identify and categorize refunds.

**Acceptance Criteria**:

- Negative amounts recognized as refunds
- Refunds categorized based on original purchase
- Refund indicator visible
- Refunds don't skew category totals incorrectly

**Test Cases**: TC-060, TC-061

---

#### FREQ-021: Transfer Detection

**Priority**: P2 (Medium)
**Status**: Partially Implemented
**Traces to**: VISION.md - "Handle edge cases"

**Description**: The system shall identify transfers between user's own accounts.

**Acceptance Criteria**:

- Transfers to own accounts marked as "Transfer"
- Internal transfers don't count as expenses
- Transfer direction indicated (to/from)
- Matching transfers can be linked

**Test Cases**: TC-070

---

### Error Handling

#### FREQ-030: Error Logging

**Priority**: P1 (High)
**Status**: Implemented
**Traces to**: VISION.md - "Transparency & Control"

**Description**: The system shall log all errors to a System Logs sheet for debugging and monitoring.

**Acceptance Criteria**:

- All errors logged with timestamp
- Error severity indicated
- Transaction ID included when applicable
- Error message is human-readable
- Stack trace available for debugging

**Test Cases**: TC-080, TC-081

**Related ADR**: [ADR Logging and Error Handling](../../coding-standards/logging-and-error-handling.md)

---

#### FREQ-031: Graceful Degradation

**Priority**: P1 (High)
**Status**: Implemented
**Traces to**: VISION.md - "Reliability"

**Description**: The system shall continue processing transactions even when individual transactions fail.

**Acceptance Criteria**:

- Failed transactions logged but don't stop batch
- Successfully processed transactions are saved
- Error summary provided at end
- Partial results are valid
- User notified of failures

**Test Cases**: TC-090

---

## Non-Functional Requirements

### Performance

#### NREQ-001: Processing Speed

**Priority**: P1 (High)
**Status**: Implemented
**Traces to**: VISION.md - "Technical Success Metrics"

**Description**: The system shall process 100 transactions in under 10 seconds (excluding OpenAI API time).

**Acceptance Criteria**:

- Normalization: <1 second per 100 transactions
- Categorization API calls: subject to OpenAI limits
- Sheet updates: <2 seconds per 100 rows
- Total processing time monitored and logged

**Test Cases**: TC-100

---

#### NREQ-002: Apps Script Execution Limits

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "Technical Constraints"

**Description**: The system shall operate within Google Apps Script 6-minute execution time limit.

**Acceptance Criteria**:

- Batch processing prevents timeout
- Maximum 500 transactions per execution
- Long-running tasks split into multiple triggers
- Execution time monitored
- Warning if approaching limit

**Test Cases**: TC-101

---

### Reliability

#### NREQ-010: Data Integrity

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "Data Integrity"

**Description**: The system shall preserve 100% of original transaction data without modification.

**Acceptance Criteria**:

- Original data never overwritten
- Normalized data stored separately
- Source bank indicated for each transaction
- Data recovery possible from source sheets
- No data loss during processing

**Test Cases**: TC-110, TC-111

---

#### NREQ-011: Idempotency

**Priority**: P1 (High)
**Status**: Implemented
**Traces to**: VISION.md - "Reliability"

**Description**: The system shall produce identical results when processing the same input multiple times.

**Acceptance Criteria**:

- Re-running normalization produces same output
- Transaction IDs are deterministic
- Category assignments consistent (for same AI model)
- No duplicate entries created
- Safe to re-run after failures

**Test Cases**: TC-120

---

### Usability

#### NREQ-020: User Setup Time

**Priority**: P2 (Medium)
**Status**: Partially Implemented
**Traces to**: VISION.md - "User Success Metrics"

**Description**: The system shall be fully configured and operational within 30 minutes for new users.

**Acceptance Criteria**:

- Clear setup documentation provided
- API key configuration straightforward
- Sheet template available
- Example data included
- Troubleshooting guide available

**Test Cases**: TC-130

---

#### NREQ-021: Error Messages

**Priority**: P2 (Medium)
**Status**: Implemented
**Traces to**: VISION.md - "Transparency & Control"

**Description**: The system shall provide clear, actionable error messages for common failures.

**Acceptance Criteria**:

- Error messages explain what went wrong
- Suggested fixes included when possible
- Technical jargon minimized
- Contact info for complex issues
- Examples of valid input provided

**Test Cases**: TC-131

---

## Data Requirements

### DREQ-001: Transaction Data Model

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "Universal Transaction Normalization"

**Description**: The system shall maintain a normalized transaction data model with required fields.

**Required Fields**:

- Transaction ID (unique, deterministic)
- Date (YYYY-MM-DD format)
- Merchant/Description
- Amount (numeric)
- Currency Code (ISO 4217)
- Category
- Source Bank
- Original Data Reference

**Optional Fields**:

- Manual Override Flag
- Confidence Score (future)
- Notes
- Tags (future)

**Test Cases**: TC-140

**Related ADR**: [ADR-003 Output Sheet Structure](../../adr/003-output-sheet-structure.md)

---

### DREQ-002: Category Master List

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "AI-Powered Categorization"

**Description**: The system shall maintain a master list of valid categories.

**Current Categories**:

- Transport
- Groceries
- Eating Out
- Shopping
- Bills
- Entertainment
- Health
- Travel
- Income
- Transfer
- Other

**Acceptance Criteria**:

- Categories defined in config
- AI uses only defined categories
- New categories require code change
- Category list versioned
- Category descriptions available

**Test Cases**: TC-141

---

## Integration Requirements

### IREQ-001: Google Sheets Integration

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "Seamless Integration"

**Description**: The system shall integrate natively with Google Sheets.

**Acceptance Criteria**:

- Runs as Apps Script within spreadsheet
- Reads from source sheets automatically
- Writes to output sheet automatically
- Uses sheet formulas for calculations
- No external export required

**Test Cases**: TC-150

---

### IREQ-002: OpenAI API Integration

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "AI-Powered Categorization"

**Description**: The system shall integrate with OpenAI GPT-4 API for categorization.

**Acceptance Criteria**:

- API key stored securely in Script Properties
- API requests properly formatted
- Responses parsed correctly
- Rate limits respected
- Errors handled gracefully
- Cost optimization implemented

**Test Cases**: TC-151

**Related ADR**: [ADR-002 Transaction Categorization Strategy](../../adr/002-transaction-categorization-strategy.md)

---

### IREQ-003: Trigger System

**Priority**: P1 (High)
**Status**: Implemented
**Traces to**: VISION.md - "Seamless Integration"

**Description**: The system shall support automated execution via triggers.

**Acceptance Criteria**:

- Time-based triggers configurable
- Manual trigger available
- Form submission triggers supported (future)
- Trigger management UI available
- Trigger errors logged

**Test Cases**: TC-152

**Related ADR**: [ADR-004 Trigger System Design](../../adr/004-trigger-system-design.md)

---

## Security Requirements

### SREQ-001: API Key Security

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "Privacy"

**Description**: The system shall securely store OpenAI API keys using Google Apps Script Properties Service.

**Acceptance Criteria**:

- API keys never in source code
- Keys stored in Script Properties
- Keys not visible in logs
- Keys not exposed in URLs
- Access restricted to script owner

**Test Cases**: TC-160

**Related ADR**: [Security Standards](../../coding-standards/security.md)

---

### SREQ-002: Data Privacy

**Priority**: P0 (Critical)
**Status**: Implemented
**Traces to**: VISION.md - "Privacy"

**Description**: The system shall keep all user data within user's Google account.

**Acceptance Criteria**:

- No data sent to external services (except OpenAI for categorization)
- No data stored in external databases
- All data remains in user's Google Drive
- User controls all data access
- Data deletion is user's responsibility

**Test Cases**: TC-161

---

### SREQ-003: Input Validation

**Priority**: P1 (High)
**Status**: Partially Implemented
**Traces to**: VISION.md - "Data Integrity"

**Description**: The system shall validate all input data before processing.

**Acceptance Criteria**:

- Date formats validated
- Amount fields validated as numeric
- Required fields checked
- Invalid data rejected with clear error
- Validation errors logged

**Test Cases**: TC-162

---

## Requirements Traceability Matrix

| Requirement | Vision Section | ADR | Use Case | Test Cases | Status |
|-------------|---------------|-----|----------|------------|--------|
| FREQ-001 | Universal Normalization | - | UC-001 | TC-001-003 | ✅ Implemented |
| FREQ-002 | Universal Normalization | ADR-001 | UC-002 | TC-010-012 | ✅ Implemented |
| FREQ-003 | AI Categorization | ADR-002 | UC-003 | TC-020-022 | ✅ Implemented |
| FREQ-004 | Transparency & Control | - | UC-004 | TC-030-031 | ✅ Implemented |
| FREQ-005 | Data Integrity | - | UC-005 | TC-040 | 🔄 Planned |
| FREQ-010 | Multi-Currency | - | UC-006 | TC-050-051 | ✅ Implemented |
| FREQ-020 | Edge Cases | - | UC-007 | TC-060-061 | ✅ Implemented |
| FREQ-021 | Edge Cases | - | UC-008 | TC-070 | 🟡 Partial |
| FREQ-030 | Transparency | - | UC-009 | TC-080-081 | ✅ Implemented |
| FREQ-031 | Reliability | - | UC-010 | TC-090 | ✅ Implemented |

*(Matrix continues for all requirements...)*

## Change History

| Date | Version | Requirement | Change | Reason |
|------|---------|-------------|--------|--------|
| 2025-11-18 | 1.0 | All | Initial catalog created | AIUP migration |

## Next Steps

1. ✅ Create business-requirements.md (this document)
2. ⏳ Create stakeholders.md
3. ⏳ Create test-strategy.md
4. ⏳ Create use-case-diagrams.md (Elaboration phase)
5. ⏳ Map test cases in test-cases.md (Elaboration phase)

## References

- [VISION.md](../VISION.md)
- [ADR Directory](../../adr/)
- [Coding Standards](../../coding-standards/)
- [Test Cases](../elaboration/test-cases.md) *(to be created)*
