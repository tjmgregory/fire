# Yonder Transaction ID Issue Fix

## 1. Problem Statement

The system was experiencing the following error when processing Yonder transactions:
```
Error: Required column not found in sheet Yonder: Transaction ID
```

This error occurred because the column mapping for Yonder in `utils.gs` incorrectly included an `originalId` field mapped to `['Transaction ID']`, but according to the ADR-001 data normalization strategy, Yonder sheets do not have a Transaction ID column.

## 2. Investigation

A review of the documentation confirmed:

1. From ADR-001:
   > Yonder Transaction Sheet
   > - Format: Google Sheet
   > - Columns: [...]
   > - Transaction ID: Not provided in the format, will be generated using our ID generation system

2. Meanwhile, in `utils.gs:getColumnMap`, we found:
   ```javascript
   else if (lowerName === 'yonder') {
     return {
       // other fields...
       originalId: ['Transaction ID'], // Yonder doesn't have explicit IDs
       // other fields...
     };
   }
   ```

3. This mismatch between the code and documentation caused the error.

## 3. Implementation Changes

1. Updated `getColumnMap` function in `utils.gs` to remove the `originalId` mapping for Yonder:
   ```javascript
   else if (lowerName === 'yonder') {
     return {
       date: ['Date/Time of transaction'],
       time: ['Date/Time of transaction'],
       description: ['Description'],
       amount: ['Amount (GBP)'],
       currency: ['Currency'],
       category: ['Category'],
       type: ['Debit or Credit'],
       // Removed originalId as Yonder doesn't have Transaction ID column
       country: ['Country']
     };
   }
   ```

2. Modified `normalizeTransaction` function to handle cases when `indices.originalId` doesn't exist:
   ```javascript
   // Handle case when indices.originalId doesn't exist (like with Yonder)
   const originalId = indices.originalId !== undefined ? row[indices.originalId] : undefined;
   const originalReference = this.generateOriginalReference(dateTime, amount, originalId);
   ```

3. No changes were needed to `generateOriginalReference` as it already properly handled the case when `originalId` is undefined.

## 4. Testing

The system should now be able to process Yonder transactions without errors, generating transaction IDs using the fallback mechanism:
- For Yonder sheets, it will generate `originalReference` using the combination of date, time, and amount.

## 5. Considerations

This change aligns the code with the documented data normalization strategy. It demonstrates the importance of keeping code in sync with documentation and specifications.

## Conclusion

✅ All changes have been implemented and the system should now correctly process Yonder transactions. 