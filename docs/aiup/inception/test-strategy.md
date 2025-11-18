# Test Strategy

**Document Version**: 1.0
**Last Updated**: 2025-11-18
**Phase**: Inception
**Traceability**: References [VISION.md](../VISION.md), [business-requirements.md](business-requirements.md)

## Document Purpose

This document defines the overall testing strategy for the FIRE project, including test types, coverage goals, automation approach, and quality gates.

## Testing Philosophy

### Test-Protected Development (AIUP Principle)

- **Specifications define expected behavior** → Tests validate that behavior
- **Tests are written BEFORE or WITH implementation** (TDD when possible)
- **All changes must maintain or improve test coverage**
- **Regression prevention is paramount**
- **Tests serve as living documentation**

### Quality Over Speed

We prioritize reliable, accurate financial data over rapid feature delivery. A bug in categorization could affect user's financial decisions for months before discovery.

---

## Test Pyramid Strategy

```
         /\
        /  \  E2E Tests (5-10%)
       /----\  - Full workflow validation
      /      \  - User acceptance scenarios
     /--------\  Integration Tests (20-30%)
    /          \  - Apps Script + OpenAI
   /------------\  - Sheet read/write
  /--------------\  - Multi-component flows
 /----------------\
/------------------\ Unit Tests (60-70%)
 Categorization logic, normalization, validation
```

---

## Test Categories

### 1. Unit Tests

**Purpose**: Test individual functions in isolation

**Scope**:
- Transaction normalization logic
- Date parsing and formatting
- Currency handling
- Category mapping
- Data validation
- Error handling functions

**Tools**:
- Google Apps Script testing framework (future)
- Manual test cases (current)
- Assertion-based validation

**Coverage Goal**: 70% of functions

**Example Test Cases**:
- TC-010: Normalize Monzo transaction format
- TC-011: Normalize Revolut transaction format
- TC-012: Handle invalid date formats
- TC-013: Parse negative amounts (refunds)

---

### 2. Integration Tests

**Purpose**: Test component interactions and external integrations

**Scope**:
- Google Sheets read/write operations
- OpenAI API categorization requests
- Error logging to System Logs sheet
- Trigger execution
- Configuration loading from Script Properties

**Tools**:
- Apps Script debugger
- Live API testing (OpenAI)
- Manual validation with test spreadsheets

**Coverage Goal**: All critical integration points

**Example Test Cases**:
- TC-150: Read transactions from Monzo sheet
- TC-151: Call OpenAI API with sample transaction
- TC-152: Write categorized transactions to output sheet
- TC-153: Log errors to System Logs sheet
- TC-154: Execute time-based trigger

---

### 3. End-to-End (E2E) Tests

**Purpose**: Validate complete user workflows from start to finish

**Scope**:
- Import CSV → Normalize → Categorize → Output
- Manual override workflow
- Error recovery workflow
- Multi-bank processing in single run

**Tools**:
- Test spreadsheet with known data
- Manual execution and validation
- Automated scripts (future)

**Coverage Goal**: All primary use cases

**Example Test Cases**:
- TC-200: Complete workflow - Monzo transactions
- TC-201: Complete workflow - Revolut transactions
- TC-202: Complete workflow - Mixed banks
- TC-203: Error recovery - Invalid data
- TC-204: Manual override - Change category

---

### 4. Acceptance Tests (UAT)

**Purpose**: Validate system meets business requirements from user perspective

**Scope**:
- Real-world usage by FIRE practitioners (PS-001)
- Actual bank exports (not sanitized test data)
- Production-like environment
- User satisfaction metrics

**Tools**:
- Production spreadsheet copies
- User feedback forms
- Usage analytics (future)

**Coverage Goal**: All business requirements

**Example Test Cases**:
- UAT-001: User can set up system in <30 minutes
- UAT-002: Categorization accuracy >95% on real data
- UAT-003: Users understand error messages
- UAT-004: Manual overrides work as expected

---

### 5. Performance Tests

**Purpose**: Validate system meets performance requirements

**Scope**:
- Processing time for various batch sizes
- Apps Script execution time limits
- OpenAI API response times
- Sheet update performance

**Tools**:
- Apps Script Logger with timestamps
- Performance monitoring (future)

**Coverage Goal**: All performance requirements (NREQ-*)

**Example Test Cases**:
- PERF-001: Process 100 transactions in <10 seconds
- PERF-002: Stay within 6-minute Apps Script limit
- PERF-003: Handle 500 transactions per execution
- PERF-004: OpenAI API response time <3 seconds per transaction

---

### 6. Security Tests

**Purpose**: Validate security and privacy requirements

