# Automated Transaction Categorization System: Implementation Plan

## 1. Architecture Overview

```
+------------------------+      +------------------------+      +------------------------+
| Source Google Sheets   |      | Processing Layer       |      | Output/Analysis Sheet  |
| - Live account sheet   | ---> | - Google Apps Script   | ---> | - Categories as columns|
| - Manual CSV sheets    |      | - ChatGPT 4.1 nano API |      | - Months as rows      |
| - Existing sheets      |      | - Learning mechanism   |      | - Monthly summaries   |
+------------------------+      +------------------------+      +------------------------+
```

## 2. Technical Components

1. **Google Apps Script** for the main implementation
2. **OpenAI API Integration** for ChatGPT 4.1 nano categorization
   - Implemented via UrlFetchApp.fetch() to make direct HTTP requests
   - Example implementation:
   ```javascript
   function callOpenAI(transactionDescription) {
     const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
     const url = 'https://api.openai.com/v1/chat/completions';
     
     const payload = {
       model: 'gpt-4-0125-preview', // or the ChatGPT 4.1 nano equivalent when available
       messages: [
         {
           role: 'system',
           content: 'You are a financial transaction categorizer. Categorize the transaction into one of these categories: Housing, Subscriptions, Phone, Groceries, Entertainment, Eating Out, Flights, Insurance, Clothing, Self Care, Gym, Education, Medical, Rideshare, Gifts, Charity, Fees, Cash, Misc'
         },
         {
           role: 'user',
           content: `Categorize this transaction: ${transactionDescription}`
         }
       ],
       temperature: 0.3
     };
     
     const options = {
       method: 'post',
       contentType: 'application/json',
       headers: {
         Authorization: `Bearer ${apiKey}`
       },
       payload: JSON.stringify(payload),
       muteHttpExceptions: true
     };
     
     const response = UrlFetchApp.fetch(url, options);
     const responseData = JSON.parse(response.getContentText());
     return responseData.choices[0].message.content.trim();
   }
   ```
3. **Google Sheets API** for reading/writing data
4. **Trigger System** for scheduling updates
5. **Override Column System** to handle manual corrections

## 3. Data Schema

### Input Sheet Format
Each source sheet (bank statement, CSV import, etc.) should contain the following columns:

| Column Name | Data Type | Description | Example |
|------------|-----------|-------------|---------|
| Date | Date | Transaction date | 2024-05-10 |
| Description | String | Transaction description | "AMZN Mktp US*1234" |
| Amount | Number | Transaction amount (negative for debits) | -29.99 |
| Account | String (Optional) | Account identifier | "Chase Checking" |
| Transaction ID | String (Optional) | Unique transaction identifier | "T123456789" |
| Notes | String (Optional) | Additional transaction notes | "Monthly subscription" |

### Output Sheet Format
The system will generate a categorized transaction sheet with the following columns:

| Column Name | Data Type | Description | Example |
|------------|-----------|-------------|---------|
| Date | Date | Transaction date | 2024-05-10 |
| Description | String | Original transaction description | "AMZN Mktp US*1234" |
| Amount | Number | Transaction amount | -29.99 |
| Category | String | Final category (AI or manual) | "Subscriptions" |
| AI Category | String | AI-suggested category | "Subscriptions" |
| Manual Override | String | Manual category override | "Entertainment" |
| Confidence | Number | AI confidence score (0-1) | 0.95 |
| Source Sheet | String | Original data source | "Chase May 2024" |
| Transaction ID | String | Unique transaction identifier | "T123456789" |
| Notes | String | Additional transaction notes | "Monthly subscription" |
| Last Updated | Date | Last modification timestamp | 2024-05-10 14:30:00 |

### Category Definitions
The system uses the following predefined categories:

| Category | Description | Examples |
|----------|-------------|----------|
| Housing | Rent, mortgage, utilities | Rent, Electricity, Water |
| Subscriptions | Recurring services | Netflix, Spotify, iCloud |
| Phone | Mobile phone expenses | Phone bill, Data plan |
| Groceries | Food and household items | Supermarket, Grocery store |
| Entertainment | Leisure activities | Movies, Games, Events |
| Eating Out | Restaurants and cafes | Restaurant, Coffee shop |
| Flights | Air travel expenses | Airline tickets, Baggage fees |
| Insurance | Insurance premiums | Health, Car, Home insurance |
| Clothing | Apparel and accessories | Clothing store, Shoes |
| Self Care | Personal care items | Toiletries, Cosmetics |
| Gym | Fitness expenses | Gym membership, Equipment |
| Education | Learning and courses | Online courses, Books |
| Medical | Healthcare expenses | Doctor visits, Medicine |
| Rideshare | Transportation services | Uber, Lyft, Taxi |
| Gifts | Gifts and donations | Birthday gifts, Charitable donations |
| Charity | Charitable contributions | Donations, Fundraising |
| Fees | Bank and service fees | ATM fees, Service charges |
| Cash | Cash withdrawals | ATM withdrawals |
| Misc | Unclassified transactions | Various small expenses |

### Input Data Normalization

#### Column Mapping
The system will handle various input formats by mapping different column names to our standard schema. Common mappings include:

