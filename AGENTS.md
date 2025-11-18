# FIRE Project Assistant Guide

## Project Overview

This is the FIRE (Financial Independence, Retire Early) project - a Google Apps Script-based system for automated transaction categorization across multiple bank accounts. The project follows the **AI Unified Process (AIUP)** methodology - an agile, iterative, requirements- and spec-driven development approach powered by AI.

## Development Methodology: AI Unified Process (AIUP)

**🚨 CRITICAL - READ THIS FIRST 🚨**: This project uses the AI Unified Process. See [docs/ai-unified-process.svg](docs/ai-unified-process.svg) for the complete workflow diagram.

**🚨 CRITICAL - READ THIS FIRST 🚨**: This project uses **bd (beads)** for **ALL** work tracking. This is **NON-NEGOTIABLE**. Please review the beads skill for more information on it's use.

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
