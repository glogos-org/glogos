/**
 * Commitment Device Demo
 *
 * Demonstrates behavioral economics commitment devices using Glogos protocol.
 *
 * Nobel Prize 2017: Richard Thaler
 * "Nudge: Improving Decisions About Health, Wealth, and Happiness"
 */

import {
  generateZone,
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  type Attestation,
  type AttestationInput,
  type ZoneId,
  type SubjectHash,
  type UnixTimestamp,
  type HashHex
} from '@glogos/core';

import { createWitnessAttestation } from '@glogos/patterns';

const COMMITMENT_CANON = computeCanonId('opt:social:commitment:1.0');
const CHECKIN_CANON = computeCanonId('opt:behavioral:checkin:1.0');
const RESOLUTION_CANON = computeCanonId('opt:behavioral:resolution:1.0');

interface Commitment {
  user: { id: ZoneId; publicKey: string; privateKey: string };
  goal: string;
  startDate: number;
  endDate: number;
  checkInFrequency: 'weekly' | 'monthly';
  stake: number; // Reputation points
  witnesses: Array<{ id: ZoneId; publicKey: string; privateKey: string }>;
  attestation: Attestation;
}

interface CheckIn {
  month: number;
  progress: number;
  evidence: string;
  attestation: Attestation;
  witnessAttestations: Attestation[];
}

/**
 * Demo: Savings Commitment Device
 */
