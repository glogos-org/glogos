/**
 * Employment Contract Demo
 *
 * Demonstrates Hart/Holmström Contract Theory using Glogos protocol.
 *
 * Nobel Prize 2016: Oliver Hart & Bengt Holmström
 * "Contract Theory: Incomplete Contracts and Optimal Incentive Design"
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
  type HashHex,
  type AttestationId
} from '@glogos/core';

import {
  createMilestoneAttestation,
  getMilestoneChain,
  type MilestonePayload
} from '@glogos/patterns';

// Canons
const CONTRACT_CANON = computeCanonId('opt:contract:milestone:1.0');
const REVIEW_CANON = computeCanonId('opt:contract:review:1.0');

interface Contract {
  id: string;
  employer: ZoneId;
  worker: ZoneId;
  salary: number;
  totalMilestones: number;
  attestation: Attestation;
}

interface Review {
  reviewer: ZoneId;
  milestoneId: string;
  rating: number;
  comments: string;
  attestation: Attestation;
}

/**
 * Demo: Software Development Contract
 */
export async function runEmploymentDemo() {
  console.log('='.repeat(80));
  console.log('EMPLOYMENT CONTRACT DEMO');
  console.log('Hart & Holmström - Nobel Prize 2016');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================================
  // 1. CREATE CONTRACT
  // ============================================================================
  console.log('1. Create employment contract (Incomplete Contract)');

  const employer = await generateZone();
  const worker = await generateZone();

  const contractPayload = {
    employer: employer.id,
    worker: worker.id,
    salary: 10000, // $10k/month
    totalMilestones: 3,
    startDate: Math.floor(Date.now() / 1000)
  };

  const contractInput: AttestationInput = {
    zone: employer.id,
    subject: sha256Hex(JSON.stringify(contractPayload)) as SubjectHash,
    canon: CONTRACT_CANON,
    time: contractPayload.startDate as UnixTimestamp,
    refs: [GLR as HashHex]
  };

  const { attestation: contractAttestation } = await createAttestation(
    contractInput,
    employer.privateKey
  );

  const contract: Contract = {
    id: contractAttestation.id,
    employer: employer.id,
    worker: worker.id,
    salary: contractPayload.salary,
    totalMilestones: contractPayload.totalMilestones,
    attestation: contractAttestation
  };

  console.log(`   Employer: ${employer.id.substring(0, 16)}...`);
  console.log(`   Worker: ${worker.id.substring(0, 16)}...`);
  console.log(`   Salary: $${contract.salary}/month`);
  console.log(`   Milestones: ${contract.totalMilestones}`);
  console.log(`   Contract ID: ${contract.id.substring(0, 16)}...`);
  console.log('');

  // ============================================================================
  // 2. WORKER DELIVERS MILESTONES
  // ============================================================================
  console.log('2. Worker delivers milestones (Verifiable Effort)');

  const milestones: Attestation[] = [];
  const deliverables = [
    { num: 1, desc: 'User authentication system', file: 'auth-v1.0.zip' },
    { num: 2, desc: 'Dashboard UI implementation', file: 'dashboard-v1.0.zip' },
    { num: 3, desc: 'Payment integration', file: 'payment-v1.0.zip' }
  ];

  for (const deliverable of deliverables) {
    const milestonePayload: MilestonePayload = {
      milestoneNumber: deliverable.num,
      deliverable: deliverable.desc,
      status: 'completed',
      deliveryHash: sha256Hex(deliverable.file),
      completedAt: Math.floor(Date.now() / 1000) + deliverable.num * 1000
    };

    const milestone = await createMilestoneAttestation(
      worker.id,
      worker.privateKey,
      milestonePayload,
      contract.id as AttestationId
    );

    milestones.push(milestone);
    console.log(`   ✓ Milestone ${deliverable.num}: ${deliverable.desc}`);
    console.log(`     Delivery: ${deliverable.file}`);
  }

  console.log('');

  // ============================================================================
  // 3. PEER REVIEWS
  // ============================================================================
  console.log('3. Peer reviews (Information Asymmetry Mitigation)');

  const reviewers = [await generateZone(), await generateZone()];

  const reviews: Review[] = [];
  const ratings = [4.5, 4.0, 5.0]; // Ratings for each milestone

  for (let i = 0; i < milestones.length; i++) {
    for (const reviewer of reviewers) {
      const reviewPayload = {
        milestoneId: milestones[i].id,
        rating: ratings[i] + (Math.random() - 0.5) * 0.5, // Slight variance
        comments: `Reviewed milestone ${i + 1}`,
        reviewedAt: Math.floor(Date.now() / 1000) + (i + 1) * 1500
      };

      const reviewInput: AttestationInput = {
        zone: reviewer.id,
        subject: sha256Hex(JSON.stringify(reviewPayload)) as SubjectHash,
        canon: REVIEW_CANON,
        time: reviewPayload.reviewedAt as UnixTimestamp,
        refs: [milestones[i].id as HashHex]
      };

      const { attestation: reviewAttestation } = await createAttestation(
        reviewInput,
        reviewer.privateKey
      );

      reviews.push({
        reviewer: reviewer.id,
        milestoneId: milestones[i].id,
        rating: reviewPayload.rating,
        comments: reviewPayload.comments,
        attestation: reviewAttestation
      });
    }
  }

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  console.log(`   Reviews collected: ${reviews.length}`);
  console.log(`   Average rating: ${avgRating.toFixed(2)}/5.0`);
  console.log('');

  // ============================================================================
  // 4. PAYMENT DECISIONS
  // ============================================================================
  console.log('4. Payment decisions (Principal-Agent Resolution)');

  const paymentPerMilestone = contract.salary / contract.totalMilestones;
  const completedMilestones = getMilestoneChain(milestones, contract.id as AttestationId);

  console.log(`   Milestones completed: ${completedMilestones.length}/${contract.totalMilestones}`);
  console.log(`   Payment per milestone: $${paymentPerMilestone.toFixed(2)}`);
  console.log(`   Average rating: ${avgRating.toFixed(2)}/5.0`);

  if (avgRating >= 4.0) {
    const totalPayment = paymentPerMilestone * completedMilestones.length;
    console.log(`   ✅ APPROVED: Full payment of $${totalPayment.toFixed(2)}`);
  } else {
    const penalty = 0.1;
    const reducedPayment = paymentPerMilestone * completedMilestones.length * (1 - penalty);
    console.log(`   ⚠️ PENALTY: Reduced to $${reducedPayment.toFixed(2)} (10% penalty)`);
  }

  console.log('');

  // ============================================================================
  // 5. VERIFICATION
  // ============================================================================
  console.log('5. Verify attestation chain');

  const allAttestations = [
    contractAttestation,
    ...milestones,
    ...reviews.map((r) => r.attestation)
  ];

  const tracesToContract = allAttestations.every((att) => {
    return (
      att.refs.includes(GLR as HashHex) ||
      att.refs.includes(contract.id as HashHex) ||
      milestones.some((m) => att.refs.includes(m.id as HashHex))
    );
  });

  console.log(`   ✓ All attestations in chain: ${tracesToContract}`);
  console.log('');

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('='.repeat(80));
  console.log('SUMMARY - Hart/Holmström Contract Theory');
  console.log('='.repeat(80));
  console.log(`1. Incomplete contracts     : ✅ Ongoing milestone attestations`);
  console.log(`2. Verifiable effort        : ✅ Work delivery attestations (${milestones.length})`);
  console.log(`3. Information asymmetry    : ✅ Peer reviews (${reviews.length})`);
  console.log(`4. Residual rights          : ✅ Milestone completion proofs`);
  console.log(
    `5. Principal-agent          : ✅ Rating-based payment (${avgRating.toFixed(2)}/5.0)`
  );
  console.log('');
  console.log(`Contract created            : ✅`);
  console.log(`Milestones delivered        : ${completedMilestones.length}`);
  console.log(`Peer reviews                : ${reviews.length}`);
  console.log(`Average quality             : ${avgRating.toFixed(2)}/5.0`);
  console.log('');
  console.log('✅ Demo completed successfully!');
  console.log('='.repeat(80));

  return {
    contract,
    milestones,
    reviews,
    avgRating
  };
}

// Run the demo
runEmploymentDemo().catch(console.error);
