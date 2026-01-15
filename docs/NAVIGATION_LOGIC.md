# Navigation Logic

## Satisfaction Algorithm

A criterion is **satisfied** when:
- **Leaf** (no children): user checked it
- **Parent** (has children): its children satisfy the partition rules below

### Child Logic Partitioning

Children are partitioned by their individual `logic` field:

| Partition | Child logic values | Rule |
|-----------|-------------------|------|
| Mandatory | `AND` | ALL must be satisfied |
| Alternatives | `FIRST`, `OR`, `END` | At least ONE must be satisfied |

Parent is satisfied when: **all mandatory OK** and **at least one alternative OK**.

If a parent has no mandatory children, only the alternative rule applies (and vice versa).

### Pseudocode

```python
def is_clause_satisfied(criterion):
    if criterion in cache:
        return cache[criterion]

    if is_leaf(criterion):
        result = criterion in checked_criteria
    else:
        children = get_children(criterion)
        result = len(children) > 0 and evaluate_sibling_logic(children)

    cache[criterion] = result
    return result

def evaluate_sibling_logic(siblings):
    mandatory    = [s for s in siblings if s.logic == 'AND']
    alternatives = [s for s in siblings if s.logic != 'AND']

    mandatory_ok    = all(is_clause_satisfied(s) for s in mandatory)
    alternatives_ok = len(alternatives) == 0 or \
                      any(is_clause_satisfied(s) for s in alternatives)

    return mandatory_ok and alternatives_ok
```

## Progressive Disclosure

The UI shows satisfied ancestors plus options for the next level down.

```
find_current_level():
    Walk depth 0 → 3, find deepest level with a satisfied group

update_visible_groups():
    Show groups at current_level (satisfied) + current_level + 1 (options)
    Filter by code prefix to only show relevant branches
```

### Example Flow

1. **Initial**: Show 12 Orders (A-L), each with child criteria
2. **Order A satisfied**: Show A's suborders (AA, AB, AC...)
3. **Suborder AA satisfied**: Show AA's great groups (AAA, AAB...)
4. **Great Group AAA satisfied**: Show AAA's subgroups
5. **Subgroup selected**: Display final classification (outcome)

## Caching

Three caches, all invalidated on any checkbox change:
- `_satCache`: criterion satisfaction results
- `_groupSatCache`: group-level satisfaction
- `_leafCache`: whether a criterion is a leaf node

Cache invalidation is total (clear all) rather than selective — user interactions are infrequent enough that full recalculation is fast.

## Edge Cases

- **Orphan criteria** (no parent): treated as roots, shown at initial level
- **Outcomes** (depth=-1): display-only classification results, not navigable
- **Unknown logic values**: default to AND (conservative)
- **Mixed AND+OR children**: both partitions must pass independently
