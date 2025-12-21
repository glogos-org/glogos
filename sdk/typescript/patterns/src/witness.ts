/**
 * @glogos/patterns - Witness Pattern
 *
 * Multi-party attestation validation pattern.
 * Used when multiple zones need to attest to observing the same event.
 */

import {
  createAttestation,
  verifyAttestation,
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
 * Canon for witness attestations
 */
export const WITNESS_CANON = computeCanonId('opt:pattern:witness:1.0');

/**
 * Witness attestation payload
 */
export interface WitnessPayload {
  /** The attestation being witnessed */
  witnessedAttestation: AttestationId;
  /** Optional observation notes */
  notes?: string;
  /** Timestamp of witness */
  witnessedAt: number;
}

/**
 * Options for witness validation
 */
export interface WitnessValidationOptions {
  /** Minimum number of witnesses required */
  minWitnesses: number;
  /** Maximum age of witness attestation (seconds) */
  maxAge?: number;
  /** Required witness zones (if specified, all must be present) */
  requiredWitnesses?: ZoneId[];
}

/**
 * Create a witness attestation
 *
 * @param witnessZone - Zone creating the witness attestation
 * @param privateKey - Private key of witness zone
 * @param targetAttestation - The attestation being witnessed
 * @param notes - Optional observation notes
 * @returns Witness attestation
 */
export async function createWitnessAttestation(
  witnessZone: ZoneId,
  privateKey: string,
  targetAttestation: Attestation,
  notes?: string
): Promise<Attestation> {
  const payload: WitnessPayload = {
    witnessedAttestation: targetAttestation.id,
    witnessedAt: Math.floor(Date.now() / 1000),
    notes
  };

  const input: AttestationInput = {
    zone: witnessZone,
    subject: sha256Hex(JSON.stringify(payload)) as SubjectHash,
    canon: WITNESS_CANON,
    time: payload.witnessedAt as UnixTimestamp,
    refs: [targetAttestation.id] // Reference the witnessed attestation
  };

  const { attestation } = await createAttestation(input, privateKey);
  return attestation;
}

/**
 * Validate witness attestations
 *
 * @param targetAttestation - The attestation being witnessed
 * @param witnesses - Array of witness attestations
 * @param publicKeys - Map of zone IDs to public keys
 * @param options - Validation options
 * @returns Validation result
 */
export async function validateWitnesses(
  targetAttestation: Attestation,
  witnesses: Attestation[],
  publicKeys: Map<ZoneId, string>,
  options: WitnessValidationOptions
): Promise<{ valid: boolean; validWitnesses: Attestation[]; errors: string[] }> {
  const errors: string[] = [];
  const validWitnesses: Attestation[] = [];

  // Filter witnesses that reference the target
  const relevantWitnesses = witnesses.filter(
    (w) => w.refs.includes(targetAttestation.id) && w.canon === WITNESS_CANON
  );

  if (relevantWitnesses.length < options.minWitnesses) {
    errors.push(`Insufficient witnesses: ${relevantWitnesses.length} < ${options.minWitnesses}`);
  }

  // Verify each witness attestation
  for (const witness of relevantWitnesses) {
    const publicKey = publicKeys.get(witness.zone);
    if (!publicKey) {
      errors.push(`No public key for witness zone ${witness.zone}`);
      continue;
    }

    const result = await verifyAttestation(witness, publicKey);
    if (!result.valid) {
      errors.push(`Invalid witness signature for zone ${witness.zone}`);
      continue;
    }

    // Check witness time vs target time (witness should be after target)
    if (witness.time < targetAttestation.time) {
      errors.push(`Witness ${witness.zone} timestamp before target`);
      continue;
    }

    // Check max age if specified
    if (options.maxAge) {
      const age = Math.floor(Date.now() / 1000) - witness.time;
      if (age > options.maxAge) {
        errors.push(`Witness ${witness.zone} too old: ${age}s > ${options.maxAge}s`);
        continue;
      }
    }

    validWitnesses.push(witness);
  }

  // Check required witnesses
  if (options.requiredWitnesses) {
    const witnessZones = new Set(validWitnesses.map((w) => w.zone));
    for (const required of options.requiredWitnesses) {
      if (!witnessZones.has(required)) {
        errors.push(`Missing required witness: ${required}`);
      }
    }
  }

  const valid = validWitnesses.length >= options.minWitnesses && errors.length === 0;

  return { valid, validWitnesses, errors };
}

/**
 * Count witnesses for an attestation
 *
 * @param targetAttestation - The attestation being witnessed
 * @param witnesses - Array of potential witness attestations
 * @returns Count of valid witness attestations
 */
export function countWitnesses(targetAttestation: Attestation, witnesses: Attestation[]): number {
  return witnesses.filter((w) => w.refs.includes(targetAttestation.id) && w.canon === WITNESS_CANON)
    .length;
}
