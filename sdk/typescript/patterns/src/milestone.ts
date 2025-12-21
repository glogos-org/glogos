/**
 * @glogos/patterns - Milestone Pattern
 *
 * Sequential state tracking pattern for work progress.
 * Used for contract completion, project milestones, etc.
 */

import {
  createAttestation,
  type Attestation,
  type AttestationInput,
  type ZoneId,
  type AttestationId,
  type SubjectHash,
  type UnixTimestamp,
  sha256Hex,
  computeCanonId
} from '@glogos/core';

/**
 * Canon for milestone attestations
 */
export const MILESTONE_CANON = computeCanonId('opt:contract:milestone:1.0');

/**
 * Milestone attestation payload
 */
export interface MilestonePayload {
  /** Milestone number/sequence */
  milestoneNumber: number;
  /** Description of deliverable */
  deliverable: string;
  /** Status: pending, completed, verified */
  status: 'pending' | 'completed' | 'verified';
  /** Optional delivery hash */
  deliveryHash?: string;
  /** Completion timestamp */
  completedAt: number;
}

/**
 * Create a milestone attestation
 *
 * @param workerZone - Zone completing the milestone
 * @param privateKey - Private key of worker zone
 * @param milestone - Milestone payload
 * @param contractId - Reference to contract attestation
 * @returns Milestone attestation
 */
export async function createMilestoneAttestation(
  workerZone: ZoneId,
  privateKey: string,
  milestone: MilestonePayload,
  contractId: AttestationId
): Promise<Attestation> {
  const input: AttestationInput = {
    zone: workerZone,
    subject: sha256Hex(JSON.stringify(milestone)) as SubjectHash,
    canon: MILESTONE_CANON,
    time: milestone.completedAt as UnixTimestamp,
    refs: [contractId] // Reference the contract
  };

  const { attestation } = await createAttestation(input, privateKey);
  return attestation;
}

/**
 * Get milestone chain by traversing refs
 *
 * @param milestones - Array of milestone attestations
 * @param contractId - Starting contract ID
 * @returns Ordered array of milestones
 */
export function getMilestoneChain(
  milestones: Attestation[],
  contractId: AttestationId
): Attestation[] {
  // Filter milestones that are part of this contract
  const contractMilestones = milestones.filter(
    (m) => m.refs.includes(contractId) && m.canon === MILESTONE_CANON
  );

  // Sort by time (causality ordering)
  return contractMilestones.sort((a, b) => a.time - b.time);
}

/**
 * Verify milestone order (causality)
 *
 * @param milestones - Array of milestone attestations
 * @returns Validation result
 */
export function verifyMilestoneOrder(milestones: Attestation[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Sort by time
  const sorted = [...milestones].sort((a, b) => a.time - b.time);

  // Verify each milestone has time > previous
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].time <= sorted[i - 1].time) {
      errors.push(`Milestone ${i} has time ${sorted[i].time} <= previous ${sorted[i - 1].time}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Count completed milestones
 *
 * @param milestones - Array of milestone attestations
 * @returns Count of completed milestones
 */
export function countCompletedMilestones(milestones: Attestation[]): number {
  return milestones.filter((m) => m.canon === MILESTONE_CANON).length;
}
