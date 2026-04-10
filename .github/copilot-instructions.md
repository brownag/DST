# Digital Keys to Soil Taxonomy - AI Agent Instructions

## Project Overview
No-build Progressive Web App for USDA soil classification. Alpine.js, offline-first, Python preprocessing. Target maintainer: soil scientist proficient in R/Python, not JS build tooling.

## Core Rules
- **Never** suggest build tools (Webpack, Vite, Rollup, npm scripts)
- All dependencies via CDN (Alpine.js v3.13.3, jsdelivr)
- No framework changes (Vue, React, Svelte)
- Keep code readable for scientists, not software engineers

## Architecture
Modular separation of concerns:
- **`scripts/dst-core.js`** - Standalone logic engine (IIFE + dual export). Single source of truth for satisfaction algorithm, classification helpers, navigation, and state mutations. Works in browser (`window.DSTCore`) and Node.js (`module.exports`).
- **`index.html`** - Thin Alpine.js UI shell. Delegates all pure logic to `DSTCore.create(data)`. Contains only theme management, glossary UI handlers, and Alpine reactivity sync.
- **`style.css`** - All CSS with custom properties for light/dark theming. No inline styles in HTML (except dynamic `:style` bindings).
- **`scripts/tests.js`** - Test suite using `DSTCore.create()` directly (no mock duplication).

## Data Pipeline
```
assets/*.json -> build_tree.py -> apply_phase1.py -> apply_phase2.py -> apply_phase3.py -> populate_code_names.py -> validate_schema.py -> data/dst-data.json
```
Run: `bash scripts/build.sh` (runs all pipeline steps)

## Data Schema
[data/dst-data.json](data/dst-data.json) - structured as:
```json
{
  "version": "1.0.0",
  "generated": "2026-02-16",
  "source": "USDA Keys to Soil Taxonomy (2022)",
  "description": "Hierarchical soil taxonomy criteria and classification outcomes",
  "navigation": {
    "criteria": [
      {
        "clause_id": "A",
        "crit": "A",
        "clause": 1,
        "parent_clause": "",
        "content": "A. Soils that have:",
        "content_html": "A. Soils that have:",
        "logic": "OR",
        "depth": 0
      }
    ]
  },
  "outcomes": { "C": { "clause_id": "...", "crit": "C", ... } },
  "glossary": { "term_id": { "term": "...", "definition": "..." } },
  "order_names": { "A": "Gelisols", ... },
  "code_names": { "A": "Gelisols", "AA": "Histels", ... },
  "metadata": { "schema_version": "1.0.0", ... }
}
```

Key fields on criteria:
- `crit`: Hierarchical code (A-L Orders, AA-LL Suborders, AAA+ deeper levels)
- `clause` / `parent_clause`: Numeric parent-child linking within a group
- `logic`: AND or OR (source FIRST/END values normalized to OR at build time) - describes how this node's **children** relate
- `depth`: 0=Order, 1=Suborder, 2=Great Group, 3=Subgroup, -1=Outcome
- `content_html`: Pre-linkified glossary terms (rendered directly)

Stats: comprehensive set of navigation criteria, outcomes, glossary terms, and code names (generated dynamically).

> For complete field documentation see [docs/DATA_FORMAT.md](../docs/DATA_FORMAT.md).

## Satisfaction Algorithm
The parent's `logic` field determines how its children are evaluated:
- **AND** parent: ALL children must be satisfied
- **OR** parent: at least ONE child must be satisfied
- **Mixed-logic siblings**: consecutive same-logic siblings form runs; each run evaluated by its own logic; runs combined by parent logic. See `evaluateSiblingLogic()`.
- Leaf nodes (no clause-children): satisfied when checked by the user
- A child's own `logic` field describes its own children, not its relationship to siblings

Key functions in [scripts/dst-core.js](scripts/dst-core.js):
- `isClauseSatisfied(criterion)` - recursive with cache (`_satCache`)
- `evaluateSiblingLogic(siblings, parentLogic)` - applies parent's logic to children
- `isGroupSatisfied(critCode)` - cached group-level check (`_groupSatCache`)
- `buildIndices()` - builds `clauseChildrenMap`, `groupRoots`, `children_by_parent`

## Navigation Logic
Progressive disclosure: show satisfied taxa + options for next level down.
- `findCurrentLevel()` - determines deepest satisfied level
- `getVisibleGroups()` - returns groups to display based on current level
- `getClassificationPath()` - returns taxonomy path (Order -> Subgroup)
- `getCurrentClassification()` - returns deepest satisfied taxon name
- `getClassificationBreadcrumb()` - returns "Gelisols > Histels > ..." string

