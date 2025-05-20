# Automated Transaction Categorization System: Implementation Plan

## 1. Architecture Overview

```
+------------------------+      +------------------------+      +------------------------+      +------------------------+
| Source Google Sheets   |      | Normalization Layer    |      | Categorization Layer  |      | Output/Analysis Sheet  |
| - Monzo transactions   | ---> | - Google Apps Script   | ---> | - ChatGPT 4.1 nano    | ---> | - Categories as columns|
| - Revolut transactions |      | - Data standardization |      | - Batch processing    |      | - Months as rows      |
| - Yonder transactions  |      | - Currency conversion  |      | - Learning mechanism  |      | - Monthly summaries   |
+------------------------+      +------------------------+      +------------------------+      +------------------------+
```

## 2. Technical Components

1. **Google Apps Script** for the main implementation
2. **OpenAI API Integration** for ChatGPT 4.1 nano categorization
3. **Google Sheets API** for reading/writing data
4. **Trigger System** for scheduling updates
5. **Override Column System** to handle manual corrections

## 3. Implementation Checklist

### Research and Setup
- ✅ Document the structure of each source sheet (Monzo, Revolut, Yonder)
- ✅ Document findings in [ADR 001: Data Normalization Strategy](/docs/adr/001-data-normalization-strategy.md)
- ✅ Document output structure in [ADR 003: Output Sheet Structure](/docs/adr/003-output-sheet-structure.md)
- ✅ Review and approve ADR 001
- ✅ Create test cases based on research
- ✅ Create a new Apps Script project in Google Drive
- ✅ Set up necessary permissions and API access
- ✅ Configure script properties for API keys

### Data Normalization
- ✅ Implement column mapping system for each source sheet
- ✅ Implement transaction ID & reference generation
- ✅ Implement date/time parsing for different formats
- ✅ Implement amount normalization with debit/credit handling
- ✅ Implement basic description extraction
- ✅ Implement rich description combination strategy (as per ADR-001 table)
- ✅ Update field mapping configurations for all bank sources
- ✅ Add better error handling for description fields
- ✅ Implement transaction type mapping
- ✅ Implement currency conversion
- ✅ Create functions to read from each source sheet
- ✅ Set up triggers for the live-updating sheets
- ✅ Create handlers for new transaction rows
- ✅ Implement immediate persistence of normalized data
- ✅ Add status tracking for normalization phase

### Transaction Categorization
- 🔄 Implement categorization system based on [ADR 002: Transaction Categorization Strategy](/docs/adr/002-transaction-categorization-strategy.md)
- 🔄 Set up OpenAI API connection
- ❌ Implement batch processing for API calls
- ❌ Add learning mechanism for improving categorization
- ❌ Create separate categorization triggers
- ❌ Implement rate limiting and error handling

### Output Generation
- ❌ Implement output structure based on ADR 003
- ❌ Create monthly summary sheet
- ❌ Set up automatic updates for output sheets
- ❌ Add data visualization options
- ❌ Implement status tracking columns
- ❌ Set up Category (final) as a calculated column using Sheet functions to use AI Category unless Manual Override is present

### Trigger System
- ✅ Implement trigger system based on [ADR 004: Trigger System Design](/docs/adr/004-trigger-system-design.md)
- ✅ Set up time-based triggers
- ✅ Implement event-based triggers
- ✅ Add error handling for triggers
- ❌ Update triggers for separated processes

### Testing and Validation
- ✅ Create test suite for data normalization
- ✅ Test with various sheet formats
- ✅ Validate ID generation and uniqueness
- ✅ Test rich description combination strategy
- ✅ Verify handling of empty fields
- ✅ Test with real Monzo, Revolut, and Yonder transactions
- ✅ Check edge cases (special characters, very long descriptions)
- ✅ Ensure consistent normalization across different banks
- ❌ Test categorization accuracy
- 🔄 Verify data consistency across sheets
- ❌ Test separation of processes

## 4. Security Considerations

- Store API keys securely using Google Apps Script's Properties Service
- Implement error handling for API failures
- Set up logging for troubleshooting
- Add monitoring for API usage and rate limits

## 5. Potential Challenges and Solutions

- **API Rate Limits**: Implement batch processing and queuing
- **Accuracy Issues**: Create a manual override system and learning mechanism
- **Data Consistency**: Add validation and error checking
- **Multiple Currencies**: Store exchange rates and implement conversion
- **Process Separation**: Implement robust state tracking and error recovery
- **Known Bug - Duplicate Transactions**: The normalization process currently re-adds every row from input sheets on each run due to broken logic for checking existing transactions. Reference ADR-001 for deterministic transaction reference implementation details.