/**
 * Liquidity Pool Demo (Bank Runs)
 *
 * Demonstrates banking reserves and crisis prevention using Glogos protocol.
 *
 * Nobel Prize 2022: Ben Bernanke, Douglas Diamond, & Philip Dybvig
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

const BANK_CANON = computeCanonId('opt:coord:liquidity:1.0');
const RESERVE_CANON = computeCanonId('opt:finance:reserve:1.0');

export async function runLiquidityDemo() {
  console.log('='.repeat(80));
  console.log('LIQUIDITY POOL DEMO (BANK RUNS)');
  console.log('Bernanke, Diamond, & Dybvig - Nobel Prize 2022');
  console.log('='.repeat(80));

  const bank = await generateZone();
  const centralBank = await generateZone();

  // 1. Reserve Requirement
  console.log('1. Setting Reserve Requirements');
  const requirementInput: AttestationInput = {
    zone: centralBank.id,
    subject: sha256Hex(
      JSON.stringify({ reserveRatio: 0.1, depositInsurance: true })
    ) as SubjectHash,
    canon: BANK_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: requirement } = await createAttestation(
    requirementInput,
    centralBank.privateKey
  );

  // 2. Bank Liquidity Proof
  const proofInput: AttestationInput = {
    zone: bank.id,
    subject: sha256Hex(
      JSON.stringify({ totalDeposits: 1000000, liquidReserves: 150000 })
    ) as SubjectHash,
    canon: RESERVE_CANON,
    time: (Math.floor(Date.now() / 1000) + 50) as unknown as UnixTimestamp,
    refs: [requirement.id]
  };
  await createAttestation(proofInput, bank.privateKey);
  console.log(`   Bank proves 15% liquid reserves (Required: 10%). Deposit insurance active.`);
  console.log(`   Cryptographic proof prevents information-based bank runs.`);

  console.log('✅ Liquidity/Banking demo completed!');
  console.log('='.repeat(80));
}

runLiquidityDemo().catch(console.error);
