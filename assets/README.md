# Assets Directory: USDA Source Data

This directory should contain the USDA Keys to Soil Taxonomy source files required by the data preprocessing pipeline.

## Required Files

The following files are needed to run `scripts/build_tree.py`:

### 1. `2022_KST_codes.json`
**Source**: USDA Keys to Soil Taxonomy (2022 Edition)

**Purpose**: Provides the official taxonomic names for all classification codes

**Expected Structure**:
```json
[
  {
    "code": "A",
    "name": "Entisols"
  },
  {
    "code": "AA",
    "name": "Aquents"
  },
  {
    "code": "AAA",
    "name": "Orthents"
  }
  // ... more codes
]
```

**Notes**:
- One entry per taxonomic code
- Single-letter codes = Orders (A-L)
- Double-letter codes = Suborders (AA-LL)
- Triple-letter codes = Great Groups (AAA-LLL)
- Quad+ letter codes = Subgroups

---

### 2. `2022_KST_criteria_EN.json`
**Source**: USDA Keys to Soil Taxonomy (2022 Edition)

**Purpose**: Provides all decision criteria and logic rules for the classification key

**Expected Structure**:
```json
[
  {
    "clause_id": "1",
    "crit": "A",
    "clause": 1,
    "parent_clause": "",
    "content": "A. Soils that ... some condition",
    "logic": "OR",
    "key": "Key to Soil Orders",
    "depth_level": 0
  },
  {
    "clause_id": "2",
    "crit": "AA",
    "clause": 2,
    "parent_clause": "1",
    "content": "AA. Soils that have ...",
    "logic": "AND",
    "key": "Key to Suborders",
    "depth_level": 1
  }
  // ... more criteria
]
```

**Schema Details**:

| Field | Type | Description |
|-------|------|-------------|
| `clause_id` | String | Unique numeric identifier |
| `crit` | String | Hierarchical code (A, AA, AAA, etc.) |
| `clause` | Integer | Numeric reference ID |
| `parent_clause` | String | References parent's `clause_id` |
| `content` | String | Decision criterion text |
| `logic` | String | One of: `AND`, `OR`, `FIRST`, `END` |
| `key` | String | Taxonomic level (e.g., "Key to Soil Orders") |
| `depth_level` | Integer | Hierarchical depth (0-4 for nav, -1 for outcomes) |

**Logic Types**:
- `AND`: ALL children must be satisfied
- `OR`: AT LEAST ONE child must be satisfied  
- `FIRST`: FIRST applicable child satisfies
- `END`: Terminal outcome node (depth -1)

---

### 3. `2014_KST_EN_featurelist.json`
**Source**: USDA Keys to Soil Taxonomy (Feature List, 2014 Edition - most recent)

**Purpose**: Provides glossary definitions for soil science terms used in criteria

**Expected Structure**:
```json
[
  {
    "name": "Andic soil properties",
    "description": "Soil properties characteristic of volcanic ash, including..."
  },
  {
    "name": "Argillic horizon",
    "description": "A subsurface horizon with evidence of clay accumulation..."
  },
  {
    "name": "Fragipan",
    "description": "A dense, brittle subsurface horizon low in organic matter..."
  }
  // ... more terms
]
```

**Schema Details**:

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Soil science term (e.g., "Argillic horizon") |
| `description` | String | Definition of the term |

**Processing**: Terms are converted to lowercase IDs:
- `"Argillic Horizon"` → ID: `argillic_horizon`
- Commas and hyphens removed, spaces → underscores
- Truncated to 50 characters to prevent excessively long IDs

---

## Where to Get These Files

### Official USDA Source

The official USDA Keys to Soil Taxonomy is available from:
- **Main Site**: https://www.nrcs.usda.gov/soil/
- **Technical Document**: https://www.nrcs.usda.gov/resources/guides-and-instructions/keys-to-soil-taxonomy

The 2022 edition may be available in JSON format from:
1. USDA NRCS official repositories
2. https://github.com/NRCS-USDA repositories
3. Zenodo or other scientific data repositories

### Legacy Data (2014 Edition)

The 2014 feature list is available from:
- USDA NRCS official archives
- Previous versions on GitHub

### If Files Are Proprietary

If these files are licensed or proprietary:
1. Add to `.gitignore` to prevent accidental posting
2. Document in team wiki where to obtain them
3. Create sample files with 5-10 entries for testing

---

## Using This Data

### To Regenerate the Database

```bash
# 1. Place JSON files in assets/ (this directory)
cp /path/to/2022_KST_codes.json assets/
cp /path/to/2022_KST_criteria_EN.json assets/
cp /path/to/2014_KST_EN_featurelist.json assets/

# 2. Run the preprocessing script
python3 scripts/build_tree.py

# 3. Result: data/keys_optimized.json is regenerated
# 4. Reload the app in browser to use new data
```

### Validation

To validate your asset files before running the script:

```bash
# Check if files are valid JSON
python3 -c "import json; json.load(open('assets/2022_KST_codes.json'))" && echo "codes.json valid"
python3 -c "import json; json.load(open('assets/2022_KST_criteria_EN.json'))" && echo "criteria.json valid"
python3 -c "import json; json.load(open('assets/2014_KST_EN_featurelist.json'))" && echo "featurelist.json valid"
```

---

## Building Custom Datasets

To adapt this for other taxonomic systems:

1. **Create equivalent JSON files** following the schema above
2. **Adjust** `scripts/build_tree.py` if your field names differ
3. **Test** with `python3 scripts/build_tree.py --validate`
4. **Deploy** the generated `data/keys_optimized.json`

---

## Updating the Data

When new USDA classifications are released:

1. Obtain updated source files
2. Copy to assets/
3. Run `scripts/build_tree.py`
4. Review `data/keys_optimized.json` for changes
5. Test in browser / offline mode
6. Deploy when validated

---

## Questions & Support

- **Schema questions**: See `scripts/build_tree.py` for processing logic
- **Data questions**: Refer to USDA NRCS documentation
- **Implementation help**: See `/home/andrew/workspace/DST/docs/ARCHITECTURE.md`

---

**Note**: This directory is in `.gitignore` to prevent accidental inclusion of potentially large or licensed files. Keep source files locally and regenerate `data/keys_optimized.json` as needed.
