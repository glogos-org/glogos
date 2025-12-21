#!/usr/bin/env node
/**
 * Glogos Genesis Ceremony Script (TypeScript)
 *
 * Self-contained ceremony script with full Ed25519 cryptography.
 * Can be run multiple times to verify deterministic output.
 *
 * Runs the complete genesis ceremony:
 * 1. Derive genesis zone from GLR (deterministic)
 * 2. Create and sign genesis attestation
 * 3. Verify attestation
 * 4. Fetch entropy witnesses (drand + Bitcoin + NIST)
 * 5. Save artifacts
 *
 * Run: pnpm ceremony
 *
 * This script produces IDENTICAL output to witness.py
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import {
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  DOMAIN_SEPARATOR,
  hexToBytes,
  concatBytes,
  stringToBytes,
  keyPairFromSeed,
  verifyAttestation
} from '../sdk/typescript/core/dist/index.js';
import type {
  AttestationInput,
  SubjectHash,
  UnixTimestamp,
  HashHex,
  ZoneId
} from '../sdk/typescript/core/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// PROTOCOL CONSTANTS (from GENESIS.md)
// ============================================================================
const GENESIS_TIMESTAMP = 1766329380; // 2025-12-21T15:03:00 UTC
const DRAND_CHAIN_HASH = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
const DRAND_ENDPOINT = `https://api.drand.sh/${DRAND_CHAIN_HASH}/public/latest`;
const NIST_BEACON_URL = 'https://beacon.nist.gov/beacon/2.0/pulse/last';
const BITCOIN_API = 'https://blockstream.info/api/blocks/tip/hash';
const BITCOIN_HEIGHT_API = 'https://blockstream.info/api/blocks/tip/height';

// ============================================================================
// HTTP UTILITIES
// ============================================================================

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https
      .get(url, { headers: { 'User-Agent': 'Glogos-Ceremony/1.0' }, timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data.trim());
          }
        });
      })
      .on('error', reject)
      .on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out: ${url}`));
      });
  });
}

async function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https
      .get(url, { headers: { 'User-Agent': 'Glogos-Ceremony/1.0' }, timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data.trim()));
      })
      .on('error', reject)
      .on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out: ${url}`));
      });
  });
}

// ============================================================================
// ZONE OPERATIONS
// ============================================================================

async function deriveGenesisZone() {
  const glrBytes = hexToBytes(GLR);
  const domainBytes = stringToBytes(DOMAIN_SEPARATOR);
  const combined = concatBytes(glrBytes, domainBytes);
  const seed = sha256Hex(combined);
  const seedBytes = hexToBytes(seed);

  const { publicKey, privateKey } = await keyPairFromSeed(seedBytes);
  const zoneId = sha256Hex(hexToBytes(publicKey)) as ZoneId;

  return { seed, publicKey, privateKey, zoneId };
}

// ============================================================================
// VERIFICATION
// ============================================================================

async function verifyArtifact(): Promise<boolean> {
  console.log('\n[VERIFY] Genesis Artifact');
  console.log('='.repeat(50));

  const artifactPath = path.join(__dirname, '../shared/artifacts/genesis-artifact.json');
  if (!fs.existsSync(artifactPath)) {
    console.log(`✗ Artifact not found: ${artifactPath}`);
    return false;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const att = artifact.attestation;
  let allPassed = true;

  // 1. Verify GLR
  const glrOk = sha256Hex('') === GLR;
  console.log(`[1] GLR = SHA256(''): ${glrOk ? '✓' : '✗'}`);
  allPassed = allPassed && glrOk;

  // 2. Verify zone derivation
  const zone = await deriveGenesisZone();
  const zoneOk = zone.zoneId === att.zone;
  console.log(`[2] Zone ID matches: ${zoneOk ? '✓' : '✗'}`);
  allPassed = allPassed && zoneOk;

  // 3. Verify subject
  const expectedSubject = sha256Hex('From nothing, truth emerges');
  const subjectOk = expectedSubject === att.subject;
  console.log(`[3] Subject matches: ${subjectOk ? '✓' : '✗'}`);
  allPassed = allPassed && subjectOk;

  // 4. Verify canon
  const expectedCanon = sha256Hex('raw:sha256:1.0');
  const canonOk = expectedCanon === att.canon;
  console.log(`[4] Canon matches: ${canonOk ? '✓' : '✗'}`);
  allPassed = allPassed && canonOk;

  // 5. Verify attestation ID
  const timeBytes = Buffer.alloc(8);
  timeBytes.writeBigUInt64BE(BigInt(att.time));
  const expectedId = sha256Hex(
    concatBytes(
      hexToBytes(att.zone),
      hexToBytes(att.subject),
      hexToBytes(att.canon),
      new Uint8Array(timeBytes)
    )
  );
  const idOk = expectedId === att.id;
  console.log(`[5] Attestation ID: ${idOk ? '✓' : '✗'}`);
  allPassed = allPassed && idOk;

  // 6. Verify signature
  const verification = await verifyAttestation(att, zone.publicKey as unknown as HashHex);
  const sigOk = verification.valid;
  console.log(`[6] Ed25519 signature: ${sigOk ? '✓' : '✗'}`);
  allPassed = allPassed && sigOk;

  console.log('='.repeat(50));
  console.log(`Result: ${allPassed ? '✓ ALL PASSED' : '✗ FAILED'}`);
  return allPassed;
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

async function waitForCeremonyTime() {
  const target = new Date(GENESIS_TIMESTAMP * 1000);
  let now = new Date();
  if (now < target) {
    console.log(`\n[WAIT] Ceremony time: ${target.toISOString()}`);
    console.log(`       Current time:  ${now.toISOString()}`);
    console.log(`       (Press Ctrl+C to cancel)\n`);

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        now = new Date();
        const diff = target.getTime() - now.getTime();
        if (diff <= 0) {
          clearInterval(interval);
          console.log('\n[!] CEREMONY TIME!');
          resolve(null);
          return;
        }
        const sec = Math.floor(diff / 1000);
        if (sec > 60) {
          const d = Math.floor(sec / 86400);
          const h = Math.floor((sec % 86400) / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const s = sec % 60;
          process.stdout.write(
            `\r   Waiting... ${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s remaining`
          );
        } else {
          process.stdout.write(`\r   Countdown: ${sec}s...                      `);
        }
      }, 100);
    });
  }
}

// ============================================================================
// MAIN CEREMONY
// ============================================================================

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           GLOGOS GENESIS CEREMONY                             ║');
  console.log('║           Winter Solstice 2025                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('✓ Full cryptographic mode (SDK available)\n');

  console.log('Options:');
  console.log('  [1] Run ceremony (simulation)');
  console.log('  [2] Run ceremony (live)');
  console.log('  [3] Verify genesis artifact\n');

  const choice = (await question('Select (1-3) [1]: ')).trim() || '1';

  if (choice === '3') {
    await verifyArtifact();
    rl.close();
    return;
  }

  if (choice === '2') {
    const deadline = new Date('2025-12-22T15:03:00Z');
    if (new Date() > deadline) {
      console.log('\n⚠ Genesis ceremony đã qua. Dùng option [1] simulation thay.');
      rl.close();
      return;
    }
    await waitForCeremonyTime();
  }
  rl.close();

  const ceremonyTimeStr = new Date(GENESIS_TIMESTAMP * 1000).toISOString();
  console.log(`\nCeremony time: ${ceremonyTimeStr}`);
  console.log(`Current time:  ${new Date().toISOString()}\n`);

  // ============================================
  // STEP 1: DERIVE GENESIS ZONE
  // ============================================
  console.log('='.repeat(65));
  console.log('STEP 1: DERIVE GENESIS ZONE FROM GLR');
  console.log('='.repeat(65));

  console.log('\n[1/3] Computing seed: SHA-256(GLR || domain_separator)...');
  const genesisZone = await deriveGenesisZone();
  console.log(`    ✓ Seed:       ${genesisZone.seed.slice(0, 32)}...`);

  console.log('\n[2/3] Deriving Ed25519 keypair from seed...');
  console.log(`    ✓ Public Key: ${genesisZone.publicKey.slice(0, 32)}...`);

  console.log('\n[3/3] Computing zone ID: SHA-256(public_key)...');
  console.log(`    ✓ Zone ID:    ${genesisZone.zoneId.slice(0, 32)}...`);

  // ============================================
  // STEP 2: CREATE GENESIS ATTESTATION
  // ============================================
  console.log('\n' + '='.repeat(65));
  console.log('STEP 2: CREATE GENESIS ATTESTATION');
  console.log('='.repeat(65));

  console.log("\n[1/4] Computing genesis subject: SHA-256('From nothing, truth emerges')...");
  const genesisSubject = sha256Hex('From nothing, truth emerges') as SubjectHash;
  console.log(`    ✓ Subject:    ${genesisSubject.slice(0, 32)}...`);

  console.log("\n[2/4] Computing canon ID: SHA-256('raw:sha256:1.0')...");
  const genesisCanon = computeCanonId('raw:sha256:1.0');
  console.log(`    ✓ Canon:      ${genesisCanon.slice(0, 32)}...`);

  console.log('\n[3/4] Computing attestation ID...');
  const genesisInput: AttestationInput = {
    zone: genesisZone.zoneId,
    subject: genesisSubject,
    canon: genesisCanon,
    time: GENESIS_TIMESTAMP as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };

  const { attestation: genesisAttestation } = await createAttestation(
    genesisInput,
    genesisZone.privateKey
  );
  console.log(`    ✓ ID:         ${genesisAttestation.id.slice(0, 32)}...`);

  console.log('\n[4/4] Signing attestation (Ed25519)...');
  console.log(`    ✓ Signature:  ${genesisAttestation.proof.slice(0, 32)}...`);

  // ============================================
  // STEP 3: VERIFY ATTESTATION
  // ============================================
  console.log('\n' + '='.repeat(65));
  console.log('STEP 3: VERIFY ATTESTATION');
  console.log('='.repeat(65));

  const verification = await verifyAttestation(
    genesisAttestation,
    genesisZone.publicKey as unknown as HashHex
  );
  if (verification.steps) {
    for (const step of verification.steps) {
      console.log(`    ${step.passed ? '✓' : '✗'} ${step.name}`);
    }
  }

  if (verification.valid) {
    console.log('\n    ✓ ATTESTATION VERIFIED SUCCESSFULLY');
  } else {
    console.log('\n    ✗ VERIFICATION FAILED');
    return;
  }

  // ============================================
  // STEP 4: FETCH ENTROPY WITNESSES
  // ============================================
  console.log('\n' + '='.repeat(65));
  console.log('STEP 4: FETCH ENTROPY WITNESSES');
  console.log('='.repeat(65));

  const fetchedAt = new Date().toISOString();
  let drand: any, nist: any, bitcoin: any;

  if (choice === '1') {
    console.log('\n[SIMULATION] Using mock entropy data...');
    drand = {
      source: 'drand_quicknet (mock)',
      chain_hash: DRAND_CHAIN_HASH,
      round: 1234567,
      randomness: 'de7e000000000000000000000000000000000000000000000000000000000000',
      signature: 'de7e',
      fetched_at: fetchedAt
    };
    nist = {
      source: 'nist_beacon (mock)',
      output_value: 'de7e',
      pulse_index: 1234567,
      fetched_at: fetchedAt
    };
    bitcoin = {
      source: 'bitcoin_block (mock)',
      block_hash: '0000',
      block_height: 1234567,
      fetched_at: fetchedAt
    };
    console.log('    ✓ Drand (Mock)');
    console.log('    ✓ NIST (Mock)');
    console.log('    ✓ Bitcoin (Mock)');
  } else {
    // Check if we're more than 1 hour past ceremony time for live mode
    const ceremonyTime = new Date(GENESIS_TIMESTAMP * 1000);
    const currentTime = new Date();
    const timeDiff = (currentTime.getTime() - ceremonyTime.getTime()) / 1000;

    if (timeDiff > 3600) {
      console.log(`\n⚠️  Current time is ${Math.floor(timeDiff / 3600)} hours past ceremony time.`);
      console.log('   Entropy data is no longer realtime for the ceremony.');
      console.log('   Please use option [3] to verify the existing genesis artifact.');
      console.log('\nExiting...');
      return;
    }

    // Fetch drand
    console.log('\n[1/3] Fetching drand quicknet...');
    drand = { source: 'drand_quicknet', error: null };
    try {
      const data = await fetchJson(DRAND_ENDPOINT);
      drand = {
        source: 'drand_quicknet',
        chain_hash: DRAND_CHAIN_HASH,
        round: data.round,
        randomness: data.randomness,
        signature: data.signature,
        fetched_at: fetchedAt
      };
      console.log(`    ✓ Round: ${drand.round}`);
      console.log(`    ✓ Randomness: ${drand.randomness.slice(0, 32)}...`);
    } catch (e: any) {
      drand.error = e.message;
      console.log(`    ✗ Error: ${e.message}`);
    }

    // Fetch NIST Beacon
    console.log('\n[2/3] Fetching NIST Randomness Beacon...');
    nist = { source: 'nist_beacon', error: null };
    try {
      const data = await fetchJson(NIST_BEACON_URL);
      const pulse = data.pulse;
      nist = {
        source: 'nist_beacon',
        output_value: pulse.outputValue,
        pulse_index: pulse.pulseIndex,
        fetched_at: fetchedAt
      };
      console.log(`    ✓ Pulse: ${nist.pulse_index}`);
      console.log(`    ✓ Value: ${nist.output_value.slice(0, 32)}...`);
    } catch (e: any) {
      nist.error = e.message;
      console.log(`    ✗ Error: ${e.message}`);
    }

    // Fetch Bitcoin
    console.log('\n[3/3] Fetching Bitcoin block...');
    bitcoin = { source: 'bitcoin_block', error: null };
    try {
      const blockHash = await fetchText(BITCOIN_API);
      const blockHeight = await fetchText(BITCOIN_HEIGHT_API);
      bitcoin = {
        source: 'bitcoin_block',
        block_hash: blockHash,
        block_height: parseInt(blockHeight),
        fetched_at: fetchedAt
      };
      console.log(`    ✓ Height: ${bitcoin.block_height}`);
      console.log(`    ✓ Hash: ${bitcoin.block_hash.slice(0, 32)}...`);
    } catch (e: any) {
      bitcoin.error = e.message;
      console.log(`    ✗ Error: ${e.message}`);
    }
  }

  // ============================================
  // STEP 5: SAVE ARTIFACTS
  // ============================================
  console.log('\n' + '='.repeat(65));
  console.log('STEP 5: SAVE ARTIFACTS');
  console.log('='.repeat(65));

  const artifact = {
    _ceremony: 'Winter Solstice Genesis 2025',
    _timestamp: ceremonyTimeStr,
    attestation: genesisAttestation,
    witnesses: { entropy: { fetched_at: fetchedAt, drand, nist, bitcoin } }
  };

  const artifactsDir = path.join(__dirname, '../shared/artifacts');
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactsDir, 'genesis-artifact.json'),
    JSON.stringify(artifact, null, 2) + '\n'
  );
  console.log(`\n✓ Saved: ${path.join(artifactsDir, 'genesis-artifact.json')}`);

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(65));
  console.log('CEREMONY COMPLETE');
  console.log('='.repeat(65));
  console.log('\nGenesis Attestation:');
  console.log(JSON.stringify(genesisAttestation, null, 2));
  console.log('\n' + '-'.repeat(65));
  console.log('Re-run this script to verify deterministic output.');
  console.log('The attestation ID and signature will be IDENTICAL each time.');
  console.log('-'.repeat(65));
  console.log('\nFrom nothing, truth emerges.');
  console.log('='.repeat(65) + '\n');
}

main().catch(console.error);
