#!/usr/bin/env python3
"""
Phase 2 Transformation: Separate navigation from outcomes, build indices
"""
import json
import os

def build_indices(nav_criteria):
    """Build fast lookup indices for navigation"""
    indices = {
        'by_code': {c['crit']: c for c in nav_criteria},
        'children_by_parent': {},
        'parent_by_code': {},
        'depth_by_code': {c['crit']: c['depth'] for c in nav_criteria}
    }
    
    # Build parent_by_code index
    for c in nav_criteria:
        if len(c['crit']) > 1:
            indices['parent_by_code'][c['crit']] = c['crit'][:-1]
    
    # Build children_by_parent index
    indices['children_by_parent']['root'] = [
        c['crit'] for c in nav_criteria if c['depth'] == 0
    ]
    
    for c in nav_criteria:
        if c['depth'] < 4:  # Non-leaf nodes
            children = [
                child['crit'] for child in nav_criteria
                if child['crit'].startswith(c['crit']) 
                and len(child['crit']) == len(c['crit']) + 1
            ]
            if children:
                indices['children_by_parent'][c['crit']] = children
    
    return indices

# Load existing data
json_path = 'data/keys_optimized.json'
with open(json_path, 'r') as f:
    data = json.load(f)

before_size = os.path.getsize(json_path)

# Separate navigation from outcomes
all_criteria = data['tree']['criteria']
nav_criteria = [c for c in all_criteria if c.get('depth', 0) >= 0]
outcomes = {c['crit']: c for c in all_criteria if c.get('depth', 0) == -1}

# Build indices
indices = build_indices(nav_criteria)

# Rebuild data structure
new_structure = {
    'version': '3.2.0',
    'generated': '2026-02-16',
    'source': 'USDA Keys to Soil Taxonomy (2022)',
    'description': 'Optimized hierarchical criteria with separated navigation and outcomes',
    'metadata': {
        **data.get('metadata', {}),
        'schema_version': '3.2.0',
    },
    'navigation': {
        'criteria': nav_criteria,
        'indices': indices
    },
    'outcomes': outcomes,
    'glossary': data.get('glossary', {}),
    'order_names': data.get('order_names', {}),
    'code_names': data.get('code_names', {})
}

# Write new structure
with open(json_path, 'w') as f:
    json.dump(new_structure, f, separators=(',', ': '))

after_size = os.path.getsize(json_path)
size_reduction = before_size - after_size
percentage = round(100 * size_reduction / before_size, 1)

print(f"[OK] Phase 2 complete: {before_size:,} → {after_size:,} bytes ({percentage:+.1f}%)")
print(f"[OK] Nav: {len(nav_criteria)} criteria, Outcomes: {len(outcomes)}, v3.2.0")
