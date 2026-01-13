---
description: Perform deep code review for Python and TypeScript codebases with comprehensive analysis across architecture, quality, style, performance, and security dimensions.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text the user typed after `/deep-code-review` in the triggering message **is** the target path to review. Assume you always have it available in this conversation even if `$ARGUMENTS` appears literally below.

**Input Format**: `[path]` or `[path] --depth [quick|standard|deep]`
- Default depth: `standard`
- `quick`: Focus on Critical and High issues only
- `standard`: Full review with Medium issues
- `deep`: Include all Low priority suggestions

Given the target path, follow this execution flow:

### Phase 1: Input Analysis & Scope Determination

1. **Parse Input Parameters**:
   - Extract target path (relative or absolute)
   - Determine review depth (default: standard)
   - Detect language type (Python/TypeScript/mixed)

2. **Validate Target**:
   - Check if path exists
   - Determine if it's a file or directory
   - If directory: identify all relevant source files
   - Filter out: test files, fixtures, node_modules, __pycache__, build artifacts

3. **Determine Review Scope**:
   - **Single file**: Review that specific file
   - **Directory**: Recursively review all relevant source files
   - Auto-detect language by file extension:
     - Python: `.py`
     - TypeScript: `.ts`, `.tsx`
     - Exclude: `.test.ts`, `.test.tsx`, `.spec.ts`, `__tests__`, `test_*.py`

### Phase 2: Review Number Assignment

1. **Check Existing Reviews**:
   ```bash
   ls -la specs/reviews/ 2>/dev/null | grep -E "deep-code-review" || echo "No existing reviews"
   ```

2. **Determine Next Number**:
   - Find all directories matching `specs/reviews/*-deep-code-review/`
   - Extract numbers from directory names
   - Use max + 1, or start from 1 if none exist

3. **Create Review Directory**:
   ```bash
   mkdir -p specs/reviews/{number}-deep-code-review
   ```

### Phase 3: Comprehensive Code Review

Execute multi-dimensional analysis following this structure for each file in scope:

#### Dimension 1: Architecture & Design

**Evaluation Criteria**:

**Python-Specific**:
- Layer separation (API/Service/Data/Domain)
- Package structure and modularity
- Dependency injection patterns
- Abstract base classes and protocols
- Plugin/extension mechanisms

**TypeScript-Specific**:
- Component hierarchy and composition
- State management architecture
- Module boundaries and exports
- Context/Provider patterns
- Hook composition patterns

**General**:
- Interface clarity and cohesion
- Coupling levels between modules
- Separation of concerns
- Design pattern appropriateness
- Extensibility considerations

**Scoring**: Low/Medium/High/Very High complexity

**Output**:
- Architecture diagram (Mermaid)
- Dependency graph
- Pattern analysis
- Coupling assessment

#### Dimension 2: KISS Principle (Keep It Simple, Stupid)

**Evaluation Criteria**:
- Logic clarity and straightforwardness
- Unnecessary complexity detection
- Single responsibility per function/method
- Nesting depth (should not exceed 4 levels)
- Clever code vs. readable code
- Premature optimization detection

**Metrics**:
- Maximum nesting depth
- Cyclomatic complexity (if calculable)
- Cognitive complexity estimate

**Output**:
- Complexity hotspots
- Over-engineered sections
- Simplification recommendations

#### Dimension 3: Code Quality

