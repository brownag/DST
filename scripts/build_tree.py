#!/usr/bin/env python3
"""
Step 1: Build hierarchical criteria tree from USDA source JSON.

Reads the dict-of-lists criteria format from SoilKnowledgeBase and produces
intermediate JSON with clause hierarchy, glossary, and taxonomic names.

Usage:
    python3 scripts/build_tree.py
    python3 scripts/build_tree.py --validate

Required files in assets/:
    2022_KST_codes.json          Taxonomic code → name mapping
    2022_KST_criteria_EN.json    Classification criteria (dict keyed by crit code)
    2022_KST_EN_featurelist.json Glossary terms
"""

import json
import os
import re
import sys
from datetime import datetime

ASSET_FILES = {
    'codes': 'assets/2022_KST_codes.json',
    'criteria': 'assets/2022_KST_criteria_EN.json',
    'features': 'assets/2022_KST_EN_featurelist.json',
}
OUTPUT_FILE = 'data/keys_optimized.json'
SCHEMA_VERSION = '3.1.0'


def error(msg):
    print(f"[!] ERROR: {msg}", file=sys.stderr)
    sys.exit(1)

def warn(msg):
    print(f"[!] WARNING: {msg}")

def info(msg):
    print(f"[>] {msg}")

def ok(msg):
    print(f"[OK] {msg}")

def load_json(path):
    if not os.path.exists(path):
        error(f"File not found: {path}\n  See assets/README.md for details.")
    try:
        with open(path) as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        error(f"Invalid JSON in {path}: {e}")


# ---------------------------------------------------------------------------
# Clause hierarchy detection
# ---------------------------------------------------------------------------

def normalize_content(content, crit):
    """Fix known source data formatting issues."""
    text = content.strip()

    # 4. Strip leading "and " / "or " before a recognizable clause prefix.
    #    These are textual connectors from the printed keys — redundant
    #    because the logic badge already conveys AND/OR.
    m_connector = re.match(r'^(?:and|or)\s+(?=[a-z]\.\s|\d+\.\s|\(\d+\)|\([a-z]+\))', text, re.IGNORECASE)
    if m_connector:
        text = text[m_connector.end():]

    # 1. Mixed-case headers: code contains lowercase suffix (IFFZa, IGGZb, ...)
    #    Content starts with the crit code + dot: "IFFZa. Other..."
    if re.match(r'^[A-Z]+[a-z]+\.', text):
        return text, text

    # 2. Descriptive subheadings: text before an embedded numbered prefix.
    #    e.g. "Elevated sodium 1. An exchangeable..." → "1. An exchangeable..."
    #    Only apply when detect on raw text fails.
    m = re.match(r'^(.+?)\s+(\d+\.)\s', text)
    if m:
        prefix_text = m.group(1)
        # Only strip if the leading text doesn't look like a valid prefix
        if not re.match(r'^(?:or|and)\s', prefix_text, re.IGNORECASE):
            stripped = text[m.start(2):]
            return stripped, text

    # 3. Missing dot after number: "1 Do not..." → "1. Do not..."
    m = re.match(r'^(\d+)\s+([A-Z])', text)
    if m:
        fixed = f"{m.group(1)}. {text[m.end(1):].lstrip()}"
        return fixed, text

    return text, text


def detect_level(content):
    """Determine clause nesting level from content prefix."""
    text = re.sub(r'^(?:or|and)\s+', '', content.strip(), flags=re.IGNORECASE)
    if re.match(r'^[A-Z][A-Za-z]*\.', text): return 0   # Header: "A.", "IFFZa."
    if re.match(r'^\d+\.', text):             return 1   # Numbered: "1.", "2."
    if re.match(r'^[a-z]\.', text):           return 2   # Lettered: "a.", "b."
    if re.match(r'^\(\d+\)', text):           return 3   # Paren-number: "(1)"
    if re.match(r'^\([a-z]+\)', text):        return 4   # Paren-letter: "(a)"
    return -1


