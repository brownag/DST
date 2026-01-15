#!/usr/bin/env bash
# Build pipeline: transforms USDA source JSON into keys_optimized.json
# Usage: bash scripts/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[>] Starting build pipeline..."

python3 scripts/build_tree.py
python3 scripts/apply_phase1.py
python3 scripts/apply_phase2.py
python3 scripts/apply_phase3.py
python3 scripts/populate_code_names.py
python3 scripts/validate_schema.py

echo "[OK] Pipeline complete. Output: data/keys_optimized.json"
ls -lh data/keys_optimized.json
