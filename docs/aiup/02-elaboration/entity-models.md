# Entity Models

This document defines the core domain entities for the FIRE transaction categorisation system. These entities represent the fundamental business concepts that persist throughout the system lifecycle.

## Overview

The FIRE system manages financial transactions from multiple bank sources, normalises them, and applies AI-driven categorisation. The entity model reflects this multi-phase processing architecture.

## Core Entities

### 1. Transaction

**Description**: Represents a single financial transaction from a bank source through its entire lifecycle (normalisation and categorisation).

**Identity**: Unique transaction identifier (UUID)

**Attributes** (alphabetically ordered, related fields grouped):

- `categoryAiValue` (String, nullable) - AI-generated category
- `categoryConfidenceScore` (Decimal, nullable) - AI categorisation confidence (0-100%)
- `categoryManualValue` (String, nullable) - User-provided manual override category
- `country` (String, nullable) - Transaction country (if available)
- `description` (String) - Transaction description/merchant name
- `errorMessage` (String, nullable) - Error details if processing failed
- `exchangeRateValue` (Decimal, nullable) - Exchange rate used for conversion (null if originally in GBP)
- `gbpAmountValue` (Decimal) - Amount converted to GBP
- `id` (UUID) - Unique identifier for the transaction
- `notes` (String, nullable) - Additional notes or tags from source
- `originalAmountCurrency` (CurrencyCode) - Original currency (ISO 4217)
- `originalAmountValue` (Decimal) - Original transaction amount
- `originalTransactionId` (String) - Original transaction ID from the bank (may be auto-generated for banks without native IDs)
- `processingStatus` (ProcessingStatus) - Current processing state
- `bankSourceId` (BankSourceId) - Identifier of the source bank (Monzo, Revolut, or Yonder)
- `timestampCategorised` (DateTime, nullable) - Categorisation completion timestamp
- `timestampCreated` (DateTime) - System creation timestamp
- `timestampLastModified` (DateTime) - Last modification timestamp
- `timestampNormalised` (DateTime, nullable) - Normalisation completion timestamp
- `transactionDate` (DateTime) - Date and time of the transaction (ISO 8601 UTC format)
- `transactionType` (TransactionType) - Debit or Credit

**Enumerations**:

- `BankSourceId`: MONZO, REVOLUT, YONDER
- `CurrencyCode`: GBP, USD, EUR, CAD, AUD, JPY, MAD, THB, SGD, HKD, ZAR, NOK, CNY, SEK
- `ProcessingStatus`: UNPROCESSED, NORMALISED, CATEGORISED, ERROR
- `TransactionType`: DEBIT, CREDIT

**Lifecycle States**:

```text
UNPROCESSED → NORMALISED → CATEGORISED
            ↓
          ERROR (can occur at any stage)
```

**Business Rules**:

- Each transaction must have a unique ID
- Transactions cannot be deleted, only marked as ERROR
- Once categorised, transactions can be re-categorised but previous categorisation is not retained
- Manual category overrides always take precedence over AI categories
- GBP amount is required; original amount and currency must be preserved
- Exchange rate is required for non-GBP transactions

**Relationships**:

- Belongs to one `BankSource`
- May reference one `Category` (via AI or manual assignment)
- May have multiple similar transactions for historical learning (implicit relationship)

---

### 2. BankSource

**Description**: Represents a source bank/financial institution with its specific schema configuration.

**Identity**: Unique source identifier (String)

**Attributes**:

- `id` (String) - Unique identifier (e.g., "monzo", "revolut", "yonder")
- `displayName` (String) - Human-readable name
- `sheetId` (String) - Google Sheets ID for this source
- `hasNativeTransactionId` (Boolean) - Whether bank provides native transaction IDs
- `isActive` (Boolean) - Whether this source is currently being processed
- `columnMappings` (Map<String, String>) - Maps standard fields to source-specific column names
- `createdAt` (DateTime) - When source was configured
- `lastProcessedAt` (DateTime, nullable) - Last successful processing timestamp

**Column Mapping Schema**:

```text
Standard Field → Source Column Name
- date → "Date" | "Date/Time of transaction" | "Started Date"
- description → "Description" | "Name"
- amount → "Amount" | "Amount (GBP)"
- currency → "Currency"
- transactionId → "Transaction ID" | "ID"
- type → "Type" | "Debit or Credit"
- category → "Category" (source-provided, not used for AI categorisation)
- notes → "Notes and #tags" (optional)
- country → "Country" (optional)
```

**Business Rules**:

- Each source must have a unique identifier
- Column mappings must include all required fields: date, description, amount, currency
- Sources without native transaction IDs require ID backfilling
- Column mappings are immutable once transactions are processed

**Relationships**:

- Has many `Transaction` entities
- Configuration relates to specific Google Sheets

**Supported Sources**:

1. **Monzo**: Native transaction IDs, comprehensive metadata
2. **Revolut**: No native IDs (requires backfilling), separate started/completed dates
3. **Yonder**: No native IDs (requires backfilling), GBP-only transactions

---

### 3. Category

**Description**: Represents a transaction category used for classification.

**Identity**: Unique category name (String)

**Attributes**:

- `name` (String) - Unique category identifier (e.g., "Groceries", "Transport", "Entertainment")
- `displayName` (String) - Human-readable category name
- `description` (String) - Detailed description of what transactions belong in this category
- `examples` (Array<String>) - Example merchants/descriptions for this category
- `isActive` (Boolean) - Whether category is currently available for assignment
- `createdAt` (DateTime) - When category was defined
- `modifiedAt` (DateTime) - Last modification timestamp
- `usageCount` (Integer) - Number of transactions assigned to this category (denormalised for performance)

**Business Rules**:

- Category names must be unique
- Categories cannot be deleted if transactions reference them (soft delete via isActive)
- AI can only assign categories from the active category list
- Manual overrides can use any string value but should use predefined categories

**Relationships**:

- Referenced by many `Transaction` entities (via aiCategory or manualCategory)

**Example Categories**:

- Groceries
- Transport
- Entertainment
- Bills & Utilities
- Dining Out
- Shopping
- Healthcare
- Travel
- Income
- Transfers
- Savings

---

### 4. ExchangeRateSnapshot

**Description**: Represents a snapshot of exchange rates fetched during a processing run.

**Identity**: Composite key (baseCurrency, targetCurrency, fetchedAt)

**Attributes**:

- `baseCurrency` (CurrencyCode) - Base currency (always GBP for this system)
- `targetCurrency` (CurrencyCode) - Target currency being converted from
- `rate` (Decimal) - Exchange rate (1 targetCurrency = rate GBP)
- `fetchedAt` (DateTime) - When this rate was fetched
- `provider` (String) - Exchange rate provider name
- `processingRunId` (String) - Identifier for the processing run that fetched this rate

**Business Rules**:

- Rates are fetched once per processing run for all required currencies
- Rates are immutable once fetched
- Multiple transactions in the same run use the same rate snapshot
- Historical rates are preserved for audit trail

**Relationships**:

- Used by many `Transaction` entities for conversion
- Associated with a specific processing run

---

### 5. ProcessingRun

**Description**: Represents a single execution of the normalization or categorisation process.

**Identity**: Unique run identifier (UUID)

**Attributes**:

- `id` (UUID) - Unique run identifier
- `runType` (RunType) - NORMALISATION or CATEGORISATION
- `startedAt` (DateTime) - When processing started
- `completedAt` (DateTime, nullable) - When processing completed
- `status` (RunStatus) - Current run status
- `transactionsProcessed` (Integer) - Number of transactions processed
- `transactionsSucceeded` (Integer) - Number successfully processed
- `transactionsFailed` (Integer) - Number that failed
- `errorLog` (Array<String>) - Collection of error messages
- `exchangeRateSnapshot` (Array<ExchangeRateSnapshot>) - Rates used in this run (normalisation only)

**Enumerations**:

- `RunStatus`: IN_PROGRESS, COMPLETED, FAILED, PARTIAL_SUCCESS
- `RunType`: NORMALISATION, CATEGORISATION

**Business Rules**:

- Each run must complete before the next run of the same type
- Failed runs should be logged for developer review
- Partial success is acceptable (some transactions fail, others succeed)
- Exchange rates are only fetched during normalization runs