**Scope**:
- API key storage and access
- Data privacy (no external storage)
- Input validation
- Error message sanitization (no secrets in logs)

**Tools**:
- Manual code review
- Security checklist
- Penetration testing (manual)

**Coverage Goal**: All security requirements (SREQ-*)

**Example Test Cases**:
- SEC-001: API keys not in source code
- SEC-002: API keys not in logs
- SEC-003: Invalid input rejected gracefully
- SEC-004: No data sent to unauthorized external services

---

## Test Data Strategy

### Test Data Types

1. **Synthetic Data**: Hand-crafted test cases for edge cases
2. **Anonymized Real Data**: Actual bank exports with PII removed
3. **Production Clones**: Copies of real user data for debugging

### Test Data Sets

#### TD-001: Monzo Test Set
- 50 transactions covering all categories
- Includes refunds, transfers, foreign currency
- Known correct categorizations
- Edge cases: £0 amounts, very large amounts, special characters

#### TD-002: Revolut Test Set
- 50 transactions covering all categories
- Multi-currency transactions (GBP, USD, EUR)
- Forex transactions
- Edge cases: Crypto purchases, stock trades

#### TD-003: Yonder Test Set
- 30 credit card transactions
- Points/rewards transactions
- Edge cases: Annual fees, cashback

#### TD-004: Mixed Bank Set
- 150 transactions from all banks
- Duplicate detection scenarios
- Same merchant across different banks
- Concurrent processing scenarios

### Test Data Management

- Test data stored in `test-data/` directory (future)
- Version controlled alongside code
- Anonymized before commit
- Updated when bank formats change

---

## Test Automation Strategy

### Current State (Manual)

All tests currently executed manually:
1. Create test spreadsheet
2. Add test data
3. Run categorization manually
4. Validate output visually
5. Document results in test log

### Future State (Automated)

**Phase 1: Unit Test Automation**
- Implement Apps Script test framework
- Automate normalization tests
- Automate validation tests
- Run on every commit (CI)

**Phase 2: Integration Test Automation**
- Mock OpenAI API for predictable tests
- Automate sheet read/write tests
- Run nightly

**Phase 3: E2E Test Automation**
- Automated spreadsheet setup
- Headless execution
- Result validation
- Run on release candidates

---

## Test Coverage Goals

| Test Type | Current Coverage | Target Coverage | Timeline |
|-----------|-----------------|-----------------|----------|
| Unit Tests | ~20% (manual) | 70% (automated) | Phase 1 |
| Integration Tests | ~40% (manual) | 90% (automated) | Phase 2 |
| E2E Tests | ~60% (manual) | 100% (automated) | Phase 3 |
| UAT | Not started | 100% (manual) | Transition |
| Performance | ~30% (manual) | 100% (automated) | Phase 2 |
| Security | ~70% (manual) | 100% (manual) | Phase 1 |

---

## Quality Gates

### Pre-Commit Gates

- ✅ Code follows coding standards
- ✅ No hardcoded secrets
- ✅ Functions documented
- ⏳ Unit tests pass (when automated)

### Pre-Merge Gates (Future)

- All automated tests pass
- Code review approved
- Documentation updated
- No new security vulnerabilities

### Pre-Release Gates

- All E2E tests pass
- UAT approved by stakeholder (PS-001)
- Performance benchmarks met
- No critical bugs open
- Documentation complete

---

## Regression Prevention Strategy

### Regression Test Suite

Maintain a suite of tests for **every bug fix**:
1. Bug discovered → Create test case that reproduces bug
2. Fix bug
3. Verify test case now passes
4. Add test case to regression suite
5. Run regression suite before every release

**Regression Suite Test Cases**:
- To be populated as bugs are discovered and fixed

### Continuous Monitoring

**Production Monitoring** (future):
- Error rate alerts
- Categorization accuracy tracking
- Processing time monitoring
- API failure rate monitoring

---

## Test Environment Strategy

### Development Environment

- Personal Google account
- Test spreadsheet with synthetic data
- Development Apps Script project
- Separate OpenAI API key (or free tier)

### Staging Environment (Future)

- Separate Google account
- Production-like data (anonymized)
- Separate Apps Script deployment
- Separate API keys

### Production Environment

- User's Google account
- Real transaction data
- Production Apps Script deployment
- User's OpenAI API key

---

## Risk-Based Testing Priorities

### Critical Paths (Must Test Thoroughly)

1. **Transaction Categorization** (FREQ-003)
   - Core business value
   - Errors affect all downstream analysis
   - Depends on external API

2. **Data Normalization** (FREQ-002)
   - Foundation for all processing
   - Different code path per bank
   - Format changes break system

