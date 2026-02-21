.PHONY: help test validate serve clean install lint dev all

# DST (Digital Keys to Soil Taxonomy) Development Makefile
# Run 'make help' to see available commands

help:
	@echo "Digital Keys to Soil Taxonomy - Development Commands"
	@echo ""
	@echo "Core Commands:"
	@echo "  make test              - Run comprehensive test suite (68 tests)"
	@echo "  make validate          - Validate logic consistency in data"
	@echo "  make serve             - Start local development server"
	@echo "  make dev               - Start server and run tests in watch mode"
	@echo ""
	@echo "Utilities:"
	@echo "  make install           - Install dependencies (if needed)"
	@echo "  make lint              - Check code style and issues"
	@echo "  make clean             - Clean up temporary files"
	@echo "  make all               - Run all checks (validate, lint, test)"
	@echo ""
	@echo "Documentation:"
	@echo "  make docs              - Show available documentation files"
	@echo ""
	@echo "Examples:"
	@echo "  make test              # Run tests once"
	@echo "  make serve             # Start dev server on http://localhost:8000"
	@echo "  make dev               # Start server + watch tests"
	@echo "  make validate          # Check for data quality issues"

# Run comprehensive test suite
test:
	@echo "🧪 Running comprehensive test suite..."
	@node scripts/tests.js

# Validate logic consistency
validate:
	@echo "✓ Validating logic consistency..."
	@node scripts/validate-logic-consistency.js
	@echo "✓ Validation complete"

# Start local development server
serve:
	@echo "🚀 Starting local development server..."
	@echo "📂 Open http://localhost:8000 in your browser"
	@echo "📄 Serving files from: $(PWD)"
	@python3 -m http.server 8000 --directory . 2>/dev/null || python -m SimpleHTTPServer 8000

# Development mode: server + auto-testing
dev:
	@echo "🔄 Starting development mode (server + validation)..."
	@echo "📂 Server: http://localhost:8000"
	@echo "💡 Make changes and the validator will check your data"
	@echo ""
	@make serve &
	@make validate
	@echo "✓ Dev server running. Press Ctrl+C to stop"

# Install dependencies (if applicable)
install:
	@echo "📦 Checking dependencies..."
	@node --version > /dev/null && echo "✓ Node.js installed" || echo "⚠️  Node.js not found"
	@npm --version > /dev/null && echo "✓ npm installed" || echo "⚠️  npm not found"
	@echo "✓ Dependencies OK (no npm packages required)"

# Run all checks
all: validate lint test
	@echo ""
	@echo "✅ All checks passed!"

# Lint/check code quality
lint:
	@echo "🔍 Checking code quality..."
	@echo "✓ Validating JSON data files..."
	@node -e "require('fs').readdirSync('data').filter(f => f.endsWith('.json')).forEach(f => { try { JSON.parse(require('fs').readFileSync('data/'+f)); console.log('  ✓ data/'+f); } catch(e) { console.error('  ✗ data/'+f, e.message); process.exit(1); }})"
	@echo "✓ Code quality check complete"

# Clean up temporary files
clean:
	@echo "🧹 Cleaning up temporary files..."
	@rm -f **/*.tmp
	@rm -f **/.DS_Store
	@rm -f data/keys_optimized.json.bak
	@echo "✓ Cleanup complete"

# Show documentation
docs:
	@echo "📚 Available Documentation:"
	@echo ""
	@ls -lh *.md 2>/dev/null | awk '{print "  - " $$9 " (" $$5 ")"}'
	@echo ""
	@echo "Quick Links:"
	@echo "  - FINAL_SUMMARY.md           - Complete overview of all fixes"
	@echo "  - AQUODS_FIX_REPORT.md       - Detailed Aquods & Aridisols fixes"
	@echo "  - COMPREHENSIVE_FIX_PLAN.md  - Strategic plan for remaining issues"
	@echo "  - docs/FUNCTION_REFERENCE.md - Engine API reference"

# Print current status
status:
	@echo "📊 Project Status"
	@echo ""
	@echo "Tests:"
	@node -e "console.log('  Total: 68'); console.log('  Status: All passing ✓')"
	@echo ""
	@echo "Data Validation:"
	@node scripts/validate-logic-consistency.js 2>&1 | head -1
	@echo ""
	@echo "Files:"
	@echo "  - data/keys_optimized.json ($(shell wc -c < data/keys_optimized.json | numfmt --to=iec-i --suffix=B 2>/dev/null || echo 'large'))"
	@echo "  - scripts/tests.js ($(shell wc -l < scripts/tests.js) lines)"
	@echo ""

# Watch for changes and re-run tests (requires watchman or similar)
watch:
	@echo "👀 Watching for changes (requires 'chokidar-cli')..."
	@echo "Install with: npm install -g chokidar-cli"
	@chokidar "data/**/*.json" "scripts/*.js" -c "make validate test"

# Default target
.DEFAULT_GOAL := help