export async function runCommitmentDemo() {
  console.log('='.repeat(80));
  console.log('COMMITMENT DEVICE DEMO');
  console.log('Richard Thaler - Nobel Prize 2017');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================================
  // 1. Create user and witnesses
  // ============================================================================
  console.log('1. Create user and witnesses');

  const user = await generateZone();
  const witnesses = [];

  const witnessNames = ['Friend', 'Family', 'Colleague'];
  for (const name of witnessNames) {
    const zone = await generateZone();
    witnesses.push({ ...zone, name });
    console.log(`   ✓ Created witness: ${name}`);
  }

  console.log('');

  // ============================================================================
  // 2. Create commitment with stake
  // ============================================================================
  console.log('2. Create savings commitment');

  const goal = 'Save $500/month for 6 months';
  const startDate = Math.floor(Date.now() / 1000);
  const endDate = startDate + 6 * 30 * 24 * 3600; // 6 months
  const stake = 100; // Reputation points at risk

  const commitmentInput: AttestationInput = {
    zone: user.id,
    subject: sha256Hex(
      JSON.stringify({
        goal,
        startDate,
        endDate,
        targetAmount: 500,
        frequency: 'monthly',
        duration: 6,
        stake,
        witnesses: witnesses.map((w) => w.id)
      })
    ) as SubjectHash,
    canon: COMMITMENT_CANON,
    time: startDate as UnixTimestamp,
    refs: [GLR as HashHex]
  };

  const { attestation: commitmentAttestation } = await createAttestation(
    commitmentInput,
    user.privateKey
  );

  const commitment: Commitment = {
    user,
    goal,
    startDate,
    endDate,
    checkInFrequency: 'monthly',
    stake,
    witnesses,
    attestation: commitmentAttestation
  };

  console.log(`   Goal: ${goal}`);
  console.log(`   Duration: 6 months`);
  console.log(`   Stake: ${stake} reputation points`);
  console.log(`   Witnesses: ${witnesses.length}`);
  console.log(`   Commitment ID: ${commitmentAttestation.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // 3. Monthly check-ins with witness verification
  // ============================================================================
  console.log('3. Monthly check-ins with witnesses');

  const checkIns: CheckIn[] = [];
  const monthlyProgress = [520, 500, 530, 500, 510, 540]; // Actual savings each month

  for (let month = 1; month <= 6; month++) {
    const progress = monthlyProgress[month - 1];
    const checkInTime = startDate + month * 30 * 24 * 3600;

    // User reports progress
    const checkInInput: AttestationInput = {
      zone: user.id,
      subject: sha256Hex(
        JSON.stringify({
          month,
          saved: progress,
          evidence: `bank-statement-month${month}.pdf`,
          timestamp: checkInTime
        })
      ) as SubjectHash,
      canon: CHECKIN_CANON,
      time: checkInTime as UnixTimestamp,
      refs: [commitmentAttestation.id as HashHex]
    };

    const { attestation: checkInAttestation } = await createAttestation(
      checkInInput,
      user.privateKey
    );

    // Witnesses verify (randomly select 2 witnesses per check-in)
    const selectedWitnesses = witnesses.slice(0, 2);
    const witnessAttestations: Attestation[] = [];

    for (const witness of selectedWitnesses) {
      const witnessAtt = await createWitnessAttestation(
        witness.id,
        witness.privateKey,
        checkInAttestation,
        `Verified savings for month ${month}`
      );
      witnessAttestations.push(witnessAtt);
    }

    checkIns.push({
      month,
      progress,
      evidence: `bank-statement-month${month}.pdf`,
      attestation: checkInAttestation,
      witnessAttestations
    });

    const status = progress >= 500 ? '✅' : '⚠️';
    console.log(
      `   ${status} Month ${month}: $${progress} saved (verified by ${witnessAttestations.length} witnesses)`
    );
  }

  console.log('');

  // ============================================================================
  // 4. Calculate outcome and resolve commitment
  // ============================================================================
  console.log('4. Resolve commitment');

  const totalSaved = monthlyProgress.reduce((sum, amt) => sum + amt, 0);
  const monthsMet = monthlyProgress.filter((amt) => amt >= 500).length;
  const success = monthsMet === 6;

  const outcome = {
    success,
    totalSaved,
    monthsMet,
    monthsFailed: 6 - monthsMet,
    stakeReturned: success ? stake : 0,
    bonus: success ? 50 : 0 // Bonus for completion
  };

  const resolutionInput: AttestationInput = {
    zone: user.id,
    subject: sha256Hex(
      JSON.stringify({
        outcome: success ? 'success' : 'failure',
        totalSaved,
        monthsMet,
        stakeReturned: outcome.stakeReturned,
        bonus: outcome.bonus,
        checkIns: checkIns.map((c) => c.attestation.id)
      })
    ) as SubjectHash,
    canon: RESOLUTION_CANON,
    time: endDate as UnixTimestamp,
    refs: [commitmentAttestation.id as HashHex, ...checkIns.map((c) => c.attestation.id as HashHex)]
  };

  const { attestation: resolutionAttestation } = await createAttestation(
    resolutionInput,
    user.privateKey
  );

  console.log(`   Outcome: ${success ? '✅ SUCCESS' : '❌ FAILURE'}`);
  console.log(`   Total saved: $${totalSaved}`);
  console.log(`   Months met target: ${monthsMet}/6`);
  console.log(`   Stake returned: ${outcome.stakeReturned} points`);
  console.log(`   Bonus earned: ${outcome.bonus} points`);
  console.log(`   Resolution ID: ${resolutionAttestation.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('='.repeat(80));
  console.log('SUMMARY - Behavioral Commitment Properties');
  console.log('='.repeat(80));
  console.log(`Goal                     : ${goal}`);
  console.log(`Duration                 : 6 months`);
  console.log(`Check-ins completed      : ${checkIns.length}`);
  console.log(
    `Witness verifications    : ${checkIns.reduce((sum, c) => sum + c.witnessAttestations.length, 0)}`
  );
  console.log(`Final outcome            : ${success ? '✅ Success' : '❌ Failure'}`);
  console.log(`Net reputation change    : +${outcome.stakeReturned + outcome.bonus - stake}`);
  console.log('');
  console.log('Behavioral Economics Principles:');
  console.log('  • Present bias mitigation (stake creates future accountability)');
  console.log('  • Social commitment (witnesses create social pressure)');
  console.log('  • Loss aversion (stake at risk is more motivating than bonus)');
  console.log('  • Transparency (all progress publicly verifiable)');
  console.log('');
  console.log('✅ Demo completed successfully!');
  console.log('='.repeat(80));

  return {
    commitment,
    checkIns,
    outcome,
    resolutionAttestation
  };
}

// Run the demo
runCommitmentDemo().catch(console.error);
