# Digital Keys to Soil Taxonomy

Interactive, offline-first web app for USDA soil classification following the Keys to Soil Taxonomy (2022 Edition).

## Quick Start

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Works offline after first load. No build tools required.

## Features

- Navigate USDA soil taxonomy: Order → Suborder → Great Group → Subgroup
- 4,127 decision criteria with AND/OR satisfaction logic
- 136 glossary terms with hover definitions
- Works completely offline after initial load
- No external dependencies beyond Alpine.js (CDN)

## Project Structure

```
index.html                 Single-file app (HTML + CSS + JS)
sw.js                      Service Worker (offline support)
manifest.json              PWA manifest
test.html                  Browser test runner
scripts/
  app_helpers.js            State management helpers
  tests.js                  Test suite
  build_tree.py             Data pipeline (6 steps)
  apply_phase1-3.py
  populate_code_names.py
  validate_schema.py
data/
  keys_optimized.json       Generated taxonomy data (3.3 MB)
docs/                       Developer documentation
```

## Testing

```bash
node scripts/tests.js                 # Run test suite via Node.js
python3 -m http.server 8000           # Or open test.html in browser
```

## Documentation

| Guide | Purpose |
|-------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design overview |
| [docs/NAVIGATION_LOGIC.md](docs/NAVIGATION_LOGIC.md) | Satisfaction algorithm |
| [docs/DATA_FORMAT.md](docs/DATA_FORMAT.md) | JSON schema reference |
| [docs/FUNCTION_REFERENCE.md](docs/FUNCTION_REFERENCE.md) | Function API docs |
| [docs/MAINTENANCE.md](docs/MAINTENANCE.md) | Data refresh & troubleshooting |
| [docs/PUBLICATION_GUIDE.md](docs/PUBLICATION_GUIDE.md) | Release & Zenodo workflow |

## License

- **Code**: MIT (see [LICENSE](LICENSE))
- **Data**: USDA Keys to Soil Taxonomy, freely available for educational use

## Version

3.2.0 — February 2026