def extract_label(content):
    """Extract the identifier from a clause prefix for clause_id construction."""
    text = re.sub(r'^(?:or|and)\s+', '', content.strip(), flags=re.IGNORECASE)
    for pattern in [
        r'^([A-Z][A-Za-z]*)\.',  # "AA.", "IFFZa."
        r'^(\d+)\.',             # "1."
        r'^([a-z])\.',           # "a."
        r'^\((\d+)\)',           # "(1)"
        r'^\(([a-z]+)\)',        # "(a)"
    ]:
        m = re.match(pattern, text)
        if m:
            return m.group(1)
    return None


def map_logic(value):
    """Normalize source logic values to OR, AND, END, or INFER."""
    if value == 'FIRST':
        return 'OR'
    if value in ('OR', 'AND', 'END'):
        return value
    if value in ('NONE', None):
        return 'INFER'
    # LAST and NEW are handled separately (outcomes); shouldn't reach here
    return 'INFER'


def merge_continuation_fragments(items):
    """Merge continuation clauses (split across source boundaries) into preceding clause."""
    merged = []
    for item in items:
        logic = item.get('logic', '')
        if logic in ('LAST', 'NEW'):
            merged.append(item)
            continue
        content = item['content'].strip()
        cleaned = re.sub(r'^(?:or|and)\s+', '', content, flags=re.IGNORECASE)
        has_prefix = bool(re.match(
            r'^(?:[A-Z][A-Za-z]*\.|[a-z]\.\s|\d+\.?\s|\(\d+\)|\([a-z]+\))', cleaned
        ))
        # Also check if normalize_content would find an embedded prefix
        has_embedded = bool(re.match(r'^.+?\s+\d+\.\s', content))
        if not has_prefix and not has_embedded and merged:
            # Find the last non-LAST/NEW clause to merge into
            for i in range(len(merged) - 1, -1, -1):
                if merged[i].get('logic') not in ('LAST', 'NEW'):
                    merged[i] = dict(merged[i])
                    merged[i]['content'] = merged[i]['content'].rstrip() + ' ' + content
                    break
        else:
            merged.append(item)
    return merged


def split_merged_subclauses(items):
    """Split sub-clauses merged into single content items (source parsing artifact)."""
    result = []
    max_clause = max((it.get('clause', 0) for it in items), default=0)
    next_clause = max_clause + 1

    for item in items:
        logic = item.get('logic', '')
        if logic in ('LAST', 'NEW'):
            result.append(item)
            continue

        content = item.get('content', '').strip()
        # Detect: starts with (digit), contains embedded (letter) sub-clause
        m = re.match(
            r'^(\(\d+\)\s*[^(]+?),?\s+(\([a-z]\)\s+.+)$', content, re.DOTALL
        )
        if m:
            parent_content = m.group(1).rstrip(',').rstrip()
            child_content = m.group(2)

            # Parent: keeps original clause number and logic (describes children)
            parent = dict(item)
            parent['content'] = parent_content
            result.append(parent)

            # Child: gets new clause number, keeps original logic
            child = dict(item)
            child['content'] = child_content
            child['clause'] = next_clause
            next_clause += 1
            result.append(child)

            crit = item.get('crit', '?')
            info(f"  Split merged sub-clause in {crit} clause {item.get('clause', '?')}")
        else:
            result.append(item)

    return result


