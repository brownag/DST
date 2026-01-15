#!/usr/bin/env python3
"""Populate code_names in keys_optimized.json with taxon names derived from content patterns."""
import json, re

with open('data/keys_optimized.json') as f:
    d = json.load(f)

outcomes = d['outcomes']
nav = d['navigation']['criteria']
order_names = d['order_names']

# Start from existing code_names (populated by build_tree from codes.json)
code_names = dict(d.get('code_names', {}))
code_names.update(order_names)

# From children's content, derive parent taxon name.
# Pattern: "CODE. [Other] TaxonName that..." → parent_code = TaxonName
# e.g., "AAA. Histels that..." → AA = Histels
#        "AAB. Other Histels that..." → AA = Histels (confirmed)
#        "AABA. Glacistels that..." → AAB = Glacistels

def extract_parent_name(code, content):
    text = re.sub(r'^[A-Z]+[.:]\s*', '', content).strip()
    text = re.sub(r'^Other\s+', '', text).strip()
    words = text.split()
    if not words:
        return None
    first_word = words[0].rstrip('.,;:')
    if first_word and first_word[0].isupper() and len(first_word) > 3:
        return first_word
    return None

# Pass 1: outcomes (3080 entries)
for code, oc in outcomes.items():
    name = extract_parent_name(code, oc.get('content', ''))
    if name:
        parent_code = code[:-1]
        if parent_code and parent_code not in code_names:
            code_names[parent_code] = name

# Pass 2: nav criteria first item per code
nav_by_code = {}
for c in nav:
    nav_by_code.setdefault(c['crit'], []).append(c)

for code, items in nav_by_code.items():
    name = extract_parent_name(code, items[0].get('content', ''))
    if name:
        parent_code = code[:-1]
        if parent_code and parent_code not in code_names:
            code_names[parent_code] = name

# Write back
d['code_names'] = code_names
with open('data/keys_optimized.json', 'w') as f:
    json.dump(d, f)

print(f'[OK] Wrote {len(code_names)} taxon names to code_names')
by_len = {}
for k in code_names:
    by_len.setdefault(len(k), []).append(k)
for length in sorted(by_len):
    print(f'  {length}-letter: {len(by_len[length])}')
