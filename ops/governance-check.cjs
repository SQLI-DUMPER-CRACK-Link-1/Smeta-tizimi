#!/usr/bin/env node
/* Governance-only guard. It validates coordination artifacts; it does not
 * inspect or mutate business data, migrations, deployments or frontend code. */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const required = [
  'AGENTS.md',
  'docs/governance/CONSTITUTION.md',
  'docs/governance/CURRENT_STATE.md',
  'ops/ACTIVE_TASKS.json',
];
const errors = [];
const warnings = [];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
}

let stateText = '';
let tasks;
try {
  stateText = fs.readFileSync(path.join(root, 'docs/governance/CURRENT_STATE.md'), 'utf8');
  tasks = JSON.parse(fs.readFileSync(path.join(root, 'ops/ACTIVE_TASKS.json'), 'utf8'));
} catch (err) {
  errors.push(`cannot read governance state: ${err.message}`);
}

if (!tasks || !Array.isArray(tasks.tasks)) {
  errors.push('ops/ACTIVE_TASKS.json must contain a tasks array');
} else {
  const active = tasks.tasks.filter((task) => ['active', 'in_progress', 'ready_for_review'].includes(task.status));
  const seen = new Map();
  for (const task of tasks.tasks) {
    for (const field of ['id', 'title', 'owner', 'branch', 'base_sha', 'status', 'owns', 'depends_on', 'must_read', 'production_write_allowed']) {
      if (!(field in task)) errors.push(`${task.id || '<unknown>'}: missing ${field}`);
    }
    if (task.production_write_allowed !== false) errors.push(`${task.id || '<unknown>'}: production_write_allowed must be false`);
    if (!Array.isArray(task.owns)) errors.push(`${task.id || '<unknown>'}: owns must be an array`);
  }
  for (const task of active) {
    for (const owned of task.owns || []) {
      const key = String(owned).replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '').toLowerCase();
      if (!key) continue;
      for (const [otherKey, otherTask] of seen) {
        const overlap = key === otherKey || key.startsWith(otherKey + '/') || otherKey.startsWith(key + '/');
        if (overlap && otherTask.id !== task.id) {
          errors.push(`owned-path lock conflict: ${task.id} (${owned}) vs ${otherTask.id} (${otherTask.owned})`);
        }
      }
      seen.set(key, { id: task.id, owned });
    }
  }
}

const shaMatch = stateText.match(/^\| `main_sha` \| `([0-9a-f]{40})` \|$/m);
try {
  const actual = cp.execFileSync('git', ['rev-parse', 'main'], { cwd: root, encoding: 'utf8' }).trim();
  if (shaMatch && actual !== shaMatch[1]) warnings.push(`CURRENT_STATE main_sha is stale: recorded ${shaMatch[1]}, git main is ${actual}`);
} catch (err) {
  warnings.push(`could not resolve git main SHA: ${err.message}`);
}

for (const rel of ['AGENTS.md', 'docs/governance/CONSTITUTION.md', 'docs/governance/CURRENT_STATE.md']) {
  const text = fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : '';
  if (/MULOQOT/i.test(text) && !/(MULOQOT[\s\S]{0,160}(historical|append-only|not current|journal)|(historical|append-only|not current|journal)[\s\S]{0,160}MULOQOT)/i.test(text)) {
    warnings.push(`${rel} references MULOQOT without an explicit historical/current-state boundary`);
  }
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`);
  process.exitCode = 1;
} else {
  console.log(`PASS governance artifacts (${required.length} required files, ${tasks?.tasks?.length || 0} tasks)`);
}
