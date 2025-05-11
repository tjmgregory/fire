# ADR 003: Output Sheet Structure

## Status

Proposed

## Context

We need a structured output format that:
- Preserves all transaction data
- Tracks categorization history
- Supports manual overrides
- Enables easy analysis
- Maintains data integrity
- Tracks processing status

## Decision

We will implement a multi-sheet output structure with the following components:

1. **Main Transaction Sheet**
   Columns:
   - Date (YYYY-MM-DD)
   - Description (original)
   - Amount (standardized)
   - Category (final) - Calculated column using Sheet functions: uses AI Category unless Manual Override is present
   - AI Category (suggested)
   - Manual Override
   - Confidence
   - Source Sheet
   - Transaction ID
   - Original Reference
   - Notes
   - Last Updated
   - Processing Status (Normalized/Categorized/Error)
   - Normalization Timestamp
   - Categorization Timestamp
   - Error Details (if any)

2. **Monthly Summary Sheet**
   - Auto-generated monthly summaries
   - Category totals
   - Trend analysis
   - Budget comparisons

3. **System Logs Sheet**
   - Error tracking
   - Processing history
   - API usage logs
   - Manual override history
   - Normalization statistics
   - Categorization statistics

4. **Category Definitions Sheet**
   - Category list
   - Descriptions
   - Examples
   - Rules

## Consequences

### Positive
- Complete transaction history
- Easy to analyze
- Supports manual corrections
- Maintains data integrity
- Enables future features
- Clear process status tracking
- Better error handling
- Improved monitoring

### Negative
- Complex sheet structure
- Need to maintain multiple sheets
- Potential performance impact
- More complex queries
- Additional storage requirements

## Implementation Notes

1. Implement sheet creation on initialization
2. Add data validation rules
3. Set up automatic updates
4. Create backup system
5. Add sheet protection where needed
6. Implement status tracking
7. Add timestamp management
8. Create error logging system 