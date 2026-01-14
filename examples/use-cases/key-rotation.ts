/**
 * Key Rotation Demo
 *
 * Demonstrates how to maintain a persistent identity across key changes.
 *
 * Concept:
 * - Zone ID is ephemeral (tied to current key).
 * - Identity is persistent (the chain of rotations).
 * - "Alice" is defined by her Genesis Zone, regardless of her current key.
 */

import {
  generateZone,
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  type Attestation,
  type AttestationInput,
  type SubjectHash,
  type UnixTimestamp,
  type HashHex,
  type ZoneId
} from '@glogos/core';

const ROTATION_CANON = computeCanonId('opt:security:key-rotation:1.0');
const POST_CANON = computeCanonId('opt:social:post:1.0');

/**
 * Helper: Resolve the current active zone for a given root identity
 */
function resolveCurrentKey(rootIdentity: ZoneId, history: Attestation[]): ZoneId {
  let currentZone = rootIdentity;

  // Sort history by time to follow the chain sequentially
  const sortedHistory = [...history].sort((a, b) => a.time - b.time);

  for (const attestation of sortedHistory) {
    // Check if this is a valid rotation from the current zone
    if (attestation.canon === ROTATION_CANON && attestation.zone === currentZone) {
      // Parse the new zone from the subject (in a real app, verify signature/structure)
      // Here we assume subject is hash of newZone ID for simplicity,
      // or we look up the payload. For this demo, we'll simulate payload lookup.
      // In Glogos, subject is a hash, so we need the pre-image (payload) to know the next zone.
      // We will simulate finding the payload in a map.
      const payload = rotationPayloads.get(attestation.id);
      if (payload && payload.nextZone) {
        console.log(
          `   🔄 Rotation detected: ${currentZone.substring(0, 8)}... -> ${payload.nextZone.substring(0, 8)}...`
        );
        currentZone = payload.nextZone;
      }
    }
  }
  return currentZone;
}

// Simulated storage for payloads (since Glogos core only stores hashes)
const rotationPayloads = new Map<string, any>();

export async function runKeyRotationDemo() {
  console.log('='.repeat(80));
  console.log('KEY ROTATION DEMO');
  console.log('Maintaining Identity across Private Key changes');
  console.log('='.repeat(80));

  // 1. Alice's Life Begins (Key 1)
  const aliceKey1 = await generateZone();
  const rootIdentity = aliceKey1.id; // This is "Alice" forever
  console.log(`1. Identity Created`);
  console.log(`   Root Identity (Alice): ${rootIdentity.substring(0, 16)}...`);
  console.log(`   Current Key:           Key 1`);

  // Alice posts something with Key 1
  const post1Input: AttestationInput = {
    zone: aliceKey1.id,
    subject: sha256Hex('Hello World') as SubjectHash,
    canon: POST_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: post1 } = await createAttestation(post1Input, aliceKey1.privateKey);
  console.log(`   📢 Post by Key 1: "Hello World"`);

  // 2. Key Rotation (Key 1 -> Key 2)
  console.log('\n2. Rotating Keys (Key 1 -> Key 2)');
  console.log('   Reason: Routine security update');

  const aliceKey2 = await generateZone();

  const rotationPayload = {
    prevZone: aliceKey1.id,
    nextZone: aliceKey2.id,
    reason: 'routine_update',
    timestamp: Date.now()
  };

  const rotationInput: AttestationInput = {
    zone: aliceKey1.id, // Signed by OLD key
    subject: sha256Hex(JSON.stringify(rotationPayload)) as SubjectHash,
    canon: ROTATION_CANON,
    time: (Math.floor(Date.now() / 1000) + 100) as unknown as UnixTimestamp,
    refs: [post1.id as HashHex] // Link to previous history
  };

  const { attestation: rotationTx } = await createAttestation(rotationInput, aliceKey1.privateKey);

  // Store payload for the resolver
  rotationPayloads.set(rotationTx.id, rotationPayload);
  console.log(`   cw Rotation Attestation created: ${rotationTx.id.substring(0, 16)}...`);

  // 3. Alice posts with Key 2
  console.log('\n3. Activity with New Key');
  const post2Input: AttestationInput = {
    zone: aliceKey2.id, // Signed by NEW key
    subject: sha256Hex('I am still Alice!') as SubjectHash,
    canon: POST_CANON,
    time: (Math.floor(Date.now() / 1000) + 200) as unknown as UnixTimestamp,
    refs: [rotationTx.id as HashHex]
  };
  const { attestation: post2 } = await createAttestation(post2Input, aliceKey2.privateKey);
  console.log(`   📢 Post by Key 2: "I am still Alice!"`);

  // 4. Compromise & Emergency Rotation (Key 2 -> Key 3)
  console.log('\n4. Emergency Rotation (Key 2 -> Key 3)');
  console.log('   Reason: Key 2 compromised!');

  const aliceKey3 = await generateZone();

  const emergencyPayload = {
    prevZone: aliceKey2.id,
    nextZone: aliceKey3.id,
    reason: 'key_compromise'
  };

  const emergencyInput: AttestationInput = {
    zone: aliceKey2.id,
    subject: sha256Hex(JSON.stringify(emergencyPayload)) as SubjectHash,
    canon: ROTATION_CANON,
    time: (Math.floor(Date.now() / 1000) + 300) as unknown as UnixTimestamp,
    refs: [post2.id as HashHex]
  };

  const { attestation: emergencyTx } = await createAttestation(
    emergencyInput,
    aliceKey2.privateKey
  );
  rotationPayloads.set(emergencyTx.id, emergencyPayload);
  console.log(`   cw Emergency Rotation created.`);

  // 5. Client Verification
  console.log('\n5. Client Verification (Resolving Identity)');

  const networkHistory = [post1, rotationTx, post2, emergencyTx];

  console.log(`   🔍 Resolving current key for Root Identity: ${rootIdentity.substring(0, 8)}...`);
  const currentActiveZone = resolveCurrentKey(rootIdentity, networkHistory);

  console.log(`   ✅ Current Active Zone: ${currentActiveZone.substring(0, 16)}...`);

  if (currentActiveZone === aliceKey3.id) {
    console.log('      (Matches Key 3 - Correct!)');
  } else {
    console.log('      (Mismatch!)');
  }

  // 6. Attempting to use Revoked Key (Key 1)
  console.log('\n6. Attack Simulation: Using Revoked Key 1');
  const attackInput: AttestationInput = {
    zone: aliceKey1.id, // Attacker found Key 1
    subject: sha256Hex('I am Alice (Fake)') as SubjectHash,
    canon: POST_CANON,
    time: (Math.floor(Date.now() / 1000) + 400) as unknown as UnixTimestamp,
    refs: [post1.id as HashHex]
  };
  const { attestation: attackTx } = await createAttestation(attackInput, aliceKey1.privateKey);

  // Validator checks
  console.log(`   🕵️  Validating attack transaction...`);
  if (attackTx.zone !== currentActiveZone) {
    console.log(
      `   ❌ REJECTED: Signer (${attackTx.zone.substring(0, 8)}...) is not the active key.`
    );
    console.log(`      Expected: ${currentActiveZone.substring(0, 8)}...`);
  } else {
    console.log(`   ⚠️  ACCEPTED (Should not happen)`);
  }

  console.log('\n✅ Key Rotation Demo completed!');
  console.log('='.repeat(80));
}

runKeyRotationDemo().catch(console.error);
