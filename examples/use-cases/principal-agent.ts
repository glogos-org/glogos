/**
 * Principal-Agent Demo (Moral Hazard)
 *
 * Demonstrates incentive-compatible contracts and moral hazard using Glogos protocol.
 *
 * Nobel Prize 2016: Oliver Hart & Bengt Holmström
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

const CONTRACT_CANON = computeCanonId('opt:contract:incentive:1.0');
const PERFORMANCE_CANON = computeCanonId('opt:contract:performance:1.0');

export async function runPrincipalAgentDemo() {
  console.log('='.repeat(80));
  console.log('PRINCIPAL-AGENT DEMO (MORAL HAZARD)');
  console.log('Hart & Holmström - Nobel Prize 2016');
  console.log('='.repeat(80));

  const principal = await generateZone();
  const agent = await generateZone();

  console.log(`   Principal: ${principal.id.substring(0, 16)}...`);
  console.log(`   Agent:     ${agent.id.substring(0, 16)}...`);

  // 1. Incentive Contract
  console.log('1. Creating Incentive-Compatible Contract');
  const contractInput: AttestationInput = {
    zone: principal.id,
    subject: sha256Hex(
      JSON.stringify({
        baseSalary: 5000,
        bonusFormula: '10% of generated revenue',
        measure: 'Verifiable Revenue'
      })
    ) as SubjectHash,
    canon: CONTRACT_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: contract } = await createAttestation(contractInput, principal.privateKey);
  console.log(`   Contract signed: Performance-based bonus to mitigate Moral Hazard`);

  // 2. Verifiable Performance
  const perfInput: AttestationInput = {
    zone: principal.id, // Verified by Principal or Audit
    subject: sha256Hex(JSON.stringify({ revenueGenerated: 20000, period: 'Q1' })) as SubjectHash,
    canon: PERFORMANCE_CANON,
    time: (Math.floor(Date.now() / 1000) + 100) as unknown as UnixTimestamp,
    refs: [contract.id]
  };
  await createAttestation(perfInput, principal.privateKey);
  console.log(`   Performance verified: $20,000 revenue. Bonus triggered: $2,000`);

  console.log('✅ Principal-Agent demo completed!');
  console.log('='.repeat(80));
}

runPrincipalAgentDemo().catch(console.error);
