#!/usr/bin/env node
/**
 * Bundle-size regression guard.
 *
 * Checks the gzipped size of the built bundles in dist/ against fixed budgets
 * and exits non-zero if any exceeds its limit. Dependency-free (uses Node's
 * built-in zlib) so it needs no extra devDependencies or lockfile churn.
 *
 * Run after a build (the dist/ files must exist):  yarn build && yarn size
 * Adjust BUDGETS deliberately when a size change is intended and understood.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Gzipped-size budgets in kilobytes (1 KB = 1024 bytes). Set with headroom over
// the current sizes so ordinary changes pass but a real regression trips it.
const BUDGETS = [
  { file: 'dist/pdf-a-go-go.js', limitKB: 165 },
  { file: 'dist/pdf-a-go-go.worker.js', limitKB: 400 }
];

const KB = 1024;

function gzipSize(filePath) {
  const buf = fs.readFileSync(filePath);
  return zlib.gzipSync(buf, { level: 9 }).length;
}

let failed = false;
const rows = [];

for (const { file, limitKB } of BUDGETS) {
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error(`✗ ${file} — not found. Run \`yarn build\` first.`);
    failed = true;
    continue;
  }
  const gz = gzipSize(abs);
  const limit = limitKB * KB;
  const over = gz > limit;
  if (over) failed = true;
  rows.push({
    file,
    gzip: (gz / KB).toFixed(1) + ' KB',
    limit: limitKB + ' KB',
    status: over ? '✗ OVER' : '✓ ok'
  });
}

if (rows.length) {
  console.log('Bundle size (gzipped):');
  for (const r of rows) {
    console.log(`  ${r.status.padEnd(7)} ${r.file}  ${r.gzip} / ${r.limit}`);
  }
}

if (failed) {
  console.error('\nBundle-size check failed. If the increase is intentional, update BUDGETS in scripts/check-bundle-size.js.');
  process.exit(1);
}

console.log('\nAll bundles within budget.');
