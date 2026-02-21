# Data Format Reference

## Pipeline
```
assets/*.json → build_tree.py → apply_phase1.py → apply_phase2.py → apply_phase3.py
             → populate_code_names.py → validate_schema.py → data/dst-data.json
```

## Input: USDA Source Files

Three JSON files in `assets/`:

### 2022_KST_codes.json — Taxonomy hierarchy
```json
[
  { "Code": "Gelisols", "Code1": "A", "Level": "Order" },
  { "Code": "Histels", "Code1": "AA", "Parent": "Gelisols", "Level": "Suborder" }
]
```

### 2022_KST_criteria_EN.json — Decision criteria
```json
[
  {
    "id": "A", "clause": 1, "parent_clause": 0, "crit": "A",
    "content": "A. Soils that have:", "logic": "FIRST",
    "Key": "Key to Soil Orders"
  }
]
```

### 2014_KST_EN_featurelist.json — Glossary
```json
[
  { "id": "aquic_conditions", "term": "aquic conditions", "definition": "..." }
]
```

## Output: dst-data.json (v1.0.0)

### Top-level structure
```json
{
  "version": "1.0.0",
  "generated": "2026-02-16",
  "source": "USDA Keys to Soil Taxonomy (2022)",
  "description": "Hierarchical soil taxonomy criteria and classification outcomes",
  "metadata": { "schema_version": "1.0.0", "statistics": { ... } },
  "navigation": { "criteria": [ ... ] },
  "outcomes": { ... },
  "glossary": { ... },
  "order_names": { ... },
  "code_names": { ... }
}
```

### navigation.criteria (5,706 records)
```json
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
```

| Field | Description |
|-------|-------------|
| `clause_id` | Unique identifier |
| `crit` | Hierarchical code: A-L (Orders), AA-LL (Suborders), AAA+ (deeper) |
| `clause` | Numeric ID for parent-child linking |
| `parent_clause` | Parent's `clause` value (empty string for roots) |
| `content` | Raw criterion text |
| `content_html` | Text with glossary terms pre-linkified as `<a>` tags |
| `logic` | `AND` or `OR` (source values FIRST/END are normalized to OR at build time) |
| `depth` | 0=Order, 1=Suborder, 2=Great Group, 3=Subgroup, -1=Outcome |

### outcomes (3,073 records, keyed by code)
```json
{ "C": { "clause_id": "...", "crit": "C", "clause": 11, ... "depth": -1 } }
```
Same fields as criteria, always `depth: -1`. Display-only, not used for navigation decisions.

### glossary (124 terms, keyed by term_id)
```json
{ "aquic_conditions": { "term": "aquic conditions", "definition": "..." } }
```

### order_names (12 entries)
```json
{ "A": "Gelisols", "B": "Histosols", ... "L": "Entisols" }
```

### code_names (3,153 entries)
Maps hierarchical codes to taxon names at all levels.
```json
{ "A": "Gelisols", "AA": "Histels", "AAA": "Folistels", ... }
```

## Logic Field Reference

The `logic` field on **children** determines how they contribute to parent satisfaction:

| Value | Role | Rule |
|-------|------|------|
| AND | Mandatory | ALL children with AND must be satisfied |
| OR | Alternative | At least ONE non-AND child must be satisfied |

Parent is satisfied when: all mandatory (AND) children OK **and** at least one alternative (non-AND) child OK.

**Note**: The USDA source uses `FIRST` and `END` logic values. The build pipeline normalizes these to `OR` before writing `dst-data.json`. Only `AND` and `OR` appear in the processed data.
