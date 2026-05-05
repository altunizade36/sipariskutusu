#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const root = process.cwd();
const strictMode = process.env.CI === 'true' || process.argv.includes('--strict');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function fileExists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function collectFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist-ci') {
      continue;
    }

    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(abs, out);
      continue;
    }

    if (/\.(ts|tsx|js|jsx|json|md|mjs|cjs|css|yml|yaml)$/.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

function hasBom(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(3);
  fs.readSync(fd, buffer, 0, 3, 0);
  fs.closeSync(fd);
  return buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

function rel(absPath) {
  return path.relative(root, absPath).replace(/\\/g, '/');
}

const errors = [];
const warnings = [];

function report(issue, isBlocking = true) {
  if (isBlocking) {
    errors.push(issue);
    return;
  }
  warnings.push(issue);
}

const appJsonPath = path.join(root, 'app.json');
const easJsonPath = path.join(root, 'eas.json');

if (!fileExists('app.json')) {
  report('app.json bulunamadi.');
}

if (!fileExists('eas.json')) {
  report('eas.json bulunamadi.');
}

if (fileExists('app.json')) {
  const app = readJson(appJsonPath);
  const projectId = app?.expo?.extra?.eas?.projectId;
  if (!projectId || String(projectId).includes('REPLACE_WITH_')) {
    report('app.json > expo.extra.eas.projectId placeholder veya bos.', strictMode);
  }

  const plugins = app?.expo?.plugins ?? [];
  const hasExpoNotifications = plugins.some((p) => (Array.isArray(p) ? p[0] : p) === 'expo-notifications');
  if (!hasExpoNotifications) {
    report('app.json > expo.plugins icinde expo-notifications eksik.');
  }

  const requiredAssets = [
    app?.expo?.icon,
    app?.expo?.splash?.image,
    app?.expo?.android?.adaptiveIcon?.foregroundImage,
    app?.expo?.web?.favicon,
  ].filter(Boolean);

  for (const asset of requiredAssets) {
    const clean = String(asset).replace(/^\.\//, '');
    if (!fileExists(clean)) {
      report(`Asset bulunamadi: ${clean}`);
    }
  }
}

if (fileExists('eas.json')) {
  const eas = readJson(easJsonPath);
  const appleId = eas?.submit?.production?.ios?.appleId;
  if (appleId && String(appleId).includes('REPLACE_WITH_')) {
    report('eas.json > submit.production.ios.appleId placeholder degerde.', strictMode);
  }

  const serviceAccountPath = eas?.submit?.production?.android?.serviceAccountKeyPath;
  if (serviceAccountPath && !String(serviceAccountPath).includes('REPLACE_WITH_')) {
    const clean = String(serviceAccountPath).replace(/^\.\//, '');
    if (!fileExists(clean)) {
      report(`Android service account dosyasi yok: ${clean}`, strictMode);
    }
  }
}

const files = collectFiles(root);
const bomFiles = files.filter((f) => hasBom(f));
if (bomFiles.length > 0) {
  for (const file of bomFiles) {
    report(`UTF-8 BOM tespit edildi: ${rel(file)}`);
  }
}

if (warnings.length > 0) {
  console.warn('Release preflight uyarilari:');
  for (const warn of warnings) {
    console.warn(`- ${warn}`);
  }
}

if (errors.length > 0) {
  console.error('Release preflight basarisiz:');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log(`Release preflight basarili. Mod: ${strictMode ? 'strict' : 'local'}`);
