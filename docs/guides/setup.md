# Setup Guide

How to get FIRE running in your Google Sheets.

## Prerequisites

- A Google account
- An OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- Node.js installed (for deployment via clasp)

## Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like "FIRE Transactions"

You'll need to create **source sheets** for each bank you use, plus the system will create **Categories** and **Result** sheets automatically during setup.

### Create Bank Source Sheets

Create a new sheet tab for each bank you want to track. The sheet names and column headers must match exactly:

#### Monzo

Sheet name: `Monzo`

| Transaction ID | Date | Time | Name | Amount | Currency | Type | Category | Notes and #tags |
|---|---|---|---|---|---|---|---|---|

Monzo data comes from the [Monzo API](https://docs.monzo.com/) or the Monzo export CSV. Paste your export data starting from row 2.

#### Revolut

Sheet name: `Revolut`

| ID | Started Date | Completed Date | Description | Amount | Currency | Type |
|---|---|---|---|---|---|---|

Export your Revolut transactions as CSV and paste the data starting from row 2. The `ID` column will be backfilled by the system if your export doesn't include it.

#### Yonder

Sheet name: `Yonder`

| ID | Date/Time of transaction | Description | Amount (GBP) | Currency | Debit or Credit | Category | Country |
|---|---|---|---|---|---|---|---|

Paste your Yonder statement data starting from row 2. The `ID` column will be backfilled by the system.

> You only need to create sheets for banks you actually use. Disable unused banks in the configuration (Step 3).

## Step 2: Deploy the Apps Script

### Option A: Automatic (CI/CD)

If you've cloned the repo and set up CI (see [ci-setup.md](../ci-setup.md)):

```bash
npm install
npm run build    # Builds the Apps Script bundle
npm run deploy   # Pushes to Google Apps Script via clasp
```

### Option B: Manual (clasp)

1. Install clasp globally:
   ```bash
   npm install -g @google/clasp
   ```

2. Log in to clasp:
   ```bash
   clasp login
   ```

3. Create a new Apps Script project bound to your spreadsheet:
   ```bash
   clasp create --type sheets --parentId YOUR_SPREADSHEET_ID --rootDir dist
   ```
   The spreadsheet ID is the long string in your Google Sheets URL between `/d/` and `/edit`.

4. Build and push:
   ```bash
   npm install
   npm run build
   clasp push
   ```

### Option C: Copy/Paste

1. In your Google Sheet, go to **Extensions > Apps Script**
2. Delete any existing code in `Code.gs`
3. Copy the contents of `dist/Code.js` from the repo and paste it in
4. Save (Ctrl+S)

## Step 3: Configure Script Properties

In the Apps Script editor, go to **Project Settings** (gear icon) > **Script Properties** and add these:

### Required

| Property | Value | Description |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | Your OpenAI API key |
| `RESULT_SHEET_NAME` | `Result` | Name of the result sheet |
| `CATEGORIES_SHEET_NAME` | `Categories` | Name of the categories sheet |

### Optional

| Property | Default | Description |
|---|---|---|
| `OPENAI_MODEL` | `gpt-4` | OpenAI model to use |
| `OPENAI_TEMPERATURE` | `0.3` | Model temperature (lower = more deterministic) |
| `OPENAI_MAX_TOKENS` | `500` | Max tokens per API response |
| `MONZO_ENABLED` | `true` | Enable/disable Monzo processing |
| `MONZO_SHEET_NAME` | `Monzo` | Custom sheet name for Monzo data |
| `REVOLUT_ENABLED` | `true` | Enable/disable Revolut processing |
| `REVOLUT_SHEET_NAME` | `Revolut` | Custom sheet name for Revolut data |
| `YONDER_ENABLED` | `true` | Enable/disable Yonder processing |
| `YONDER_SHEET_NAME` | `Yonder` | Custom sheet name for Yonder data |
| `EXCHANGE_RATE_PROVIDER` | `https://api.exchangerate-api.com/v4/latest/` | Exchange rate API URL |
| `EXCHANGE_RATE_API_KEY` | *(none)* | API key if your exchange rate provider requires one |

> Set any bank's `_ENABLED` property to `false` if you don't use that bank.

## Step 4: Run Setup

1. In the Apps Script editor, select `setupSheets` from the function dropdown
2. Click **Run**
3. Grant the required permissions when prompted (Google will ask you to authorize the script)

This will:
- Create the **Categories** sheet with headers and 12 default categories
- Create the **Result** sheet with headers and data validation
- Install the **onEdit trigger** (for manual category overrides)
- Install **scheduled triggers** (normalization every 15 min, categorization every hour)

> `setupSheets` is idempotent — safe to run multiple times. It won't duplicate data.

## Step 5: Verify It Works

1. Paste a few test transactions into one of your bank source sheets
2. In the Apps Script editor, select `processNewTransactions` and click **Run**
3. Check the **Result** sheet — you should see your transactions normalised
4. Select `categorizeTransactions` and click **Run**
5. Check the Result sheet again — transactions should now have AI categories and confidence scores

## Troubleshooting

### "Missing required configuration: OPENAI_API_KEY"
You haven't set up the Script Properties yet. See Step 3.

### "Categories sheet is empty"
Run `setupSheets` first (Step 4).

### Permissions errors
When running for the first time, Google requires you to authorize the script. Click through the "This app isn't verified" warning (Advanced > Go to FIRE Transactions).

### Triggers not firing
Check **Triggers** (clock icon in Apps Script editor) to verify the triggers are installed. If they're missing, run `setupSheets` again.

### Exchange rate errors for foreign currency transactions
The default exchange rate provider is free and doesn't require an API key. If you're hitting rate limits, consider using a provider with an API key and update the `EXCHANGE_RATE_PROVIDER` and `EXCHANGE_RATE_API_KEY` Script Properties.

### Logs
View execution logs in the Apps Script editor: **Executions** (left sidebar) shows all recent runs with their logs and any errors.
