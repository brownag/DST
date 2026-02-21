# Contributing to Digital Keys to Soil Taxonomy

Thank you for your interest in contributing to this scientific software project! This document provides guidelines for contributions.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please treat all community members with respect and professionalism.

## How to Contribute

### Reporting Issues

Found a bug? Have a feature request? Please open an issue on GitHub.

**Before reporting:**
1. Check if the issue already exists
2. Test on the latest version
3. Collect relevant information:
   - Browser and version
   - Steps to reproduce
   - Expected vs. actual behavior
   - Console errors (open DevTools with F12)

**Issue template:**
```
**Version:** (from README or browser console)
**Browser:** (Chrome, Firefox, Safari, etc.)
**Steps to reproduce:**
1. ...
2. ...

**Expected behavior:**
...

**Actual behavior:**
...

**Error details:**
(Copy from browser console if applicable)
```

### Suggesting Enhancements

Have an idea for improvement? We'd love to hear it!

**Enhancement suggestions should include:**
- Clear description of the enhancement
- Use cases and why it's beneficial
- Possible implementation approaches
- Links to related discussions or issues

### Making Code Changes

#### Step 1: Fork and Clone
```bash
git clone https://github.com/your-fork/digital-keys-soil-taxonomy.git
cd digital-keys-soil-taxonomy
```

