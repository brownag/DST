# Maintenance Guide

## Data Refresh

When USDA releases a new Keys to Soil Taxonomy edition (every 3-5 years):

### 1. Acquire Source Files
Download to `assets/`:
- `YYYY_KST_codes.json` — Hierarchy codes
- `YYYY_KST_criteria_EN.json` — Decision criteria
- `YYYY_KST_EN_featurelist.json` — Glossary terms

### 2. Run Pipeline
```bash
python3 scripts/build_tree.py && \
python3 scripts/apply_phase1.py && \
python3 scripts/apply_phase2.py && \
python3 scripts/apply_phase3.py && \
python3 scripts/populate_code_names.py && \
python3 scripts/validate_schema.py
```

### 3. Validate
```bash
python3 -c "
import json
d = json.load(open('data/dst-data.json'))
nav = d['navigation']['criteria']
out = d['outcomes']
gls = d['glossary']
print(f'Navigation: {len(nav)} criteria')
print(f'Outcomes: {len(out)}')
print(f'Glossary: {len(gls)} terms')
print(f'Schema: {d[\"metadata\"][\"schema_version\"]}')
"
```
Expected: 5,706 navigation criteria, 3,073 outcomes, 124 glossary terms.

### 4. Test and Deploy
```bash
python3 -m http.server 8000   # Test locally
# Spot-check 3-5 navigation paths: Order → Suborder → Great Group → Subgroup
# Verify glossary tooltips appear on hover
# Test offline mode (DevTools → Network → Offline → reload)
git add data/dst-data.json
git commit -m "Update USDA Keys data to YYYY edition"
git push
```

## Troubleshooting

### Navigation doesn't respond to clicks
**Cause**: Broken `parent_clause` references after data update.
```python
import json
d = json.load(open('data/dst-data.json'))
clauses = {c['clause'] for c in d['navigation']['criteria']}
for c in d['navigation']['criteria']:
    if c['parent_clause'] and c['parent_clause'] not in clauses:
        print(f"[!] Broken parent: {c['clause_id']} → {c['parent_clause']}")
```

### Glossary terms not highlighting
**Cause**: Glossary term IDs don't match `content_html` links from `apply_phase3.py`.
```python
import json
d = json.load(open('data/dst-data.json'))
for tid, entry in list(d['glossary'].items())[:5]:
    print(f"ID: {tid}, Term: {entry['term']}")
```

### Stale offline cache
**Fix**: Bump `CACHE_VERSION` in [sw.js](../sw.js), then hard reload (Shift+F5).
```javascript
const CACHE_VERSION = 'v10-2026-03';  // Increment the version number
```

### File size unexpectedly large
```python
import json
d = json.load(open('data/dst-data.json'))
ids = [c['clause_id'] for c in d['navigation']['criteria']]
dups = [i for i in set(ids) if ids.count(i) > 1]
if dups:
    print(f"[!] Duplicate IDs: {dups[:5]}")
```

## Key Documents

| Task | Document |
|------|----------|
| System overview | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Satisfaction algorithm | [NAVIGATION_LOGIC.md](NAVIGATION_LOGIC.md) |
| JSON schema | [DATA_FORMAT.md](DATA_FORMAT.md) |
| Function API | [FUNCTION_REFERENCE.md](FUNCTION_REFERENCE.md) |
| Release process | [PUBLICATION_GUIDE.md](PUBLICATION_GUIDE.md) |
