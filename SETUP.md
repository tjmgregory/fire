# Transaction Categorization System - Setup Guide

## Prerequisites

1. A Google account
2. An OpenAI API key
3. Basic familiarity with Google Sheets

## Step 1: Create a New Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click "+ New" to create a new spreadsheet
3. Name it something like "Transaction Categorization System"

## Step 2: Create the Apps Script Project

1. In your new Google Sheet, go to Extensions > Apps Script
2. This will open the Apps Script editor in a new tab
3. Delete any code in the default `Code.gs` file

## Step 3: Add the Project Files

1. In the Apps Script editor, create three new files:
   - Click the "+" button next to "Files"
   - Name them `Code.js`, `config.js`, and `setup.js`
2. Copy and paste the contents of each file from our project:
   - Copy the contents of `src/Code.js` into `Code.js`
   - Copy the contents of `src/config.js` into `config.js`
   - Copy the contents of `src/setup.js` into `setup.js`

## Step 4: Set Up the OpenAI API Key

1. In the Apps Script editor, go to Project Settings (gear icon)
2. Click on "Script Properties" tab
3. Click "Add script property"
4. Set the following:
   - Property: `OPENAI_API_KEY`
   - Value: Your OpenAI API key
5. Click "Save"

## Step 5: Deploy the Project

1. In the Apps Script editor, click "Deploy" > "New deployment"
2. Click "Select type" > "Web app"
3. Set the following:
   - Description: "Transaction Categorization System"
   - Execute as: "Me"
   - Who has access: "Only myself"
4. Click "Deploy"
5. Click "Authorize access" and follow the prompts

## Step 6: Test the Setup

1. Go back to your Google Sheet
2. You should see a new menu item called "Transaction Categorizer"
3. Click "Transaction Categorizer" > "Run Setup Test"
4. Check the execution log for any errors:
   - In the Apps Script editor, click "View" > "Execution log"

## Step 7: Verify the Sheets

After running the setup test, you should see:

1. Three new sheets:
   - "Transactions"
   - "Categorized Transactions"
   - "Monthly Summary"
2. Sample test data in the "Transactions" sheet
3. Proper column headers in all sheets

## Troubleshooting

If you encounter any issues:

1. Check the execution log for error messages
2. Verify that the OpenAI API key is correctly set in script properties
3. Make sure all three files are properly copied into the Apps Script project
4. Try running the `clearTestData()` function and then `testSetup()` again

## Next Steps

Once the setup is complete and working:

1. Import your actual transaction data into the "Transactions" sheet
2. Run "Process New Transactions" from the menu
3. Review the categorizations and use the manual override column if needed

## Security Notes

- Keep your OpenAI API key secure
- Don't share the Google Sheet with others unless necessary
- Regularly check the execution log for any unusual activity 