3. **Manual Override** (FREQ-004)
   - User trust depends on this
   - Data integrity critical

### High Risk Areas (Test Well)

1. Currency handling (FREQ-010)
2. Error handling (FREQ-030, FREQ-031)
3. API key security (SREQ-001)
4. Duplicate detection (FREQ-005)

### Medium Risk Areas (Adequate Testing)

1. Refund handling (FREQ-020)
2. Transfer detection (FREQ-021)
3. Performance optimization (NREQ-001)

---

## Test Case Naming Convention

```
[Type]-[Number]: [Description]

Types:
- TC: General Test Case
- UAT: User Acceptance Test
- PERF: Performance Test
- SEC: Security Test
- REG: Regression Test

Examples:
- TC-010: Normalize Monzo transaction format
- UAT-001: User setup time under 30 minutes
- PERF-001: Process 100 transactions in 10 seconds
- SEC-001: API keys not in source code
- REG-042: Handle duplicate merchant names (Bug #42)
```

---

## Test Documentation

### Test Case Format

Each test case documented with:
- **ID**: Unique identifier
- **Title**: Clear description
- **Requirements**: Links to FREQ/NREQ/etc.
- **Preconditions**: Setup required
- **Steps**: Detailed test steps
- **Expected Result**: What should happen
- **Actual Result**: What happened (during execution)
- **Status**: Pass/Fail/Blocked
- **Priority**: P0-P4
- **Automation**: Manual/Automated

### Test Results Tracking

- Test results logged in `test-results/` (future)
- Pass/fail tracked over time
- Trends analyzed for quality metrics
- Failures trigger investigation

---

## Defect Management

### Bug Lifecycle with Beads

1. **Discovery**: Bug found during testing
2. **Documentation**: Create beads issue
   ```bash
   bd create "Bug: Incorrect category for refunds" \
     -t bug -p 1 \
     --description "Test case TC-060 fails. Refunds categorized as purchases."
   ```
3. **Test Case Creation**: Create regression test
4. **Fix**: Implement fix, link to beads issue
5. **Verification**: Run regression test
6. **Closure**: Close beads issue when test passes

### Bug Priority Guidelines

- **P0 (Critical)**: Data loss, security breach, system unusable
- **P1 (High)**: Core features broken, frequent errors
- **P2 (Medium)**: Edge case failures, minor features broken
- **P3 (Low)**: Cosmetic issues, rare edge cases
- **P4 (Backlog)**: Nice-to-have fixes

---

## Test Metrics & Reporting

### Key Metrics

1. **Test Coverage**: % of requirements with test cases
2. **Test Pass Rate**: % of tests passing
3. **Defect Density**: Bugs per 1000 lines of code
4. **Test Automation Rate**: % of tests automated
5. **Mean Time to Detection (MTTD)**: How long bugs exist before detection
6. **Mean Time to Resolution (MTTR)**: How long to fix bugs

### Current Status (Baseline)

- Test Coverage: ~40% (manual test cases exist)
- Test Pass Rate: Unknown (not tracked systematically)
- Defect Density: Unknown (first release)
- Test Automation Rate: 0%
- MTTD: Unknown
- MTTR: Unknown

### Target Metrics (6 months)

- Test Coverage: >80%
- Test Pass Rate: >95%
- Test Automation Rate: >50%
- MTTR: <7 days

---

## Testing Tools & Infrastructure

### Current Tools

- Google Apps Script Editor (debugging)
- Manual test spreadsheets
- Apps Script Logger
- Visual inspection

### Planned Tools

- **Apps Script Unit Test Framework** (Phase 1)
- **CI/CD Integration** (GitHub Actions) (Phase 2)
- **Test Data Generator** (Phase 2)
- **Performance Profiler** (Phase 3)
- **Mock OpenAI API** (Phase 2)

---

## Change History

| Date | Version | Change | Reason |
|------|---------|--------|--------|
| 2025-11-18 | 1.0 | Initial test strategy created | AIUP migration |

---

## Next Steps

1. ✅ Create test-strategy.md (this document)
2. ⏳ Create detailed test cases in `elaboration/test-cases.md`
3. ⏳ Implement first automated unit tests (Phase 1)
4. ⏳ Set up CI/CD pipeline for automated testing
5. ⏳ Establish test metrics dashboard

---

## References

- [VISION.md](../VISION.md)
- [Business Requirements](business-requirements.md)
- [Test Cases](../elaboration/test-cases.md) *(to be created)*
- [Coding Standards](../../coding-standards/)
- [ADR-002: Transaction Categorization Strategy](../../adr/002-transaction-categorization-strategy.md)
