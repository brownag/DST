#!/usr/bin/env node

/**
 * Logic Consistency Validator
 * Checks for criteria with OR-semantic text but AND logic
 *
 * Usage:
 *   node validate-logic-consistency.js
 *
 * Exit codes:
 *   0 = No mismatches found (all good)
 *   1 = Mismatches found (data needs fixing)
 */

const fs = require('fs');
const path = require('path');

const dataPath = './data/keys_optimized.json';

if (!fs.existsSync(dataPath)) {
  console.error(`Error: ${dataPath} not found`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const criteria = data.navigation.criteria;

// Patterns that indicate OR semantics
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

// Find all mismatches
const mismatches = criteria.filter(c => {
  const hasORText = hasORSemantics(c.content);
  const hasANDLogic = c.logic === 'AND';
  return hasORText && hasANDLogic;
});

if (mismatches.length === 0) {
  console.log('✓ Logic consistency check passed - no mismatches found');
  process.exit(0);
}

console.error(`✗ Found ${mismatches.length} criteria with OR-text + AND-logic:`);
console.error('');

const byLevel = {};
mismatches.forEach(c => {
  const level = c.crit.length;
  if (!byLevel[level]) byLevel[level] = [];
  byLevel[level].push(c);
});

Object.keys(byLevel).sort().forEach(level => {
  const levelName = ['Order', 'Suborder', 'Great Group', 'Subgroup', 'Other'][level - 1] || `Level ${level}`;
  console.error(`  Level ${level} (${levelName}): ${byLevel[level].length}`);
});

console.error('');
console.error('First 5 examples:');
mismatches.slice(0, 5).forEach(c => {
  const content = c.content.substring(0, 60) + (c.content.length > 60 ? '...' : '');
  console.error(`  ${c.crit}: ${content}`);
});

if (mismatches.length > 5) {
  console.error(`  ... and ${mismatches.length - 5} more`);
}

console.error('');
console.error('Please fix these criteria or update the validation patterns.');
process.exit(1);
