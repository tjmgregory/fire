# Transaction Categorization System

A Google Apps Script implementation for the FIRE project's transaction processing system. This component handles the normalization and categorization of financial transactions from various bank sources.

## Implementation Details

This component implements the architecture defined in [ADR 005](../docs/adr/005-normalization-categorization-separation.md), providing:
- Data normalization from multiple bank sources
- AI-powered transaction categorization
- Automated processing and updates
- Error handling and logging

## Setup Instructions

1. Create a new Google Apps Script project:
   - Go to [script.google.com](https://script.google.com)
   - Click "New Project"
   - Copy the contents of each `.gs` file into separate script files in the project

2. Set up the Google Sheet:
   - Create a new Google Sheet
   - Add your transaction data with the following columns:
     - Date
     - Description
     - Amount
   - The script will automatically create additional sheets for categories and logs

3. Configure API Access:
   - Get an OpenAI API key from [platform.openai.com](https://platform.openai.com)
   - In the Apps Script project, go to Project Settings > Script Properties
   - Add a new property:
     - Name: `OPENAI_API_KEY`
     - Value: Your OpenAI API key

4. Run the initialization:
   - Open the script editor
   - Select the `initialize` function
   - Click the "Run" button
   - Grant the necessary permissions when prompted

## Project Structure

- `main.gs`: Main script file with core functionality
- `config.gs`: Configuration settings and constants
- `utils.gs`: Utility functions for data processing

## Features

- Automatic transaction categorization using GPT-4.1
- Support for multiple source sheets
- Manual override capability
- Error logging and monitoring
- Monthly summary generation

## Usage

The script runs automatically every hour to process new transactions. You can also:

1. Run `processNewTransactions()` manually to process transactions immediately
2. Use the output sheet to view categorized transactions
3. Check the logs sheet for any errors or issues

## Security

- API keys are stored securely in Script Properties
- All data processing happens within Google's infrastructure
- No data is stored outside of your Google Sheet

## Maintenance

- Monitor the logs sheet for any errors
- Review categorization accuracy periodically
- Update the categories list in `config.gs` if needed 