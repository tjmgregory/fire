# Transaction Categorization System

An automated system for categorizing financial transactions using Google Apps Script and OpenAI's GPT-4.

## Overview

This system automatically categorizes financial transactions from various sources (Google Sheets, CSV files) using AI-powered categorization. It maintains a clean, categorized dataset and provides monthly summaries of spending patterns.

## Features

- Automated transaction categorization using GPT-4
- Support for multiple data sources
- Manual override capability
- Monthly spending summaries
- Confidence scoring for categorizations
- Batch processing for efficiency

## Setup

1. Create a new Google Apps Script project
2. Copy the contents of `src/Code.js` and `src/config.js` into your Apps Script project
3. Set up your OpenAI API key in the Apps Script project:
   - Go to Project Settings > Script Properties
   - Add a new property named `OPENAI_API_KEY` with your API key

## Usage

1. Run the `initializeSpreadsheet()` function to set up the required sheets
2. Import your transaction data into the "Transactions" sheet
3. Run `processNewTransactions()` to categorize new transactions
4. Review and adjust categories as needed using the manual override column

## Sheet Structure

### Transactions Sheet
- Date
- Description
- Amount
- Category (AI-suggested)
- Manual Override
- Confidence
- Last Updated

### Categorized Transactions Sheet
- Date
- Description
- Amount
- Category
- Source

### Monthly Summary Sheet
- Month
- Category columns
- Total

## Development

The project is structured into several components:

- `Code.js`: Main script file containing core functionality
- `config.js`: Configuration settings and constants

## Security

- API keys are stored securely using Google Apps Script's Properties Service
- All data processing happens within Google's secure environment
- No sensitive data is stored outside of your Google Drive

## Contributing

Feel free to submit issues and enhancement requests! 