def process_code_group(crit, items):
    """Process one code group into navigation criteria and outcome."""
    nav = []
    outcome = None

    # Pre-process: merge continuation fragments, then split merged sub-clauses
    items = merge_continuation_fragments(items)
    items = split_merged_subclauses(items)

    # Last item is always LAST/NEW — that's the outcome reference or name
    last_item = items[-1]
    if last_item.get('logic') in ('LAST', 'NEW'):
        outcome_content = last_item['content'].strip()
    else:
        outcome_content = None

    # For 3+ letter codes, clause 1 (header) becomes the outcome description.
    # The front-end injects it back as a synthetic nav criterion.
    header_is_outcome = len(crit) >= 3

    # Stack tracks (clause_number, clause_id) at each nesting level
    stack = {}

    for item in items:
        logic_raw = item.get('logic')  # None if absent → INFER
        raw_content = item.get('content', '').strip()
        clause_num = item.get('clause', 0)

        # Skip LAST/NEW — handled above
        if logic_raw in ('LAST', 'NEW'):
            continue

        # Normalize content for level/label detection
        content, display_content = normalize_content(raw_content, crit)

        level = detect_level(content)
        label = extract_label(content)

        if level == 0:
            clause_id = crit
            parent_clause = ''
        elif level > 0 and label is not None:
            parent_info = stack.get(level - 1)
            if parent_info:
                parent_num, parent_cid = parent_info
                parent_clause = parent_num
                clause_id = f"{parent_cid}.{label}"
            else:
                # No parent at expected level — attach to header
                header_info = stack.get(0)
                if header_info:
                    parent_clause = header_info[0]
                    clause_id = f"{crit}.{label}"
                else:
                    parent_clause = ''
                    clause_id = f"{crit}.{label}"
        else:
            # Unknown prefix — attach to most recent known level
            for try_level in range(4, -1, -1):
                if try_level in stack:
                    parent_clause = stack[try_level][0]
                    clause_id = f"{stack[try_level][1]}.x{clause_num}"
                    break
            else:
                parent_clause = ''
                clause_id = f"{crit}.x{clause_num}"
            level = max(level, 0)

        # Update stack and clear deeper levels
        stack[level] = (clause_num, clause_id)
        for k in [l for l in stack if l > level]:
            del stack[k]

        record = {
            'clause_id': clause_id,
            'crit': crit,
            'clause': clause_num,
            'parent_clause': parent_clause,
            'content': display_content,
            'logic': map_logic(logic_raw),
            'depth': level,
        }

        if level == 0 and header_is_outcome:
            # Header for 3+ letter code → outcome (depth -1)
            record['depth'] = -1
            outcome = record
            # Keep it in stack so children can reference it as parent
        else:
            nav.append(record)

    # Build outcome from header + LAST name
    if outcome is None and outcome_content:
        # 1-2 letter codes: no outcome stored (page reference only)
        pass
    elif outcome is not None and outcome_content is None:
        # Shouldn't happen, but keep whatever we have
        pass

    return nav, outcome


def resolve_positional_logic(nav_list):
    """Replace END and INFER logic markers with concrete OR or AND."""
    # Group by (crit, parent_clause) — these are sibling groups
    sibling_groups = {}
    for item in nav_list:
        key = (item['crit'], item['parent_clause'])
        if key not in sibling_groups:
            sibling_groups[key] = []
        sibling_groups[key].append(item)

    # Also index by (crit, clause) for child lookups
    children_of = {}
    for item in nav_list:
        key = (item['crit'], item['parent_clause'])
        if key not in children_of:
            children_of[key] = []
        # (already populated above as sibling_groups)
    children_of = sibling_groups  # same structure, different perspective

    end_resolved = 0
    infer_resolved = 0

    # Pass 1: resolve END markers from siblings
    for siblings in sibling_groups.values():
        dominant = 'OR'
        for s in siblings:
            if s['logic'] not in ('END', 'INFER'):
                dominant = s['logic']
                break
        for s in siblings:
            if s['logic'] == 'END':
                s['logic'] = dominant
                end_resolved += 1

    # Pass 2: resolve INFER markers from children
    for item in nav_list:
        if item['logic'] != 'INFER':
            continue
        # Find this item's children
        child_key = (item['crit'], item['clause'])
        children = children_of.get(child_key, [])
        if children:
            # Use first child's concrete logic
            for child in children:
                if child['logic'] not in ('END', 'INFER'):
                    item['logic'] = child['logic']
                    infer_resolved += 1
                    break
            else:
                item['logic'] = 'OR'
                infer_resolved += 1
        else:
            # No children — default to AND (leaf-like)
            item['logic'] = 'AND'
            infer_resolved += 1

    if end_resolved:
        info(f"Resolved {end_resolved} END markers → sibling logic")
    if infer_resolved:
        info(f"Resolved {infer_resolved} INFER markers → children logic")


def build_glossary(features):
    """Build glossary dict from feature list."""
    glossary = {}
    for f in features:
        term = f.get('name', '').strip()
        if not term:
            continue
        tid = term.lower().replace(' ', '_').replace(',', '').replace('-', '_')[:50]
        glossary[tid] = {
            'id': tid,
            'term': term,
            'definition': f.get('description', ''),
        }
    return glossary


