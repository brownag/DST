#!/usr/bin/env python3
"""
Test utilities for Digital Keys to Soil Taxonomy navigation logic
Validates allocation criteria satisfaction and hierarchy traversal

Usage:
    python3 scripts/test_navigation.py              # Run all tests
    python3 scripts/test_navigation.py --verbose    # Show detailed output
"""

import json
import sys
from typing import List, Dict, Set, Tuple


class NavigationTester:
    """Test harness for soil taxonomy navigation"""
    
    def __init__(self, data_path: str = 'data/keys_optimized.json'):
        """
        Load and prepare test data
        
        Args:
            data_path: Path to keys_optimized.json
        """
        with open(data_path) as f:
            self.data = json.load(f)
        
        # Extract components
        self.navigation = self.data.get('navigation', {})
        self.criteria = self.navigation.get('criteria', [])
        self.indices = self.navigation.get('indices', {})
        self.outcomes = self.data.get('outcomes', [])
        self.glossary = self.data.get('glossary', {})
        
        # Build derived structures
        self.criteria_by_code = {}
        self.criteria_by_clause = {}
        self.code_to_name = self.data.get('code_names', {})
        self.order_names = self.data.get('order_names', {})
        
        self._index_criteria()
    
    def _index_criteria(self):
        """Build lookup indices for criteria"""
        for c in self.criteria:
            code = c.get('crit', 'UNKNOWN')
            clause = c.get('clause')
            
            if code not in self.criteria_by_code:
                self.criteria_by_code[code] = []
            self.criteria_by_code[code].append(c)
            
            if clause is not None:
                self.criteria_by_clause[clause] = c
    
    def test_hierarchy_integrity(self) -> Tuple[bool, List[str]]:
        """
        Verify that all parent_clause references point to existing clauses
        Returns: (passed: bool, errors: List[str])
        """
        errors = []
        
        for code, criteria_list in self.criteria_by_code.items():
            for criterion in criteria_list:
                parent_clause = criterion.get('parent_clause')
                
                # Skip root items
                if parent_clause is None or parent_clause == '' or parent_clause == 0:
                    continue
                
                # Check if parent exists in same crit-code group
                parent_exists = any(c['clause'] == parent_clause for c in criteria_list)
                
                if not parent_exists:
                    errors.append(
                        f"Code '{code}': criterion clause={criterion['clause']} "
                        f"references parent_clause={parent_clause} which doesn't exist"
                    )
        
        return len(errors) == 0, errors
    
    def test_unique_ids(self) -> Tuple[bool, List[str]]:
        """
        Verify that (crit, clause) tuples are unique
        Returns: (passed: bool, errors: List[str])
        """
        seen = {}
        errors = []
        
        for c in self.criteria:
            key = (c.get('crit'), c.get('clause'))
            if key in seen:
                errors.append(f"Duplicate criterion ID: {key}")
            seen[key] = True
        
        return len(errors) == 0, errors
    
    def test_outcome_codes_exist(self) -> Tuple[bool, List[str]]:
        """
        Verify that outcome codes are represented (or injected) in criteria
        Returns: (passed: bool, errors: List[str])
        """
        errors = []
        
        for outcome in self.outcomes[:20]:  # Sample first 20
            code = outcome.get('crit')
            if code not in self.criteria_by_code:
                errors.append(f"Outcome code '{code}' not found in criteria")
        
        return len(errors) == 0, errors
    
    def test_glossary_term_coverage(self) -> Tuple[bool, Dict]:
        """
        Check which glossary terms appear in criterion text
        Returns: (coverage_pct: float, stats: Dict)
        """
        text_content = ' '.join(c.get('content', '') for c in self.criteria)
        
        found = set()
        for term_id, term_obj in self.glossary.items():
            term_text = term_obj.get('term', '')
            if term_text.lower() in text_content.lower():
                found.add(term_id)
        
        coverage = (len(found) / len(self.glossary) * 100) if self.glossary else 0
        
        return {
            'coverage_pct': round(coverage, 1),
            'found_terms': len(found),
            'total_terms': len(self.glossary),
            'missing_terms': len(self.glossary) - len(found)
        }
    
    def test_code_hierarchy(self) -> Tuple[bool, List[str]]:
        """
        Verify hierarchical structure of codes
        Returns: (passed: bool, violations: List[str])
        """
        violations = []
        all_codes = set(self.criteria_by_code.keys())
        
        # Check: if AAA exists, parent AA must exist (or be injected)
        for code in all_codes:
            if len(code) <= 1:
                continue  # Root, no parent needed
            
            parent = code[:-1]
            if parent not in all_codes:
                # Allow: parent is missing (will be filled by injection)
                # Flag: parent is multiple levels away (shouldn't happen)
                ancestor = parent
                while ancestor and ancestor not in all_codes:
                    ancestor = ancestor[:-1]
                
                if ancestor and len(ancestor) < len(parent) - 1:
                    violations.append(
                        f"Code '{code}' parent '{parent}' missing, nearest ancestor '{ancestor}'"
                    )
        
        return len(violations) == 0, violations
    
    def test_logic_fields(self) -> Tuple[bool, Dict]:
        """
        Verify that logic field values are valid
        Returns: (valid: bool, stats: Dict)
        """
        valid_logics = {'AND', 'OR', 'FIRST', 'END'}
        invalid = []
        logic_counts = {}
        
        for c in self.criteria:
            logic = c.get('logic', 'AND')
            logic_counts[logic] = logic_counts.get(logic, 0) + 1
            
            if logic not in valid_logics:
                invalid.append(f"Invalid logic '{logic}' in code={c.get('crit')}")
        
        return len(invalid) == 0, {
            'valid_logic_values': valid_logics,
            'logic_distribution': logic_counts,
            'invalid_count': len(invalid)
        }
    
    def test_depth_consistency(self) -> Tuple[bool, Dict]:
        """
        Check that depth values match code length
        Returns: (mostly_consistent: bool, stats: Dict)
        """
        depth_mismatches = []
        depth_dist = {}
        
        for c in self.criteria:
            code_len = len(c.get('crit', ''))
            depth = c.get('depth')
            
            depth_dist[depth] = depth_dist.get(depth, 0) + 1
            
            # Depth should generally equal code length
            if code_len > 0 and code_len != depth and depth >= 0:
                depth_mismatches.append({
                    'code': c.get('crit'),
                    'code_len': code_len,
                    'depth': depth
                })
        
        return len(depth_mismatches) == 0, {
            'depth_distribution': depth_dist,
            'mismatches': len(depth_mismatches),
            'sample_mismatches': depth_mismatches[:5] if depth_mismatches else []
        }
    
    def run_all_tests(self, verbose=False):
        """Execute all tests and report results"""
        tests = [
            ("Hierarchy Integrity", self.test_hierarchy_integrity),
            ("Unique IDs", self.test_unique_ids),
            ("Outcome Codes Exist", self.test_outcome_codes_exist),
            ("Code Hierarchy", self.test_code_hierarchy),
            ("Logic Fields Valid", self.test_logic_fields),
            ("Depth Consistency", self.test_depth_consistency),
        ]
        
        results = []
        
        for test_name, test_func in tests:
            if verbose:
                print(f"\n[>] Running: {test_name}")
            
            try:
                result = test_func()
                passed = result[0] if isinstance(result, tuple) else result.get('found_terms')
                details = result[1] if isinstance(result, tuple) else result
                
                results.append({
                    'name': test_name,
                    'passed': passed,
                    'details': details
                })
                
                if verbose:
                    if isinstance(passed, bool):
                        status = "[OK]" if passed else "[!]"
                    else:
                        status = "[OK]" if passed > 80 else "[!]"
                    print(f"  {status} {test_name}")
                    if details and isinstance(details, list):
                        for err in details[:3]:
                            print(f"      - {err}")
                    elif details and isinstance(details, dict):
                        for k, v in details.items():
                            print(f"      {k}: {v}")
            
            except Exception as e:
                results.append({
                    'name': test_name,
                    'passed': False,
                    'error': str(e)
                })
                if verbose:
                    print(f"  [!] {test_name}: {e}")
        
        return results


def print_summary(results):
    """Pretty-print test summary"""
    passed = sum(1 for r in results if r.get('passed'))
    total = len(results)
    
    print(f"\n{'='*60}")
    print(f"TEST SUMMARY: {passed}/{total} tests passed")
    print(f"{'='*60}\n")
    
    for r in results:
        status = "✓ PASS" if r.get('passed') else "✗ FAIL"
        print(f"{status}: {r['name']}")


if __name__ == '__main__':
    verbose = '--verbose' in sys.argv or '-v' in sys.argv
    
    print("[>] Loading test data...")
    tester = NavigationTester()
    
    print(f"[OK] Loaded {len(tester.criteria)} criteria, {len(tester.outcomes)} outcomes")
    print(f"[OK] Glossary: {len(tester.glossary)} terms\n")
    
    print("[>] Running navigation validation tests...")
    results = tester.run_all_tests(verbose=verbose)
    
    print_summary(results)
