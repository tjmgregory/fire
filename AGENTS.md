# FIRE Project Assistant Guide

## Project Overview

This is the FIRE (Financial Independence, Retire Early) project - a Google Apps Script-based system for automated transaction categorization across multiple bank accounts. The project follows the **AI Unified Process (AIUP)** methodology - an agile, iterative, requirements- and spec-driven development approach powered by AI.

## Development Methodology: AI Unified Process (AIUP)

**CRITICAL**: This project uses the AI Unified Process. See [docs/ai-unified-process.svg](docs/ai-unified-process.svg) for the complete workflow diagram.

### AIUP Core Philosophy

- **Specifications drive code**, not the other way around
- **Iterative improvement** - specs, code, and tests evolve together
- **AI-assisted development** - AI handles tedious tasks; humans focus on logic
- **Test-protected** - comprehensive tests ensure consistent behavior
- **Requirements traceability** - from business needs to implementation

### AIUP Four Phases

1. **Inception** (`docs/aiup/inception/`)
   - Business Requirements Catalog
   - Stakeholder alignment
   - Test strategy planning
   - Quick iterations for feedback

2. **Elaboration** (`docs/aiup/elaboration/`)
   - Business Use Case Diagrams
   - Entity Models
   - System Use Case Diagrams
   - Test cases

3. **Construction** (`docs/aiup/construction/`)
   - System Use Case Specifications
   - AI-generated code from specs
   - Unit and integration testing
   - Developer review

4. **Transition** (`docs/aiup/transition/`)
   - User acceptance testing
   - Continuous delivery
   - Production optimization
   - Continuous improvement

### Working with AIUP as an AI Agent

**BEFORE writing code:**
1. Check `docs/aiup/` for existing specifications
2. Verify requirements are documented
3. Ensure test cases exist or create them
4. Review relevant use case diagrams

**WHEN implementing:**
1. Follow specifications in `docs/aiup/construction/`
2. Update specs if you discover gaps
3. Write tests BEFORE implementation when possible
4. Link code commits to requirements using beads

**AFTER implementation:**
1. Update specifications to match reality
2. Document any deviations from original spec
3. Ensure all tests pass
4. Update use case diagrams if behavior changed

## Core Principles

### 1. Documentation-First Development

- **Always** consult existing documentation before making changes
- Update docs BEFORE implementing code changes
- Documentation locations:
  - `docs/adr/` - Architecture Decision Records (source of truth)
  - `docs/coding-standards/` - Code style and patterns

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

## Technical Stack

- **Platform**: Google Apps Script
- **Language**: JavaScript (Apps Script dialect)
- **External APIs**: OpenAI GPT-4 for categorization
- **Storage**: Google Sheets (transaction data, logs)
- **Security**: API keys in Properties Service

## Testing & Validation

When testing changes:

1. Test with real transaction data from all bank sources
2. Verify currency conversion handling
3. Test edge cases (refunds, transfers)
4. Validate manual override functionality
5. Run lint/typecheck commands if available

## Common Tasks

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

```text
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

**🚨 CRITICAL - READ THIS FIRST 🚨**

This project uses **bd (beads)** for **ALL** work tracking. This is **NON-NEGOTIABLE**.

### What This Means for AI Agents

**✅ ALWAYS DO:**
- Track ALL work items in beads (bugs, features, tasks, epics, chores)
- Check `bd ready` before starting new work
- Update issue status as you work (`in_progress`, `completed`)
- Link discovered work with `discovered-from` dependencies
- Commit `.beads/issues.jsonl` with code changes
- Use beads MCP tools (`mcp__beads__*`) when available

**❌ NEVER DO:**
- Create markdown TODO lists
- Use GitHub Issues, Linear, Jira, or any other tracker
- Track work in comments, documentation, or commit messages
- Create planning documents without linking to beads issues
- Skip updating beads when discovering new work

### Why Beads is Mandatory

Beads provides:
- **Dependency tracking**: See what blocks what
- **Git integration**: Auto-syncs to `.beads/issues.jsonl`
- **AI-optimized**: JSON output, ready work detection
- **Traceability**: Links requirements → specs → code → tests
- **Single source of truth**: No duplicate tracking systems

### AIUP + Beads Integration

Beads issues should reference AIUP artifacts:

```bash
# Link to requirements
bd create "Implement transaction categorization" \
  -t feature -p 1 \
  --description "See docs/aiup/inception/business-requirements.md #REQ-001"

# Link discovered work during construction
bd create "Add validation for negative amounts" \
  -t task -p 2 \
  --deps discovered-from:bd-123 \
  --description "Found during implementation of use case UC-005"

# Link to test cases
bd create "Fix failing categorization test" \
  -t bug -p 0 \
  --description "Test case TC-012 in docs/aiup/elaboration/test-cases.md"
```

This creates full traceability: `Business Requirement → Use Case → Beads Issue → Code → Test`

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