def build_names(codes):
    """Build order_names and code_names from codes file."""
    order_names = {}
    code_names = {}
    for entry in codes:
        c, n = entry['code'], entry['name']
        code_names[c] = n
        if len(c) == 1:
            order_names[c] = n
    return order_names, code_names


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    info("Digital Keys to Soil Taxonomy — build_tree.py")
    info(f"Schema version: {SCHEMA_VERSION}\n")

    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        sys.exit(0)

    validate_only = '--validate' in sys.argv

    # Load sources
    codes    = load_json(ASSET_FILES['codes'])
    criteria = load_json(ASSET_FILES['criteria'])
    features = load_json(ASSET_FILES['features'])

    # Validate shapes
    if not isinstance(codes, list) or not codes:
        error("codes.json must be a non-empty array of {code, name}")
    if not isinstance(criteria, dict) or not criteria:
        error("criteria.json must be a non-empty dict keyed by crit code")
    if not isinstance(features, list) or not features:
        error("featurelist.json must be a non-empty array of {name, description}")

    ok(f"codes.json: {len(codes)} entries")
    ok(f"criteria.json: {len(criteria)} code groups, {sum(len(v) for v in criteria.values())} total clauses")
    ok(f"featurelist.json: {len(features)} entries")

    # Process each code group
    info("Processing code groups...")
    all_nav = []
    all_outcomes = []

    for crit in criteria:
        items = criteria[crit]
        nav, outcome = process_code_group(crit, items)
        all_nav.extend(nav)
        if outcome:
            all_outcomes.append(outcome)

    # Resolve positional END and INFER logic markers
    resolve_positional_logic(all_nav)

    # Combine: nav (depth >= 0) + outcomes (depth == -1) into one list
    all_criteria = all_nav + all_outcomes

    ok(f"Navigation criteria: {len(all_nav)}")
    ok(f"Outcomes: {len(all_outcomes)}")

    # Depth distribution
    depth_dist = {}
    for c in all_criteria:
        d = c['depth']
        depth_dist[d] = depth_dist.get(d, 0) + 1
    info(f"Depth distribution: {dict(sorted(depth_dist.items()))}")

    # Check for duplicate clause_ids
    seen = {}
    dupes = 0
    for c in all_criteria:
        cid = c['clause_id']
        if cid in seen:
            dupes += 1
            # Make unique by appending clause number
            c['clause_id'] = f"{cid}_{c['clause']}"
        seen[c['clause_id']] = True
    if dupes:
        warn(f"Resolved {dupes} duplicate clause_ids")

    if validate_only:
        ok("Validation complete — no output written.")
        return

    # Build supporting data
    glossary = build_glossary(features)
    order_names, code_names = build_names(codes)

    ok(f"Glossary: {len(glossary)} terms")
    ok(f"Taxonomic names: {len(order_names)} orders, {len(code_names)} total")

    # Build tree output (intermediate format for downstream scripts)
    output = {
        'version': SCHEMA_VERSION,
        'generated': datetime.now().strftime('%Y-%m-%d'),
        'source': 'USDA Keys to Soil Taxonomy (2022)',
        'description': 'Hierarchical criteria with clause hierarchy',
        'metadata': {
            'schema_version': SCHEMA_VERSION,
            'depth_labels': {
                '0': 'Key to Soil Orders',
                '1': 'Key to Suborders',
                '2': 'Key to Great Groups',
                '3': 'Key to Subgroups',
                '4': 'Key to Subgroups',
            },
        },
        'tree': {
            'id': 'root',
            'criteria': all_criteria,
            'root_ids': [],
            'parent_map': {},
        },
        'glossary': glossary,
        'order_names': order_names,
        'code_names': code_names,
    }

    # Write
    os.makedirs('data', exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f)

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    ok(f"Wrote {OUTPUT_FILE} ({size_mb:.2f} MB)")
    ok(f"Total criteria: {len(all_criteria)} ({len(all_nav)} nav + {len(all_outcomes)} outcomes)")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n[!] Interrupted")
        sys.exit(1)
    except Exception as e:
        error(f"Unexpected error: {e}")

