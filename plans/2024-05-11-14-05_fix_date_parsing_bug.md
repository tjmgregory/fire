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
4. [x] Test the fix with sample Monzo transaction data
5. [x] Deploy the updated code to the production environment

## Detailed Solution
We need to modify the `parseDateTime` function to recognize and handle the "zero date" (December 30, 1899) pattern that Google Sheets uses for time-only values. When we detect a Date object that has a year of 1899, we should extract only the time components and apply them to the main date.

Additionally, we'll add detailed debugging logs to help identify the exact point of failure. Based on the logs, we've discovered that the RangeError occurs during the timezone conversion using `toLocaleString('en-GB', { timeZone: 'Europe/London' })` which can have inconsistent behavior across environments.

The solution is to:
1. Detect and properly handle the Google Sheets "zero date" (Dec 30, 1899)
2. Add comprehensive logging to track the date conversion process
3. Make timezone assumptions explicit - assuming input dates are already in UK time
4. Use direct ISO string generation for UTC output without problematic intermediate conversions
5. Maintain proper error propagation for genuine errors

This approach adheres to our established error handling guidelines while addressing the specific cause of the RangeError.

## Timezone Considerations
The updated implementation assumes that dates imported from transaction sources are already in UK time. This is consistent with the previous implementation but avoids the RangeError caused by `toLocaleString()`. In the future, if more precise timezone handling is needed, we should implement a more robust solution using a dedicated date/time library.

## Final Implementation
The bug has been fixed by:

1. Properly identifying and handling Google Sheets' time-only values (dates with year 1899)
2. Simplifying date conversion logic to avoid problematic localization methods
3. Cleaning up the code to make it more maintainable
4. Adding clear documentation about timezone assumptions
5. Ensuring robust validation and error handling

The implementation preserves the transaction processing pipeline while making it more reliable. Testing confirms that the fix resolves the original issue.

## Code Changes Required

### Update `parseDateTime`