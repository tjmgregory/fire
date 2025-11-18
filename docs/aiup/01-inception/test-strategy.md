# Test Strategy

**Document Version**: 1.1
**Last Updated**: 2025-11-18
**Phase**: Inception
**Traceability**: References [VISION.md](../VISION.md)

## Document Purpose

This document defines the overall testing strategy for the FIRE project, including test types, coverage goals, automation approach, and quality gates.

## Testing Philosophy

### Test-Protected Development (AIUP Principle)

- **Specifications define expected behavior** → Tests validate that behavior
- **Tests are written BEFORE or WITH implementation** (TDD when possible)
- **All changes must maintain or improve test coverage**
- **Regression prevention is paramount**
- **Tests serve as living documentation**

### Test Behaviors, Not Implementation (Ian Cooper's TDD Philosophy)

**Key Principles:**

1. **Trigger for tests**: Write a test when adding a new *behavior*, not when creating a new method/class
2. **Test the public API**: Test module behaviors through stable interfaces, not internal implementation
3. **Test independence**: Tests must run in complete isolation from each other—no shared state or data
4. **Refactoring must be safe**: If tests break during refactoring (behavior unchanged), tests are too coupled to implementation
5. **Red-Green-Refactor**: Design emerges during refactor phase, not during green phase
6. **Avoid excessive mocking**: Only mock external dependencies (APIs, databases), never internal classes

**What This Means for FIRE:**

- Test "categorize transactions" behavior, not individual helper functions
- Each test generates its own data via builders/fakers
- Tests must be runnable independently in any order
- Implementation changes (e.g., refactoring normalization logic) shouldn't break tests

### Quality Over Speed

We prioritize reliable, accurate financial data over rapid feature delivery. A bug in categorization could affect user's financial decisions for months before discovery.

### Testing Philosophy References

This philosophy draws heavily from:

- Ian Cooper's ["TDD, Where Did It All Go Wrong"](https://www.youtube.com/watch?v=EZ05e7EMOLM) (NDC 2013)
- Kent Beck's *Test Driven Development: By Example* (2002)

---

## Test Pyramid Strategy

```text
         /\
        /--\  E2E Tests (5%)
       /    \  - Full workflow validation
      /      \  - User acceptance scenarios
     /--------\  Integration Tests (20-30%)
    /          \  - Apps Script + OpenAI
   /            \  - Sheet read/write
  /              \  - Multi-component flows
 /                \
/------------------\ Unit Tests (70-80%)
 Categorization logic, normalization, validation
```

---

## Test Categories

### 1. Unit Tests

**Purpose**: Test module behaviors through their public APIs

**Scope** (organized by behavior, not implementation):

- **Transaction Import Behavior**: Given raw bank CSV → When imported → Then normalized to standard format
- **Categorization Behavior**: Given normalized transaction → When categorized → Then assigned correct category
- **Override Behavior**: Given manual category override → When applied → Then persists and never auto-categorizes again
- **Duplicate Detection Behavior**: Given identical transactions → When processed → Then marked as duplicates
- **Error Handling Behavior**: Given invalid input → When processed → Then logs error and continues

**What NOT to Test**:

- Internal helper functions (unless they represent a distinct behavior)
- Private methods or implementation details
- Getters/setters without logic
- Individual steps within a behavior (test the whole behavior)

**Tools**:

- Google Apps Script testing framework (future)
- Manual test cases (current)
- Assertion-based validation
- Transaction builders for test data generation

### 2. Integration Tests

**Purpose**: Test interactions with external dependencies (ports & adapters boundaries)

**Scope**:

- **Sheets Integration**: Read/write to Google Sheets (real sheets in test environment)
- **OpenAI Integration**: API categorization requests (mocked for deterministic tests)
- **Error Logging**: System Logs sheet integration (real sheets)
- **Configuration**: Script Properties loading (real properties)
- **Trigger Execution**: Scheduled and manual triggers (real Apps Script environment)

**Mocking Strategy**:

- **Mock external APIs** (OpenAI): Expensive, slow, non-deterministic responses
- **Use real Google Sheets**: Fast enough, deterministic, part of our platform
- **Never mock internal classes**: Tests should exercise real categorization logic

