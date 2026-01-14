/**
 * Game Theory Demo (Nash Equilibrium)
 *
 * Demonstrates verifiable strategy commitment in social dilemmas.
 *
 * Nobel Prize 1994: John Nash, Reinhard Selten, & John Harsanyi
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

const STRATEGY_CANON = computeCanonId('opt:game:strategy:1.0');
const EQUILIBRIUM_CANON = computeCanonId('opt:game:equilibrium:1.0');

export async function runGameTheoryDemo() {
  console.log('='.repeat(80));
  console.log("GAME THEORY DEMO (PRISONER'S DILEMMA RESOLUTION)");
  console.log('Nash, Selten, & Harsanyi - Nobel Prize 1994');
  console.log('='.repeat(80));

  const playerA = await generateZone();
  const playerB = await generateZone();

  // 1. Simultaneous Strategy Commitment
  console.log('1. Players committing to "Cooperate" strategy via attestations');

  const moveAInput: AttestationInput = {
    zone: playerA.id,
    subject: sha256Hex(JSON.stringify({ move: 'Cooperate' })) as SubjectHash,
    canon: STRATEGY_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: moveA } = await createAttestation(moveAInput, playerA.privateKey);

  const moveBInput: AttestationInput = {
    zone: playerB.id,
    subject: sha256Hex(JSON.stringify({ move: 'Cooperate' })) as SubjectHash,
    canon: STRATEGY_CANON,
    time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
    refs: [GLR as HashHex]
  };
  const { attestation: moveB } = await createAttestation(moveBInput, playerB.privateKey);

  console.log(`   Player A: Cooperate (${moveA.id.substring(0, 8)})`);
  console.log(`   Player B: Cooperate (${moveB.id.substring(0, 8)})`);

  // 2. Outcome Resolution (Mutual Cooperation Equilibrium)
  console.log('2. Resolving Nash Equilibrium');
  const resolutionInput: AttestationInput = {
    zone: playerA.id, // Or a third-party arbiter
    subject: sha256Hex(
      JSON.stringify({ outcome: 'Mutual Cooperation', payoff: [3, 3] })
    ) as SubjectHash,
    canon: EQUILIBRIUM_CANON,
    time: (Math.floor(Date.now() / 1000) + 10) as unknown as UnixTimestamp,
    refs: [moveA.id as HashHex, moveB.id as HashHex]
  };
  await createAttestation(resolutionInput, playerA.privateKey);
  console.log(`   Result: Pareto-optimal outcome achieved via verifiable commitment.`);

  console.log('✅ Game Theory demo completed!');
  console.log('='.repeat(80));
}

runGameTheoryDemo().catch(console.error);
