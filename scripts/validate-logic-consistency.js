#!/usr/bin/env node

/**
 * Logic Consistency Validator — Enhanced
 *
 * Checks for three classes of logic-text mismatches and mixed-logic sibling groups:
 *   Class A (CRITICAL): OR-semantic text with AND logic — indicates data bugs
 *   Class B (INFORMATIONAL): AND-semantic text with OR logic — usually correct
 *   Class C (INFORMATIONAL): Mixed-logic sibling groups — structural analysis & proposals
 *
 * Usage:
 *   node validate-logic-consistency.js [--json]
 *
 * Exit codes:
 *   0 = No critical issues found (all good)
 *   1 = Critical mismatches found (Class A only)
 *
 * Note: Class B and C are informational. Class B mostly contains correct cases
 * like "one or both of the following" (OR-semantic) with OR logic. Class C
 * shows mixed-logic sibling groups and proposes restructuring for clarity.
 */

const fs = require('fs');
const path = require('path');

const dataPath = './data/dst-data.json';

if (!fs.existsSync(dataPath)) {
  console.error(`Error: ${dataPath} not found`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const criteria = data.navigation.criteria;

// ============================================================================
// CLASS A: OR-semantic text with AND logic (existing check)
// ============================================================================

const orPatterns = [
  /one or both/i,
  /any of the following/i,
  /either.*or/i,
  /any one of/i,
  /one of the following/i
];

function hasORSemantics(content) {
  return orPatterns.some(pattern => pattern.test(content));
}

const classA = criteria.filter(c => {
  const hasORText = hasORSemantics(c.content);
  const hasANDLogic = c.logic === 'AND';
  return hasORText && hasANDLogic;
});

// ============================================================================
// CLASS B: AND-semantic text with OR logic (new check)
// ============================================================================

const andPatterns = [
  /both of the following/i,
  /all of the following/i,
  /and both/i,
  /all three/i,
  /all four/i
];

function hasANDSemantics(content) {
  return andPatterns.some(pattern => pattern.test(content));
}

const classB = criteria.filter(c => {
  const hasANDText = hasANDSemantics(c.content);
  const hasORLogic = c.logic === 'OR';
  return hasANDText && hasORLogic;
});

// ============================================================================
// CLASS C: Mixed-logic sibling groups (structural analysis)
// ============================================================================

// Build parent to children map
const childrenByParent = {};
criteria.forEach(c => {
  if (c.parent_clause !== '' && c.parent_clause !== 0) {
    const parentKey = `${c.crit}_${c.parent_clause}`;
    if (!childrenByParent[parentKey]) {
      childrenByParent[parentKey] = [];
    }
    childrenByParent[parentKey].push(c);
  }
});

// Find groups with mixed logic among siblings
const classC = [];
Object.entries(childrenByParent).forEach(([parentKey, children]) => {
  if (children.length < 2) return;

  const logics = children.map(c => c.logic);
  const uniqueLogics = new Set(logics);

  if (uniqueLogics.size > 1) {
    // Mixed logic detected
    const parent = criteria.find(c => {
      const parentCrit = children[0].crit;
      const parentClause = children[0].parent_clause;
      return c.crit === parentCrit && c.clause === parentClause;
    });

    // Build run breakdown
    const runs = [];
    let currentLogic = children[0].logic;
    let currentRun = [children[0]];
    for (let i = 1; i < children.length; i++) {
      if (children[i].logic === currentLogic) {
        currentRun.push(children[i]);
      } else {
        runs.push({ logic: currentLogic, items: currentRun });
        currentLogic = children[i].logic;
        currentRun = [children[i]];
      }
    }
    runs.push({ logic: currentLogic, items: currentRun });

    // Determine severity
    const parentLogic = parent ? parent.logic : '?';
    let severity = 'INFO';

    // WARN: parent AND with any multi-item OR run (potential for bug)
    if (parentLogic === 'AND') {
      const hasMultiItemORRun = runs.some(run => run.logic === 'OR' && run.items.length > 1);
      if (hasMultiItemORRun) {
        severity = 'WARN';
      }
    }

    classC.push({
      severity,
      parent,
      children,
      runs,
      parentKey
    });
  }
});

// ============================================================================
// Generate transformation proposals for Class C items
// ============================================================================

function generateTransformationProposal(item) {
  const parent = item.parent;
  const runs = item.runs;

  if (!parent || runs.length <= 1) return null;

  // Proposal: for multi-run groups, suggest adding synthetic intermediate nodes
  const hasMultiItemORRun = runs.some(run => run.logic === 'OR' && run.items.length > 1);
  if (!hasMultiItemORRun) return null;

  const proposal = {
    summary: `Restructure ${parent.crit} clause ${parent.clause} to eliminate mixed logic`,
    steps: []
  };

  let nextSyntheticClause = Math.max(...item.children.map(c => c.clause)) + 1;

  runs.forEach((run, idx) => {
    if (run.logic === 'AND') {
      // AND runs can stay as children
      proposal.steps.push(`Keep ${run.items.map(c => c.clause_id).join(', ')} as AND children`);
    } else if (run.items.length > 1) {
      // Multi-item OR runs should become children of a synthetic OR parent
      proposal.steps.push(
        `Create synthetic OR-parent (clause ${nextSyntheticClause}) ` +
        `with children ${run.items.map(c => c.clause_id).join(', ')}`
      );
      nextSyntheticClause++;
    } else {
      // Single-item OR run stays as-is
      proposal.steps.push(`Keep ${run.items[0].clause_id} as OR child`);
    }
  });

  proposal.result = `All children of ${parent.crit} clause ${parent.clause} will have consistent logic`;
  return proposal;
}

// ============================================================================
// Output
// ============================================================================

const useJSON = process.argv.includes('--json');

if (useJSON) {
  // JSON output for machine processing
  const output = {
    summary: {
      classA_orTextAndLogic: classA.length,
      classB_andTextOrLogic: classB.length,
      classC_mixedLogicGroups: classC.length
    },
    critical: [],
    structural: [],
    timestamp: new Date().toISOString()
  };

  classA.forEach(c => {
    output.critical.push({
      type: 'CLASS_A',
      issue: 'OR-semantic text with AND logic',
      crit: c.crit,
      clause: c.clause,
      clause_id: c.clause_id,
      content_preview: c.content.substring(0, 80),
      logic: c.logic
    });
  });

  classB.forEach(c => {
    output.critical.push({
      type: 'CLASS_B',
      issue: 'AND-semantic text with OR logic',
      crit: c.crit,
      clause: c.clause,
      clause_id: c.clause_id,
      content_preview: c.content.substring(0, 80),
      logic: c.logic
    });
  });

  classC.forEach(item => {
    if (!item.parent) return; // Skip if parent not found

    const runBreakdown = item.runs
      .map(r => `${r.logic}[${r.items.map(i => i.clause).join(',')}]`)
      .join(' ');

    output.structural.push({
      type: 'CLASS_C',
      severity: item.severity,
      crit: item.parent.crit,
      clause: item.parent.clause,
      clause_id: item.parent.clause_id,
      parent_content_preview: item.parent.content.substring(0, 80),
      parent_logic: item.parent.logic,
      runs: runBreakdown,
      proposal: generateTransformationProposal(item)
    });
  });

  console.log(JSON.stringify(output, null, 2));
} else {
  // Human-readable output
  let hasIssues = classA.length > 0 || classB.length > 0;

  if (classA.length > 0) {
    console.error(`CLASS A: Found ${classA.length} criteria with OR-text + AND-logic`);
    console.error('');
    classA.slice(0, 3).forEach(c => {
      console.error(`  ${c.crit} clause ${c.clause}: "${c.content.substring(0, 60)}..."`);
    });
    if (classA.length > 3) {
      console.error(`  ... and ${classA.length - 3} more`);
    }
    console.error('');
  }

  if (classB.length > 0) {
    console.error(`CLASS B: Found ${classB.length} criteria with AND-text + OR-logic`);
    console.error('');
    classB.slice(0, 3).forEach(c => {
      console.error(`  ${c.crit} clause ${c.clause}: "${c.content.substring(0, 60)}..."`);
    });
    if (classB.length > 3) {
      console.error(`  ... and ${classB.length - 3} more`);
    }
    console.error('');
  }

  if (classC.length > 0) {
    const warnCount = classC.filter(c => c.severity === 'WARN').length;
    const infoCount = classC.filter(c => c.severity === 'INFO').length;
    console.log(`CLASS C: Found ${classC.length} mixed-logic sibling groups`);
    if (warnCount > 0) {
      console.log(`  ${warnCount} WARN (parent AND with OR-alternatives)`);
    }
    if (infoCount > 0) {
      console.log(`  ${infoCount} INFO (structural artifacts)`);
    }
    console.log('');

    classC.filter(c => c.severity === 'WARN').slice(0, 2).forEach(item => {
      const runs = item.runs.map(r => `${r.logic}[${r.items.map(i => i.clause).join(',')}]`).join(' ');
      console.log(`  ${item.parent.crit} clause ${item.parent.clause}: ${runs}`);
      const proposal = generateTransformationProposal(item);
      if (proposal) {
        console.log(`    ${proposal.result}`);
      }
    });
    console.log('');
  }

  if (!hasIssues) {
    console.log('Logic consistency check: No critical mismatches found');
  }

  if (hasIssues) {
    console.error('To see detailed report: node validate-logic-consistency.js --json');
  }
}

// Only exit with error for Class A (critical mismatches)
// Class B and C are informational
process.exit(classA.length > 0 ? 1 : 0);
