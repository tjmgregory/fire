# FIRE (Financial Independence, Retire Early) Project

In its early form, this project offers account-agnostic automation for transaction categorisation. It’s designed to complement any financial planning spreadsheet that relies on accurate categorisation. A special thanks to the excellent work [shared here](https://www.reddit.com/r/financialindependence/comments/rwq9qw/i_made_a_new_and_improved_advanced/), which served as the inspiration for this project.

## Supported Accounts

| Account | Integration | Supported |
|---------|-----------------|-----------|
| Monzo | Live | ✅ |
| Revolut | CSV | ✅ |
| Yonder | CSV | ✅ |

All account data is normalized to a standard format as defined in [ADR 001](docs/adr/001-data-normalization-strategy.md).

## System Architecture

The system processes financial data in three main stages:
1. **Normalization**: Standardizes data from different source sheets
2. **Categorization**: Uses AI to categorize transactions
3. **Analysis**: Generates summaries and insights

For a detailed architecture diagram and explanation, see [ADR 005: Normalization and Categorization Process Separation](docs/adr/005-normalization-categorization-separation.md).

## Project Structure

- `src/apps-script/`: Google Apps Script implementation for transaction processing
  - See [Apps Script README](src/apps-script/README.md) for setup and usage
- `docs/`: Project documentation
  - `adr/`: Architecture Decision Records
  - `plans/`: Implementation plans and timelines
- `.cursor/`: Editor configuration and rules

## Features

- **Transaction Processing**
  - Automatic categorization using AI
  - Support for multiple bank sources
  - Manual override capability
  - Error logging and monitoring

- **Analysis & Reporting**
  - Monthly summaries
  - Category-based analysis
  - Spending trends
  - Budget comparisons

- **FIRE Planning**
  - Savings rate calculator
  - Investment growth tracking
  - FIRE date projection
  - Scenario modeling

## Development

### Architecture Decisions

Key architectural decisions are documented in the `docs/adr/` directory:
- [ADR 001](docs/adr/001-data-normalization-strategy.md): Data Normalization Strategy
- [ADR 002](docs/adr/002-transaction-categorization-strategy.md): Transaction Categorization Strategy
- [ADR 003](docs/adr/003-output-sheet-structure.md): Output Sheet Structure
- [ADR 004](docs/adr/004-trigger-system-design.md): Trigger System Design
- [ADR 005](docs/adr/005-normalization-categorization-separation.md): Process Separation

### Implementation Plans

Detailed implementation plans and timelines can be found in the `docs/plans/` directory.

## Contributing

1. Review the relevant ADRs for architectural context
2. Check the implementation plans for current status
3. Follow the coding standards in `.cursor/rules/`
4. Update documentation as needed

## Security

- All sensitive data (API keys, etc.) is stored securely
- Data processing happens within Google's infrastructure
- No data is stored outside of your Google Sheet

## License

[Add your chosen license here] 