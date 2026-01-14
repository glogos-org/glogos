/**
 * Mechanism Design Demo
 *
 * Demonstrates strategy-proof revelation and incentive compatibility using Glogos protocol.
 *
 * Nobel Prize 2007: Leonid Hurwicz, Eric Maskin, & Roger Myerson
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

const MECHANISM_CANON = computeCanonId('opt:mechanism:design:1.0');
const REVELATION_CANON = computeCanonId('opt:mechanism:revelation:1.0');

export async function runMechanismDemo() {
  console.log('='.repeat(80));
  console.log('MECHANISM DESIGN DEMO');
  console.log('Hurwicz, Maskin, & Myerson - Nobel Prize 2007');
  console.log('='.repeat(80));

  const planner = await generateZone();
  const agents = [await generateZone(), await generateZone()];

  // 1. Define Mechanism (Incentive Compatible)
  console.log('1. Defining Strategy-Proof Allocation Mechanism');
  const mechanismInput: AttestationInput = {
    zone: planner.id,
    subject: sha256Hex(
      JSON.stringify({ rule: 'VCG-Mechanism', item: 'Public Good' })
    ) as SubjectHash,
    canon: MECHANISM_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: mechanism } = await createAttestation(mechanismInput, planner.privateKey);

  // 2. Truthful Preference Revelation
  for (const agent of agents) {
    const revInput: AttestationInput = {
      zone: agent.id,
      subject: sha256Hex(
        JSON.stringify({ valuation: 100, proof: 'Truthful-Revelation' })
      ) as SubjectHash,
      canon: REVELATION_CANON,
      time: (Math.floor(Date.now() / 1000) + 50) as unknown as UnixTimestamp,
      refs: [mechanism.id]
    };
    await createAttestation(revInput, agent.privateKey);
    console.log(`   Agent ${agent.id.substring(0, 8)} reveals true valuation: 100`);
  }

  console.log('✅ Mechanism Design demo completed!');
  console.log('='.repeat(80));
}

runMechanismDemo().catch(console.error);
