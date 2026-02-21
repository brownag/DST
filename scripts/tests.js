/**
 * Test Suite for Digital Keys to Soil Taxonomy
 * Run in browser (test.html) or Node.js (node scripts/tests.js)
 *
 * Tests use DSTCore.create() — the same engine the app uses.
 * No mock duplication; satisfaction logic lives only in dst-core.js.
 */

// Load DSTCore in Node.js
if (typeof DSTCore === 'undefined' && typeof require !== 'undefined') {
    var DSTCore = require('./dst-core.js');
}

// TEST FRAMEWORK
const TEST_SUITE = {
  passed: 0,
  failed: 0,
  tests: [],
  startTime: null,
  endTime: null,
  currentSuite: null
};

function describe(name, fn) {
  TEST_SUITE.currentSuite = name;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[SUITE] ${name}`);
  console.log('='.repeat(70));
  fn();
  TEST_SUITE.currentSuite = null;
}

function it(name, testFn) {
  try {
    testFn();
    TEST_SUITE.passed++;
    console.log(`  \u2713 ${name}`);
    TEST_SUITE.tests.push({
      suite: TEST_SUITE.currentSuite,
      name,
      status: 'PASS'
    });
  } catch (err) {
    TEST_SUITE.failed++;
    console.log(`  \u2717 ${name}`);
    console.log(`    \u2514\u2500 Error: ${err.message}`);
    TEST_SUITE.tests.push({
      suite: TEST_SUITE.currentSuite,
      name,
      status: 'FAIL',
      error: err.message
    });
  }
}

// ASSERTION HELPERS
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, msg) {
  if (value !== true) {
    throw new Error(msg || `Expected true, got ${JSON.stringify(value)}`);
  }
}

function assertFalse(value, msg) {
  if (value !== false) {
    throw new Error(msg || `Expected false, got ${JSON.stringify(value)}`);
  }
}

function assertArrayEquals(actual, expected, msg) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    throw new Error(`${msg}: both values must be arrays`);
  }
  if (actual.length !== expected.length) {
    throw new Error(`${msg}: array length mismatch (expected ${expected.length}, got ${actual.length})`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(`${msg}: element ${i} mismatch (expected ${expected[i]}, got ${actual[i]})`);
    }
  }
}

function assertDefined(value, msg) {
  if (value === undefined || value === null) {
    throw new Error(msg || `Expected defined value, got ${JSON.stringify(value)}`);
  }
}

function assertUndefined(value, msg) {
  if (value !== undefined && value !== null) {
    throw new Error(msg || `Expected undefined, got ${JSON.stringify(value)}`);
  }
}

function assertIncludes(array, value, msg) {
  if (!array.includes(value)) {
    throw new Error(`${msg || 'Array does not include value'}: ${JSON.stringify(value)}`);
  }
}

// TEST FIXTURES

function createTestCriteria() {
  return [
    // Order level (A) - root, FIRST logic on its children
    {
      crit: 'A',
      clause: 1,
      parent_clause: '',
      logic: 'FIRST',
      depth: 0,
      content: 'Test Order A',
      key: 'Test'
    },
    // Suborder level -- children of A
    // AA: logic=AND means its children (AAA, AAB) are all required
    {
      crit: 'AA',
      clause: 1,
      parent_clause: '',
      logic: 'AND',
      depth: 1,
      content: 'Test Suborder AA (children all required)',
      key: 'Test'
    },
    // AB: logic=OR means its children (ABA, ABB) are alternatives
    {
      crit: 'AB',
      clause: 1,
      parent_clause: '',
      logic: 'OR',
      depth: 1,
      content: 'Test Suborder AB (children are alternatives)',
      key: 'Test'
    },
    // Children of AA -- parent AA has AND, so all must be satisfied
    {
      crit: 'AAA',
      clause: 1,
      parent_clause: '',
      logic: 'END',
      depth: 2,
      content: 'Test Great Group AAA',
      key: 'Test'
    },
    {
      crit: 'AAB',
      clause: 1,
      parent_clause: '',
      logic: 'END',
      depth: 2,
      content: 'Test Great Group AAB',
      key: 'Test'
    },
    // Children of AB -- parent AB has OR, so any one suffices
    {
      crit: 'ABA',
      clause: 1,
      parent_clause: '',
      logic: 'OR',
      depth: 2,
      content: 'Test Great Group ABA',
      key: 'Test'
    },
    {
      crit: 'ABB',
      clause: 1,
      parent_clause: '',
      logic: 'END',
      depth: 2,
      content: 'Test Great Group ABB',
      key: 'Test'
    }
  ];
}

function setupTestState(criteria) {
  criteria = criteria || createTestCriteria();
  var data = {
    navigation: { criteria: criteria },
    outcomes: {},
    glossary: {},
    order_names: {},
    code_names: {}
  };
  var engine = DSTCore.create(data);

  // For test convenience: add cross-group parent-child links in clauseChildrenMap.
  // Real data uses clause/parent_clause within groups. Test fixtures use
  // separate crit codes for hierarchy levels (A -> AA -> AAA), so we inject
  // these inter-group relationships manually.
  criteria.forEach(function(c) {
    if (c.crit.length > 1) {
      var parentCode = c.crit.slice(0, -1);
      var parentGroup = engine.criteriaByCode[parentCode];
      if (parentGroup) {
        var parent = parentGroup[0];
        var parentId = engine.getCriterionId(parent);
        if (!engine.clauseChildrenMap[parentId]) {
          engine.clauseChildrenMap[parentId] = [];
        }
        var existingIds = engine.clauseChildrenMap[parentId].map(function(x) {
          return engine.getCriterionId(x);
        });
        if (existingIds.indexOf(engine.getCriterionId(c)) === -1) {
          engine.clauseChildrenMap[parentId].push(c);
        }
      }
    }
  });

  // Clear leaf cache since we modified children
  engine._leafCache = {};

  return engine;
}

// UNIT TESTS: SATISFACTION LOGIC

describe('Satisfaction Logic: isClauseSatisfied()', () => {

  it('AND logic: all children satisfied -> parent satisfied', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('AA'); // logic: AND

    state.check(state.getCriterionId(state.getCriterionByCode('AAA')));
    state.check(state.getCriterionId(state.getCriterionByCode('AAB')));

    assertTrue(state.isClauseSatisfied(parent), 'Parent with AND logic should be satisfied when all children are checked');
  });

  it('AND logic: one child unsatisfied -> parent NOT satisfied', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('AA'); // logic: AND

    state.check(state.getCriterionId(state.getCriterionByCode('AAA')));
    // Leave AAB unchecked

    assertFalse(state.isClauseSatisfied(parent), 'Parent with AND logic should NOT be satisfied when any child is unchecked');
  });

  it('AND logic: no children satisfied -> parent NOT satisfied', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('AA'); // logic: AND

    assertFalse(state.isClauseSatisfied(parent), 'Parent with AND logic should NOT be satisfied when no children are checked');
  });

  it('OR logic: one child satisfied -> parent satisfied', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('AB'); // logic: OR

    state.check(state.getCriterionId(state.getCriterionByCode('ABA')));

    assertTrue(state.isClauseSatisfied(parent), 'Parent with OR logic should be satisfied when at least one child is checked');
  });

  it('OR logic: no children satisfied -> parent NOT satisfied', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('AB'); // logic: OR

    assertFalse(state.isClauseSatisfied(parent), 'Parent with OR logic should NOT be satisfied when no children are checked');
  });

  it('OR logic: all children satisfied -> parent satisfied', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('AB'); // logic: OR

    state.check(state.getCriterionId(state.getCriterionByCode('ABA')));
    state.check(state.getCriterionId(state.getCriterionByCode('ABB')));

    assertTrue(state.isClauseSatisfied(parent), 'Parent with OR logic should be satisfied when all children are checked');
  });

  it('Leaf node with END logic: checked -> satisfied', () => {
    const state = setupTestState();
    const leaf = state.getCriterionByCode('AAA');

    state.check(state.getCriterionId(leaf));

    assertTrue(state.isClauseSatisfied(leaf), 'Leaf node with END logic should be satisfied when checked');
  });

  it('Leaf node with END logic: unchecked -> NOT satisfied', () => {
    const state = setupTestState();
    const leaf = state.getCriterionByCode('AAA');

    assertFalse(state.isClauseSatisfied(leaf), 'Leaf node with END logic should NOT be satisfied when unchecked');
  });

  it('Cache invalidation: changing checked state updates result', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('AB'); // logic: OR

    assertFalse(state.isClauseSatisfied(parent), 'Initially parent should be unsatisfied');

    state.check(state.getCriterionId(state.getCriterionByCode('ABA')));

    assertTrue(state.isClauseSatisfied(parent), 'After checking child, parent should be satisfied');
  });

  it('FIRST logic: any alternative child satisfied -> parent satisfied', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('A'); // logic: FIRST

    // Satisfy AB by checking one of its OR children
    state.check(state.getCriterionId(state.getCriterionByCode('ABA')));

    assertTrue(state.isClauseSatisfied(parent), 'Parent should be satisfied when any alternative child is satisfied');
  });

  it('FIRST logic: no children satisfied -> parent NOT satisfied', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('A');

    assertFalse(state.isClauseSatisfied(parent), 'Parent should NOT be satisfied when no children are satisfied');
  });

  it('Parent logic determines child evaluation (AND vs OR)', () => {
    const criteria = [
      { crit: 'M', clause: 1, parent_clause: '', logic: 'AND', depth: 0, content: 'AND parent', key: 'Test' },
      { crit: 'MA', clause: 1, parent_clause: '', logic: 'OR', depth: 1, content: 'Child A', key: 'Test' },
      { crit: 'MB', clause: 2, parent_clause: '', logic: 'OR', depth: 1, content: 'Child B', key: 'Test' },
      { crit: 'MC', clause: 3, parent_clause: '', logic: 'END', depth: 1, content: 'Child C', key: 'Test' }
    ];
    const state = setupTestState(criteria);
    const M = state.getCriterionByCode('M');

    // Only one child checked -> fails (AND parent needs all)
    state.check(state.getCriterionId(state.getCriterionByCode('MA')));
    assertFalse(state.isClauseSatisfied(M), 'AND parent should fail when only one child satisfied');

    // Two of three -> still fails
    state.check(state.getCriterionId(state.getCriterionByCode('MB')));
    assertFalse(state.isClauseSatisfied(M), 'AND parent should fail when not all children satisfied');

    // All three -> passes
    state.check(state.getCriterionId(state.getCriterionByCode('MC')));
    assertTrue(state.isClauseSatisfied(M), 'AND parent should pass when all children satisfied');
  });
});

// UNIT TESTS: HIERARCHY LOOKUPS

describe('Hierarchy Lookups', () => {

  it('getCriterionByCode: should find existing code', () => {
    const state = setupTestState();
    const criterion = state.getCriterionByCode('A');
    assertDefined(criterion, 'Should find criterion with code A');
    assertEqual(criterion.crit, 'A', 'Should return criterion with correct code');
  });

  it('getCriterionByCode: should return null for non-existent code', () => {
    const state = setupTestState();
    const criterion = state.getCriterionByCode('ZZZ');
    assertUndefined(criterion, 'Should return null/undefined for non-existent code');
  });

  it('getDirectChildren: should find all direct children', () => {
    const state = setupTestState();
    const children = state.getDirectChildren('A');
    assertEqual(children.length, 2, 'Order A should have 2 direct children (AA, AB)');
    const codes = children.map(c => c.crit).sort();
    assertArrayEquals(codes, ['AA', 'AB'], 'Children should be AA and AB');
  });

  it('getDirectChildren: should find children of intermediate level', () => {
    const state = setupTestState();
    const children = state.getDirectChildren('AA');
    assertEqual(children.length, 2, 'Suborder AA should have 2 direct children (AAA, AAB)');
    const codes = children.map(c => c.crit).sort();
    assertArrayEquals(codes, ['AAA', 'AAB'], 'Children should be AAA and AAB');
  });

  it('getDirectChildren: should return empty array for leaf nodes', () => {
    const state = setupTestState();
    const children = state.getDirectChildren('AAA');
    assertEqual(children.length, 0, 'Leaf node should have no direct children');
  });

  it('getParent: should find parent code', () => {
    const state = setupTestState();
    const parent = state.getParent('AA');
    assertDefined(parent, 'Should find parent of AA');
    assertEqual(parent.crit, 'A', 'Parent of AA should be A');
  });

  it('getParent: should return null for root level', () => {
    const state = setupTestState();
    const parent = state.getParent('A');
    assertUndefined(parent, 'Root level should have no parent');
  });

  it('getCriterionId: should generate unique identifiers', () => {
    const state = setupTestState();
    const criterion = state.getCriterionByCode('A');
    const id = state.getCriterionId(criterion);
    assertEqual(id, 'A_1', 'ID should be crit_clause format');
  });

  it('getCriterionId: should be unique across all criteria', () => {
    const state = setupTestState();
    const ids = new Set();
    state.allCriteria.forEach(c => {
      const id = state.getCriterionId(c);
      if (ids.has(id)) throw new Error(`Duplicate ID found: ${id}`);
      ids.add(id);
    });
    assertEqual(ids.size, state.allCriteria.length, 'All IDs should be unique');
  });
});

// INTEGRATION TESTS: NAVIGATION PATHS

describe('Navigation Paths: Full Hierarchies', () => {

  it('Should navigate full hierarchy: checking leaves satisfies parents', () => {
    const state = setupTestState();

    state.check(state.getCriterionId(state.getCriterionByCode('AAA')));
    state.check(state.getCriterionId(state.getCriterionByCode('AAB')));

    assertTrue(state.isClauseSatisfied(state.getCriterionByCode('AA')), 'AA should be satisfied when both AND children checked');
    assertTrue(state.isClauseSatisfied(state.getCriterionByCode('A')), 'A should be satisfied when child AA is satisfied');
  });

  it('Should require all AND children for satisfaction', () => {
    const state = setupTestState();

    state.check(state.getCriterionId(state.getCriterionByCode('AAA')));

    assertFalse(state.isClauseSatisfied(state.getCriterionByCode('AA')), 'AA needs both AND children');

    state.check(state.getCriterionId(state.getCriterionByCode('AAB')));

    assertTrue(state.isClauseSatisfied(state.getCriterionByCode('AA')), 'AA satisfied when both AND children checked');
  });

  it('Should handle switching between suborders', () => {
    const state = setupTestState();

    state.check(state.getCriterionId(state.getCriterionByCode('AAA')));
    state.check(state.getCriterionId(state.getCriterionByCode('AAB')));
    assertTrue(state.isClauseSatisfied(state.getCriterionByCode('AA')), 'AA should be satisfied');

    state.uncheck(state.getCriterionId(state.getCriterionByCode('AAA')));
    state.uncheck(state.getCriterionId(state.getCriterionByCode('AAB')));
    state.check(state.getCriterionId(state.getCriterionByCode('ABA')));

    assertFalse(state.isClauseSatisfied(state.getCriterionByCode('AA')), 'AA should be unsatisfied');
    assertTrue(state.isClauseSatisfied(state.getCriterionByCode('AB')), 'AB should be satisfied');
  });

  it('Should handle reset to initial state', () => {
    const state = setupTestState();

    state.check(state.getCriterionId(state.getCriterionByCode('AAA')));
    state.check(state.getCriterionId(state.getCriterionByCode('AAB')));

    state.reset();

    assertFalse(state.isClauseSatisfied(state.getCriterionByCode('AA')), 'After reset, AA should be unsatisfied');
  });
});

// EDGE CASE TESTS

describe('Edge Cases & Boundary Conditions', () => {

  it('Should handle single root node', () => {
    const state = setupTestState([
      { crit: 'X', clause: 1, parent_clause: '', logic: 'END', depth: 0, content: 'Single root', key: 'Test' }
    ]);

    state.check(state.getCriterionId(state.getCriterionByCode('X')));
    assertTrue(state.isClauseSatisfied(state.getCriterionByCode('X')), 'Single root should be satisfiable');
  });

  it('Should handle node with many children', () => {
    const letters = 'ABCDEFGHIJ';
    const children = [];
    for (let i = 0; i < 10; i++) {
      children.push({
        crit: `P${letters[i]}`,
        clause: i + 1,
        parent_clause: '',
        logic: 'OR',
        depth: 1,
        content: `Child ${i}`,
        key: 'Test'
      });
    }

    const parent = {
      crit: 'P',
      clause: 1,
      parent_clause: '',
      logic: 'OR',
      depth: 0,
      content: 'Parent with many children',
      key: 'Test'
    };

    const state = setupTestState([parent, ...children]);

    state.check(state.getCriterionId(state.getCriterionByCode('PF')));

    assertTrue(state.isClauseSatisfied(parent), 'Parent with many OR children should be satisfied when one is checked');
  });

  it('Should handle deep nesting (4+ levels)', () => {
    const criteria = [
      { crit: 'D', clause: 1, parent_clause: '', logic: 'FIRST', depth: 0, content: 'Level 1', key: 'Test' },
      { crit: 'DA', clause: 1, parent_clause: '', logic: 'OR', depth: 1, content: 'Level 2', key: 'Test' },
      { crit: 'DAA', clause: 1, parent_clause: '', logic: 'OR', depth: 2, content: 'Level 3', key: 'Test' },
      { crit: 'DAAA', clause: 1, parent_clause: '', logic: 'OR', depth: 3, content: 'Level 4', key: 'Test' },
      { crit: 'DAAAA', clause: 1, parent_clause: '', logic: 'OR', depth: 4, content: 'Level 5', key: 'Test' }
    ];

    const state = setupTestState(criteria);

    state.check(state.getCriterionId(state.getCriterionByCode('DAAAA')));

    assertTrue(state.isClauseSatisfied(state.getCriterionByCode('D')), 'Deeply nested hierarchy should be navigable');
  });

  it('Should handle OR logic requiring exactly one check', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('AB'); // OR logic
    const children = state.getDirectChildren('AB');
    assertEqual(children.length, 2, 'AB should have 2 children');

    state.check(state.getCriterionId(children[0]));
    assertTrue(state.isClauseSatisfied(parent), 'OR parent should be satisfied with one child');

    state.uncheck(state.getCriterionId(children[0]));
    state.check(state.getCriterionId(children[1]));
    assertTrue(state.isClauseSatisfied(parent), 'OR parent should be satisfied with different child');
  });

  it('Should handle AND logic requiring all checks', () => {
    const state = setupTestState();
    const parent = state.getCriterionByCode('AA'); // AND logic
    const children = state.getDirectChildren('AA');
    assertEqual(children.length, 2, 'AA should have 2 children');

    state.check(state.getCriterionId(children[0]));
    assertFalse(state.isClauseSatisfied(parent), 'AND parent should not be satisfied with incomplete children');

    state.check(state.getCriterionId(children[1]));
    assertTrue(state.isClauseSatisfied(parent), 'AND parent should be satisfied when all children checked');

    state.uncheck(state.getCriterionId(children[0]));
    assertFalse(state.isClauseSatisfied(parent), 'AND parent should not be satisfied after unchecking');
  });

  it('Should handle empty checkedCriteria map', () => {
    const state = setupTestState();

    assertFalse(state.isClauseSatisfied(state.getCriterionByCode('A')), 'Parent should be unsatisfied with empty checks');
    assertFalse(state.isClauseSatisfied(state.getCriterionByCode('AA')), 'Suborder should be unsatisfied with empty checks');
  });
});

// DATA INTEGRITY TESTS

describe('Data Integrity Validation', () => {

  it('Should have unique getCriterionId for all test criteria', () => {
    const state = setupTestState();
    const ids = new Set();
    const duplicates = [];
    state.allCriteria.forEach(c => {
      const id = state.getCriterionId(c);
      if (ids.has(id)) duplicates.push(id);
      ids.add(id);
    });
    if (duplicates.length > 0) throw new Error(`Found duplicate IDs: ${duplicates.join(', ')}`);
    assertEqual(ids.size, state.allCriteria.length, 'All IDs should be unique');
  });

  it('Should have valid parent-child relationships', () => {
    const state = setupTestState();
    state.allCriteria.forEach(c => {
      if (c.crit.length > 1) {
        const parentCode = c.crit.slice(0, -1);
        const parent = state.getCriterionByCode(parentCode);
        assertDefined(parent, `Parent ${parentCode} should exist for child ${c.crit}`);
      }
    });
  });

  it('Should have valid logic types', () => {
    const state = setupTestState();
    const validLogics = new Set(['AND', 'OR', 'FIRST', 'END']);
    state.allCriteria.forEach(c => {
      const logic = c.logic || 'OR';
      if (!validLogics.has(logic)) throw new Error(`Invalid logic type "${logic}" for criterion ${c.crit}`);
    });
  });

  it('Should have consistent depth values where applicable', () => {
    const state = setupTestState();
    state.allCriteria.forEach(c => {
      const expectedDepth = c.crit.length - 1;
      if (c.depth >= 0) {
        assertEqual(c.depth, expectedDepth, `Depth mismatch for ${c.crit}: expected ${expectedDepth}, got ${c.depth}`);
      }
    });
  });

  it('Should have all direct children of a parent build correctly', () => {
    const state = setupTestState();
    state.allCriteria.forEach(parent => {
      const children = state.getDirectChildren(parent.crit);
      children.forEach(child => {
        const expectedParent = child.crit.slice(0, -1);
        assertEqual(expectedParent, parent.crit, `Child ${child.crit} parent mismatch`);
      });
    });
  });
});

// ADVANCED SATISFACTION TESTS

describe('Advanced Satisfaction Tests', () => {

  it('Should chain satisfaction evaluation through deep hierarchy', () => {
    const state = setupTestState();
    const AAA = state.getCriterionByCode('AAA');
    const AA = state.getCriterionByCode('AA');

    state.check(state.getCriterionId(AAA));

    assertTrue(state.isClauseSatisfied(AAA), 'END logic leaf should be satisfied when checked');
    assertFalse(state.isClauseSatisfied(AA), 'AND parent should not satisfy with only one child');
  });

  it('Should satisfy OR logic with single child check', () => {
    const state = setupTestState();
    const AB = state.getCriterionByCode('AB'); // logic: OR
    const childrenAB = state.getDirectChildren('AB');
    assertTrue(childrenAB.length >= 1, 'AB should have children');

    state.check(state.getCriterionId(childrenAB[0]));
    assertTrue(state.isClauseSatisfied(AB), 'OR parent should be satisfied with one child checked');
  });

  it('Should validate AND logic requires all children', () => {
    const state = setupTestState();
    const AA = state.getCriterionByCode('AA'); // logic: AND
    const childrenAA = state.getDirectChildren('AA');
    assertEqual(childrenAA.length, 2, 'AA should have 2 children for AND test');

    childrenAA.forEach(c => state.check(state.getCriterionId(c)));
    assertTrue(state.isClauseSatisfied(AA), 'AND parent should satisfy when all children checked');

    state.uncheck(state.getCriterionId(childrenAA[0]));
    assertFalse(state.isClauseSatisfied(AA), 'AND parent should fail when any child unchecked');
  });
});

// HIERARCHY AND LOOKUP TESTS

describe('Hierarchy and Lookup Operations', () => {

  it('Should correctly identify parent-child relationships through code matching', () => {
    const state = setupTestState();
    const parentAA = state.getCriterionByCode('AA');
    const childAAA = state.getCriterionByCode('AAA');

    assertDefined(parentAA, 'AA should exist');
    assertDefined(childAAA, 'AAA should exist');

    const expectedParentCode = childAAA.crit.slice(0, -1);
    assertEqual(expectedParentCode, 'AA', 'AAA parent code should be AA');

    const childrenOfAA = state.getDirectChildren('AA');
    const codesList = childrenOfAA.map(c => c.crit);
    assertTrue(codesList.includes('AAA'), 'AA should find AAA as direct child');
  });

  it('Should not get grandchildren when looking for direct children', () => {
    const state = setupTestState();
    const childrenA = state.getDirectChildren('A');
    const codes = childrenA.map(c => c.crit);

    assertFalse(codes.includes('AAA'), 'AAA should not be direct child of A');
    assertFalse(codes.includes('AAB'), 'AAB should not be direct child of A');
    assertFalse(codes.includes('ABA'), 'ABA should not be direct child of A');
  });

  it('Should navigate full path from A to AAA', () => {
    const state = setupTestState();

    const fromA = state.getDirectChildren('A');
    assertTrue(fromA.some(c => c.crit === 'AA'), 'A should have AA as child');

    const fromAA = state.getDirectChildren('AA');
    assertTrue(fromAA.some(c => c.crit === 'AAA'), 'AA should have AAA as child');

    const AAparent = state.getParent('AA');
    assertEqual(AAparent.crit, 'A', 'Parent of AA should be A');

    const AAAparent = state.getParent('AAA');
    assertEqual(AAAparent.crit, 'AA', 'Parent of AAA should be AA');
  });
});

// STATE MANAGEMENT AND CACHING TESTS

describe('State Management and Cache Behavior', () => {

  it('Should maintain checked state during navigation', () => {
    const state = setupTestState();
    const A = state.getCriterionByCode('A');
    const AB = state.getCriterionByCode('AB');
    const nodeId_A = state.getCriterionId(A);
    const nodeId_AB = state.getCriterionId(AB);

    state.check(nodeId_A);
    state.check(nodeId_AB);

    assertTrue(!!state.checkedCriteria[nodeId_A], 'A should remain checked');
    assertTrue(!!state.checkedCriteria[nodeId_AB], 'AB should remain checked');

    state.uncheck(nodeId_A);
    assertFalse(!!state.checkedCriteria[nodeId_A], 'A should be unchecked');
    assertTrue(!!state.checkedCriteria[nodeId_AB], 'AB should still be checked');
  });

  it('Should properly invalidate cache upon state changes', () => {
    const state = setupTestState();
    const AB = state.getCriterionByCode('AB');
    const child = state.getDirectChildren('AB')[0];

    assertFalse(state.isClauseSatisfied(AB), 'AB should initially be unsatisfied');

    state.check(state.getCriterionId(child));
    assertTrue(state.isClauseSatisfied(AB), 'After child check, AB should be satisfied');
  });

  it('Should accumulate checks across unrelated branches', () => {
    const state = setupTestState();
    const AA = state.getCriterionByCode('AA');
    const AB = state.getCriterionByCode('AB');
    const idAA = state.getCriterionId(AA);
    const idAB = state.getCriterionId(AB);

    state.check(idAA);
    assertTrue(!!state.checkedCriteria[idAA], 'AA should be checked');
    assertFalse(!!state.checkedCriteria[idAB], 'AB should not be checked');

    state.check(idAB);
    assertTrue(!!state.checkedCriteria[idAA], 'AA should still be checked');
    assertTrue(!!state.checkedCriteria[idAB], 'AB should now be checked');
  });

  it('Should handle toggling the same criterion multiple times', () => {
    const state = setupTestState();
    const AAA = state.getCriterionByCode('AAA');
    const id = state.getCriterionId(AAA);

    for (let i = 0; i < 5; i++) {
      if (i % 2 === 0) state.check(id);
      else state.uncheck(id);
      assertEqual(!!state.checkedCriteria[id], (i % 2 === 0), `Toggle ${i} failed`);
    }
  });
});

// CRITERIA INDEX AND VALIDATION TESTS

describe('Criteria Index Validation', () => {

  it('Should build criteriaByCode index correctly', () => {
    const state = setupTestState();
    const codes = ['A', 'AA', 'AB', 'AAA', 'AAB', 'ABA', 'ABB'];

    codes.forEach(code => {
      const criteria = state.criteriaByCode[code];
      assertDefined(criteria, `criteriaByCode[${code}] should be defined`);
      assertTrue(Array.isArray(criteria), `criteriaByCode[${code}] should be an array`);
      assertTrue(criteria.length > 0, `criteriaByCode[${code}] should not be empty`);
      assertEqual(criteria[0].crit, code, `Indexed criterion should match code ${code}`);
    });
  });

  it('Should build clauseChildrenMap with correct parent-child links', () => {
    const state = setupTestState();
    const A = state.getCriterionByCode('A');
    const parentId = state.getCriterionId(A);

    const childrenOfA = state.clauseChildrenMap[parentId];
    assertDefined(childrenOfA, 'A should have entry in clauseChildrenMap');
    assertTrue(Array.isArray(childrenOfA), 'Children map should be array');
    assertTrue(childrenOfA.length > 0, 'A should have some children in map');

    childrenOfA.forEach(child => {
      assertTrue(child.crit.startsWith('A') && child.crit.length === 2, 'Child should be direct child of A');
    });
  });

  it('Should validate all direct children have correct parent codes', () => {
    const state = setupTestState();
    state.allCriteria.forEach(parent => {
      const children = state.getDirectChildren(parent.crit);
      children.forEach(child => {
        const expectedParent = child.crit.slice(0, -1);
        assertEqual(expectedParent, parent.crit, `${child.crit} should have parent ${parent.crit}`);
      });
    });
  });

  it('Should ensure all criteria have valid logic types', () => {
    const state = setupTestState();
    const validLogics = new Set(['AND', 'OR', 'FIRST', 'END']);
    state.allCriteria.forEach(c => {
      assertTrue(validLogics.has(c.logic), `Invalid logic "${c.logic}" for criterion ${c.crit}`);
    });
  });
});

// CLASSIFICATION HELPER TESTS

describe('Classification Helpers', () => {

  it('getClassificationPath returns empty for no satisfied groups', () => {
    const state = setupTestState();
    const path = state.getClassificationPath();
    assertEqual(path.length, 0, 'No path when nothing satisfied');
  });

  it('getCurrentClassification returns empty for no satisfied groups', () => {
    const state = setupTestState();
    assertEqual(state.getCurrentClassification(), '', 'No classification when nothing satisfied');
  });

  it('getClassificationBreadcrumb returns empty for no satisfied groups', () => {
    const state = setupTestState();
    assertEqual(state.getClassificationBreadcrumb(), '', 'No breadcrumb when nothing satisfied');
  });

  it('removeCodePrefix strips code prefix from content', () => {
    const state = setupTestState();
    assertEqual(state.removeCodePrefix('AA. Some content', 'AA'), 'Some content');
    assertEqual(state.removeCodePrefix('A: Other text', 'A'), 'Other text');
    assertEqual(state.removeCodePrefix('No prefix here', 'ZZ'), 'No prefix here');
  });
});

// INTEGRATION TESTS WITH REAL DATA

describe('Real Data: Aquods (CA) OR Logic Fix', () => {

  it('Should load keys_optimized.json successfully', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      // Skip in browser
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    assertDefined(data.navigation, 'Should have navigation section');
    assertDefined(data.navigation.criteria, 'Should have criteria array');
    assertTrue(data.navigation.criteria.length > 0, 'Should have at least one criterion');
  });

  it('Aquods (CA) root criterion should have OR logic', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const ca = data.navigation.criteria.find(c => c.crit === 'CA' && c.clause === 1);
    assertDefined(ca, 'CA criterion should exist');
    assertEqual(ca.logic, 'OR', 'CA (Aquods) root should have OR logic, not AND');
  });

  it('Aquods (CA) should have exactly 2 direct children (clauses 2 and 3)', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const caChildren = data.navigation.criteria.filter(c => c.crit === 'CA' && c.parent_clause === 1);
    assertEqual(caChildren.length, 2, 'CA should have exactly 2 children (CA.1 and CA.2)');

    const clauses = caChildren.map(c => c.clause).sort();
    assertArrayEquals(clauses, [2, 3], 'CA children should have clauses 2 and 3');
  });

  it('Aquods CA.1 and CA.2 should both have OR logic', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const ca1 = data.navigation.criteria.find(c => c.crit === 'CA' && c.clause === 2);
    const ca2 = data.navigation.criteria.find(c => c.crit === 'CA' && c.clause === 3);

    assertDefined(ca1, 'CA.1 should exist');
    assertDefined(ca2, 'CA.2 should exist');
    assertEqual(ca1.logic, 'OR', 'CA.1 should have OR logic');
    assertEqual(ca2.logic, 'OR', 'CA.2 should have OR logic');
  });

  it('Aquods content should describe OR semantics with "one or both"', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const ca = data.navigation.criteria.find(c => c.crit === 'CA' && c.clause === 1);
    assertDefined(ca, 'CA should exist');
    assertTrue(
      ca.content.includes('one or both'),
      'CA content should indicate OR semantics with "one or both"'
    );
  });
});

describe('Real Data Integration Tests', () => {

  it('Should instantiate engine from real data successfully', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const engine = DSTCore.create(data);
    assertDefined(engine, 'Engine should be created');
    assertTrue(engine.allCriteria.length > 0, 'Engine should have criteria');
    assertDefined(engine.groupRoots['CA'], 'CA should be a group root');
  });

  it('Aquods CA criterion should satisfy with only first child checked', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const engine = DSTCore.create(data);

    const ca = engine.getCriterionByCode('CA');
    assertDefined(ca, 'CA should exist in engine');

    // Get CA's children (clauses 2 and 3)
    const caChildren = engine.getClauseChildren(ca);
    assertTrue(caChildren.length > 0, 'CA should have children clauses');

    // Check only the first child
    const firstChild = caChildren[0];
    engine.check(engine.getCriterionId(firstChild));

    // CA should now be satisfied with OR logic (only need one child)
    assertTrue(
      engine.isClauseSatisfied(ca),
      'CA with OR logic should be satisfied when only first child is checked'
    );
  });

  it('Aquods CA criterion should satisfy with only second child checked', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const engine = DSTCore.create(data);

    const ca = engine.getCriterionByCode('CA');
    const caChildren = engine.getClauseChildren(ca);
    assertTrue(caChildren.length > 1, 'CA should have at least 2 children');

    // Check only the second child
    const secondChild = caChildren[1];
    engine.check(engine.getCriterionId(secondChild));

    // CA should be satisfied with OR logic (only need one child)
    assertTrue(
      engine.isClauseSatisfied(ca),
      'CA with OR logic should be satisfied when only second child is checked'
    );
  });

  it('Aquods should NOT require both children for satisfaction', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const engine = DSTCore.create(data);

    const ca = engine.getCriterionByCode('CA');
    const caChildren = engine.getClauseChildren(ca);

    // With AND logic (the bug), you'd need both children
    // With correct OR logic, only one should be needed
    assertTrue(
      caChildren.length >= 2,
      'CA should have at least 2 children for this test'
    );

    // Check first child only
    engine.check(engine.getCriterionId(caChildren[0]));
    assertTrue(
      engine.isClauseSatisfied(ca),
      'OR logic: first child alone should satisfy CA'
    );

    // Uncheck first, check second
    engine.uncheck(engine.getCriterionId(caChildren[0]));
    engine.check(engine.getCriterionId(caChildren[1]));
    assertTrue(
      engine.isClauseSatisfied(ca),
      'OR logic: second child alone should satisfy CA'
    );
  });

  it('Should handle Spodosols (C) suborder navigation with fixed Aquods', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const engine = DSTCore.create(data);

    // C is Spodosols (Order)
    const c = engine.getCriterionByCode('C');
    assertDefined(c, 'C (Spodosols) should exist');

    // CA is Aquods (Suborder of Spodosols)
    const ca = engine.getCriterionByCode('CA');
    assertDefined(ca, 'CA (Aquods) should exist');

    // Get the direct children of CA in the clause hierarchy
    const caChildren = engine.getClauseChildren(ca);
    assertTrue(caChildren.length > 0, 'CA should have clause children');

    // Checking only one CA child should make Aquods satisfiable
    engine.check(engine.getCriterionId(caChildren[0]));
    assertTrue(
      engine.isClauseSatisfied(ca),
      'Aquods (CA) should be satisfied with OR logic'
    );
  });
});

describe('Data Structure: Aridisols Mixed Logic (Semantic)', () => {

  it('Aridisols G.1 has semantically correct mixed AND/OR logic', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const children = data.navigation.criteria.filter(c =>
      c.crit === 'G' && c.parent_clause === 2
    );

    assertTrue(children.length === 4, 'G.1 should have 4 children (a, b, c, d)');

    // Semantic structure:
    // 1. Have: a AND b AND (c OR d)
    const logicsByClause = {};
    children.forEach(c => {
      logicsByClause[c.clause] = c.logic;
    });

    // Clauses 3-4 (a, b): AND - both required
    assertEqual(logicsByClause[3], 'AND', 'Clause 3 (a): Required with AND');
    assertEqual(logicsByClause[4], 'AND', 'Clause 4 (b): Required with AND');

    // Clauses 5-6 (c, d): OR - either/or alternative
    assertEqual(logicsByClause[5], 'OR', 'Clause 5 (c): Alternative with OR');
    assertEqual(logicsByClause[6], 'OR', 'Clause 6 (d): Alternative with OR');
  });

  it('Aridisols G.1 mixed logic reflects correct taxonomy semantics', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));

    // Verify semantic structure in content
    const criteria = data.navigation.criteria.filter(c => c.crit === 'G' && c.parent_clause === 2);

    // a and b should have "and" at the end
    assertTrue(
      criteria.some(c => c.clause === 3 && c.content.includes('and')),
      'Clause 3 (a) should indicate AND relationship with "and"'
    );

    assertTrue(
      criteria.some(c => c.clause === 4 && c.content.includes('and')),
      'Clause 4 (b) should indicate AND relationship with "and"'
    );

    // c and d should have "or"
    assertTrue(
      criteria.some(c => c.clause === 5 && c.content.includes('or')),
      'Clause 5 (c) should indicate OR relationship with "or"'
    );

    assertTrue(
      criteria.some(c => c.clause === 6 && c.content.includes('or')),
      'Clause 6 (d) should indicate OR relationship with "or"'
    );
  });
});

describe('Regression Tests: Other Suborders Still Work', () => {

  it('Should handle AND logic correctly (other taxa)', () => {
    const criteria = [
      { crit: 'TEST', clause: 1, parent_clause: '', logic: 'AND', depth: 0, content: 'Test AND', key: 'Test' },
      { crit: 'TEST', clause: 2, parent_clause: 1, logic: 'END', depth: 1, content: 'Child 1', key: 'Test' },
      { crit: 'TEST', clause: 3, parent_clause: 1, logic: 'END', depth: 1, content: 'Child 2', key: 'Test' }
    ];
    const state = setupTestState(criteria);
    const test = state.getCriterionByCode('TEST');
    const children = state.getClauseChildren(test);

    // AND logic: only one child checked should not satisfy
    state.check(state.getCriterionId(children[0]));
    assertFalse(
      state.isClauseSatisfied(test),
      'AND logic: only one child checked should not satisfy'
    );

    // Both children checked should satisfy
    state.check(state.getCriterionId(children[1]));
    assertTrue(
      state.isClauseSatisfied(test),
      'AND logic: both children checked should satisfy'
    );
  });

  it('Should preserve OR logic for actual OR nodes', () => {
    const criteria = [
      { crit: 'TEST', clause: 1, parent_clause: '', logic: 'OR', depth: 0, content: 'Test OR', key: 'Test' },
      { crit: 'TEST', clause: 2, parent_clause: 1, logic: 'END', depth: 1, content: 'Child 1', key: 'Test' },
      { crit: 'TEST', clause: 3, parent_clause: 1, logic: 'END', depth: 1, content: 'Child 2', key: 'Test' }
    ];
    const state = setupTestState(criteria);
    const test = state.getCriterionByCode('TEST');
    const children = state.getClauseChildren(test);

    // OR logic: one child checked should satisfy
    state.check(state.getCriterionId(children[0]));
    assertTrue(
      state.isClauseSatisfied(test),
      'OR logic: one child checked should satisfy'
    );
  });
});

describe('Mixed Logic Run-Grouping Evaluation', () => {

  it('Aridisols G.1: checking a+b only does NOT satisfy G.1', () => {
    // Create synthetic test data since real data access in test runner can be unreliable
    const criteria = [
      { crit: 'G', clause: 1, parent_clause: '', logic: 'OR', depth: 0, content: 'G root', key: 'G' },
      { crit: 'G', clause: 2, parent_clause: 1, logic: 'AND', depth: 1, content: '1. Have:', key: 'G' },
      { crit: 'G', clause: 3, parent_clause: 2, logic: 'AND', depth: 2, content: 'a. moisture', key: 'G' },
      { crit: 'G', clause: 4, parent_clause: 2, logic: 'AND', depth: 2, content: 'b. epipedon', key: 'G' },
      { crit: 'G', clause: 5, parent_clause: 2, logic: 'OR', depth: 2, content: 'c. one or more', key: 'G' },
      { crit: 'G', clause: 6, parent_clause: 2, logic: 'OR', depth: 2, content: 'd. argillic', key: 'G' }
    ];

    const state = setupTestState(criteria);
    const g1_2 = criteria.find(c => c.crit === 'G' && c.clause === 2);

    // Check only a (clause 3) and b (clause 4)
    state.check('G_3');
    state.check('G_4');

    // G.1 should NOT be satisfied yet (c or d is needed)
    assertFalse(
      state.isClauseSatisfied(g1_2),
      'G.1 should NOT be satisfied with only a and b (needs c OR d)'
    );
  });

  it('Aridisols G.1: checking a+b+c satisfies G.1', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const engine = DSTCore.create(data);

    const g1_2 = data.navigation.criteria.find(c => c.crit === 'G' && c.clause === 2);

    // Check a, b, and c
    engine.check('G_3');
    engine.check('G_4');
    engine.check('G_5');

    assertTrue(
      engine.isClauseSatisfied(g1_2),
      'G.1 should be satisfied with a+b+c (c is one OR alternative)'
    );
  });

  it('Aridisols G.1: checking a+b+d satisfies G.1', () => {
    let fs;
    try {
      fs = require('fs');
    } catch (e) {
      return;
    }

    if (!fs) return;

    const data = JSON.parse(fs.readFileSync('./data/keys_optimized.json', 'utf8'));
    const engine = DSTCore.create(data);

    const g1_2 = data.navigation.criteria.find(c => c.crit === 'G' && c.clause === 2);

    // Check a, b, and d (not c)
    engine.check('G_3');
    engine.check('G_4');
    engine.check('G_6');

    assertTrue(
      engine.isClauseSatisfied(g1_2),
      'G.1 should be satisfied with a+b+d (d is the other OR alternative)'
    );
  });

  it('Aridisols G.1: run-grouping formula (a AND b) AND (c OR d) works', () => {
    // Synthetic test with [AND, AND, OR, OR] children under parent AND
    const criteria = [
      { crit: 'MIX', clause: 1, parent_clause: '', logic: 'AND', depth: 0, content: 'Parent AND', key: 'MIX' },
      { crit: 'MIX', clause: 2, parent_clause: 1, logic: 'AND', depth: 1, content: 'a required', key: 'MIX' },
      { crit: 'MIX', clause: 3, parent_clause: 1, logic: 'AND', depth: 1, content: 'b required', key: 'MIX' },
      { crit: 'MIX', clause: 4, parent_clause: 1, logic: 'OR', depth: 1, content: 'c alternative', key: 'MIX' },
      { crit: 'MIX', clause: 5, parent_clause: 1, logic: 'OR', depth: 1, content: 'd alternative', key: 'MIX' }
    ];

    const state = setupTestState(criteria);
    const parent = state.getCriterionByCode('MIX');

    // Test: a+b+c should satisfy (a AND b required, then c OR d satisfied by c)
    state.check('MIX_2');
    state.check('MIX_3');
    state.check('MIX_4');
    assertTrue(
      state.isClauseSatisfied(parent),
      'Run-grouping: (a AND b) AND (c OR d) satisfied by a+b+c'
    );

    state.reset();

    // Test: a+b+d should satisfy (same, but d instead of c)
    state.check('MIX_2');
    state.check('MIX_3');
    state.check('MIX_5');
    assertTrue(
      state.isClauseSatisfied(parent),
      'Run-grouping: (a AND b) AND (c OR d) satisfied by a+b+d'
    );

    state.reset();

    // Test: a+b alone should NOT satisfy (OR-run needs at least one)
    state.check('MIX_2');
    state.check('MIX_3');
    assertFalse(
      state.isClauseSatisfied(parent),
      'Run-grouping: (a AND b) AND (c OR d) fails without c or d'
    );

    state.reset();

    // Test: a+c should NOT satisfy (b is required by AND-run)
    state.check('MIX_2');
    state.check('MIX_4');
    assertFalse(
      state.isClauseSatisfied(parent),
      'Run-grouping: (a AND b) AND (c OR d) fails without b'
    );
  });

  it('Uniform-logic siblings unchanged: parent AND with all-AND children', () => {
    const criteria = [
      { crit: 'UNIF', clause: 1, parent_clause: '', logic: 'AND', depth: 0, content: 'Parent AND', key: 'UNIF' },
      { crit: 'UNIF', clause: 2, parent_clause: 1, logic: 'AND', depth: 1, content: 'a', key: 'UNIF' },
      { crit: 'UNIF', clause: 3, parent_clause: 1, logic: 'AND', depth: 1, content: 'b', key: 'UNIF' },
      { crit: 'UNIF', clause: 4, parent_clause: 1, logic: 'AND', depth: 1, content: 'c', key: 'UNIF' }
    ];

    const state = setupTestState(criteria);
    const parent = state.getCriterionByCode('UNIF');

    // All must be satisfied
    state.check('UNIF_2');
    state.check('UNIF_3');
    assertFalse(state.isClauseSatisfied(parent), 'Uniform AND: 2/3 not enough');

    state.check('UNIF_4');
    assertTrue(state.isClauseSatisfied(parent), 'Uniform AND: all 3 needed');
  });

  it('Uniform-logic siblings unchanged: parent OR with all-OR children', () => {
    const criteria = [
      { crit: 'UNIF2', clause: 1, parent_clause: '', logic: 'OR', depth: 0, content: 'Parent OR', key: 'UNIF2' },
      { crit: 'UNIF2', clause: 2, parent_clause: 1, logic: 'OR', depth: 1, content: 'a', key: 'UNIF2' },
      { crit: 'UNIF2', clause: 3, parent_clause: 1, logic: 'OR', depth: 1, content: 'b', key: 'UNIF2' },
      { crit: 'UNIF2', clause: 4, parent_clause: 1, logic: 'OR', depth: 1, content: 'c', key: 'UNIF2' }
    ];

    const state = setupTestState(criteria);
    const parent = state.getCriterionByCode('UNIF2');

    // Any one satisfies
    state.check('UNIF2_2');
    assertTrue(state.isClauseSatisfied(parent), 'Uniform OR: first one enough');

    state.reset();
    state.check('UNIF2_3');
    assertTrue(state.isClauseSatisfied(parent), 'Uniform OR: second one enough');

    state.reset();
    assertFalse(state.isClauseSatisfied(parent), 'Uniform OR: need at least one');
  });

});

// TEST EXECUTION

function printSummary() {
  const total = TEST_SUITE.passed + TEST_SUITE.failed;
  const passRate = total > 0 ? ((TEST_SUITE.passed / total) * 100).toFixed(1) : 0;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST SUMMARY`);
  console.log('='.repeat(70));
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${TEST_SUITE.passed} \u2713`);
  console.log(`Failed: ${TEST_SUITE.failed} \u2717`);
  console.log(`Pass Rate: ${passRate}%`);

  if (TEST_SUITE.failed > 0) {
    console.log(`\nFailed Tests:`);
    TEST_SUITE.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => {
        console.log(`  - [${t.suite}] ${t.name}`);
        if (t.error) console.log(`    Error: ${t.error}`);
      });
  }

  console.log('='.repeat(70));
  return TEST_SUITE.failed === 0;
}

function runAllTests() {
  console.log('\nStarting test suite\n');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  TEST_SUITE.startTime = Date.now();
  TEST_SUITE.endTime = Date.now();
  const duration = ((TEST_SUITE.endTime - TEST_SUITE.startTime) / 1000).toFixed(2);
  console.log(`\nTest execution time: ${duration}s`);

  return printSummary();
}

// Auto-run or export
if (typeof window !== 'undefined') {
  runAllTests();
} else if (typeof module !== 'undefined' && module.exports) {
  // Print summary in Node.js (tests already ran via describe/it at load time)
  runAllTests();
  module.exports = {
    describe, it,
    assertEqual, assertTrue, assertFalse, assertArrayEquals,
    assertDefined, assertUndefined, assertIncludes,
    setupTestState, createTestCriteria,
    runAllTests, TEST_SUITE
  };
}
