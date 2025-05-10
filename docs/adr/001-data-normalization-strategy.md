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
- Columns: TBD
- Date Format: TBD
- Amount Format: TBD
- Transaction ID: TBD

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

## Consequences

### Positive
- Handles all known sheet formats
- Deterministic transaction IDs
- Consistent output format
- Extensible for new sheets

### Negative
- Complex normalization logic
- Need to maintain format mappings
- Potential performance impact from normalization
- May need updates for new sheet formats

## Implementation Notes

1. Store format mappings in configuration
2. Implement format detection
3. Add validation for normalized data
4. Include format version tracking
5. Add logging for normalization issues 