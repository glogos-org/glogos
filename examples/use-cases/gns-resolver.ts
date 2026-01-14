/**
 * GNS Resolver Demo (DNS + Key Rotation)
 *
 * Demonstrates integrating Decentralized DNS with Key Rotation.
 *
 * Problem: If I rotate my key (Key A -> Key B), do I lose my domain "alice.glogos"?
 * Solution: The Resolver automatically follows the rotation chain.
 *
 * Flow:
 * 1. Resolve "alice.glogos" -> Zone A (Old Key)
 * 2. Check Rotation History -> Zone A rotated to Zone B
 * 3. Final Result -> Zone B (New Key)
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

const GNS_CANON = computeCanonId('opt:dns:gns:1.0');
const ROTATION_CANON = computeCanonId('opt:security:key-rotation:1.0');

// Simulated Data Availability Layer (Map Hash -> Payload)
const payloadStore = new Map<string, any>();

/**
 * Helper: Follow the rotation chain to find the active key
 */
function resolveActiveKey(startZone: ZoneId, history: Attestation[]): ZoneId {
  let currentZone = startZone;
  const sortedHistory = [...history].sort((a, b) => a.time - b.time);

  for (const tx of sortedHistory) {
    if (tx.canon === ROTATION_CANON && tx.zone === currentZone) {
      const payload = payloadStore.get(tx.id);
      if (payload && payload.nextZone) {
        // Valid rotation found
        currentZone = payload.nextZone;
      }
    }
  }
  return currentZone;
}

/**
 * GNS Resolver: Name -> Active Zone ID
 */
function resolveName(name: string, history: Attestation[]): ZoneId | null {
  // 1. Find latest GNS registration for this name
  // In a real node, this would be an indexed SQL query.
  // Here we scan the history.
  const sortedHistory = [...history].sort((a, b) => b.time - a.time); // Newest first

  let registeredZone: ZoneId | null = null;

  for (const tx of sortedHistory) {
    if (tx.canon === GNS_CANON) {
      const payload = payloadStore.get(tx.id);
      if (payload && payload.name === name) {
        registeredZone = payload.target;
        break; // Found latest record
      }
    }
  }

  if (!registeredZone) return null;

  // 2. Resolve Key Rotation (The "Redirect" Logic)
  return resolveActiveKey(registeredZone, history);
}

export async function runGnsDemo() {
  console.log('='.repeat(80));
  console.log('GNS RESOLVER DEMO (DNS + Key Rotation)');
  console.log('Mapping domains to the latest active identity.');
  console.log('='.repeat(80));

  const history: Attestation[] = [];

  // 1. Registration
  console.log('\n1. Registration');
  const aliceKey1 = await generateZone();
  console.log(`   🔑 Key 1: ${aliceKey1.id.substring(0, 16)}...`);

  const gnsPayload = {
    name: 'alice.glogos',
    target: aliceKey1.id,
    ttl: 3600
  };

  const gnsInput: AttestationInput = {
    zone: aliceKey1.id,
    subject: sha256Hex(JSON.stringify(gnsPayload)) as SubjectHash,
    canon: GNS_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };

  const { attestation: regTx } = await createAttestation(gnsInput, aliceKey1.privateKey);
  history.push(regTx);
  payloadStore.set(regTx.id, gnsPayload);
  console.log(`   📝 Registered "alice.glogos" -> Key 1`);

  // Verify
  let resolved = resolveName('alice.glogos', history);
  console.log(`   🔍 Resolve "alice.glogos": ${resolved?.substring(0, 16)}... (Matches Key 1)`);

  // 2. Key Rotation (Key 1 -> Key 2)
  console.log('\n2. Key Rotation (Key 1 -> Key 2)');
  const aliceKey2 = await generateZone();
  console.log(`   🔑 Key 2: ${aliceKey2.id.substring(0, 16)}...`);

  const rotationPayload = {
    prevZone: aliceKey1.id,
    nextZone: aliceKey2.id,
    reason: 'security_upgrade'
  };

  const rotationInput: AttestationInput = {
    zone: aliceKey1.id, // Signed by OLD key
    subject: sha256Hex(JSON.stringify(rotationPayload)) as SubjectHash,
    canon: ROTATION_CANON,
    time: (Math.floor(Date.now() / 1000) + 100) as unknown as UnixTimestamp,
    refs: [regTx.id as HashHex]
  };

  const { attestation: rotTx } = await createAttestation(rotationInput, aliceKey1.privateKey);
  history.push(rotTx);
  payloadStore.set(rotTx.id, rotationPayload);
  console.log(`   cw Rotation Attestation broadcasted.`);

  // 3. Resolution with Auto-Forwarding
  console.log('\n3. Resolution (Auto-Forwarding)');
  console.log('   Note: The GNS record still points to Key 1.');

  resolved = resolveName('alice.glogos', history);

  if (resolved === aliceKey2.id) {
    console.log(`   ✅ Resolve "alice.glogos": ${resolved.substring(0, 16)}...`);
    console.log(`      (Success! Resolver followed the rotation chain to Key 2)`);
  } else {
    console.log(`   ❌ Failed! Resolved to: ${resolved?.substring(0, 16)}...`);
  }

  // 4. Update GNS Record (Optional but recommended)
  console.log('\n4. Updating GNS Record (Optimization)');
  // Alice uses Key 2 to update the record directly
  const updatePayload = { ...gnsPayload, target: aliceKey2.id };
  const updateInput = {
    ...gnsInput,
    zone: aliceKey2.id,
    subject: sha256Hex(JSON.stringify(updatePayload)) as SubjectHash,
    time: (Math.floor(Date.now() / 1000) + 200) as unknown as UnixTimestamp,
    refs: [regTx.id as HashHex]
  };

  const { attestation: updateTx } = await createAttestation(updateInput, aliceKey2.privateKey);
  history.push(updateTx);
  payloadStore.set(updateTx.id, updatePayload);
  console.log(`   📝 Updated "alice.glogos" -> Key 2 (Directly)`);

  console.log('\n✅ GNS Resolver Demo completed!');
  console.log('='.repeat(80));
}

runGnsDemo().catch(console.error);
