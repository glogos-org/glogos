/**
 * Attestation Module for Glogos Protocol
 *
 * An Attestation is a signed statement with provenance containing:
 * (zone, subject, canon, time, refs, proof)
 *
 * @module attestation
 */

import {
  sha256Hex,
  hexToBytes,
  concatBytes,
  uint64BE,
  sign,
  verify,
  isValidHashHex,
  isValidSignatureHex
} from '../crypto/index.js';
import { GLR, REFS_DELIMITER } from '../constants.js';
import type {
  Attestation,
  AttestationInput,
  AttestationId,
  HashHex,
  SignatureHex,
  SubjectHash,
  CanonId,
  ZoneId,
  UnixTimestamp,
  VerificationResult,
  VerificationStep,
  CreateAttestationResult,
  CreateAttestationOptions
} from '../types/index.js';

/**
 * Compute attestation ID from input fields
 *
 * attestation_id = SHA-256(zone || subject || canon || BE64(time))
 */
export function computeAttestationId(input: AttestationInput): AttestationId {
  const zoneBytes = hexToBytes(input.zone);
  const subjectBytes = hexToBytes(input.subject);
  const canonBytes = hexToBytes(input.canon);
  const timeBytes = uint64BE(input.time);

  const combined = concatBytes(zoneBytes, subjectBytes, canonBytes, timeBytes);
  return sha256Hex(combined) as AttestationId;
}

/**
 * Compute refs hash according to the protocol
 *
 * If refs is not empty:
 *   sorted_refs = SORT(refs, lexicographic)
 *   refs_concat = JOIN(sorted_refs, "|")
 *   refs_hash = SHA-256(utf8(refs_concat))
 * Else:
 *   refs_hash = GLR
 */
export function computeRefsHash(refs: readonly string[]): HashHex {
  if (refs.length === 0) {
    return GLR as HashHex;
  }

  const sortedRefs = [...refs].sort();
  const refsConcat = sortedRefs.join(REFS_DELIMITER);
  return sha256Hex(refsConcat);
}

/**
 * Build the signature input for an attestation
 *
 * sign_input = attestation_id || subject || BE64(time) || refs_hash || canon
 * (136 bytes total)
 */
export function buildSignatureInput(
  attestationId: string,
  subject: string,
  time: number,
  refsHash: string,
  canon: string
): Uint8Array {
  return concatBytes(
    hexToBytes(attestationId), // 32 bytes
    hexToBytes(subject), // 32 bytes
    uint64BE(time), // 8 bytes
    hexToBytes(refsHash), // 32 bytes
    hexToBytes(canon) // 32 bytes
  );
}

/**
 * Create a new attestation
 */
export async function createAttestation(
  input: AttestationInput,
  privateKey: string,
  options?: CreateAttestationOptions
): Promise<CreateAttestationResult> {
  // Compute attestation ID
  const attestationId = computeAttestationId(input);

  // Compute refs hash
  const refsHash = computeRefsHash(input.refs);

  // Build signature input
  const signatureInput = buildSignatureInput(
    attestationId,
    input.subject,
    input.time,
    refsHash,
    input.canon
  );

  // Sign
  const proof = await sign(signatureInput, privateKey);

  // Construct attestation
  const attestation: Attestation = {
    id: attestationId,
    zone: input.zone,
    subject: input.subject,
    canon: input.canon,
    time: input.time,
    refs: input.refs,
    proof
  };

  // Serialize to JSON
  const json = JSON.stringify(
    {
      id: attestation.id,
      zone: attestation.zone,
      subject: attestation.subject,
      canon: attestation.canon,
      time: attestation.time,
      refs: attestation.refs,
      proof: attestation.proof
    },
    null,
    options?.prettyPrint ? 2 : undefined
  );

  return { attestation, json };
}

/**
 * Create an attestation for arbitrary content
 *
 * Convenience function that computes the subject hash automatically
 */
export async function attestContent(
  content: string | Uint8Array,
  zone: { id: ZoneId; privateKey: string },
  canon: CanonId,
  refs: readonly HashHex[] = [],
  options?: CreateAttestationOptions
): Promise<CreateAttestationResult> {
  const subject = sha256Hex(content) as SubjectHash;
  const time = (options?.timestamp ?? Math.floor(Date.now() / 1000)) as UnixTimestamp;

  const input: AttestationInput = {
    zone: zone.id,
    subject,
    canon,
    time,
    refs
  };

  return createAttestation(input, zone.privateKey, options);
}

/**
 * Verify an attestation
 */