**Tools**:

- Apps Script debugger
- OpenAI API mock/stub
- Test spreadsheet (generated per test or per suite)
- Manual validation

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

### 4. Security Tests

**Purpose**: Validate security and privacy requirements

**Scope**:

- API key storage and access
- Data privacy (no external storage)
- Input validation
- Error message sanitization (no secrets in logs)

**Tools**:

- AI code review
- Security checklist

---

## Test Data Strategy

### Principle: Complete Test Independence

**All automated tests MUST generate their own data.** Shared test datasets create painful coupling between tests—when one test needs to change the dataset, other tests break. This violates the principle that tests must run independently.

### Test Data Approaches by Test Type

#### Unit & Integration Tests: Generated Data (Builders/Fakers)

**Approach**: Each test generates exactly the data it needs using builder patterns or faker libraries.

**Benefits**:

- Tests can run in any order
- Tests can run in parallel
- No risk of one test polluting another's data
- Test intent is clear (data setup shows what matters)
- Refactoring tests is safe and easy

**Implementation**:

```javascript
// Example: Transaction builder pattern
class TransactionBuilder {
  withMerchant(name) { ... }
  withAmount(amount) { ... }
  withDate(date) { ... }
  withCategory(category) { ... }
  build() { ... }
}

// In test:
test("categorizes grocery purchases correctly", () => {
  const transaction = new TransactionBuilder()
    .withMerchant("Tesco")
    .withAmount(-45.67)
    .build();

  const result = categorize(transaction);
  expect(result.category).toBe("Groceries");
});
```

**Data Generators Needed**:

- Transaction builder (per bank format: Monzo, Revolut, Yonder)
- Random but realistic merchant names
- Random but valid amounts, dates, currencies
- Edge case generators (zero amounts, very large amounts, etc.)

#### E2E Tests: Static Reference Dataset

**Approach**: A single, stable, version-controlled dataset used only for end-to-end workflow validation.

**Why static data works here**:

- E2E tests validate complete user journeys, not individual behaviors
- Humans need to inspect results manually (for now)
- Having consistent data makes visual validation easier
- These tests don't run frequently (pre-release only)
- Few E2E tests exist (5% of test suite)

**E2E Reference Dataset** (`test-data/e2e-reference-set.csv`):

- 50 transactions covering all banks (Monzo, Revolut, Yonder)
- All categories represented
- Known edge cases: refunds, transfers, foreign currency, £0 amounts
- **Immutable**: Only updated when bank formats change or new features added
- Documented expected outputs for each transaction

#### Manual Testing & Debugging: Anonymized Production Data

**Use Case**: Investigating production bugs or validating fixes.

**Approach**:

- Keep anonymized copies of real user data that triggered bugs
- Store in `test-data/debugging/` (git-ignored, not committed)
- Used for one-off manual testing only
- Never used in automated tests

### Test Data Anti-Patterns to Avoid

❌ **Shared mutable dataset**: Multiple tests reading/writing same data
❌ **Tests that depend on previous test state**: Test B assumes Test A ran first
❌ **Golden master files shared across tests**: Changes break multiple tests
❌ **Database seeding shared by test suite**: Tests interfere with each other
❌ **Hard-coded production-like data in tests**: Obscures test intent

### Test Data Management

**Generated Data**:

- Builders/fakers live in `test/builders/` directory
- Version controlled with tests
- Documented with examples
- Reusable across test suite

**E2E Reference Dataset**:

- Stored in `test-data/e2e-reference-set.csv`
- Version controlled
- Change requires documentation of why
- Expected outputs documented in `test-data/e2e-expected-results.md`

**Debugging Data**:

- Stored in `test-data/debugging/` (git-ignored)
- Never committed to version control
- Anonymized before saving locally

---

## Test Automation Strategy

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

## Test Naming & Documentation

### Tests ARE the Documentation

Well-written tests serve as executable documentation of system behavior. We don't need separate test case documents - the tests themselves should be clear enough.

### Test Naming Convention

Test names should clearly express:

