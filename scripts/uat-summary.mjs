#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const csvPath = path.resolve(process.cwd(), 'docs', 'real-user-feedback-log.csv');

if (!fs.existsSync(csvPath)) {
  console.error('UAT SUMMARY FAIL: docs/real-user-feedback-log.csv bulunamadi.');
  process.exit(1);
}

const raw = fs.readFileSync(csvPath, 'utf8').trim();
if (!raw) {
  console.log('UAT SUMMARY: Dosya bos.');
  process.exit(0);
}

const lines = raw.split(/\r?\n/);
if (lines.length <= 1) {
  console.log('UAT SUMMARY: Henuz veri yok.');
  process.exit(0);
}

const header = lines[0].split(',');
const rows = lines.slice(1).filter((line) => line.trim().replace(/,/g, '').length > 0);

const idx = (name) => header.indexOf(name);
const roleIdx = idx('role');
const successIdx = idx('success');
const severityIdx = idx('severity');
const scenarioIdx = idx('scenario');
const testerIdx = idx('tester_id');

const roleCounts = new Map();
const scenarioCounts = new Map();
const severityCounts = new Map();
const testerSet = new Set();

let successCount = 0;
let failCount = 0;

for (const line of rows) {
  const cols = line.split(',');
  const role = (cols[roleIdx] || 'unknown').trim() || 'unknown';
  const scenario = (cols[scenarioIdx] || 'unknown').trim() || 'unknown';
  const severity = (cols[severityIdx] || 'none').trim().toUpperCase() || 'NONE';
  const tester = (cols[testerIdx] || '').trim();
  const success = (cols[successIdx] || '').trim().toLowerCase();

  if (tester) testerSet.add(tester);

  roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
  scenarioCounts.set(scenario, (scenarioCounts.get(scenario) || 0) + 1);
  severityCounts.set(severity, (severityCounts.get(severity) || 0) + 1);

  if (success === 'true' || success === '1' || success === 'ok' || success === 'pass') {
    successCount += 1;
  } else if (success === 'false' || success === '0' || success === 'fail') {
    failCount += 1;
  }
}

console.log('=== UAT SUMMARY ===');
console.log(`Toplam kayit: ${rows.length}`);
console.log(`Tekil tester: ${testerSet.size}`);
console.log(`Basarili adim: ${successCount}`);
console.log(`Basarisiz adim: ${failCount}`);

console.log('\nRol dagilimi:');
for (const [key, value] of roleCounts.entries()) {
  console.log(`- ${key}: ${value}`);
}

console.log('\nSenaryo dagilimi:');
for (const [key, value] of scenarioCounts.entries()) {
  console.log(`- ${key}: ${value}`);
}

console.log('\nSeverity dagilimi:');
for (const [key, value] of severityCounts.entries()) {
  console.log(`- ${key}: ${value}`);
}

const p0 = severityCounts.get('P0') || 0;
const p1 = severityCounts.get('P1') || 0;
if (p0 > 0 || p1 > 0) {
  console.log('\nUAT KARAR: BLOCKED (P0/P1 issue var)');
  process.exitCode = 2;
} else {
  console.log('\nUAT KARAR: GO (P0/P1 issue yok)');
}
