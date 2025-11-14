# FIRE Project Assistant Guide

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

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**
```bash
bd ready --json
```

**Create new issues:**
```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**
```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**
```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`
6. **Commit together**: Always commit the `.beads/issues.jsonl` file together with the code changes so issue state stays in sync with code state

### Auto-Sync

bd automatically syncs with git:
- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### MCP Server (Recommended)

If using Claude or MCP-compatible clients, install the beads MCP server:

```bash
pip install beads-mcp
```

Add to MCP config (e.g., `~/.config/claude/config.json`):
```json
{
  "beads": {
    "command": "beads-mcp",
    "args": []
  }
}
```

Then use `mcp__beads__*` functions instead of CLI commands.

### Managing AI-Generated Planning Documents

AI assistants often create planning and design documents during development:
- PLAN.md, IMPLEMENTATION.md, ARCHITECTURE.md
- DESIGN.md, CODEBASE_SUMMARY.md, INTEGRATION_PLAN.md
- TESTING_GUIDE.md, TECHNICAL_DESIGN.md, and similar files

**Best Practice: Use a dedicated directory for these ephemeral files**

**Recommended approach:**
- Create a `history/` directory in the project root
- Store ALL AI-generated planning/design docs in `history/`
- Keep the repository root clean and focused on permanent project files
- Only access `history/` when explicitly asked to review past planning

**Example .gitignore entry (optional):**
```
# AI planning documents (ephemeral)
history/
```

**Benefits:**
- ✅ Clean repository root
- ✅ Clear separation between ephemeral and permanent documentation
- ✅ Easy to exclude from version control if desired
- ✅ Preserves planning history for archeological research
- ✅ Reduces noise when browsing the project

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ✅ Store AI planning docs in `history/` directory
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems
- ❌ Do NOT clutter repo root with planning documents

For more details, see README.md and QUICKSTART.md.

## Remember

- This project is "vibecoded" - embrace the iterative, learning approach
- Always update documentation to reflect current thinking
- Use persistent documentation to avoid repeating context
- Track all bugs before fixing them
- When in doubt, check the ADRs