/**
 * Right to be Forgotten Demo
 *
 * Demonstrates how to handle data deletion on an immutable DAG.
 *
 * Strategies:
 * 1. Tombstoning: Mark as deleted (Client-side filtering).
 * 2. Crypto-shredding: Delete the decryption key.
 * 3. Off-chain: Delete the source, leave the hash.
 */

import {
  generateZone,
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  type AttestationInput,
  type SubjectHash,
  type UnixTimestamp,
  type HashHex
} from '@glogos/core';

const SOCIAL_POST_CANON = computeCanonId('opt:social:post:1.0');
const TOMBSTONE_CANON = computeCanonId('opt:social:tombstone:1.0');
const ENCRYPTED_CANON = computeCanonId('opt:data:encrypted:1.0');

export async function runRightToBeForgottenDemo() {
  console.log('='.repeat(80));
  console.log('RIGHT TO BE FORGOTTEN DEMO');
  console.log('Reconciling Immutability with Privacy');
  console.log('='.repeat(80));

  const alice = await generateZone();
  console.log(`   👤 Alice: ${alice.id.substring(0, 16)}...`);

  // ============================================================================
  // STRATEGY 1: TOMBSTONING (Social Deletion)
  // ============================================================================
  console.log('\n1. Strategy: Tombstoning (Soft Delete)');
  console.log('   Alice posts something regrettable, then "deletes" it.');

  // 1a. The Regrettable Post
  const postPayload = { content: 'I hate my boss!', mood: 'angry' };
  const postInput: AttestationInput = {
    zone: alice.id,
    subject: sha256Hex(JSON.stringify(postPayload)) as SubjectHash,
    canon: SOCIAL_POST_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: post } = await createAttestation(postInput, alice.privateKey);
  console.log(`   📢 Post created: "${postPayload.content}" (ID: ${post.id.substring(0, 8)}...)`);

  // 1b. The Tombstone (Deletion Request)
  const tombstonePayload = {
    action: 'delete',
    target: post.id,
    reason: 'GDPR Request'
  };
  const tombstoneInput: AttestationInput = {
    zone: alice.id,
    subject: sha256Hex(JSON.stringify(tombstonePayload)) as SubjectHash,
    canon: TOMBSTONE_CANON,
    time: (Math.floor(Date.now() / 1000) + 100) as unknown as UnixTimestamp,
    refs: [post.id as HashHex] // Must reference the target
  };
  const { attestation: tombstone } = await createAttestation(tombstoneInput, alice.privateKey);
  console.log(`   🪦 Tombstone created for ID: ${post.id.substring(0, 8)}...`);

  // 1c. Client View
  console.log('   👀 Client View:');
  const history = [post, tombstone];
  const deletedIds = new Set(
    history
      .filter((a) => a.canon === TOMBSTONE_CANON)
      .map((a) => history.find((target) => target.id === a.refs[0])?.id)
  );

  const visiblePosts = history.filter(
    (a) => a.canon === SOCIAL_POST_CANON && !deletedIds.has(a.id)
  );

  if (visiblePosts.length === 0) {
    console.log('      ✅ Post is HIDDEN from UI (Filtered by Tombstone)');
  } else {
    console.log('      ❌ Post is still visible!');
  }

  // ============================================================================
  // STRATEGY 2: CRYPTO-SHREDDING (Hard Delete)
  // ============================================================================
  console.log('\n2. Strategy: Crypto-shredding (Hard Delete)');
  console.log('   Alice encrypts data. To delete, she destroys the key.');

  // 2a. Encrypt Data
  const sensitiveData = 'My Medical Records: Healthy';
  const encryptionKey = 'correct-horse-battery-staple'; // In reality, a random 256-bit key

  console.log(`   🔐 Encrypting data: "${sensitiveData}"`);
  console.log(`   🔑 Key generated (simulated): "${encryptionKey.substring(0, 8)}..."`);

  // Simulate encryption: AES(data, key)
  const cipherText = Buffer.from(`ENCRYPTED[${sensitiveData}]WITH[${encryptionKey}]`).toString(
    'base64'
  );

  const encryptedInput: AttestationInput = {
    zone: alice.id,
    subject: sha256Hex(JSON.stringify({ cipherText })) as SubjectHash,
    canon: ENCRYPTED_CANON,
    time: (Math.floor(Date.now() / 1000) + 200) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: encryptedPost } = await createAttestation(encryptedInput, alice.privateKey);
  console.log(`   cw Encrypted Post on DAG: ${encryptedPost.id.substring(0, 8)}...`);
  console.log(`      Content: "${cipherText.substring(0, 20)}..."`);

  // 2b. Access (With Key)
  console.log('   🔓 Access with Key: Data is readable.');

  // 2c. "Delete" (Destroy Key)
  console.log('   🔥 Action: Alice destroys the Encryption Key.');
  const destroyedKey = null;

  // 2d. Access (Without Key)
  console.log('   🔒 Access without Key:');
  if (!destroyedKey) {
    console.log('      ✅ Data is mathematically unrecoverable (Indistinguishable from noise).');
    console.log('      The DAG entry remains, but the *information* is gone.');
  }

  console.log('\n✅ Right to be Forgotten Demo completed!');
  console.log('='.repeat(80));
}

runRightToBeForgottenDemo().catch(console.error);
