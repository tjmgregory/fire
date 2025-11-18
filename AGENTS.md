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

1. **Inception** (`docs/aiup/01-inception/`)
   - Business Requirements Catalog
   - Stakeholder alignment
   - Test strategy planning
   - Quick iterations for feedback

2. **Elaboration** (`docs/aiup/02-elaboration/`)
   - Business Use Case Diagrams
   - Entity Models
   - System Use Case Diagrams
   - Test cases

3. **Construction** (`docs/aiup/03-construction/`)
   - System Use Case Specifications
   - AI-generated code from specs
   - Unit and integration testing
   - Developer review

4. **Transition** (`docs/aiup/04-transition/`)
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

1. Follow specifications in `docs/aiup/03-construction/`
2. Update specs if you discover gaps
3. Write tests BEFORE implementation when possible
4. Link code commits to requirements using beads

**AFTER implementation:**

1. Update specifications to match reality
2. Document any deviations from original spec
3. Ensure all tests pass
4. Update use case diagrams if behavior changed

## Commit-As-You-Go

- Commit regularly and silently after each file update
- Use clear, descriptive commit messages
- Keep commits atomic and focused
- Follow [Conventional Commits](https://www.conventionalcommits.org/) specification
  - Format: `<type>(<scope>): <subject>`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
  - Example: `feat(categorization): add support for Amex transactions`
  - Example: `fix(normalization): handle edge case in date parsing`

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
|   ├── aiup              # AI categorization logic
│   └── coding-standards/ # Code style guides
```

## Useful Commands

For Google Apps Script development:

- Deploy: Via Apps Script editor UI
- Test: Run functions directly in editor
- Logs: View > Logs in Apps Script editor
- Properties: Project Settings > Script Properties