export async function verifyAttestation(
  attestation: Attestation,
  publicKey: string
): Promise<VerificationResult> {
  const steps: VerificationStep[] = [];

  // Step 1: Verify zone matches public key
  const computedZone = sha256Hex(hexToBytes(publicKey));
  const zoneValid = computedZone === attestation.zone;
  steps.push({
    name: 'Zone verification',
    passed: zoneValid,
    expected: attestation.zone,
    actual: computedZone
  });

  if (!zoneValid) {
    return {
      valid: false,
      error: 'Zone ID does not match public key',
      steps
    };
  }

  // Step 2: Verify attestation ID
  const input: AttestationInput = {
    zone: attestation.zone,
    subject: attestation.subject,
    canon: attestation.canon,
    time: attestation.time,
    refs: attestation.refs
  };
  const expectedId = computeAttestationId(input);
  const idValid = expectedId === attestation.id;
  steps.push({
    name: 'Attestation ID verification',
    passed: idValid,
    expected: expectedId,
    actual: attestation.id
  });

  if (!idValid) {
    return {
      valid: false,
      error: 'Attestation ID does not match computed value',
      steps
    };
  }

  // Step 3: Compute refs hash
  const refsHash = computeRefsHash(attestation.refs);
  steps.push({
    name: 'Refs hash computation',
    passed: true,
    actual: refsHash
  });

  // Step 4: Build signature input
  const signatureInput = buildSignatureInput(
    attestation.id,
    attestation.subject,
    attestation.time,
    refsHash,
    attestation.canon
  );
  steps.push({
    name: 'Signature input construction',
    passed: true,
    actual: `${signatureInput.length} bytes`
  });

  // Step 5: Verify Ed25519 signature
  const signatureValid = await verify(signatureInput, attestation.proof, publicKey);
  steps.push({
    name: 'Ed25519 signature verification',
    passed: signatureValid
  });

  if (!signatureValid) {
    return {
      valid: false,
      error: 'Invalid signature',
      steps
    };
  }

  return {
    valid: true,
    steps
  };
}

/**
 * Parse attestation from JSON
 */
export function parseAttestation(json: string): Attestation {
  const data = JSON.parse(json) as Record<string, unknown>;

  // Validate required fields
  const requiredFields = ['id', 'zone', 'subject', 'canon', 'time', 'refs', 'proof'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate field types
  if (!isValidHashHex(data.id as string)) {
    throw new Error('Invalid attestation ID format');
  }
  if (!isValidHashHex(data.zone as string)) {
    throw new Error('Invalid zone ID format');
  }
  if (!isValidHashHex(data.subject as string)) {
    throw new Error('Invalid subject format');
  }
  if (!isValidHashHex(data.canon as string)) {
    throw new Error('Invalid canon ID format');
  }
  if (typeof data.time !== 'number' || !Number.isInteger(data.time)) {
    throw new Error('Invalid time format');
  }
  if (!Array.isArray(data.refs)) {
    throw new Error('Invalid refs format');
  }
  for (const ref of data.refs as string[]) {
    if (!isValidHashHex(ref)) {
      throw new Error('Invalid ref format');
    }
  }
  if (!isValidSignatureHex(data.proof as string)) {
    throw new Error('Invalid proof format');
  }

  return {
    id: data.id as AttestationId,
    zone: data.zone as ZoneId,
    subject: data.subject as SubjectHash,
    canon: data.canon as CanonId,
    time: data.time as UnixTimestamp,
    refs: data.refs as HashHex[],
    proof: data.proof as SignatureHex
  };
}

/**
 * Validate attestation structure (without verifying signature)
 */
export function validateAttestationStructure(attestation: Attestation): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isValidHashHex(attestation.id)) {
    errors.push('Invalid attestation ID format');
  }
  if (!isValidHashHex(attestation.zone)) {
    errors.push('Invalid zone ID format');
  }
  if (!isValidHashHex(attestation.subject)) {
    errors.push('Invalid subject format');
  }
  if (!isValidHashHex(attestation.canon)) {
    errors.push('Invalid canon ID format');
  }
  if (
    typeof attestation.time !== 'number' ||
    !Number.isInteger(attestation.time) ||
    attestation.time < 0
  ) {
    errors.push('Invalid time format');
  }
  if (!Array.isArray(attestation.refs)) {
    errors.push('Invalid refs format');
  } else {
    for (let i = 0; i < attestation.refs.length; i++) {
      if (!isValidHashHex(attestation.refs[i])) {
        errors.push(`Invalid ref at index ${i}`);
      }
    }
  }
  if (!isValidSignatureHex(attestation.proof)) {
    errors.push('Invalid proof format');
  }

  // Verify attestation ID computation
  if (errors.length === 0 || !errors.some((e) => e.includes('attestation ID'))) {
    const input: AttestationInput = {
      zone: attestation.zone,
      subject: attestation.subject,
      canon: attestation.canon,
      time: attestation.time,
      refs: attestation.refs
    };
    const computedId = computeAttestationId(input);
    if (computedId !== attestation.id) {
      errors.push(`Attestation ID mismatch: expected ${computedId}, got ${attestation.id}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if an attestation references GLR (belongs to Glogos family)
 */
export function referencesGLR(attestation: Attestation): boolean {
  return attestation.refs.includes(GLR as HashHex);
}

/**
 * Check causality constraint: if A refs B (where B is an attestation), then A.time > B.time
 * Note: This requires access to the referenced attestation
 */
export function checkCausality(
  attestation: Attestation,
  referencedAttestations: Map<string, Attestation>
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const ref of attestation.refs) {
    // Skip GLR check
    if (ref === GLR) continue;

    const referenced = referencedAttestations.get(ref);
    if (referenced && attestation.time <= referenced.time) {
      violations.push(
        `Causality violation: attestation time (${attestation.time}) must be > referenced attestation time (${referenced.time}) for ref ${ref}`
      );
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
}
