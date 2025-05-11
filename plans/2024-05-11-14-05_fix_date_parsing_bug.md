# Date Parsing Bug Fix Plan

## Problem Description
The system is currently failing with the following error:
```
RangeError: Invalid time value
  at parseDateTime(utils:209:31)
  at normalizeTransaction(utils:132:27)
  at [unknown function](utils:41:42)
  at getNewTransactions(utils:41:26)
  at [unknown function](main:123:32)
  at processNewTransactions(main:121:16)
```

The error occurs when parsing date values from the Monzo sheet. The log shows:
```
[getNewTransactions] Found 9136 data rows in sheet: Monzo
[parseDateTime] Monzo timeStr type: object, value: Sat Dec 30 1899 18:13:37 GMT+0000 (Greenwich Mean Time)
```

## Root Cause Analysis
The issue appears to be in the `parseDateTime` function in `utils.gs`. The function is receiving a very old date (1899) for the timeStr parameter when processing Monzo transactions. This is likely due to how Google Sheets represents time-only values as dates with the "zero date" of December 30, 1899.

## Architecture Components Affected
- `Utils` class in `src/apps-script/utils.gs` - particularly the `parseDateTime` function
- Transaction processing workflow for Monzo sheets

## Implementation Steps

1. [x] Update the `parseDateTime` function to properly handle the 1899 date as a time-only value
2. [x] Add better type checking and error handling for date/time values
3. [x] Add more detailed logging to help diagnose similar issues in the future
4. [ ] Test the fix with sample Monzo transaction data
5. [ ] Deploy the updated code to the production environment

## Detailed Solution
We need to modify the `parseDateTime` function to recognize and handle the "zero date" (December 30, 1899) pattern that Google Sheets uses for time-only values. When we detect a Date object that has a year of 1899, we should extract only the time components and apply them to the main date.

## Code Changes Required

### Update `parseDateTime` in utils.gs
The function needs to be updated to:
1. Add better type checking and validation
2. Handle the special case of Date objects with year 1899
3. Improve error messages with more context
4. Add more detailed logging

## Testing Strategy
1. Create test transactions with various date/time formats to verify the fix
2. Run the `processNewTransactions` function on the Monzo sheet
3. Verify that no errors occur and dates are correctly parsed
4. Check the logs to ensure everything is working as expected

## Security Considerations
No security impact as this is a data parsing issue.

## Maintenance Notes
- The date/time parsing logic is critical to transaction processing
- Future Google Sheets format changes could potentially impact this function
- Consider implementing a more robust date/time handling library in the future

## Timeline
- Implementation: 1 hour
- Testing: 30 minutes
- Documentation: 15 minutes
- Deployment: 15 minutes

## Delivery
Once implemented and tested, the fix will ensure accurate date/time parsing for all transactions, preventing processing failures. 