| Standard Column | Common Variations |
|----------------|------------------|
| Date | "Transaction Date", "Date", "Posted Date", "Transaction Time" |
| Description | "Description", "Transaction Description", "Merchant", "Payee", "Details" |
| Amount | "Amount", "Transaction Amount", "Debit", "Credit", "Value" |
| Account | "Account", "Account Name", "Account Number", "Account Type" |
| Notes | "Notes", "Memo", "Category", "Tags" |

#### Transaction ID Generation
Since different sources may or may not provide transaction IDs, the system will generate deterministic IDs for all transactions using the following algorithm:

1. For transactions with existing IDs:
   - Use the source sheet name as a prefix
   - Append the original ID
   - Example: "Chase_2024_05_T123456789"

2. For transactions without IDs:
   - Create a hash using:
     - Transaction date (YYYY-MM-DD)
     - Description (normalized)
     - Amount (with 2 decimal places)
     - Source sheet name
   - Format: "HASH_[first 8 chars of hash]"
   - Example: "HASH_a1b2c3d4"

This ensures:
- Unique IDs across all sources
- Deterministic generation (same transaction always gets same ID)
- Ability to match transactions across different exports
- No collisions between different sources

#### Data Normalization Rules
1. **Dates**:
   - Convert all dates to YYYY-MM-DD format
   - Handle different timezone formats
   - Store original timezone information if available

2. **Descriptions**:
   - Remove special characters
   - Normalize whitespace
   - Convert to lowercase
   - Remove common prefixes (e.g., "POS ", "ACH ")
   - Preserve original in separate column

3. **Amounts**:
   - Standardize to negative for debits, positive for credits
   - Handle different currency formats
   - Store original format in metadata

4. **Account Names**:
   - Standardize common variations
   - Map to consistent account types
   - Preserve original name in metadata

## 4. Implementation Steps

1. **Setup Google Apps Script Project**
   - Create a new Apps Script project in Google Drive
   - Set up necessary permissions and API access
   - Configure script properties for API keys

2. **Source Data Processing**
   - Create functions to read from each bank sheet
   - Implement column mapping system:
     - Create mapping configuration for common bank formats
     - Add support for custom column mappings
     - Implement column detection for unknown formats
   - Implement data normalization:
     - Create date standardization functions
     - Implement description cleaning and normalization
     - Add amount format standardization
     - Create account name normalization
   - Implement transaction ID generation:
     - Add ID generation for transactions with existing IDs
     - Create hashing function for transactions without IDs
     - Add ID validation and collision detection
   - Set up triggers for the live-updating sheet
   - Create import handlers for CSV sheets

3. **ChatGPT Integration**
   - Set up OpenAI API connection
   - Design prompts for transaction categorization
   - Implement batch processing to optimize API usage
   - Include context from previous categorizations

4. **Categorization System**
   - Create functions to process transactions using ChatGPT
   - Implement confidence scoring for categorizations
   - Add columns for both AI-suggested categories and manual override columns
   - Design system to prioritize manual overrides over AI suggestions
   - Track categorization patterns to improve future suggestions

5. **Output Sheet Generation**
   - Create monthly summary sheet
   - Set up automatic updates
   - Add data visualization options
   - Implement transaction deduplication using generated IDs
   - Add support for transaction history tracking

6. **Testing and Validation**
   - Create test suite for data normalization
   - Test with various input formats
   - Validate ID generation and uniqueness
   - Test categorization accuracy
   - Verify data consistency across imports

## 5. Security Considerations

- Store API keys securely using Google Apps Script's Properties Service
- Implement error handling for API failures
- Set up logging for troubleshooting

## 6. Potential Challenges and Solutions

- **API Rate Limits**: Implement batch processing and queuing
- **Accuracy Issues**: Create a manual override system and learning mechanism
- **Data Consistency**: Add validation and error checking
- **Multiple Currencies**: Store exchange rates and implement conversion
- **OpenAI Integration**: Google Apps Script can make HTTP requests to the OpenAI API using the UrlFetchApp service. This allows direct integration without requiring middleware.

## 7. Recommended Tools

- **Google Apps Script** for primary implementation
- **OpenAI SDK** for JavaScript
- **Google Sheets API** (built into Apps Script)
- **LodashGS** library for data manipulation
- **Moment.js** for date handling

## 8. Development Timeline

- **Phase 1 (2 hours)**: Basic setup and data normalization
  - Set up Google Apps Script project
  - Configure API access and permissions
  - Create functions to read from bank sheets
  - Normalize data formats

- **Phase 2 (3 hours)**: ChatGPT integration and categorization
  - Implement OpenAI API integration
  - Create categorization functions
  - Add AI-suggested and override columns
  - Test with sample transactions

- **Phase 3 (2 hours)**: Output sheet generation
  - Create monthly summary sheet
  - Implement automatic updates
  - Set up triggers for sheet updates

- **Phase 4 (1 hour)**: Testing and refinement
  - Test end-to-end workflow
  - Fix any issues
  - Document the system

- **Total**: 8 hours for complete implementation

## 9. Maintenance Considerations

- Set up email alerts for errors
- Create a manual correction interface
- Document the system thoroughly
- Plan for periodic review of categorization accuracy

## Additional FIRE Features

- Spending trend analysis by category
- Budget vs. actual comparisons
- Savings rate calculator
- Investment growth tracking
- FIRE date projector based on savings rate
- "What-if" scenario modeling for different spending patterns 