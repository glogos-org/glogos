/**
 * Decentralized Science (DeSci) Demo
 *
 * Addressing "Publish or Perish" via:
 * 1. Immediate Provenance: Pre-prints are first-class citizens.
 * 2. Open Peer Review: Reviews are attestations; reviewers get reputation credit.
 * 3. Overlay Journals: Journals are curation filters (Zones), not storage silos.
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

// Canons
const PAPER_CANON = computeCanonId('opt:science:paper:1.0');
const REVIEW_CANON = computeCanonId('opt:science:reproducible:1.0');
const CURATION_CANON = computeCanonId('opt:science:curation:1.0'); // "Journal" acceptance

export async function runPeerReviewDemo() {
  console.log('='.repeat(80));
  console.log('DECENTRALIZED SCIENCE (DeSci) DEMO');
  console.log('Solving "Publish or Perish" with Open Provenance');
  console.log('='.repeat(80));

  // 1. Actors
  const alice = await generateZone(); // Researcher
  const bob = await generateZone(); // Reviewer 1 (Strict)
  const carol = await generateZone(); // Reviewer 2 (Constructive)
  const natureDAO = await generateZone(); // High-impact Overlay Journal

  console.log('1. Actors Established');
  console.log(`   👩‍🔬 Alice (Researcher): ${alice.id.substring(0, 16)}...`);
  console.log(`   🧐 Bob (Reviewer):     ${bob.id.substring(0, 16)}...`);
  console.log(`   👩‍🏫 Carol (Reviewer):   ${carol.id.substring(0, 16)}...`);
  console.log(`   GB  NatureDAO (Journal):${natureDAO.id.substring(0, 16)}...`);

  // 2. Submission (Permissionless Publishing)
  console.log('\n2. Permissionless Publishing (Pre-print)');
  console.log('   Alice publishes immediately. No gatekeepers.');

  const paperPayload = {
    title: 'A Unified Theory of Glogos',
    abstract: 'We propose a DAG-based truth layer...',
    ipfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco', // Simulated content
    authors: [alice.id]
  };

  const paperInput: AttestationInput = {
    zone: alice.id,
    subject: sha256Hex(JSON.stringify(paperPayload)) as SubjectHash,
    canon: PAPER_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };

  const { attestation: paper } = await createAttestation(paperInput, alice.privateKey);
  console.log(`   Pg  Paper Published: ${paper.id.substring(0, 16)}...`);
  console.log(`      Title: "${paperPayload.title}"`);

  // 3. Open Peer Review
  console.log('\n3. Open Peer Review');
  console.log('   Reviews are attestations linked to the paper. Reviewers build reputation.');

  // Bob reviews (Critical)
  const reviewBobPayload = {
    score: 2, // Out of 5
    comments: 'Novel idea, but lacks mathematical proofs in Section 4.',
    recommendation: 'Major Revision'
  };

  const reviewBobInput: AttestationInput = {
    zone: bob.id,
    subject: sha256Hex(JSON.stringify(reviewBobPayload)) as SubjectHash,
    canon: REVIEW_CANON,
    time: (Math.floor(Date.now() / 1000) + 100) as unknown as UnixTimestamp,
    refs: [paper.id as HashHex] // Links directly to the paper
  };

  const { attestation: reviewBob } = await createAttestation(reviewBobInput, bob.privateKey);
  console.log(`   QC  Review from Bob: Score 2/5 ("${reviewBobPayload.recommendation}")`);

  // Carol reviews (Constructive)
  const reviewCarolPayload = {
    score: 4,
    comments: 'Excellent conceptual framework. Suggest adding simulation results.',
    recommendation: 'Accept with Minor Revision'
  };

  const reviewCarolInput: AttestationInput = {
    zone: carol.id,
    subject: sha256Hex(JSON.stringify(reviewCarolPayload)) as SubjectHash,
    canon: REVIEW_CANON,
    time: (Math.floor(Date.now() / 1000) + 200) as unknown as UnixTimestamp,
    refs: [paper.id as HashHex]
  };

  const { attestation: reviewCarol } = await createAttestation(reviewCarolInput, carol.privateKey);
  console.log(`   QC  Review from Carol: Score 4/5 ("${reviewCarolPayload.recommendation}")`);

  // 4. Revision (Alice updates the paper)
  console.log('\n4. Revision (Version Control)');
  console.log('   Alice updates the paper referencing the reviews (acknowledging feedback).');

  const paperV2Payload = {
    ...paperPayload,
    title: 'A Unified Theory of Glogos (Revised)',
    ipfsHash: 'QmNewHashForV2...',
    version: 2
  };

  const paperV2Input: AttestationInput = {
    zone: alice.id,
    subject: sha256Hex(JSON.stringify(paperV2Payload)) as SubjectHash,
    canon: PAPER_CANON,
    time: (Math.floor(Date.now() / 1000) + 500) as unknown as UnixTimestamp,
    refs: [paper.id as HashHex, reviewBob.id as HashHex, reviewCarol.id as HashHex] // Chain of custody
  };

  const { attestation: paperV2 } = await createAttestation(paperV2Input, alice.privateKey);
  console.log(`   Pg  Paper V2 Published: ${paperV2.id.substring(0, 16)}...`);
  console.log(`      Refs: Previous Version + Reviews (Provenance Graph)`);

  // 5. Curation (Overlay Journal Acceptance)
  console.log('\n5. Curation (Overlay Journal)');
  console.log('   NatureDAO selects the paper for their "collection".');

  const curationInput: AttestationInput = {
    zone: natureDAO.id,
    subject: sha256Hex(JSON.stringify({ status: 'ACCEPTED', volume: 1, issue: 1 })) as SubjectHash,
    canon: CURATION_CANON,
    time: (Math.floor(Date.now() / 1000) + 600) as unknown as UnixTimestamp,
    refs: [paperV2.id as HashHex]
  };

  const { attestation: acceptance } = await createAttestation(curationInput, natureDAO.privateKey);
  console.log(`   GB  NatureDAO Accepted Paper V2: ${acceptance.id.substring(0, 16)}...`);
  console.log('\n✅ DeSci Demo completed!');
}

runPeerReviewDemo().catch(console.error);
