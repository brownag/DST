#!/usr/bin/env python3
"""
Phase 4: Schema Validation and Testing
Comprehensive validation script for keys_optimized.json
"""
import json
import os

def validate_schema(data):
    """Validate the overall data structure"""
    errors = []
    
    # Check top-level structure
    required_fields = ['version', 'navigation', 'outcomes', 'glossary', 'metadata']
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing top-level field: {field}")
    
    # Check version
    version = data.get('version', '')
    if not version.startswith('3.'):
        errors.append(f"Unexpected version: {version}")
    
    return errors

def validate_navigation(data):
    """Validate navigation structure and indices"""
    errors = []
    nav = data.get('navigation', {})
    
    # Check required navigation fields
    if 'criteria' not in nav:
        errors.append("Missing navigation.criteria")
        return errors
    
    if 'indices' not in nav:
        errors.append("Missing navigation.indices")
        return errors
    
    criteria = nav['criteria']
    indices = nav['indices']
    
    # Check criteria array
    if not isinstance(criteria, list):
        errors.append(f"navigation.criteria should be list, got {type(criteria)}")
        return errors
    
    if len(criteria) == 0:
        errors.append("navigation.criteria is empty")
        return errors
    
    # Check indices structure
    required_indices = ['by_code', 'children_by_parent', 'parent_by_code', 'depth_by_code']
    for idx in required_indices:
        if idx not in indices:
            errors.append(f"Missing index: {idx}")
    
    # Check each criterion for required fields
    for i, criterion in enumerate(criteria[:100]):  # Sample check
        if not isinstance(criterion, dict):
            errors.append(f"Criterion {i} is not a dict")
            continue
        
        required_fields = ['clause_id', 'crit', 'content', 'logic', 'depth']
        for field in required_fields:
            if field not in criterion:
                errors.append(f"Criterion {i} ({criterion.get('crit', '?')}): missing {field}")
        
        # Verify content_html exists
        if 'content_html' not in criterion:
            errors.append(f"Criterion {i} ({criterion.get('crit', '?')}): missing content_html")
    
    # Check index consistency
    by_code = indices.get('by_code', {})
    for criterion in criteria:
        code = criterion.get('crit')
        if code and code not in by_code:
            errors.append(f"Criterion {code} not in by_code index")
    
    return errors

def validate_outcomes(data):
    """Validate outcomes structure"""
    errors = []
    outcomes = data.get('outcomes', {})
    
    if not isinstance(outcomes, dict):
        errors.append(f"outcomes should be dict, got {type(outcomes)}")
        return errors
    
    if len(outcomes) == 0:
        errors.append("outcomes is empty")
        return errors
    
    # Sample check first few outcomes
    for code, outcome in list(outcomes.items())[:10]:
        if not isinstance(outcome, dict):
            errors.append(f"Outcome {code} is not a dict")
        elif 'crit' not in outcome:
            errors.append(f"Outcome {code} missing 'crit' field")
    
    return errors

def validate_glossary(data):
    """Validate glossary structure"""
    errors = []
    glossary = data.get('glossary', {})
    
    if not isinstance(glossary, dict):
        errors.append(f"glossary should be dict, got {type(glossary)}")
        return errors
    
    # Sample check glossary entries
    for term_id, term in list(glossary.items())[:10]:
        if not isinstance(term, dict):
            errors.append(f"Glossary entry {term_id} is not a dict")
        elif 'term' not in term or 'definition' not in term:
            errors.append(f"Glossary entry {term_id} missing 'term' or 'definition'")
    
    return errors

def validate_counts(data):
    """Validate record counts are reasonable"""
    errors = []
    
    nav_count = len(data.get('navigation', {}).get('criteria', []))
    outcome_count = len(data.get('outcomes', {}))
    glossary_count = len(data.get('glossary', {}))
    
    # Expected counts (approximate)
    if nav_count < 4000 or nav_count > 4500:
        errors.append(f"Navigation criteria count suspicious: {nav_count} (expected ~4249)")
    
    if outcome_count < 2900 or outcome_count > 3300:
        errors.append(f"Outcomes count suspicious: {outcome_count} (expected ~3073)")
    
    if glossary_count < 100 or glossary_count > 200:
        errors.append(f"Glossary count suspicious: {glossary_count} (expected ~124)")
    
    return errors

def main():
    json_path = 'data/keys_optimized.json'
    
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"[!] File not found: {json_path}")
        return False
    except json.JSONDecodeError as e:
        print(f"[!] JSON decode error: {e}")
        return False
    
    print("[OK] JSON file loads successfully")
    
    all_errors = []
    
    # Run all validators
    all_errors.extend(validate_schema(data))
    all_errors.extend(validate_navigation(data))
    all_errors.extend(validate_outcomes(data))
    all_errors.extend(validate_glossary(data))
    all_errors.extend(validate_counts(data))
    
    # Report results
    if all_errors:
        print(f"[!] Validation failed with {len(all_errors)} error(s):")
        for error in all_errors:
            print(f"    - {error}")
        return False
    
    # Print success summary
    nav = data.get('navigation', {})
    nav_count = len(nav.get('criteria', []))
    outcome_count = len(data.get('outcomes', {}))
    glossary_count = len(data.get('glossary', {}))
    
    print("[OK] All validation checks passed!")
    print(f"[OK] Version: {data.get('version')}")
    print(f"[OK] Navigation criteria: {nav_count}")
    print(f"[OK] Outcomes: {outcome_count}")
    print(f"[OK] Glossary terms: {glossary_count}")
    print(f"[OK] Indices present: {list(nav.get('indices', {}).keys())}")
    
    file_size = os.path.getsize(json_path)
    print(f"[OK] File size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")
    
    return True

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
