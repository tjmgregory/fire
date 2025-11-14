# CLAUDE.md - FIRE Project Assistant Guide

## Project Overview

This is the FIRE (Financial Independence, Retire Early) project - a Google Apps Script-based system for automated transaction categorization across multiple bank accounts. The system is "entirely vibecoded" with a focus on practical financial automation.

## Core Principles

### 1. Documentation-First Development
- **Always** consult existing documentation before making changes
- Update docs BEFORE implementing code changes
- Documentation locations:
  - `docs/adr/` - Architecture Decision Records (source of truth)
  - `docs/coding-standards/` - Code style and patterns
  - `docs/issues/bug-tracker.md` - Bug tracking

### 2. Commit-As-You-Go
- Commit regularly and silently after each file update
- Use clear, descriptive commit messages
- Keep commits atomic and focused
- Follow [Conventional Commits](https://www.conventionalcommits.org/) specification
  - Format: `<type>(<scope>): <subject>`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
  - Example: `feat(categorization): add support for Amex transactions`
  - Example: `fix(normalization): handle edge case in date parsing`
  - Example: `docs(adr): update ADR-001 with new bank format`

### 3. Documentation Standards  
- Documentation remains the source of truth for architectural decisions and coding standards
- Always reference and update relevant documentation when making changes
- The `docs/plans/` directory contains historical implementation plans from Cursor usage

## Technical Stack

- **Platform**: Google Apps Script
- **Language**: JavaScript (Apps Script dialect)
- **External APIs**: OpenAI GPT-4 for categorization
- **Storage**: Google Sheets (transaction data, logs)
- **Security**: API keys in Properties Service

## Supported Banks

| Bank | Integration Type | Transaction ID |
|------|-----------------|----------------|
| Monzo | Live API | Native ID |
| Revolut | CSV Import | Generated |
| Yonder | CSV Import | Generated |

## Code Standards

### JavaScript/Apps Script
- Follow Google Apps Script style guide
- Use JSDoc comments for all functions
- Prefer descriptive variable names (e.g., `transactionDescription` over `desc`)
- Keep functions single-purpose and focused

### Error Handling Pattern
```javascript
// Top-level functions catch and log
function onTrigger() {
  try {
    processNewTransactions();
  } catch (err) {
    console.error(`[onTrigger] Execution failed: ${err.message}`, err.stack);
    return false;
  }
}

// Mid-level functions throw without logging
function parseData(input) {
  if (!input) {
    throw new Error('Input is null or undefined');
  }
  // Process...
}
```

### Logging Levels (Supported in Apps Script)
- `console.error()`: Actual errors preventing operation
- `console.warn()`: Potential issues (deprecated features, etc.)
- `console.info()`: Important business events
- `console.log()`: Debugging information

Note: All standard console methods are fully supported in Google Apps Script. View logs via "View > Logs" in the Apps Script editor.

## Transaction Processing Flow

1. **Normalization** (ADR 001)
   - Convert dates to YYYY-MM-DD
   - Standardize amounts (negative for debits)
   - Convert all amounts to GBP
   - Generate transaction IDs using `Utilities.getUuid()`
   - Create stable `originalReference` for duplicate detection

2. **Categorization** (ADR 002)
   - AI categorization using OpenAI GPT-4
   - Manual override capability
   - Batch processing (10 transactions per API call)
   - Categories defined in `config.gs`

## Testing & Validation

When testing changes:
1. Test with real transaction data from all bank sources
2. Verify currency conversion handling
3. Test edge cases (refunds, transfers)
4. Validate manual override functionality
5. Run lint/typecheck commands if available

## Common Tasks

### Adding a New Bank
1. Update ADR 001 with new bank's format
2. Create normalizer in appropriate module
3. Add to `getSourceSheets()` in config
4. Test with sample data
5. Update documentation

### Modifying Categories
1. Update `CATEGORIES` array in `config.gs`
2. Test categorization with new categories
3. Document reasoning in appropriate ADR

### Debugging Transaction Issues
1. Check System Logs sheet for errors
2. Verify transaction ID generation
3. Check currency conversion if applicable
4. Validate date parsing

## Security Notes

- NEVER commit API keys or secrets
- Store all sensitive data in Properties Service
- API keys accessed via: `PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY')`
- All processing happens within Google's infrastructure

## File Structure Reference

```
/
├── src/apps-script/
│   ├── main.gs           # Core transaction processing
│   ├── config.gs         # Configuration and constants
│   ├── categorization.gs # AI categorization logic
│   └── utils.gs          # Utility functions
├── docs/
│   ├── adr/              # Architecture decisions
│   ├── coding-standards/ # Code style guides
│   ├── plans/            # Historical implementation plans (Cursor-specific)
│   └── issues/           # Bug tracking
└── .cursor/rules/        # Editor-specific rules
```

## Important ADRs

- **ADR 001**: Data Normalization Strategy - How we handle different bank formats
- **ADR 002**: Transaction Categorization Strategy - AI-powered categorization approach
- **ADR 005**: Normalization-Categorization Separation - System architecture

## Useful Commands

For Google Apps Script development:
- Deploy: Via Apps Script editor UI
- Test: Run functions directly in editor
- Logs: View > Logs in Apps Script editor
- Properties: Project Settings > Script Properties

## Remember

- This project is "vibecoded" - embrace the iterative, learning approach
- Always update documentation to reflect current thinking
- Use persistent documentation to avoid repeating context
- Track all bugs before fixing them
- When in doubt, check the ADRs