**Relationships**:

- Processes many `Transaction` entities
- May create multiple `ExchangeRateSnapshot` entities

---

## Entity Relationships Diagram

```mermaid
erDiagram
    %% Direct FK relationships (solid lines)
    BankSource ||--o{ Transaction : "bankSourceId"
    Category ||--o{ Transaction : "categoryAiValue / categoryManualValue"
    ProcessingRun ||--o{ ExchangeRateSnapshot : "processingRunId"

    %% Indirect relationships (dotted lines)
    ProcessingRun ||..o{ Transaction : "audits via timestamps"
    Transaction }o..o| ExchangeRateSnapshot : "uses rate (no FK)"

    BankSource {
        String id PK
        String displayName
        String sheetId
    }

    Transaction {
        UUID id PK
        BankSourceId bankSourceId FK
        String categoryAiValue FK
        String categoryManualValue FK
        Decimal originalAmountValue
        CurrencyCode originalAmountCurrency
        Decimal gbpAmountValue
        ProcessingStatus processingStatus
    }

    Category {
        String name PK
        String displayName
        String description
    }

    ExchangeRateSnapshot {
        CurrencyCode baseCurrency PK
        CurrencyCode targetCurrency PK
        DateTime fetchedAt PK
        String processingRunId FK
        Decimal rate
    }

    ProcessingRun {
        UUID id PK
        RunType runType
        RunStatus status
    }
```

## Key Design Decisions

### 1. Single Transaction Entity

Rather than separate entities for source and normalised transactions, we use a single `Transaction` entity that evolves through its lifecycle. This simplifies deduplication and provides a clear audit trail.

### 2. Status-Based Processing

The `ProcessingStatus` enum enables the two-phase architecture (NFR-006), allowing normalisation and categorisation to run independently.

### 3. Dual Category Storage

Storing both `categoryAiValue` and `categoryManualValue` separately (rather than overwriting) maintains auditability and allows for historical learning (FR-014).

### 4. Exchange Rate Snapshots

Rather than storing a single "current" exchange rate, we snapshot rates per processing run. This provides:

- Audit trail for conversions
- Consistency within a processing batch
- Historical rate tracking

### 5. Immutable Transaction IDs

Once assigned, transaction IDs never change. This is critical for:

- Deduplication (FR-010)
- Concurrent processing (FR-002)
- Cross-system referential integrity

## Implementation Notes

### Google Sheets Mapping

Each entity corresponds to specific columns in Google Sheets:

**Transaction → Result Sheet Columns**:

- Row number → Implicit surrogate key
- Columns → Direct mapping to attributes
- Formula columns → `Category` (calculated as `=IF(ManualOverride<>"", ManualOverride, AICategory)`)

**BankSource → Configuration**:

- Stored in Google Apps Script properties
- Not persisted as rows in sheets

**Category → Categories Configuration Sheet**:

- Dedicated "Categories" sheet with columns for name, description, examples, isActive
- Each row represents one category
- Easy for users to view and modify without touching code

**ExchangeRateSnapshot → Audit Log Sheet (optional)**:

- Could be logged to separate sheet for audit purposes
- Or stored only in memory during processing run

### Persistence Strategy

- **Primary Storage**: Google Sheets (rows = transactions)
- **Configuration**:
  - Bank sources and mappings: Script Properties
  - Categories: Dedicated "Categories" sheet
- **Audit Logs**: Execution logs + optional audit sheet
- **State Management**: Status column in result sheet

## Related Requirements

This entity model directly supports the following requirements:

- **FR-001**: Transaction entity supports normalisation
- **FR-002**: Unique IDs enable concurrent handling
- **FR-003/004**: Currency attributes support conversion
- **FR-005**: Status and category attributes support async categorisation
- **FR-006**: BankSource entity encapsulates schema support
- **FR-007**: ExchangeRateSnapshot handles API integration
- **FR-010**: Transaction ID enables deduplication
- **FR-012**: Transaction ID backfilling
- **FR-013**: Dual category storage for manual overrides
- **FR-014**: Transaction relationships support historical learning
- **FR-015**: Category entity manages definitions
- **NFR-006**: ProcessingStatus supports two-phase architecture
