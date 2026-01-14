/**
 * Matching Market Demo
 *
 * Demonstrates stable matching using Glogos protocol.
 *
 * Nobel Prize 2012: Alvin Roth & Lloyd Shapley
 * "Stable allocations and the practice of market design"
 */

import {
  generateZone,
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  type Attestation,
  type AttestationInput,
  type HashHex,
  type SubjectHash,
  type UnixTimestamp,
  type ZoneId
} from '@glogos/core';

// MATCHING_CANON removed as it was unused
const PREFERENCE_CANON = computeCanonId('opt:market:preference:1.0');
const ACCEPTANCE_CANON = computeCanonId('opt:market:acceptance:1.0');

interface Worker {
  zone: { id: ZoneId; publicKey: string; privateKey: string };
  name: string;
  preferences: string[]; // Employer IDs in preference order
  prefAttestation?: Attestation;
}

interface Employer {
  zone: { id: ZoneId; publicKey: string; privateKey: string };
  name: string;
  slots: number;
  preferences: string[]; // Worker IDs in preference order
  prefAttestation?: Attestation;
}

interface Match {
  worker: ZoneId;
  employer: ZoneId;
  workerAcceptance: Attestation;
  employerAcceptance: Attestation;
}

/**
 * Deferred Acceptance Algorithm (Gale-Shapley)
 * Workers propose, employers accept/reject
 */
function deferredAcceptance(workers: Worker[], employers: Employer[]): Array<[Worker, Employer]> {
  const employerMap = new Map(employers.map((e) => [e.zone.id, e]));
  const workerMap = new Map(workers.map((w) => [w.zone.id, w]));

  // Track current matches and proposals
  const matches = new Map<ZoneId, ZoneId>(); // employer -> worker
  const proposals = new Map<ZoneId, number>(); // worker -> next proposal index

  // Initialize
  workers.forEach((w) => proposals.set(w.zone.id, 0));

  let changed = true;
  while (changed) {
    changed = false;

    for (const worker of workers) {
      // Skip if already matched
      if (Array.from(matches.values()).includes(worker.zone.id)) continue;

      const nextIdx = proposals.get(worker.zone.id)!;
      if (nextIdx >= worker.preferences.length) continue;

      const employerId = worker.preferences[nextIdx] as ZoneId;
      const employer = employerMap.get(employerId);
      if (!employer) continue;

      // Worker proposes to employer
      const currentMatch = matches.get(employerId);

      if (!currentMatch) {
        // Employer has free slot, accept
        matches.set(employerId, worker.zone.id);
        changed = true;
      } else {
        // Employer compares current match with new proposer
        const currentIdx = employer.preferences.indexOf(currentMatch);
        const proposerIdx = employer.preferences.indexOf(worker.zone.id);

        if (proposerIdx < currentIdx) {
          // New proposer is preferred, switch
          matches.set(employerId, worker.zone.id);
          changed = true;
        }
      }

      // Move to next preference
      proposals.set(worker.zone.id, nextIdx + 1);
    }
  }

  // Convert to array of tuples
  const result: Array<[Worker, Employer]> = [];
  for (const [employerId, workerId] of matches.entries()) {
    const worker = workerMap.get(workerId);
    const employer = employerMap.get(employerId);
    if (worker && employer) {
      result.push([worker, employer]);
    }
  }

  return result;
}

/**
 * Verify matching is stable (no blocking pairs)
 */
