# Function Reference — DSTCore Engine

All logic lives in `scripts/dst-core.js`. The Alpine.js UI in `index.html` delegates to `engine.*` methods.

## Factory

### `DSTCore.create(data) → engine`
Creates a new engine instance from parsed `dst-data.json`. Builds all indices, sets up state, returns the engine object.

```javascript
// Browser
const engine = DSTCore.create(data);

// Node.js
const DSTCore = require('./scripts/dst-core.js');
const engine = DSTCore.create(data);
```

## Data Lookups

### `engine.getCriterionId(criterion) → string`
Returns unique ID as `"crit_clause"` (e.g., `"AAA_42"`). Used as cache key, DOM id, and `checkedCriteria` key.

### `engine.getCriterionByCode(code) → Object|undefined`
Returns first criterion matching `code` (e.g., `"AAA"`).

### `engine.getDirectChildren(parentCode) → Object[]`
Returns child criteria whose code is `parentCode` + one letter (e.g., `"AA"` → AAA, AAB, ...).

### `engine.getParent(code) → Object|null`
Returns parent criterion by trimming last character of code.

## Satisfaction Logic

### `engine.isLeafCriterion(criterion) → boolean` *(cached)*
Returns `true` if criterion has no children in `clauseChildrenMap`. Cached in `_leafCache`.

### `engine.isClauseSatisfied(criterion) → boolean` *(cached)*
Recursive. Leaf: returns `checkedCriteria[id]`. Parent: returns `evaluateSiblingLogic(children, logic)`. Results cached in `_satCache`, invalidated on any state mutation.

### `engine.evaluateSiblingLogic(siblings, parentLogic) → boolean`
Applies the parent's logic to its children. Three cases:
- **Uniform AND**: all siblings must satisfy (`every`)
- **Uniform OR**: at least one sibling must satisfy (`some`)
- **Mixed logic**: groups consecutive same-logic siblings into runs; evaluates each run by its own logic, then combines run results using the parent logic

### `engine.isGroupSatisfied(critCode) → boolean` *(cached)*
Checks if the root criterion for a code group is satisfied. Results cached in `_groupSatCache`.

### `engine.getClauseChildren(criterion) → Object[]`
Returns children from `clauseChildrenMap[criterionId]`.

## Navigation

### `engine.findCurrentLevel() → string|null`
Scans all group roots, returns the longest code where `isGroupSatisfied()` is true.

### `engine.getVisibleGroups() → Object[]`
Returns groups for progressive disclosure: all Orders if nothing satisfied, otherwise ancestors + next-level options.

### `engine.getCheckedLeaves() → Object[]`
Returns checked leaf criteria sorted by code then clause.

## State Mutations

All mutations auto-invalidate caches and notify listeners.

### `engine.check(id)`
Sets `checkedCriteria[id] = true`.

### `engine.uncheck(id)`
Deletes `checkedCriteria[id]`.

### `engine.toggle(id)`
Toggles check state.

### `engine.reset()`
Clears all checked criteria.

### `engine.onChange(fn) → unsubscribe`
Registers a state change listener. Returns a function that removes the listener.

## Classification Helpers

### `engine.getClassificationPath() → Object[]`
Returns the current taxonomy path as an array of `{ code, name, levelName, satisfied }` objects. Includes a pending placeholder for the next unsatisfied level.

### `engine.getCurrentClassification() → string`
Returns the name of the deepest satisfied taxon (e.g., `"Histels"`), or empty string.

### `engine.getClassificationLevel() → string`
Returns the level name of the current classification (e.g., `"Suborder"`), or empty string.

### `engine.getClassificationBreadcrumb() → string`
Returns a breadcrumb string (e.g., `"Gelisols › Histels"`).

### `engine.removeCodePrefix(content, code) → string`
Strips leading code prefix (e.g., `"A. Soils..."` → `"Soils..."`).

## Index Building

### `engine.buildIndices()`
Called once during `create()`. Builds:
- `criteriaByCode` — code → criteria array
- `clauseChildrenMap` — parentId → children array (clause-level)
- `groupRoots` — code → root criterion (with synthetic roots for rootless groups)
- `indices.children_by_parent` — code → child codes (nearest-ancestor logic)
- `groupedCriteria` — sorted groups with labels for display

## State Properties

| Property | Type | Description |
|----------|------|-------------|
| `allCriteria` | Object[] | All criteria after outcome injection |
| `checkedCriteria` | {id: bool} | User checkbox selections |
| `criteriaByCode` | {code: Object[]} | Code → criteria lookup |
| `clauseChildrenMap` | {parentId: Object[]} | Parent → children map |
| `groupRoots` | {code: Object} | Root criterion per code group |
| `groupedCriteria` | Object[] | Sorted groups with labels |
| `outcomes` | {code: Object} | Classification results |
| `glossary` | {id: Object} | Glossary terms |
| `orderNames` | {code: string} | Order letter → name |
| `codeNames` | {code: string} | Any code → taxon name |
| `_satCache` | {id: bool} | Clause satisfaction cache |
| `_groupSatCache` | {code: bool} | Group satisfaction cache |
| `_leafCache` | {id: bool} | Leaf status cache |
