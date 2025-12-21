/**
 * Comprehensive tests for @glogos/core
 *
 * These tests validate the implementation against the protocol specification
 * and the shared test vectors.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  // Constants
  GLR,
  GENESIS_TIMESTAMP,
  GENESIS_ZONE_ID,
  GENESIS_ATTESTATION_ID,
  GENESIS_SUBJECT,
  GENESIS_PUBLIC_KEY,
  STANDARD_CANONS,
  DOMAIN_SEPARATOR,

  // Crypto
  sha256Hex,
  hexToBytes,
  bytesToHex,
  uint64BE,
  concatBytes,
  stringToBytes,

  // Zone
  computeZoneId,
  generateZone,
  validateZone,

  // Canon
  computeCanonId,
  RAW_SHA256,
  TIMESTAMP,
  CANON_DEFINITION,

  // Attestation
  computeAttestationId,
  computeRefsHash,
  createAttestation,
  verifyAttestation,
  parseAttestation
} from '../src/index.js';

import type {
  AttestationInput,
  ZoneId,
  SubjectHash,
  CanonId,
  HashHex,
  UnixTimestamp
} from '../src/types/index.js';

// Load test vectors
import testVectors from '../../../../shared/test-vectors/protocol-vectors.json';

describe('GLR (Glogos Root)', () => {
  it('should be SHA256 of empty string', () => {
    const computed = sha256Hex('');
    expect(computed).toBe(GLR);
    expect(computed).toBe(testVectors.vectors.glr.expected);
  });
});

describe('Zone Computation', () => {
  it('should compute zone ID from public key', () => {
    const { public_key, expected_zone_id } = testVectors.vectors.zone_computation;
    const zoneId = computeZoneId(public_key);
    expect(zoneId).toBe(expected_zone_id);
  });

  it('should generate a new zone', async () => {
    const zone = await generateZone();
    expect(zone.id).toHaveLength(64);
    expect(zone.publicKey).toHaveLength(64);
    expect(zone.privateKey).toHaveLength(64);
    expect(validateZone(zone.id, zone.publicKey)).toBe(true);
  });

  it('should validate zone correctly', () => {
    const { public_key, expected_zone_id } = testVectors.vectors.zone_computation;
    expect(validateZone(expected_zone_id, public_key)).toBe(true);
    expect(validateZone('0'.repeat(64), public_key)).toBe(false);
  });
});

describe('Canon Computation', () => {
  it('should compute raw:sha256:1.0 canon ID', () => {
    const { name, expected_id } = testVectors.vectors.canon_ids.raw_sha256;
    expect(computeCanonId(name)).toBe(expected_id);
    expect(RAW_SHA256.id).toBe(expected_id);
  });

  it('should compute timestamp:1.0 canon ID', () => {
    const { name, expected_id } = testVectors.vectors.canon_ids.timestamp;
    expect(computeCanonId(name)).toBe(expected_id);
    expect(TIMESTAMP.id).toBe(expected_id);
  });

  it('should compute canon-definition:1.0 canon ID', () => {
    const { name, expected_id } = testVectors.vectors.canon_ids.canon_definition;
    expect(computeCanonId(name)).toBe(expected_id);
    expect(CANON_DEFINITION.id).toBe(expected_id);
  });
});

describe('Refs Hash Computation', () => {
  it('should return GLR for empty refs', () => {
    const refsHash = computeRefsHash([]);
    expect(refsHash).toBe(GLR);
    expect(refsHash).toBe(testVectors.vectors.refs_hash.empty_refs.expected);
  });

  it('should compute hash for single ref (GLR)', () => {
    const { refs, expected } = testVectors.vectors.refs_hash.single_ref_glr;
    const refsHash = computeRefsHash(refs as HashHex[]);
    expect(refsHash).toBe(expected);
  });

  it('should sort and join multiple refs with delimiter', () => {
    const { refs, expected } = testVectors.vectors.refs_hash.multiple_refs_unsorted;
    const refsHash = computeRefsHash(refs as HashHex[]);
    expect(refsHash).toBe(expected);
  });
});

describe('Attestation ID Computation', () => {
  it('should compute attestation ID correctly', () => {
    const input: AttestationInput = {
      zone: testVectors.vectors.attestation_id_computation.zone_hex as ZoneId,
      subject: testVectors.vectors.attestation_id_computation.subject_hex as SubjectHash,
      canon: testVectors.vectors.attestation_id_computation.canon_hex as CanonId,
      time: testVectors.vectors.attestation_id_computation.time as UnixTimestamp,
      refs: []
    };

    const attestationId = computeAttestationId(input);
    expect(attestationId).toBe(testVectors.vectors.attestation_id_computation.expected_id);
  });

  it('should encode time as BE64 correctly', () => {
    const time = testVectors.vectors.attestation_id_computation.time;
    const timeBytes = uint64BE(time);
    const timeHex = bytesToHex(timeBytes);
    expect(timeHex).toBe(testVectors.vectors.attestation_id_computation.time_be64_hex);
  });
});

describe('Attestation Creation and Verification', () => {
  let testZone: { id: ZoneId; publicKey: string; privateKey: string };

  beforeAll(async () => {
    testZone = await generateZone();
  });

  it('should create and verify a new attestation', async () => {
    const input: AttestationInput = {
      zone: testZone.id,
      subject: sha256Hex('test content') as SubjectHash,
      canon: STANDARD_CANONS.RAW_SHA256 as CanonId,
      time: Math.floor(Date.now() / 1000) as UnixTimestamp,
      refs: [GLR as HashHex]
    };

    const { attestation } = await createAttestation(input, testZone.privateKey);

    // Verify the attestation
    const result = await verifyAttestation(attestation, testZone.publicKey);
    expect(result.valid).toBe(true);
  });

  it('should fail verification with wrong public key', async () => {
    const input: AttestationInput = {
      zone: testZone.id,
      subject: sha256Hex('test content') as SubjectHash,
      canon: STANDARD_CANONS.RAW_SHA256 as CanonId,
      time: Math.floor(Date.now() / 1000) as UnixTimestamp,
      refs: []
    };

    const { attestation } = await createAttestation(input, testZone.privateKey);

    // Try to verify with a different public key
    const otherZone = await generateZone();
    const result = await verifyAttestation(attestation, otherZone.publicKey);
    expect(result.valid).toBe(false);
  });

  it('should parse attestation from JSON', async () => {
    const input: AttestationInput = {
      zone: testZone.id,
      subject: sha256Hex('test content') as SubjectHash,
      canon: STANDARD_CANONS.RAW_SHA256 as CanonId,
      time: Math.floor(Date.now() / 1000) as UnixTimestamp,
      refs: [GLR as HashHex]
    };

    const { attestation, json } = await createAttestation(input, testZone.privateKey, {
      prettyPrint: true
    });

    const parsed = parseAttestation(json);
    expect(parsed.id).toBe(attestation.id);
    expect(parsed.zone).toBe(attestation.zone);
    expect(parsed.subject).toBe(attestation.subject);
    expect(parsed.canon).toBe(attestation.canon);
    expect(parsed.time).toBe(attestation.time);
    expect(parsed.refs).toEqual(attestation.refs);
    expect(parsed.proof).toBe(attestation.proof);
  });
});

describe('Crypto Utilities', () => {
  it('should concatenate bytes correctly', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5, 6]);
    const result = concatBytes(a, b);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it('should convert string to bytes correctly', () => {
    const str = 'hello';
    const bytes = stringToBytes(str);
    expect(bytes).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
  });

  it('should convert bytes to hex correctly', () => {
    const bytes = new Uint8Array([0, 255, 16, 32]);
    const hex = bytesToHex(bytes);
    expect(hex).toBe('00ff1020');
  });

  it('should convert hex to bytes correctly', () => {
    const hex = '00ff1020';
    const bytes = hexToBytes(hex);
    expect(bytes).toEqual(new Uint8Array([0, 255, 16, 32]));
  });
});
