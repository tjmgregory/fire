# ADR 001: Data Normalization Strategy

## Status

Proposed

## Context

We need to handle transaction data from various Google Sheets:
- Monzo transaction sheet
- Revolut transaction sheet
- Yonder transaction sheet

Each sheet has its own:
- Column naming conventions
- Date formats
- Amount formats
- Transaction ID systems (or lack thereof)
- Special characters and formatting

## Research Findings

### Source Sheet Formats

#### Monzo Transaction Sheet
- Format: Google Sheet
- Columns:
  - Transaction ID: Unique identifier (e.g., "tx_00009OTxGTgBsccfxgpscD")
  - Date: DD/MM/YYYY format
  - Time: HH:mm:ss format
  - Type: Transaction type (e.g., "Card payment", "Faster payment")
  - Name: Merchant name
  - Emoji: Category emoji
  - Category: Transaction category
  - Amount: Transaction amount
  - Currency: 3-letter code
  - Local amount: Local currency amount
  - Local currency: Local currency code
  - Notes and #tags: Additional notes
  - Address: Merchant address
  - Receipt: Receipt information
  - Description: Detailed description
  - Category split: Split category info
- Date Format: DD/MM/YYYY
- Amount Format: Decimal with 2 places (e.g., "1000.00")
- Transaction ID: Prefixed with "tx_" followed by alphanumeric string

#### Revolut Transaction Sheet
- Format: Google Sheet
- Columns: TBD
- Date Format: TBD
- Amount Format: TBD
- Transaction ID: TBD

#### Yonder Transaction Sheet
- Format: Google Sheet
- Columns: TBD
- Date Format: TBD
- Amount Format: TBD
- Transaction ID: TBD

## Decision

We will implement a flexible data normalization system with the following components:

1. **Column Mapping System**
   - Configuration-based mapping for known sheet formats
   - Fuzzy matching for unknown column names
   - Support for custom mappings

2. **Transaction ID Generation**
   - For transactions with existing IDs:
     - Prefix with source sheet name
     - Append original ID
   - For transactions without IDs:
     - Generate hash from:
       - Transaction date (YYYY-MM-DD)
       - Description (normalized)
       - Amount (with 2 decimal places)
       - Source sheet name

3. **Data Normalization Rules**
   - Dates: Convert to YYYY-MM-DD
   - Descriptions: Remove special chars, normalize whitespace
   - Amounts: Standardize to negative for debits
   - Account Names: Map to consistent types

4. **Standardized Transaction Format**
All transactions will be normalized to the following structure:

```typescript
interface NormalizedTransaction {
  id: string;              // Unique transaction identifier
  date: string;            // ISO 8601 date format (YYYY-MM-DD)
  time: string;            // 24-hour time format (HH:mm:ss)
  description: string;     // Transaction description/merchant name
  amount: number;          // Transaction amount (positive for credits, negative for debits)
  currency: string;        // 3-letter currency code
  category: string;        // Transaction category
  type: string;           // Transaction type (e.g., "Card payment", "Faster payment")
  metadata: {             // Additional source-specific data
    [key: string]: any;
  };
}
```

Example normalization for Monzo:
```typescript
// Input row:
{
  "Transaction ID": "tx_00009OTxGTgBsccfxgpscD",
  "Date": "13/09/2017",
  "Time": "18:13:37",
  "Type": "Faster payment",
  "Name": "GREGORY T J M",
  "Emoji": "",
  "Category": "Income",
  "Amount": "1000.00",
  "Currency": "GBP",
  "Local amount": "1000.00",
  "Local currency": "GBP",
  "Notes and #tags": "MONZO",
  "Address": "",
  "Receipt": "",
  "Description": "MONZO",
  "Category split": ""
}

// Normalized output:
{
  id: "tx_00009OTxGTgBsccfxgpscD",
  date: "2017-09-13",
  time: "18:13:37",
  description: "GREGORY T J M",
  amount: 1000.00,
  currency: "GBP",
  category: "Income",
  type: "Faster payment",
  metadata: {
    emoji: "",
    localAmount: 1000.00,
    localCurrency: "GBP",
    notes: "MONZO",
    address: "",
    receipt: "",
    description: "MONZO",
    categorySplit: ""
  }
}
```

## Consequences

### Positive
- Handles all known sheet formats
- Deterministic transaction IDs
- Consistent output format
- Extensible for new sheets
- Preserved original data in metadata
- Clear validation rules
- Maintainable codebase

### Negative
- Complex normalization logic
- Need to maintain format mappings
- Potential performance impact from normalization
- May need updates for new sheet formats
- Additional processing overhead
- Potential data loss in edge cases
- Increased storage requirements

### Neutral
- Learning curve for new data sources
- Regular updates needed for new formats
- Documentation requirements

## Implementation Notes

1. Store format mappings in configuration
2. Implement format detection
3. Add validation for normalized data
4. Include format version tracking
5. Add logging for normalization issues
6. Create a `TransactionNormalizer` class
7. Implement source-specific normalizers
8. Add validation rules
9. Create test cases for each format
10. Document normalization rules
11. Add error logging
12. Implement data cleaning utilities

## Future Considerations
1. Support for new data sources
2. Enhanced validation rules
3. Improved error handling
4. Performance optimization
5. Additional metadata fields
6. Custom normalization rules
7. Data quality metrics 