1. **Use case reference** (optional, if applicable)
2. **Given-When-Then scenario**

**Format**:

```
test("<Use Case ID>: Given <context>, when <action>, then <expected outcome>")
```

**Examples**:

```javascript
// References a use case
test("UC-003: Given Tesco transaction, when categorized, then assigned to Groceries")

// Doesn't reference use case (internal behavior)
test("Given £0 transaction, when normalized, then preserves zero amount")

// Edge case
test("Given duplicate transactions, when processed, then marked as duplicates")

// Regression test (references bug)
test("Bug #42: Given refund transaction, when categorized, then not treated as purchase")
```

### What Makes a Good Test Name?

- ✅ Reads like a specification
- ✅ Non-technical stakeholder can understand it
- ✅ Describes behavior, not implementation
- ✅ Clear what failed when test breaks
- ❌ Doesn't reference class/method names
- ❌ Doesn't use technical jargon unnecessarily

### Test Code as Documentation

The test code itself should be self-documenting:

```javascript
// GOOD: Clear, behavior-focused
test("Given manual override, when transaction re-categorized, then override persists", () => {
  const transaction = new TransactionBuilder()
    .withMerchant("Tesco")
    .withAutoCategory("Groceries")
    .build();

  const overridden = applyManualOverride(transaction, "Entertainment");
  const recategorized = categorize(overridden);

  expect(recategorized.category).toBe("Entertainment");
  expect(recategorized.isManualOverride).toBe(true);
});

// BAD: Implementation-focused, unclear intent
test("testCategoryProperty", () => {
  const t = { merchant: "Tesco", cat: null };
  setCat(t, "Groceries");
  processTransaction(t);
  expect(t.cat).toBe("Groceries");
});
```

### Test Results Tracking

- Test runners report pass/fail automatically
- CI/CD systems track trends over time
- No manual test result documentation needed
- Failed tests are bugs to fix, not status to track

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
| 2025-11-18 | 1.1 | Major revision: Ian Cooper TDD philosophy integrated | Align with behavior-driven testing, eliminate shared datasets |
| 2025-11-18 | 1.0 | Initial test strategy created | AIUP migration |

---

## Key Principles Summary

### The Golden Rules

1. **Test behaviors, not implementations** - Write tests when adding behaviors, not methods
2. **Test independence is sacred** - Every test generates its own data and runs in isolation
3. **Refactoring must be safe** - If refactoring breaks tests, tests are wrong (too coupled)
4. **Mock only external dependencies** - Never mock internal classes or domain logic
5. **Given-When-Then** - Structure all tests clearly: setup → action → assertion

### What This Means in Practice

**DO**:

- ✅ Generate test data with builders/fakers (except E2E)
- ✅ Test through public module APIs
- ✅ Mock OpenAI API for deterministic tests
- ✅ Run tests in any order, in parallel
- ✅ Test complete behaviors (import → normalize → categorize)
- ✅ Create regression tests for every bug

**DON'T**:

- ❌ Share test datasets between tests
- ❌ Test private helper functions directly
- ❌ Mock internal categorization logic
- ❌ Write tests that depend on other tests running first
- ❌ Break tests when refactoring (behavior unchanged)
- ❌ Test implementation details like data structure choices

---

## References

### Project Documentation

- [VISION.md](../VISION.md)
- [Business Requirements](business-requirements.md)
- Requirements Catalogue *(to be created)*
- System Use Cases *(to be created)*
- [Coding Standards](../../coding-standards/)
- [ADR-002: Transaction Categorization Strategy](../../adr/002-transaction-categorization-strategy.md)

### External References

- Ian Cooper, ["TDD, Where Did It All Go Wrong"](https://www.youtube.com/watch?v=EZ05e7EMOLM) (NDC 2013)
  - [Herberto Graca's Distillation](https://herbertograca.com/2018/08/27/distillation-of-tdd-where-did-it-all-go-wrong/)
  - [Robert Moore's Review](http://robdmoore.id.au/blog/2015/01/26/review-of-ian-cooper-tdd-where-did-it-all-go-wrong)
- Kent Beck, *Test Driven Development: By Example* (2002)
