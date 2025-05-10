# ADR 001: Data Normalization Strategy

## Status

Proposed

## Context

We need to handle transaction data from various sources:
- Bank exports (different formats from different banks)
- CSV imports (from various tools and manual exports)
- Google Sheets (different column layouts)

Each source has its own:
- Column naming conventions
- Date formats
- Amount formats
- Transaction ID systems (or lack thereof)
- Special characters and formatting

## Research Findings

### Bank Export Formats

#### Chase
- Format: CSV
- Columns:
  - Transaction Date
  - Post Date
  - Description
  - Amount
  - Type
  - Category
  - Account Name
  - Account Number
- Date Format: MM/DD/YYYY
- Amount Format: Negative for debits, positive for credits
- Transaction ID: None provided

#### Bank of America
- Format: CSV
- Columns:
  - Date
  - Description
  - Amount
  - Running Balance
  - Account
- Date Format: MM/DD/YYYY
- Amount Format: Negative for debits, positive for credits
- Transaction ID: None provided

#### Wells Fargo
- Format: CSV
- Columns:
  - Date
  - Amount
  - Balance
  - Check Number
  - Description
- Date Format: MM/DD/YYYY
- Amount Format: Negative for debits, positive for credits
- Transaction ID: None provided

### CSV Import Formats

#### Excel Exports
- Common delimiters: comma, tab, semicolon
- Header row typically present
- Date formats vary by region settings
- Amount formats vary by region settings

#### Google Sheets
- Similar to Excel but with more consistent formatting
- Date formats follow sheet locale
- Amount formats follow sheet locale

## Decision

We will implement a flexible data normalization system with the following components:

1. **Column Mapping System**
   - Configuration-based mapping for known formats
   - Fuzzy matching for unknown formats
   - Support for custom mappings

2. **Transaction ID Generation**
   - For transactions with existing IDs:
     - Prefix with source name
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

## Consequences

### Positive
- Handles all known input formats
- Deterministic transaction IDs
- Consistent output format
- Extensible for new formats

### Negative
- Complex normalization logic
- Need to maintain format mappings
- Potential performance impact from normalization
- May need updates for new bank formats

## Implementation Notes

1. Store format mappings in configuration
2. Implement format detection
3. Add validation for normalized data
4. Include format version tracking
5. Add logging for normalization issues 