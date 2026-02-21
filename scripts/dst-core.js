/**
 * DST Core — Pure logic engine for Digital Keys to Soil Taxonomy.
 * No DOM, no Alpine.js, no UI. Works in browser or Node.js.
 *
 * Usage:
 *   const engine = DSTCore.create(data);  // data = parsed keys_optimized.json
 *   engine.check('AAA_5');                // check a criterion
 *   engine.uncheck('AAA_5');
 *   engine.getVisibleGroups();            // get current visible groups
 *   engine.reset();
 */
var DSTCore = (function () {
    'use strict';

    function create(data) {
        var engine = {
            allCriteria: [],
            outcomes: {},
            glossary: {},
            orderNames: {},
            codeNames: {},
            checkedCriteria: {},
            criteriaByCode: {},
            clauseChildrenMap: {},
            groupRoots: {},
            groupedCriteria: [],
            indices: {},
            _satCache: {},
            _groupSatCache: {},
            _leafCache: {},
            _listeners: []
        };

        // --- ID & Lookup ---

        engine.getCriterionId = function (c) {
            return c.crit + '_' + c.clause;
        };

        engine.getCriterionByCode = function (code) {
            var group = this.criteriaByCode[code];
            return group ? group[0] : undefined;
        };

        engine.getDirectChildren = function (parentCode) {
            var childCodes = (this.indices.children_by_parent || {})[parentCode] || [];
            var self = this;
            return childCodes.map(function (code) { return self.getCriterionByCode(code); }).filter(Boolean);
        };

        engine.getParent = function (code) {
            if (code.length <= 1) return null;
            return this.getCriterionByCode(code.slice(0, -1)) || null;
        };

        // --- Satisfaction Logic ---

        engine.isLeafCriterion = function (criterion) {
            var id = this.getCriterionId(criterion);
            if (this._leafCache[id] !== undefined) return this._leafCache[id];
            this._leafCache[id] = !this.clauseChildrenMap[id];
            return this._leafCache[id];
        };

        engine.getClauseChildren = function (criterion) {
            return this.clauseChildrenMap[this.getCriterionId(criterion)] || [];
        };

        engine.isClauseSatisfied = function (criterion) {
            var id = this.getCriterionId(criterion);
            if (this._satCache[id] !== undefined) return this._satCache[id];
            var result;
            if (this.isLeafCriterion(criterion)) {
                result = !!this.checkedCriteria[id];
            } else {
                var children = this.getClauseChildren(criterion);
                result = children.length > 0 && this.evaluateSiblingLogic(children, criterion.logic);
            }
            this._satCache[id] = result;
            return result;
        };

        engine.evaluateSiblingLogic = function (siblings, parentLogic) {
            var self = this;

            // Fast path: uniform logic — use existing behavior unchanged
            var firstLogic = siblings.length > 0 ? siblings[0].logic : parentLogic;
            var uniform = siblings.every(function (s) { return s.logic === firstLogic; });
            if (uniform) {
                if (parentLogic === 'AND') {
                    return siblings.every(function (s) { return self.isClauseSatisfied(s); });
                }
                return siblings.some(function (s) { return self.isClauseSatisfied(s); });
            }

            // Mixed logic: group consecutive same-logic siblings into runs
            var runs = [];
            var currentLogic = siblings[0].logic;
            var currentItems = [siblings[0]];
            for (var i = 1; i < siblings.length; i++) {
                if (siblings[i].logic === currentLogic) {
                    currentItems.push(siblings[i]);
                } else {
                    runs.push({ logic: currentLogic, items: currentItems });
                    currentItems = [siblings[i]];
                    currentLogic = siblings[i].logic;
                }
            }
            runs.push({ logic: currentLogic, items: currentItems });

            // Evaluate each run by its own logic
            var runResults = runs.map(function (run) {
                if (run.logic === 'AND') {
                    return run.items.every(function (s) { return self.isClauseSatisfied(s); });
                }
                return run.items.some(function (s) { return self.isClauseSatisfied(s); });
            });

            // Combine runs with parent logic
            if (parentLogic === 'AND') {
                return runResults.every(function (r) { return r; });
            }
            return runResults.some(function (r) { return r; });
        };

        engine.isGroupSatisfied = function (critCode) {
            if (this._groupSatCache[critCode] !== undefined) return this._groupSatCache[critCode];
            var root = this.groupRoots[critCode];
            if (!root) { this._groupSatCache[critCode] = false; return false; }
            var result = this.isClauseSatisfied(root);
            this._groupSatCache[critCode] = result;
            return result;
        };

        // --- Navigation ---

        engine.findCurrentLevel = function () {
            var deepest = null;
            for (var code in this.groupRoots) {
                if (this.isGroupSatisfied(code)) {
                    if (!deepest || code.length > deepest.length) {
                        deepest = code;
                    }
                }
            }
            return deepest;
        };

        engine.getVisibleGroups = function () {
            var currentCode = this.findCurrentLevel();
            if (!currentCode) {
                return this.groupedCriteria.filter(function (g) { return g.code.length === 1; });
            }
            var visibleCodes = new Set();
            for (var i = 1; i <= currentCode.length; i++) {
                visibleCodes.add(currentCode.substring(0, i));
            }
            var childCodes = (this.indices.children_by_parent || {})[currentCode] || [];
            childCodes.forEach(function (code) { visibleCodes.add(code); });
            return this.groupedCriteria.filter(function (g) { return visibleCodes.has(g.code); });
        };

        engine.getCheckedLeaves = function () {
            var self = this;
            return this.allCriteria
                .filter(function (c) {
                    return self.isLeafCriterion(c) && self.checkedCriteria[self.getCriterionId(c)];
                })
                .sort(function (a, b) {
                    if (a.crit !== b.crit) return a.crit.localeCompare(b.crit);
                    return a.clause - b.clause;
                });
        };

        // --- State Mutations ---

        engine._invalidateCaches = function () {
            this._satCache = {};
            this._groupSatCache = {};
        };

        engine._notify = function () {
            var self = this;
            this._listeners.forEach(function (fn) { fn(self); });
        };

        engine.check = function (id) {
            this.checkedCriteria[id] = true;
            this._invalidateCaches();
            this._notify();
        };

        engine.uncheck = function (id) {
            delete this.checkedCriteria[id];
            this._invalidateCaches();
            this._notify();
        };

        engine.toggle = function (id) {
            if (this.checkedCriteria[id]) {
                this.uncheck(id);
            } else {
                this.check(id);
            }
        };

        engine.reset = function () {
            this.checkedCriteria = {};
            this._invalidateCaches();
            this._notify();
        };

        engine.onChange = function (fn) {
            this._listeners.push(fn);
            return function () {
                var idx = engine._listeners.indexOf(fn);
                if (idx >= 0) engine._listeners.splice(idx, 1);
            };
        };

        // --- Classification Helpers ---

        engine.getClassificationPath = function () {
            var levelNames = ['Order', 'Suborder', 'Great Group', 'Subgroup'];
            var currentCode = this.findCurrentLevel();
            if (!currentCode) return [];
            var path = [];
            for (var i = 1; i <= currentCode.length && i <= 4; i++) {
                var code = currentCode.substring(0, i);
                var name = this.codeNames[code] || code;
                path.push({
                    code: code,
                    name: name,
                    levelName: levelNames[i - 1] || 'Level ' + i,
                    satisfied: true
                });
            }
            if (currentCode.length < 4) {
                var nextLevel = currentCode.length + 1;
                path.push({
                    code: '?',
                    name: '\u2014',
                    levelName: levelNames[nextLevel - 1] || 'Level ' + nextLevel,
                    satisfied: false
                });
            }
            return path;
        };

        engine.getCurrentClassification = function () {
            var currentCode = this.findCurrentLevel();
            if (!currentCode) return '';
            return this.codeNames[currentCode] || currentCode;
        };

        engine.getClassificationLevel = function () {
            var levelNames = ['Order', 'Suborder', 'Great Group', 'Subgroup'];
            var currentCode = this.findCurrentLevel();
            if (!currentCode) return '';
            return levelNames[currentCode.length - 1] || '';
        };

        engine.getClassificationBreadcrumb = function () {
            var currentCode = this.findCurrentLevel();
            if (!currentCode) return '';
            var parts = [];
            for (var i = 1; i <= currentCode.length; i++) {
                var code = currentCode.substring(0, i);
                parts.push(this.codeNames[code] || code);
            }
            return parts.join(' \u203a ');
        };

        engine.removeCodePrefix = function (content, code) {
            var regex = new RegExp('^' + code + '[.:\\s]*\\s*', 'i');
            return content.replace(regex, '');
        };

        // --- Index Building ---

        engine.buildIndices = function () {
            var self = this;

            // criteriaByCode
            this.criteriaByCode = {};
            this.allCriteria.forEach(function (c) {
                if (!self.criteriaByCode[c.crit]) self.criteriaByCode[c.crit] = [];
                self.criteriaByCode[c.crit].push(c);
            });

            // clauseChildrenMap
            this.clauseChildrenMap = {};
            this.allCriteria.forEach(function (c) {
                if (c.parent_clause !== '' && c.parent_clause !== 0) {
                    var group = self.criteriaByCode[c.crit];
                    var parent = group ? group.find(function (p) { return p.clause === c.parent_clause; }) : null;
                    if (parent) {
                        var parentId = self.getCriterionId(parent);
                        if (!self.clauseChildrenMap[parentId]) self.clauseChildrenMap[parentId] = [];
                        self.clauseChildrenMap[parentId].push(c);
                    }
                }
            });

            // Inject outcome codes as synthetic nav groups
            for (var code in this.outcomes) {
                if (this.criteriaByCode[code]) continue;
                var outcome = this.outcomes[code];
                var syn = {
                    clause_id: code, crit: code, clause: 1, parent_clause: '',
                    content: outcome.content || code,
                    content_html: outcome.content_html || outcome.content || code,
                    logic: outcome.logic || 'FIRST', depth: 0, _fromOutcome: true
                };
                this.allCriteria.push(syn);
                this.criteriaByCode[code] = [syn];
            }

            // groupRoots
            this.groupRoots = {};
            this.allCriteria.forEach(function (c) {
                if ((c.parent_clause === '' || c.parent_clause === 0) && !self.groupRoots[c.crit]) {
                    self.groupRoots[c.crit] = c;
                }
            });

            // Synthetic roots for rootless groups
            for (var code2 in this.criteriaByCode) {
                if (!this.groupRoots[code2]) {
                    var items = this.criteriaByCode[code2];
                    var clausesInGroup = new Set(items.map(function (c) { return c.clause; }));
                    var topLevel = items.filter(function (c) { return !clausesInGroup.has(c.parent_clause); });
                    // Infer parent logic from first top-level child's logic field.
                    var inferredLogic = (topLevel.length > 0)
                        ? topLevel[0].logic : 'OR';
                    var syntheticRoot = {
                        clause_id: code2, crit: code2, clause: 0, parent_clause: '',
                        content: '', logic: inferredLogic, depth: -1, _synthetic: true
                    };
                    this.groupRoots[code2] = syntheticRoot;
                    this.clauseChildrenMap[this.getCriterionId(syntheticRoot)] = topLevel;
                }
            }

            // children_by_parent with nearest-ancestor logic
            var allCodes = new Set(Object.keys(this.criteriaByCode));
            this.indices.children_by_parent = { root: [] };
            for (var c of allCodes) {
                if (c.length <= 1) {
                    this.indices.children_by_parent.root.push(c);
                    continue;
                }
                var ancestor = c.slice(0, -1);
                while (ancestor.length > 0 && !allCodes.has(ancestor)) {
                    ancestor = ancestor.slice(0, -1);
                }
                var p = ancestor || 'root';
                if (!this.indices.children_by_parent[p]) this.indices.children_by_parent[p] = [];
                this.indices.children_by_parent[p].push(c);
            }

            // groupedCriteria
            var groups = {};
            this.allCriteria.forEach(function (c) {
                var code = c.crit || 'Other';
                if (!groups[code]) {
                    var label = self.codeNames[code];
                    if (!label && code.length >= 3 && self.outcomes[code]) {
                        label = self.outcomes[code].content || '';
                    }
                    if (!label) label = c.content.split('\n')[0];
                    label = label.replace(/^[A-Z]+[.:]\s*/, '');
                    if (label.length > 70) label = label.substring(0, 67) + '...';
                    groups[code] = { code: code, label: label, items: [], order_code: code[0] };
                }
                groups[code].items.push(c);
            });
            this.groupedCriteria = Object.values(groups).sort(function (a, b) {
                if (a.code.length !== b.code.length) return a.code.length - b.code.length;
                return a.code.localeCompare(b.code);
            });
        };

        // --- Initialize ---

        if (data) {
            if (data.navigation) {
                engine.allCriteria = (data.navigation.criteria || []).slice();
                engine.indices = data.navigation.indices ? JSON.parse(JSON.stringify(data.navigation.indices)) : {};
                engine.outcomes = data.outcomes || {};
            } else {
                engine.allCriteria = (data.tree ? data.tree.criteria : []).slice();
                engine.indices = {};
                engine.outcomes = {};
            }
            engine.glossary = data.glossary || {};
            engine.orderNames = data.order_names || {};
            engine.codeNames = data.code_names || {};
            engine.buildIndices();
        }

        return engine;
    }

    var api = { create: create };

    // Export for Node.js or browser
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.DSTCore = api;
    }

    return api;
})();
