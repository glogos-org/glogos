/**
 * Public Goods & Optimal Taxation Demo
 *
 * Demonstrates incentive-compatible revelation for public goods.
 *
 * Nobel Prize 1996: James Mirrlees & William Vickrey
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

const REVENUE_CANON = computeCanonId('opt:tax:revenue:1.0');
const SUBSIDY_CANON = computeCanonId('opt:tax:subsidy:1.0');

export async function runPublicGoodsDemo() {
  console.log('='.repeat(80));
  console.log('PUBLIC GOODS & OPTIMAL TAXATION DEMO');
  console.log('Mirrlees & Vickrey - Nobel Prize 1996');
  console.log('='.repeat(80));

  const citizen = await generateZone();
  const taxAuthority = await generateZone();

  // 1. Verifiable Revenue (Mirrlees' Optimal Income Taxation)
  console.log('1. Citizen attests to Verifiable Income for fair taxation');
  const revenueInput: AttestationInput = {
    zone: citizen.id,
    subject: sha256Hex(
      JSON.stringify({ grossIncome: 85000, occupation: 'Research' })
    ) as SubjectHash,
    canon: REVENUE_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: revenue } = await createAttestation(revenueInput, citizen.privateKey);
  console.log(`   Income Proof: $85,000. Verified for progressive tax calculation.`);

  // 2. Vickrey Auction/Mechanism for Public Good allocation
  const subsidyInput: AttestationInput = {
    zone: taxAuthority.id,
    subject: sha256Hex(
      JSON.stringify({ subsidy: 12000, reason: 'Public Good Contribution' })
    ) as SubjectHash,
    canon: SUBSIDY_CANON,
    time: (Math.floor(Date.now() / 1000) + 100) as unknown as UnixTimestamp,
    refs: [revenue.id as HashHex]
  };
  await createAttestation(subsidyInput, taxAuthority.privateKey);
  console.log(`   Subsidy issued: $12,000 incentive-compatible transfer.`);

  console.log('✅ Public Goods demo completed!');
  console.log('='.repeat(80));
}

runPublicGoodsDemo().catch(console.error);