function verifyStableMatching(
  matches: Array<[Worker, Employer]>,
  workers: Worker[],
  employers: Employer[]
): boolean {
  const matchMap = new Map(matches.map(([w, e]) => [w.zone.id, e.zone.id]));

  // Check for blocking pairs
  for (const worker of workers) {
    const currentEmployer = matchMap.get(worker.zone.id);

    for (const prefEmployerId of worker.preferences) {
      // Worker prefers this employer over current match
      if (currentEmployer && prefEmployerId === currentEmployer) break;

      const employer = employers.find((e) => e.zone.id === prefEmployerId);
      if (!employer) continue;

      // Find employer's current match
      const employerMatch = matches.find(([_, e]) => e.zone.id === employer.zone.id);
      const currentWorker = employerMatch?.[0];

      if (!currentWorker) {
        // Employer has free slot - blocking pair!
        return false;
      }

      // Check if employer prefers this worker over current match
      const currentIdx = employer.preferences.indexOf(currentWorker.zone.id);
      const proposerIdx = employer.preferences.indexOf(worker.zone.id);

      if (proposerIdx < currentIdx) {
        // Blocking pair found!
        return false;
      }
    }
  }

  return true;
}

/**
 * Demo: Medical Residency Matching
 */
export async function runMatchingDemo() {
  console.log('='.repeat(80));
  console.log('MATCHING MARKET DEMO');
  console.log('Alvin Roth & Lloyd Shapley - Nobel Prize 2012');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================================
  // 1. Create workers (medical students)
  // ============================================================================
  console.log('1. Create workers (medical students)');

  const workers: Worker[] = [];
  const workerNames = ['Alice', 'Bob', 'Carol', 'David', 'Eve'];

  for (const name of workerNames) {
    const zone = await generateZone();
    workers.push({
      zone,
      name,
      preferences: [] // Will set later
    });
    console.log(`   ✓ Created worker: ${name}`);
  }

  console.log('');

  // ============================================================================
  // 2. Create employers (hospitals)
  // ============================================================================
  console.log('2. Create employers (hospitals)');

  const employers: Employer[] = [];
  const hospitalNames = ['General Hospital', 'City Medical', 'University Hospital'];

  for (const name of hospitalNames) {
    const zone = await generateZone();
    employers.push({
      zone,
      name,
      slots: 2, // Each hospital has 2 positions
      preferences: [] // Will set later
    });
    console.log(`   ✓ Created employer: ${name}`);
  }

  console.log('');

  // ============================================================================
  // 3. Submit preference attestations
  // ============================================================================
  console.log('3. Submit preference lists');

  // Workers submit preferences (hospital IDs)
  workers[0].preferences = [employers[0].zone.id, employers[1].zone.id, employers[2].zone.id];
  workers[1].preferences = [employers[1].zone.id, employers[0].zone.id, employers[2].zone.id];
  workers[2].preferences = [employers[0].zone.id, employers[2].zone.id, employers[1].zone.id];
  workers[3].preferences = [employers[2].zone.id, employers[1].zone.id, employers[0].zone.id];
  workers[4].preferences = [employers[1].zone.id, employers[2].zone.id, employers[0].zone.id];

  for (const worker of workers) {
    const prefInput: AttestationInput = {
      zone: worker.zone.id,
      subject: sha256Hex(
        JSON.stringify({
          preferences: worker.preferences,
          type: 'worker-preferences'
        })
      ) as SubjectHash,
      canon: PREFERENCE_CANON,
      time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
      refs: [GLR as HashHex]
    };

    const { attestation } = await createAttestation(prefInput, worker.zone.privateKey);
    worker.prefAttestation = attestation;
    console.log(`   ✓ ${worker.name} submitted preferences`);
  }

  console.log('');

  // Employers submit preferences (worker IDs)
  employers[0].preferences = [
    workers[0].zone.id,
    workers[2].zone.id,
    workers[1].zone.id,
    workers[3].zone.id,
    workers[4].zone.id
  ];
  employers[1].preferences = [
    workers[1].zone.id,
    workers[4].zone.id,
    workers[0].zone.id,
    workers[2].zone.id,
    workers[3].zone.id
  ];
  employers[2].preferences = [
    workers[3].zone.id,
    workers[2].zone.id,
    workers[4].zone.id,
    workers[0].zone.id,
    workers[1].zone.id
  ];

  for (const employer of employers) {
    const prefInput: AttestationInput = {
      zone: employer.zone.id,
      subject: sha256Hex(
        JSON.stringify({
          preferences: employer.preferences,
          slots: employer.slots,
          type: 'employer-preferences'
        })
      ) as SubjectHash,
      canon: PREFERENCE_CANON,
      time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
      refs: [GLR as HashHex]
    };

    const { attestation } = await createAttestation(prefInput, employer.zone.privateKey);
    employer.prefAttestation = attestation;
    console.log(`   ✓ ${employer.name} submitted preferences (${employer.slots} slots)`);
  }

  console.log('');

  // ============================================================================
  // 4. Run deferred acceptance algorithm
  // ============================================================================
  console.log('4. Run matching algorithm (Deferred Acceptance)');

  const matches = deferredAcceptance(workers, employers);

  console.log(`   ✓ Generated ${matches.length} matches`);
  console.log('');

  // ============================================================================
  // 5. Create mutual acceptance attestations
  // ============================================================================
  console.log('5. Create acceptance attestations');

  const matchAttestations: Match[] = [];

  for (const [worker, employer] of matches) {
    // Worker attests to acceptance
    const workerAcceptInput: AttestationInput = {
      zone: worker.zone.id,
      subject: sha256Hex(
        JSON.stringify({
          accepts: employer.zone.id,
          type: 'worker-acceptance'
        })
      ) as SubjectHash,
      canon: ACCEPTANCE_CANON,
      time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
      refs: [worker.prefAttestation!.id as HashHex]
    };

    const { attestation: workerAccept } = await createAttestation(
      workerAcceptInput,
      worker.zone.privateKey
    );

    // Employer attests to acceptance
    const employerAcceptInput: AttestationInput = {
      zone: employer.zone.id,
      subject: sha256Hex(
        JSON.stringify({
          accepts: worker.zone.id,
          type: 'employer-acceptance'
        })
      ) as SubjectHash,
      canon: ACCEPTANCE_CANON,
      time: Math.floor(Date.now() / 1000) as unknown as UnixTimestamp,
      refs: [employer.prefAttestation!.id as HashHex]
    };

    const { attestation: employerAccept } = await createAttestation(
      employerAcceptInput,
      employer.zone.privateKey
    );

    matchAttestations.push({
      worker: worker.zone.id,
      employer: employer.zone.id,
      workerAcceptance: workerAccept,
      employerAcceptance: employerAccept
    });

    console.log(`   ✓ Match: ${worker.name} ↔ ${employer.name}`);
  }

  console.log('');

  // ============================================================================
  // 6. Verify stability
  // ============================================================================
  console.log('6. Verify matching stability');

  const isStable = verifyStableMatching(matches, workers, employers);

  if (isStable) {
    console.log('   ✅ STABLE: No blocking pairs exist');
  } else {
    console.log('   ❌ UNSTABLE: Blocking pairs found');
  }

  console.log('');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('='.repeat(80));
  console.log('SUMMARY - Matching Market Properties');
  console.log('='.repeat(80));
  console.log(`Workers registered       : ${workers.length}`);
  console.log(`Employers registered     : ${employers.length}`);
  console.log(`Total matches            : ${matches.length}`);
  console.log(`Stability verified       : ${isStable ? '✅' : '❌'}`);
  console.log(`All preferences attested : ✅`);
  console.log(`All acceptances attested : ✅`);
  console.log('');
  console.log('Economic Properties:');
  console.log('  • Strategy-proof for workers (truth-telling is optimal)');
  console.log('  • Pareto-efficient (no Pareto improvements possible)');
  console.log('  • Individual rationality (no worse than being unmatched)');
  console.log('');
  console.log('✅ Demo completed successfully!');
  console.log('='.repeat(80));

  return {
    workers,
    employers,
    matches: matchAttestations,
    stable: isStable
  };
}

// Run the demo
runMatchingDemo().catch(console.error);