#### Step 2: Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
# or for bug fixes:
git checkout -b fix/bug-description
```

#### Step 3: Make Your Changes
- Edit files as needed
- Keep commits focused and atomic (one feature per commit)
- Write clear commit messages following convention:
  ```
  [Component] Brief description
  
  Longer explanation if needed, including:
  - What changed and why
  - Related issue numbers (#123)
  - Any breaking changes or important notes
  ```

#### Step 4: Test Your Changes

**Node.js and Logic Validation:**
```bash
npm test                          # Run test suite via Node.js (54 tests)
npm run validate                  # Check logic consistency (informational)
```

**Browser Testing:**
```bash
python3 -m http.server 8000
# Open http://localhost:8000 to test the application
# Open http://localhost:8000/test.html to run unit tests
```

Verify:
- Application works as intended
- No errors in browser console (DevTools F12)
- Responsive design works on different screen sizes
- Offline mode works (DevTools Network tab → Offline)

**Code Coverage:**
- All 54 tests pass in both Node.js and browser
- For new functions, add corresponding unit tests to `scripts/tests.js`

#### Step 5: Validate Implementation

**Checklist before submitting PR:**
- [ ] `npm test` passes (Node.js)
- [ ] All tests pass (http://localhost:8000/test.html)
- [ ] No npm dependencies added (maintain no-build philosophy)
- [ ] Code follows existing style and patterns
- [ ] Comments explain complex logic
- [ ] New functions have JSDoc docstrings
- [ ] README.md updated if user-facing changes
- [ ] CHANGELOG.md entry added
- [ ] No console errors when running application

#### Step 6: Submit a Pull Request

**PR Description:**
```markdown
## Description
Brief summary of changes

## Motivation
Why this change is needed (related issue, use case, etc.)

## Changes
- Change 1
- Change 2
- Change 3

## Testing
How to verify the changes work correctly

## Checklist
- [ ] `npm test` passes
- [ ] Tests pass (http://localhost:8000/test.html)
- [ ] Documentation updated
- [ ] No new npm dependencies
- [ ] Code style consistent
```

## Development Guidelines

### Code Style

**JavaScript in index.html:**
- Use modern ES6+ syntax where appropriate
- Keep functions focused and well-documented
- Use meaningful variable names
- Add comments for complex logic

**Example JSDoc:**
```javascript
/**
 * Checks if a criterion is satisfied based on its children and logic type
 * 
 * @param {Object} criterion - The criterion to evaluate
 * @returns {boolean} True if the criterion is satisfied
 * 
 * @example
 * const criterion = { crit: 'A', logic: 'AND', ... };
 * if (this.isCriteriaSatisfied(criterion)) {
 *   console.log('Criterion satisfied');
 * }
 */
```

**Alpine.js Patterns:**
Follow the existing patterns in index.html:
- Use x-data for component state
- Use x-text for content binding
- Use @click for event handling
- Use x-show for conditional visibility

**Python Scripts:**
Follow PEP 8 style guide:
```bash
pip install pylint
pylint scripts/your_script.py
```

### Data Structure Conventions

- Taxonomy codes (USDA Keys format):
  - Single letter: Order (A-L)
  - Two letters: Suborder (AA-LL)
  - Three letters: Great Group (AAA-LLL)
  - Four letters: Subgroup (AAAA-LLLL)
  - Extended: Special cases (IFFZh, etc.)

- JSON structure in data/dst-data.json:
  - `crit`: The code (A, AA, AAA, AAAA, etc.)
  - `clause`: Internal reference ID
  - `parent_clause`: Reference to parent's clause
  - `logic`: `AND` or `OR` (source FIRST/END values are normalized to OR at build time)
  - `content`: Decision criterion text
  - `depth`: Hierarchical level

### Testing Requirements

**For bug fixes:**
- Add test case that reproduces the bug
- Verify fix resolves the issue
- Ensure fix doesn't break other tests

**For new features:**
- Add unit tests to `scripts/tests.js`
- Aim for 80%+ coverage
- Test edge cases and error conditions

**Test Template:**
```javascript
it('Feature: should do X when Y', () => {
  const state = setupTestState();
  // Setup
  state.checkedCriteria[state.getCriterionId(criterion)] = true;
  
  // Execute
  state.isCriteriaSatisfied(criterion);
  
  // Assert
  assertTrue(result, 'Should satisfy when X');
});
```

### Documentation Requirements

- Update [README.md](README.md) for user-facing changes
- Update [CHANGELOG.md](CHANGELOG.md) with entry in Unreleased section
- Add JSDoc comments to new functions
- Update [docs/FUNCTION_REFERENCE.md](docs/FUNCTION_REFERENCE.md) for API changes
- Update [MAINTENANCE.md](docs/MAINTENANCE.md) if affecting maintenance procedures

### Commit Message Rules

Good commit messages help understand history:

```
[Category] Brief description (50 chars max)

Longer explanation explaining the what and why, not how (wrap at 72 chars)

Fixes #123
Relates to #456
```

**Categories:**
- `[Feature]` - New functionality
- `[Fix]` - Bug fix
- `[Refactor]` - Code restructuring without behavior changes
- `[Docs]` - Documentation only
- `[Test]` - Test additions or modifications
- `[Style]` - Formatting, missing semicolons, etc.
- `[Chore]` - Build process, dependencies, etc.

## Architecture & Philosophy

### No-Build Principle
This project explicitly avoids build tools (npm, webpack, etc.) to ensure:
- Long-term maintainability (10+ years)
- No dependency rot
- Easy for scientists to understand and modify
- Zero external runtime dependencies

**Never add:** npm packages, webpack loaders, babel, typescript compiler, etc.

### Progressive Disclosure UI
The interface shows:
1. All root orders initially
2. All children of selected order
3. Progressively deeper levels as parent is satisfied

This matches USDA Keys specification and makes branching decisions clear.

### Offline-First Architecture
Service Worker caches on first visit and updates automatically. All functionality works offline after initial load.

### Performance Targets
- Page load: < 2 seconds
- Navigation update: < 100ms
- Test suite: < 200ms
- Gzipped size: < 1 MB

## Review Process

**What maintainers look for:**
1. Code quality and style consistency
2. Test coverage (80%+ target)
3. Documentation completeness
4. Alignment with project philosophy
5. No breaking changes without discussion

**Timeline:**
- Small fixes: 1-3 days
- Feature PRs: 3-7 days
- Complex changes: May require discussion first

## Helpful Resources

- [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) - System design overview
- [**NAVIGATION_LOGIC.md**](docs/NAVIGATION_LOGIC.md) - Algorithm details
- [**FUNCTION_REFERENCE.md**](docs/FUNCTION_REFERENCE.md) - API documentation
- [**MAINTENANCE.md**](docs/MAINTENANCE.md) - Maintenance guide
- **Testing**: Run `npm test` (Node.js) or open `test.html` in browser. Run `npm run validate` for logic consistency.

## Community

- **Questions?** Open a discussion or issue
- **Want to chat?** Create a GitHub discussion
- **Found a security issue?** Email contact@example.com privately

## Recognition

Contributors are recognized in:
- [CHANGELOG.md](CHANGELOG.md) (per-version contributor list)
- [CITATION.cff](CITATION.cff) (contributor acknowledgments)
- Project README (if major contribution)

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to ask! We want to make contributing easy and enjoyable.

---

**Thank you for helping make Digital Keys to Soil Taxonomy better for the scientific community!**
