# FIRE (Financial Independence, Retire Early) Project

> **Note:** This project is entirely vibecoded - learnings and insights to be shared as the project develops.

In its early form, this project offers account-agnostic automation for transaction categorisation. It's designed to complement any financial planning spreadsheet that relies on accurate categorisation. A special thanks to the excellent work [shared here](https://www.reddit.com/r/financialindependence/comments/rwq9qw/i_made_a_new_and_improved_advanced/), which served as the inspiration for this project.

## Supported Accounts

| Account | Integration | Supported |
|---------|-----------------|-----------|
| Monzo | Live | ✅ |
| Revolut | CSV | ✅ |
| Yonder | CSV | ✅ |

## System Architecture

The system processes financial data in three main stages:
1. **Normalization**: Standardizes data from different source sheets
2. **Categorization**: Uses AI to categorize transactions

For detailed architecture explanations, see the [ADR directory](docs/adr/).

## Project Structure

- `src/apps-script/`: Google Apps Script implementation for transaction processing
  - See [Apps Script README](src/apps-script/README.md) for setup and usage
- `docs/`: Project documentation
  - `adr/`: Architecture Decision Records
  - `coding-standards/`: Coding patterns and best practices to adhere to
  - `plans/`: Implementation plans and timelines
- `.cursor/`: Editor configuration and rules

## Features

- **Transaction Processing**
  - Automatic categorization using AI
  - Support for multiple bank sources
  - Manual override capability
  - Error logging and monitoring

## Development

### Google Apps Script Deployment

This project uses [clasp](https://github.com/google/clasp) for deploying Google Apps Script code.

#### Initial Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   cp .clasp.json.example .clasp.json
   ```
   Edit `.env` and `.clasp.json` with your script ID (from your Apps Script URL).

3. **Authenticate with Google**:
   ```bash
   npm run clasp:login
   ```
   This will open a browser for authentication. The credentials will be saved to `~/.clasprc.json`.

4. **Run the setup script** (optional):
   ```bash
   npm run setup
   ```
   This interactive script will help you configure clasp if you prefer guided setup.

#### Deployment Commands

- **Push changes to Apps Script**:
  ```bash
  npm run deploy
  ```

- **Deploy to production** (creates a versioned deployment):
  ```bash
  npm run deploy:prod
  ```
  Note: Requires `DEPLOYMENT_ID` in your `.env` file.

- **Open in Apps Script editor**:
  ```bash
  npm run clasp:open
  ```

- **Pull latest from Apps Script**:
  ```bash
  npm run clasp:pull
  ```

#### GitHub Actions Deployment

Deployments to Google Apps Script happen automatically when changes are pushed to `main` branch.

**Required GitHub Secrets**:
1. `SCRIPT_ID`: Your Google Apps Script ID
2. `CLASP_CREDENTIALS`: Contents of `~/.clasprc.json` after running `clasp login`
3. `DEPLOYMENT_ID` (optional): For production deployments

To set up GitHub Actions:
1. Run `clasp login` locally
2. Copy the contents of `~/.clasprc.json`
3. Add as `CLASP_CREDENTIALS` secret in GitHub repository settings
4. Add your `SCRIPT_ID` as a repository secret

### Architecture Decisions

Key architectural decisions are documented in the [docs/adr/](docs/adr/) directory.

### Implementation Plans

Detailed implementation plans can be found in the [docs/plans/](docs/plans/) directory. These are what keep the vibe coding on track.

### Coding Standards

Coding standards are maintained to keep the codebase consistent and maintainable.


## Contributing

1. Review the relevant ADRs for architectural context
2. Check the implementation plans for current status
3. Follow the coding standards in `docs/coding-standards`
4. Update documentation as needed

## Security

- All sensitive data (API keys, etc.) is stored securely
- Data processing happens within Google's infrastructure
- No data is stored outside of your Google Sheet

## License

[Add your chosen license here] 