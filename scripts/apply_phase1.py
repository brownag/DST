#!/usr/bin/env python3
"""
Phase 1 Transformation: Remove redundant id and key fields from existing JSON
"""
import json
import os

# Load existing data
json_path = 'data/keys_optimized.json'
with open(json_path, 'r') as f:
    data = json.load(f)

# Track stats
before_size = os.path.getsize(json_path)

# Process criteria - remove id and key fields
for criterion in data['tree']['criteria']:
    # Remove the redundant id field (always clause_${clause_id})
    if 'id' in criterion:
        del criterion['id']
    
    # Remove the repeated key field
    if 'key' in criterion:
        del criterion['key']

# Update root_ids to use computed IDs
data['tree']['root_ids'] = [f"clause_{c['clause_id']}" for c in data['tree']['criteria'] if len(c['crit']) == 1]

# Update parent_map to use computed IDs
new_parent_map = {}
for criterion in data['tree']['criteria']:
    parent = criterion.get('parent_clause')
    if parent:
        if parent not in new_parent_map:
            new_parent_map[parent] = []
        new_parent_map[parent].append(f"clause_{criterion['clause_id']}")
data['tree']['parent_map'] = new_parent_map

# Add metadata with depth labels (preserve existing metadata)
if 'metadata' not in data:
    data['metadata'] = {}
data['metadata']['depth_labels'] = {
    '0': 'Key to Soil Orders',
    '1': 'Key to Suborders',
    '2': 'Key to Great Groups',
    '3': 'Key to Subgroups',
    '4': 'Key to Subgroups'
}

# Update version number
data['version'] = '3.1.0'
data['generated'] = '2026-02-16'

# Write updated data
with open(json_path, 'w') as f:
    json.dump(data, f, separators=(',', ': '))

after_size = os.path.getsize(json_path)
size_reduction = before_size - after_size
percentage = round(100 * size_reduction / before_size, 1)

print(f"[OK] Phase 1 complete: {before_size:,} → {after_size:,} bytes (-{percentage}%)")
print(f"[OK] Criteria: {len(data['tree']['criteria'])}, v3.1.0")
