/**
 * @glogos/patterns - Commit-Reveal Pattern
 *
 * Two-phase sealed process for auctions, voting, etc.
 * Prevents front-running and ensures bid privacy.
 */

import {
  createAttestation,
  type Attestation,
  type AttestationInput,
  type ZoneId,
  type AttestationId,
  type SubjectHash,
  type UnixTimestamp,
  type HashHex,
  sha256Hex,
  computeCanonId
} from '@glogos/core';

/**
 * Canon for commit phase
 */
export const COMMIT_CANON = computeCanonId('opt:market:commit:1.0');

/**
 * Canon for reveal phase
 */
export const REVEAL_CANON = computeCanonId('opt:market:reveal:1.0');

/**
 * Commit payload
 */
export interface CommitPayload {
  /** Hash of the sealed value */
  commitment: HashHex;
  /** Reference to auction/vote */
  targetId: AttestationId;
  /** Commit timestamp */
  committedAt: number;
}

/**
 * Reveal payload
 */
export interface RevealPayload {
  /** The actual value being revealed */
  value: any;
  /** The nonce used in commitment */
  nonce: string;
  /** Reveal timestamp */
  revealedAt: number;
}

/**
 * Create commitment hash
 *
 * @param value - Value to commit to
 * @param nonce - Random nonce
 * @returns Commitment hash
 */
export function createCommitmentHash(value: any, nonce: string): HashHex {
  const combined = JSON.stringify({ value, nonce });
  return sha256Hex(combined) as HashHex;
}

/**
 * Create a commit attestation
 *
 * @param bidderZone - Zone making the commitment
 * @param privateKey - Private key of bidder
 * @param value - Value to commit (will be hashed)
 * @param nonce - Random nonce for hiding
 * @param targetId - Reference to auction/vote
 * @returns Commit attestation and nonce (save nonce for reveal!)
 */
export async function createCommitAttestation(
  bidderZone: ZoneId,
  privateKey: string,
  value: any,
  nonce: string,
  targetId: AttestationId
): Promise<{ attestation: Attestation; nonce: string; commitment: HashHex }> {
  const commitment = createCommitmentHash(value, nonce);

  const payload: CommitPayload = {
    commitment,
    targetId,
    committedAt: Math.floor(Date.now() / 1000)
  };

  const input: AttestationInput = {
    zone: bidderZone,
    subject: sha256Hex(JSON.stringify(payload)) as SubjectHash,
    canon: COMMIT_CANON,
    time: payload.committedAt as UnixTimestamp,
    refs: [targetId]
  };

  const { attestation } = await createAttestation(input, privateKey);

  return { attestation, nonce, commitment };
}

/**
 * Create a reveal attestation
 *
 * @param bidderZone - Zone revealing
 * @param privateKey - Private key
 * @param value - Original value
 * @param nonce - Original nonce
 * @param commitId - Reference to commit attestation
 * @returns Reveal attestation
 */
export async function createRevealAttestation(
  bidderZone: ZoneId,
  privateKey: string,
  value: any,
  nonce: string,
  commitId: AttestationId
): Promise<Attestation> {
  const payload: RevealPayload = {
    value,
    nonce,
    revealedAt: Math.floor(Date.now() / 1000)
  };

  const input: AttestationInput = {
    zone: bidderZone,
    subject: sha256Hex(JSON.stringify(payload)) as SubjectHash,
    canon: REVEAL_CANON,
    time: payload.revealedAt as UnixTimestamp,
    refs: [commitId] // Reference the commit
  };

  const { attestation } = await createAttestation(input, privateKey);
  return attestation;
}

/**
 * Verify reveal matches commitment
 *
 * @param commitAttestation - Commit attestation
 * @param revealAttestation - Reveal attestation
 * @param commitPayload - Parsed commit payload
 * @param revealPayload - Parsed reveal payload
 * @returns Validation result
 */
export function verifyReveal(
  commitAttestation: Attestation,
  revealAttestation: Attestation,
  commitPayload: CommitPayload,
  revealPayload: RevealPayload
): { valid: boolean; error?: string } {
  // Verify reveal refs the commit
  if (!revealAttestation.refs.includes(commitAttestation.id)) {
    return { valid: false, error: 'Reveal does not reference commit' };
  }

  // Verify reveal time > commit time (causality)
  if (revealAttestation.time <= commitAttestation.time) {
    return { valid: false, error: 'Reveal time must be after commit time' };
  }

  // Recompute commitment from reveal
  const recomputedCommitment = createCommitmentHash(revealPayload.value, revealPayload.nonce);

  // Verify commitment matches
  if (recomputedCommitment !== commitPayload.commitment) {
    return {
      valid: false,
      error: `Commitment mismatch: expected ${commitPayload.commitment}, got ${recomputedCommitment}`
    };
  }

  return { valid: true };
}
