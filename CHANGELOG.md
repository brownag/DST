# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning: [Semantic Versioning](https://semver.org/).

## [3.2.0] - 2026-02-20

### Added
- **Dark mode**: Three-state toggle (auto/light/dark) with CSS custom properties and FOUC prevention
- **About tab**: In-app developer documentation with data schema, engine API, and live statistics
- **DSTCore engine** (`scripts/dst-core.js`): Standalone pure logic engine (no DOM, dual export for browser + Node.js)
- **Test suite**: Test suite in `scripts/tests.js` covering satisfaction logic, hierarchy, navigation, edge cases, and classification helpers
- **Browser test runner**: `test.html` with visual output and auto-run
- **Python pipeline**: 6-step preprocessing from USDA source JSON (`build_tree.py` → `validate_schema.py`)
- **Classification helpers**: `getClassificationPath()`, `getCurrentClassification()`, `getClassificationBreadcrumb()`
- **Documentation**: `docs/` — architecture, data format, function reference, maintenance, navigation logic, publication guide

### Changed
- Modularized architecture: `index.html` is now a thin Alpine.js shell (~290 lines) delegating all logic to `DSTCore`
- All CSS extracted to `style.css` with 22 custom properties per theme
- Logic normalization: FIRST → OR, END → inherited from siblings, undefined → inferred from children
- Only OR and AND logic values in generated data (FIRST/END/INFER resolved at build time)
- Merged sub-clause splitting in `build_tree.py` for source clauses with embedded sub-clauses
- Stripped redundant "and"/"or" text prefixes from 118 criteria
- Three-tier criterion rendering: structural headers, inline parents, and leaf checkboxes
- Service Worker uses relative URL resolution for any deploy path

### Removed
- `scripts/app_helpers.js` — logic consolidated into `DSTCore` engine
- Inline CSS — moved to `style.css`

## [3.1.0] - 2026-02-01

### Added
- Interactive soil taxonomy decision tree
- Offline-first PWA with Service Worker
- Alpine.js frontend (no build tools)
- Glossary term highlighting and tooltips
- 4,100+ navigation criteria, 3,000+ outcomes, 136 glossary terms
