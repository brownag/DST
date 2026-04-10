# Digital Keys to Soil Taxonomy

Interactive, offline-first web app for USDA soil classification following the Keys to Soil Taxonomy (2022 Edition).

## Install

```bash
npm install dst-soil-taxonomy
```

## Usage (Node.js)

```javascript
const DSTCore = require('dst-soil-taxonomy');
const data = require('dst-soil-taxonomy/data/dst-data.json');

const engine = DSTCore.create(data);
engine.check('AAA_5');                             // check criterion AAA, clause 5
console.log(engine.getCurrentClassification());    // e.g. "Histels"
console.log(engine.getClassificationBreadcrumb()); // e.g. "Gelisols > Histels"
engine.reset();
```

## Usage (Browser)

```html
<script src="node_modules/dst-soil-taxonomy/scripts/dst-core.js"></script>
<script>
  const engine = DSTCore.create(data); // same API
</script>
```

## Quick Start (Web App)

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Works offline after first load. No build tools required.

## Features

- Navigate USDA soil taxonomy: Order, Suborder, Great Group, Subgroup
- Comprehensive decision criteria with AND/OR satisfaction logic
- Glossary terms with hover definitions
- Toggle to hide satisfied criteria groups for easier navigation
- Works completely offline after initial load
- No external dependencies beyond Alpine.js (CDN)

## Project Structure

```
index.html                 Alpine.js UI shell
style.css                  CSS with light/dark custom properties
sw.js                      Service Worker (offline support)
manifest.json              PWA manifest
test.html                  Browser test runner
scripts/
  dst-core.js              Standalone logic engine
  tests.js                  Test suite
  build_tree.py             Data pipeline
  apply_phase1.py
  apply_phase2.py
  apply_phase3.py
  populate_code_names.py
  validate_schema.py
  validate-logic-consistency.js  Logic validator
  sync-version.js          Version sync utility
data/
  dst-data.json            Generated taxonomy data
docs/                      Developer documentation
```

## Testing

```bash
make test                             # Run test suite
make validate                         # Validate logic and data integrity
make serve                            # Start development server
```

## Documentation

See [docs/README.md](docs/README.md) for complete documentation index and guidance on where to start.

## License

- **Code**: MIT (see [LICENSE](LICENSE))
- **Data**: USDA Keys to Soil Taxonomy, freely available for educational use