**DRY (Don't Repeat Yourself)**:
- Duplicate code block detection
- Similar logic patterns
- Extraction opportunities (functions, classes, modules)
- Copy-paste code identification

**YAGNI (You Aren't Gonna Need It)**:
- Unused code, functions, parameters
- Dead code detection
- Commented-out code
- "Future-proofing" abstractions
- Unnecessary flexibility

**SOLID Principles**:
- **S**ingle Responsibility: Classes/functions doing one thing
- **O**pen/Closed: Easy to extend, not modify
- **L**iskov Substitution: Proper inheritance
- **I**nterface Segregation: Not bloated interfaces
- **D**ependency Inversion: Depend on abstractions

**Function Size Analysis**:
- Count lines per function/method
- Flag functions > 150 lines
- Identify functions > 300 lines (critical)
- Provide breakdown by file

**Parameter Count Analysis**:
- Count parameters per function
- Flag functions > 7 parameters
- Flag functions > 10 parameters (critical)
- Suggest parameter objects/data classes

**Output**:
- Violation counts by category
- Specific locations and line numbers
- Refactoring suggestions with examples

#### Dimension 4: Code Style

**Python (PEP 8)**:
- Naming conventions:
  - `snake_case` for functions/variables
  - `PascalCase` for classes
  - `UPPER_CASE` for constants
  - `_leading_underscore` for protected
- Import ordering (stdlib, third-party, local)
- Indentation consistency (4 spaces)
- Line length (prefer ≤ 100, max 120)
- Docstring completeness (Google/NumPy style)
- Type hints usage
- Whitespace usage
- Trailing whitespace

**TypeScript**:
- Naming conventions:
  - `camelCase` for variables/functions
  - `PascalCase` for classes/interfaces/types
  - `UPPER_CASE` for constants
  - `kebab-case` for files
- Type usage:
  - Avoid `any` (prefer `unknown`)
  - Interface vs type usage
  - Union types and intersections
  - Type guards and assertions
- Async/await patterns
- JSX/TSX conventions
- Import/export patterns
- Null/undefined handling

**Code Readability**:
- Semantic naming
- Magic numbers/strings elimination
- Helpful comments (why, not what)
- Consistent formatting
- Code organization

**Output**:
- Style violations by category
- Naming convention issues
- Formatting inconsistencies

#### Dimension 5: Error Handling

**Python**:
- Exception handling specificity
- Avoid bare `except:` blocks
- Custom exception hierarchy
- Context manager usage (`with` statements)
- Resource cleanup (finally blocks)
- Exception propagation
- Error message quality
- Logging vs raising

**TypeScript**:
- try/catch specificity
- Error type checking
- Promise rejection handling
- Async error propagation
- Null/undefined checks
- Optional chaining usage
- Error boundaries (React)
- Error type definitions

**Resource Management**:
- File handle cleanup
- Connection closure
- Memory leak detection
- Context manager usage
- Dispose pattern implementation

**Output**:
- Missing error handlers
- Overly broad catches
- Resource leak risks
- Error handling improvements

#### Dimension 6: Performance Optimization

**Algorithmic Complexity**:
- Identify O(n²) or worse algorithms
- Suggest better alternatives
- Nested loop analysis
- Recursive call depth

**Database/Network I/O**:
- N+1 query patterns
- Batch operation opportunities
- Connection pooling
- Caching strategies
- Lazy loading issues
- Pagination for large datasets

**Memory Usage**:
- Large data structure handling
- Memory leak risks
- Unnecessary copies
- Generator/iterator usage (Python)
- Stream processing (TypeScript)

**Concurrency/Async**:
- Proper async/await usage
- Race condition detection
- Deadlock risks
- Lock/ mutex usage
- Coroutine patterns

**Python-Specific**:
- List comprehensions vs loops
- Generator expressions
- Global interpreter lock (GIL) awareness
- Context variables usage
- LRU caching

**TypeScript/React-Specific**:
- Unnecessary re-renders
- Memoization opportunities (useMemo, useCallback)
- React.memo usage
- Bundle size considerations
- Code splitting
- Virtual scrolling for large lists
- Event listener cleanup

**Output**:
- Performance bottlenecks
- Optimization suggestions
- Complexity analysis
- Before/after comparisons

#### Dimension 7: Design Patterns

**Pattern Analysis**:

**Creational Patterns**:
- Factory/Builder usage appropriateness
- Singleton detection (and whether appropriate)
- Prototype pattern usage

**Structural Patterns**:
- Adapter/Facade usage
- Decorator pattern (Python decorators)
- Composite pattern
- Proxy pattern

**Behavioral Patterns**:
- Strategy pattern
- Observer pattern (event emitters, React hooks)
- Command pattern
- Chain of responsibility
- Template method

**React-Specific Patterns**:
- Custom hooks
- Higher-order components
- Render props
- Compound components
- Context/Provider patterns

**Output**:
- Pattern usage assessment
- Missing pattern opportunities
- Anti-pattern detection
- Pattern improvement suggestions

#### Dimension 8: Security Considerations

**Common Vulnerabilities**:
- SQL injection (if database code)
- XSS risks (frontend)
- CSRF protection
- Sensitive data exposure (passwords, API keys)
- Input validation
- Output encoding
- Authentication/authorization issues

**Dependency Security**:
- Known vulnerabilities in dependencies
- Outdated packages

**Data Security**:
- Sensitive data in logs
- Hardcoded credentials
- Insecure storage
- Encryption needs

**Output**:
- Security vulnerabilities
- Severity ratings (Critical/High/Medium/Low)
- Remediation steps

### Phase 4: Issue Classification & Prioritization

For each identified issue, assign:

**Severity Levels**:
- **Critical**: Must fix (security vulnerabilities, data loss risks, severe performance issues)
- **High**: Strongly recommended (design defects, code smells, potential bugs)
- **Medium**: Recommended (code style, maintainability issues)
- **Low**: Optional improvements (minor optimizations, suggestions)

**Impact Scope**:
- Single file
- Module/package
- Global/system-wide

**Fix Difficulty**:
- Simple: < 1 hour
- Medium: 1-4 hours
- Complex: > 4 hours or requires refactoring

**Output Format** for each issue:
```markdown
### [File Path]

**Complexity**: [Rating]
**Lines of Code**: [N]
**Primary Issues**: [List]

#### Findings

1. **[Severity]** [Issue Title]
   - **Location**: Line [N]
   - **Problem**: [Detailed description]
   - **Recommendation**: [Fix approach]
   - **Example**:
     ```python or typescript
     # Current code
     ...

     # Suggested fix
     ...
     ```
```

### Phase 5: Report Generation

1. **Create Report File**: `specs/reviews/{number}-deep-code-review/{topic}-report.md`

2. **Report Structure**:

```markdown
# Deep Code Review Report

**Review Date**: [Date]
**Target Path**: [Path]
**Languages**: [Python/TypeScript/Mixed]
**Files Reviewed**: [N]
**Total Lines of Code**: [LOC]
**Review Depth**: [quick/standard/deep]

## Executive Summary

[Overall assessment, key findings, critical issues overview]

## Architecture Overview

[Project structure analysis with Mermaid diagrams]

### Architecture Diagram

```mermaid
graph TD
    [Module relationships]
```

### Dependency Graph

```mermaid
graph LR
    [Dependencies and couplings]
```

## Key Findings

### Critical Issues ([N] found)

[List all critical issues with severity ratings]

### High Priority Issues ([N] found)

[List all high priority issues]

### Medium Priority Issues ([N] found)

[Summary of medium priority issues]

### Low Priority Suggestions ([N] found)

[Summary of low priority suggestions]

## Detailed Analysis

### Architecture & Design

[Detailed architectural assessment]

### Code Quality Analysis

[DRY, YAGNI, SOLID, function size, parameter count analysis]

### Code Style

[Style consistency, naming conventions, readability analysis]

### Error Handling

[Exception handling, resource management analysis]

### Performance Optimization

[Performance bottlenecks, optimization suggestions]

### Design Patterns

[Pattern usage assessment]

### Security Considerations

[Security vulnerabilities and risks]

## File-Level Review

### [File Path 1]

[Detailed findings as per Phase 4 format]

### [File Path 2]

[Detailed findings as per Phase 4 format]

...

## Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Total Files | [N] | - |
| Total LOC | [N] | - |
| Avg Function Lines | [N] | [OK/Warning] |
| Functions > 150 lines | [N] | [OK/Warning] |
| Functions > 7 parameters | [N] | [OK/Warning] |
| Code Duplication | [N]% | [OK/Warning] |
| Cyclomatic Complexity (avg) | [N] | [OK/Warning] |
| Test Coverage (if available) | [N]% | [OK/Warning] |

## Priority Fix Roadmap

### Phase 1 (Immediate - Critical)
[List with estimated fix time]

### Phase 2 (Urgent - High)
[List with estimated fix time]

### Phase 3 (Planned - Medium)
[List with estimated fix time]

### Phase 4 (Continuous - Low)
[List with estimated fix time]

## Best Practice Recommendations

[Project-specific improvement suggestions]

## Tool Recommendations

[Automated tools: linters, formatters, static analysis]

## Conclusion

[Summary and next steps]
```

3. **Quality Check**:
   - All issues have specific locations
   - All issues have clear recommendations
   - Code examples are accurate
   - Severity assignments are justified
   - Mermaid diagrams are valid

### Phase 6: Output & Next Steps

Report completion with:
- Review directory path
- Report file path
- Issue statistics summary
- Top 3 most critical issues
- Suggested next actions

## General Guidelines

### Review Principles

- **Objectivity**: Base findings on facts and established best practices, not personal preferences
- **Constructiveness**: Provide actionable improvements, not just point out problems
- **Context Awareness**: Consider project size, team, business context
- **Priority Clarity**: Help developers focus on most important issues
- **Language Expertise**: Deep understanding of Python and TypeScript idioms

### Python-Specific Review Points

- Use type hints (Type Annotations)
- Follow PEP 8, PEP 257 (docstrings)
- Prefer dataclasses or Pydantic models
- Use async/await correctly
- Avoid global state
- Use context managers for resources
- Consider `__slots__` for memory optimization
- Use protocols for duck typing
- Leverage decorators appropriately
- Use `dataclasses.field()` for configuration

### TypeScript-Specific Review Points

- Avoid `any`, prefer `unknown`
- Enable strict mode
- Use union/intersection types correctly
- Avoid type assertions, use type guards
- React: proper hooks usage
- Correct dependency arrays
- Avoid unnecessary any and type assertions
- Use enum vs const assertions appropriately
- Handle null/undefined (optional chaining, nullish coalescing)
- Proper async/await error handling

### Universal Review Points

- Single responsibility per function
- Semantic naming
- Avoid deep nesting
- Early returns (guard clauses)
- Comments explain "why" not "what"
- Testability consideration
- Correct dependency direction

### Severity Guidelines

**Critical**:
- Security vulnerabilities (injection, XSS, sensitive data exposure)
- Data loss or corruption risks
- Severe performance issues (system unusability)
- Resource leaks (memory, connections, file handles)

**High**:
- Design defects causing maintainability issues
- SOLID violations causing tight coupling
- Code smells (god classes, long methods)
- Potential runtime errors
- Clear performance issues

**Medium**:
- Code style inconsistencies
- Unclear naming
- Missing documentation
- Readability issues
- Minor code duplication

**Low**:
- Minor optimization opportunities
- Suggestive improvements
- Non-critical best practice suggestions

### Tool Integration Recommendations

**Python**:
- `mypy` - Static type checking
- `ruff` - Fast linter and formatter
- `pylint` - Code quality
- `bandit` - Security vulnerability scanning
- `pytest` + `pytest-cov` - Test coverage
- `vulture` - Dead code detection
- `radon` - Code complexity metrics

**TypeScript**:
- `ESLint` - Linting
- `Prettier` - Formatting
- `tsc` - Type checking (strict mode)
- `SonarJS` - Code quality
- `Jest` + `vitest` - Test coverage
- `@typescript-eslint/eslint-plugin` - TypeScript-specific rules

### Handling Special Cases

- **Legacy code**: More lenient, focus on Critical/High issues
- **Quick prototypes**: Focus on critical issues only
- **Critical systems**: Stricter, all High issues should be addressed
- **Learning projects**: Educational focus, explain each issue

### Output Format Requirements

- Use Markdown format
- Code blocks with correct language syntax (` ```python ` or ` ```typescript `)
- Tables for metrics and comparisons
- Lists for issue enumeration
- Clear heading hierarchy (max 4 levels)
- Mermaid diagrams for architecture visualization
- Use emoji sparingly for readability enhancement

### Example Review Output Snippet

```markdown
### src/services/user_service.py

**Complexity**: Medium-High
**Lines of Code**: 245
**Primary Issues**: Long function, missing type hints, unclear responsibilities

#### Findings

1. **[High]** Function too long with mixed responsibilities
   - **Location**: Lines 45-189
   - **Problem**: `process_user_data()` function has 145 lines and handles validation, transformation, database operations, and notifications
   - **Recommendation**: Split into independent functions: `validate_user_data()`, `transform_user_data()`, `save_user_data()`, `send_notification()`
   - **Example**:
     ```python
     # Current code (simplified)
     def process_user_data(raw_data):
         # 145 lines of mixed logic...
         pass

     # Suggested refactoring
     def process_user_data(raw_data: dict) -> User:
         validated = validate_user_data(raw_data)
         transformed = transform_user_data(validated)
         user = save_user_data(transformed)
         send_notification(user)
         return user
     ```

2. **[Medium]** Missing type hints
   - **Location**: Throughout file
   - **Problem**: Function parameters and return values lack type annotations
   - **Recommendation**: Add comprehensive type hints
   - **Example**:
     ```python
     # Current
     def get_user(user_id):
         ...

     # Suggested
     def get_user(user_id: int) -> Optional[User]:
         ...
     ```

3. **[Critical]** SQL injection vulnerability
   - **Location**: Line 89
   - **Problem**: Direct SQL string concatenation
   - **Recommendation**: Use parameterized queries
   - **Example**:
     ```python
     # Current (dangerous)
     query = f"SELECT * FROM users WHERE name = '{user_name}'"

     # Suggested (safe)
     query = "SELECT * FROM users WHERE name = ?"
     cursor.execute(query, (user_name,))
     ```
```

## Execution Notes

- Ensure code can be parsed (syntax check) before reviewing
- For large projects, may need to focus on critical modules first
- Prioritize business logic core over utility code
- Consider using automated tools as pre-filter
- Maintain communication with user to confirm review focus
- Be respectful of existing codebase and team conventions
- Provide context for issues (why it's a problem, not just that it is)
