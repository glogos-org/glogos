#!/usr/bin/env node

/**
 * Run all Glogos example demos sequentially
 */

import { execSync } from 'child_process';

const demos = [
  'art-provenance',
  'carbon',
  'commitment',
  'constitution',
  'data-integrity',
  'employment',
  'federation',
  'forgotten',
  'game',
  'gns',
  'impact',
  'liquidity',
  'matching',
  'mechanism',
  'peer-review',
  'prediction',
  'principal',
  'public',
  'rotation',
  'standards-bridge',
  'supply-chain',
  'sybil',
  'transaction'
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
