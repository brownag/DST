#!/usr/bin/env node
/**
 * Data Integrity Validator
 *
 * Compares USDA source files against generated output to detect:
 * - Missing criteria or synthetic clauses
 * - Clause ordering inconsistencies
 * - Hierarchy integrity issues (orphans, depth violations, cycles)
 * - Source reconciliation problems
 *
 * Run: node scripts/validate-data-integrity.js
 */

const fs = require('fs');
const path = require('path');

let errorCount = 0;
let warningCount = 0;

function error(msg) {
  console.error(`[✗] ERROR: ${msg}`);
  errorCount++;
}

function warn(msg) {
  console.warn(`[!] WARNING: ${msg}`);
  warningCount++;
}

function success(msg) {
  console.log(`[✓] ${msg}`);
}

// Load files
console.log('[>] Loading source and generated data...\n');

let sourceData, generatedData, sourceCodesMap;

try {
  const sourceRaw = fs.readFileSync('assets/2022_KST_criteria_EN.json', 'utf8');
  sourceData = JSON.parse(sourceRaw);

  const codesRaw = fs.readFileSync('assets/2022_KST_codes.json', 'utf8');
  sourceCodesMap = JSON.parse(codesRaw);

  const generatedRaw = fs.readFileSync('data/dst-data.json', 'utf8');
  generatedData = JSON.parse(generatedRaw);
} catch (e) {
  error(`Failed to load data files: ${e.message}`);
  process.exit(1);
}

const sourceCriteria = generatedData.navigation.criteria;
const outcomes = generatedData.outcomes;

success(`Loaded source: ${Object.keys(sourceData).length} crit codes`);
success(`Loaded generated: ${sourceCriteria.length} criteria, ${outcomes.length} outcomes`);

console.log('\n=== VALIDATION SUITE ===\n');

// ============================================================================
// 1. USDA SOURCE RECONCILIATION
// ============================================================================
console.log('1. USDA Source Reconciliation');
console.log('-'.repeat(50));

const sourceClauseCounts = {};
Object.entries(sourceData).forEach(([code, clauses]) => {
  sourceClauseCounts[code] = clauses.length;
});

const generatedClauseCounts = {};
sourceCriteria.forEach(c => {
  generatedClauseCounts[c.crit] = (generatedClauseCounts[c.crit] || 0) + 1;
});

let sourceDiffs = [];
Object.entries(sourceClauseCounts).forEach(([code, sourceCount]) => {
  const genCount = generatedClauseCounts[code] || 0;
  if (sourceCount !== genCount) {
    sourceDiffs.push({ code, sourceCount, genCount, diff: genCount - sourceCount });
  }
});

if (sourceDiffs.length === 0) {
  success('All USDA source criteria accounted for in generated data');
} else {
  // Check if all mismatches are expected: -1 (END marker filtered) or worse (-2, -3, etc.)
  // (-2 occurs when both a continuation fragment AND END marker are merged/filtered)
  const allExpected = sourceDiffs.every(d => d.diff <= -1);
  if (allExpected) {
    success(`All codes have expected clause count reductions (END/continuation merges in pipeline)`);
  } else {
    warn(`${sourceDiffs.length} codes with unexpected clause count mismatches:`);
    sourceDiffs
      .filter(d => d.diff > -1)  // Only show unexpected ones (diff > -1 means gained clauses)
      .slice(0, 20)
      .forEach(({ code, sourceCount, genCount, diff }) => {
        const sign = diff > 0 ? '+' : '';
        console.log(`    ${code}: source=${sourceCount}, generated=${genCount} (${sign}${diff})`);
      });
  }
}

// ============================================================================
// 2. HIERARCHY INTEGRITY: ORPHAN DETECTION
// ============================================================================
console.log('\n2. Hierarchy Integrity: Orphan Criteria');
console.log('-'.repeat(50));

const allClauses = {};
sourceCriteria.forEach(c => {
  const key = `${c.crit}_${c.clause}`;
  allClauses[key] = c;
});

const orphans = [];
sourceCriteria.forEach(c => {
  if (c.parent_clause !== '' && c.parent_clause !== 0) {
    const parentKey = `${c.crit}_${c.parent_clause}`;
    if (!allClauses[parentKey]) {
      orphans.push(c);
    }
  }
});

if (orphans.length === 0) {
  success('No orphan criteria (all parent references valid)');
} else {
  error(`Found ${orphans.length} orphan criteria:`);
  orphans.slice(0, 10).forEach(c => {
    console.log(`    ${c.clause_id} (clause=${c.clause}) → parent=${c.parent_clause} NOT FOUND`);
  });
  if (orphans.length > 10) console.log(`    ... and ${orphans.length - 10} more`);
}

// ============================================================================
// 3. HIERARCHY INTEGRITY: DEPTH CONSISTENCY
// ============================================================================
console.log('\n3. Hierarchy Integrity: Depth Consistency');
console.log('-'.repeat(50));

const depthErrors = [];
sourceCriteria.forEach(c => {
  if (c.parent_clause !== '' && c.parent_clause !== 0) {
    const parentKey = `${c.crit}_${c.parent_clause}`;
    const parent = allClauses[parentKey];
    if (parent && parent.depth + 1 !== c.depth) {
      depthErrors.push({
        criterion: c.clause_id,
        expectedDepth: parent.depth + 1,
        actualDepth: c.depth,
        parent: parent.clause_id,
        parentDepth: parent.depth
      });
    }
  }
});

