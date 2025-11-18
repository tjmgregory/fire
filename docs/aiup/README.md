# AI Unified Process (AIUP) Documentation

This directory contains all AIUP artifacts for the FIRE project, organized by phase.

## Directory Structure

```
docs/aiup/
├── README.md                    # This file
├── VISION.md                    # Project vision and goals
├── inception/                   # Phase 1: Foundation
│   ├── business-requirements.md # Business needs catalog
│   ├── stakeholders.md          # Stakeholder identification
│   └── test-strategy.md         # Overall test approach
├── elaboration/                 # Phase 2: Design
│   ├── use-case-diagrams.md     # Business use case diagrams
│   ├── entity-models.md         # Data models
│   ├── system-diagrams.md       # System use case diagrams
│   └── test-cases.md            # Detailed test cases
├── construction/                # Phase 3: Implementation
│   ├── use-case-specs/          # Detailed specifications
│   └── implementation-notes.md  # Construction insights
└── transition/                  # Phase 4: Deployment
    ├── uat-plan.md              # User acceptance testing
    ├── deployment-strategy.md   # Continuous delivery approach
    └── improvement-log.md       # Continuous improvement tracking
```

## AIUP Principles Applied to FIRE

### 1. Requirements-Driven
All code changes must trace back to a documented requirement in `inception/business-requirements.md`.

### 2. AI-Assisted
AI agents follow specifications in this directory to generate and modify code. Specifications are the source of truth.

### 3. Iterative Improvement
These documents evolve alongside the codebase. When reality diverges from specs, specs are updated and the reason documented.

### 4. Test-Protected
Test cases in `elaboration/test-cases.md` must pass. New features require new test cases first.

### 5. Stakeholder-Centric
Changes are validated against stakeholder needs documented in `inception/stakeholders.md`.

### 6. Traceable
Each document references related documents, creating a chain:
```
Business Requirement → Use Case → Specification → Code → Test Case → Deployment
```

## Document Relationships

```
VISION.md
    ↓
inception/business-requirements.md
    ↓
elaboration/use-case-diagrams.md
    ↓
elaboration/system-diagrams.md
    ↓
construction/use-case-specs/*.md
    ↓
src/apps-script/*.gs
    ↓
elaboration/test-cases.md
    ↓
transition/uat-plan.md
```

## How to Use This Directory

### For AI Agents

1. **Starting new work**: Check `inception/business-requirements.md` for context
2. **Implementing features**: Follow specs in `construction/use-case-specs/`
3. **Writing tests**: Reference `elaboration/test-cases.md`
4. **Discovering gaps**: Update relevant specs, document in beads issue

### For Humans

1. **Understanding the system**: Start with `VISION.md`, then browse by phase
2. **Adding features**: Document in `inception/business-requirements.md` first
3. **Reviewing changes**: Verify specs match implementation
4. **Planning work**: Use specs to create beads issues

## Integration with Beads

All beads issues should reference AIUP documents:

```bash
bd create "Implement categorization API" \
  -t feature -p 1 \
  --description "REQ-001 from inception/business-requirements.md"
```

This creates full traceability from business need to working code.

## Current Phase

**Phase**: Inception → Elaboration (Transitioning)
**Status**: Migrating existing project to AIUP methodology
**Next Steps**:
1. Create VISION.md
2. Document existing requirements
3. Create use case diagrams for current functionality
4. Build test case catalog

## References

- [AI Unified Process Official Site](https://aiup.dev/)
- [AIUP Process Diagram](../ai-unified-process.svg)
- [Project AGENTS.md](../../AGENTS.md) - AI agent guidelines