## DSTCore Engine API
```javascript
const engine = DSTCore.create(data);  // data = parsed dst-data.json

// Lookups
engine.getCriterionId(criterion)      // -> 'A_1' (unique ID)
engine.getCriterionByCode(code)       // -> criterion object or undefined
engine.getDirectChildren(parentCode)  // -> [criterion, ...]
engine.getParent(code)                // -> criterion or null

// Satisfaction
engine.isLeafCriterion(criterion)     // -> boolean
engine.isClauseSatisfied(criterion)   // -> boolean (recursive, cached)
engine.isGroupSatisfied(critCode)     // -> boolean (cached)

// Navigation
engine.findCurrentLevel()             // -> code string or null
engine.getVisibleGroups()             // -> [{ code, label, items }, ...]
engine.getCheckedLeaves()             // -> [criterion, ...] (sorted)

// Classification
engine.getClassificationPath()        // -> [{ code, name, levelName, satisfied }, ...]
engine.getCurrentClassification()     // -> 'Histels' or ''
engine.getClassificationLevel()       // -> 'Suborder' or ''
engine.getClassificationBreadcrumb()  // -> 'Gelisols > Histels'
engine.removeCodePrefix(content, code) // -> content without 'AA.' prefix

// State mutations (auto-invalidate caches, notify listeners)
engine.check(id)                      // Check a criterion
engine.uncheck(id)                    // Uncheck a criterion
engine.toggle(id)                     // Toggle check state
engine.reset()                        // Clear all checks
engine.onChange(fn)                    // Register listener, returns unsubscribe fn
```

> For full signatures and behavior see [docs/FUNCTION_REFERENCE.md](../docs/FUNCTION_REFERENCE.md).

## Alpine.js UI (index.html)
The Alpine `app()` function creates a thin shell:
- `engine` property holds the `DSTCore` instance
- All logic methods delegate to `this.engine.*`
- `_syncState()` copies `engine.checkedCriteria` to Alpine reactive state and refreshes `visibleGroups`
- Theme toggle cycles auto -> light -> dark, persists in `localStorage`
- `showSatisfiedCriteria` toggle: hides/shows already-satisfied criteria groups; persists in Alpine state
- FOUC-prevention `<script>` in `<head>` applies dark class before paint

## Dark Mode
- CSS custom properties defined in [style.css](style.css) under `:root` (light) and `:root.dark` (dark)
- System preference auto-follows via JS (`prefers-color-scheme` media query listener)
- Manual toggle persists choice in `localStorage` as `dst-theme` (\u2018light', \u2018dark', or absent for auto)
- `<html>` element gets `class="dark"` when dark mode is active

## File Structure
```
index.html              Thin Alpine.js UI shell (HTML + minimal JS)
style.css               CSS with custom properties (light + dark themes)
sw.js                   Service Worker (cache-first static, network-first data)
manifest.json           PWA manifest
test.html               Test runner (browser)
scripts/
  dst-core.js           Standalone logic engine (browser + Node.js)
  tests.js              Test suite using DSTCore.create()
  build_tree.py         Pipeline step 1: build hierarchical criteria from USDA JSON
  apply_phase1.py       Pipeline step 2: separate navigation from outcomes
  apply_phase2.py       Pipeline step 3: add indices
  apply_phase3.py       Pipeline step 4: pre-linkify glossary terms -> content_html
  populate_code_names.py Pipeline step 5: add taxa names by code
  validate_schema.py    Pipeline step 6: validate output
  validate-logic-consistency.js  Logic consistency validator
  sync-version.js       Syncs version between package.json and manifest.json
data/
  dst-data.json         Generated data file (do not edit manually)
assets/
  *.json                USDA source data files
docs/
  ARCHITECTURE.md       System component overview
  DATA_FORMAT.md        JSON schema reference
  FUNCTION_REFERENCE.md Function signatures and behavior
  MAINTENANCE.md        Data refresh and troubleshooting
  NAVIGATION_LOGIC.md   Satisfaction algorithm specification
  PUBLICATION_GUIDE.md  Release and citation workflow
```

## Development
```bash
make test                    # Run test suite
make validate                # Check logic consistency
make serve                   # Serve locally on http://localhost:8000
```

## Service Worker
- Cache version: `v10-2026-03` - bump when changing static files
- All paths resolved relative to SW location via `new URL('./', self.location)` - works at any deploy path
- Static (cache-first): `index.html`, `manifest.json`, `style.css`, `scripts/dst-core.js`
- Dynamic (network-first): `data/dst-data.json`
- Registered in index.html: `navigator.serviceWorker.register('sw.js')`

## Conventions
- Python: `snake_case.py`, logging with `[OK]`, `[>]`, `[!]` markers
- JS: `camelCase` variables, `kebab-case` HTML attributes
- CSS: Custom properties (`--color-*`) in style.css, soil-themed teal palette

## Anti-Patterns
- npm packages or build dependencies
- Framework changes
- Complex state management libraries
- Duplicating logic that belongs in dst-core.js
- Hardcoded colors in HTML (use CSS custom properties)
- Ignoring the scientist-maintainer persona