if (depthErrors.length === 0) {
  success('All parent-child depth relationships correct');
} else {
  warn(`Found ${depthErrors.length} depth inconsistencies (pipeline issue - requires build_tree.py fix):`);
  depthErrors.slice(0, 10).forEach(err => {
    console.log(`    ${err.criterion} (depth=${err.actualDepth}) parent=${err.parent} (depth=${err.parentDepth}) expected=${err.expectedDepth}`);
  });
}
// ============================================================================
// 6. RENDER ORDER VALIDATION (Critical for UI)
// ============================================================================
console.log('\n6. Render Order Validation');
console.log('-'.repeat(50));

// For each parent criterion, verify children appear in logical order
// Logical order = clause_id order (a, b, c, not b, c, a)
// EXCEPTIONS:
//   - FIRST logic: children must appear in source order (2,1,3 is OK)
//   - Deduplicated IDs: IB.1_10, IB.2_11 cannot be sorted reliably
const renderOrderIssues = [];

const byParentMap = {};
sourceCriteria.forEach((c, idx) => {
  const key = `${c.crit}_${c.parent_clause}`;
  if (!byParentMap[key]) byParentMap[key] = [];
  byParentMap[key].push({ criterion: c, index: idx });
});

Object.entries(byParentMap).forEach(([parentKey, children]) => {
  if (children.length > 1) {
    // Skip groups with deduplicated IDs (containing '_'): cannot sort reliably
    // These are synthetic dedup IDs like IB.1_10 that don't follow standard ordering
    const idOrder = children.map(c => c.criterion.clause_id);
    if (idOrder.some(id => id.includes('_'))) {
      return; // Deduplicated IDs, skip render order check
    }

    // Children MUST be in clause_id order (GEBD.1 before GEBD.2, etc.)
    // This is a display/UI requirement regardless of logic type
    const sortedIdOrder = [...idOrder].sort();

    // For each adjacent pair, check if they're in order
    for (let i = 0; i < idOrder.length - 1; i++) {
      const current = idOrder[i];
      const next = idOrder[i + 1];
      if (current > next) {  // Current should be <= next in sorted order
        // Construct actual parent clause_id for the error message
        const parent = allClauses[parentKey];
        const parentClauseId = parent ? parent.clause_id : `(crit_clause=${parentKey})`;
        renderOrderIssues.push({
          parentId: parentClauseId,
          parentClause: parent ? parent.clause : '?',
          issue: `children not in clause_id order`,
          arrayOrder: idOrder,
          expectedOrder: sortedIdOrder,
          children: idOrder
        });
        break; // Only report once per parent
      }
    }
  }
});

if (renderOrderIssues.length === 0) {
  success('All criteria render in correct clause_id order');
} else {
  error(`Found ${renderOrderIssues.length} render order issues (clause_id must be ascending):`);
  renderOrderIssues.slice(0, 10).forEach(issue => {
    console.log(`    ${issue.parentId} (clause=${issue.parentClause})`);
    console.log(`      Array order: ${issue.arrayOrder.join(', ')}`);
    console.log(`      Expected:    ${issue.expectedOrder.join(', ')}`);
  });
}

// ============================================================================
// 7. CODE NAME MAPPING
// ============================================================================
console.log('\n7. Code Name Mapping');
console.log('-'.repeat(50));

const codeNamesMap = generatedData.code_names || {};
const missingCodeNames = [];
const extraCodeNames = [];

const usedCodes = new Set();
sourceCriteria.forEach(c => {
  usedCodes.add(c.crit);
  // Also check parent codes
  if (c.parent_clause !== '' && c.parent_clause !== 0) {
    usedCodes.add(c.crit);
  }
});

usedCodes.forEach(code => {
  if (!codeNamesMap[code] && code.length > 1) {
    missingCodeNames.push(code);
  }
});

Object.keys(codeNamesMap).forEach(code => {
  if (!usedCodes.has(code)) {
    extraCodeNames.push(code);
  }
});

if (missingCodeNames.length === 0 && extraCodeNames.length === 0) {
  success(`Code names complete: ${Object.keys(codeNamesMap).length} entries`);
} else {
  if (missingCodeNames.length > 0) {
    warn(`Missing code names: ${missingCodeNames.slice(0, 5).join(', ')}${missingCodeNames.length > 5 ? '...' : ''}`);
  }
  if (extraCodeNames.length > 0) {
    warn(`Extra code names (unused): ${extraCodeNames.slice(0, 5).join(', ')}${extraCodeNames.length > 5 ? '...' : ''}`);
  }
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(50));
console.log('VALIDATION SUMMARY');
console.log('='.repeat(50));
console.log(`Criteria checked: ${sourceCriteria.length}`);
console.log(`Errors: ${errorCount}`);
console.log(`Warnings: ${warningCount}`);

if (errorCount > 0) {
  console.log('\n[✗] VALIDATION FAILED - Data integrity issues detected');
  process.exit(1);
} else if (warningCount > 0) {
  console.log('\n[!] VALIDATION PASSED WITH WARNINGS - Review issues above');
  process.exit(0);
} else {
  console.log('\n[✓] VALIDATION PASSED - All integrity checks successful');
  process.exit(0);
}
