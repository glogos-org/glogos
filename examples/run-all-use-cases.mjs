#!/usr/bin/env node

/**
 * Run all Glogos example demos sequentially
 */

import { execSync } from 'child_process';

const demos = [
  'employment',
  'carbon',
  'constitution',
  'matching',
  'commitment',
  'impact',
  'prediction',
  'federation',
  'principal',
  'liquidity',
  'mechanism',
  'game',
  'public',
  'peer-review',
  'sybil',
  'forgotten',
  'rotation',
  'gns',
  'supply-chain',
  'data-integrity',
  'transaction',
  'art-provenance'
];

console.log(`Running ${demos.length} demos sequentially...\n`);

let passed = 0;
let failed = 0;

for (const demo of demos) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running: ${demo}`);
    console.log('='.repeat(80));

    execSync(`pnpm run ${demo}`, { stdio: 'inherit' });
    passed++;
  } catch (error) {
    console.error(`\n❌ Failed: ${demo}\n`);
    failed++;
  }
}

console.log(`\n${'='.repeat(80)}`);
console.log(`SUMMARY: ${passed} passed, ${failed} failed (out of ${demos.length})`);
console.log('='.repeat(80));

process.exit(failed > 0 ? 1 : 0);
