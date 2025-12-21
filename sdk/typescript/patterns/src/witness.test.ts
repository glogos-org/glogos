/**
 * Witness pattern tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateZone,
  createAttestation,
  sha256Hex,
  GLR,
  computeCanonId,
  type AttestationInput,
  type ZoneId
} from '@glogos/core';

import {
  createWitnessAttestation,
  validateWitnesses,
  countWitnesses,
  WITNESS_CANON
} from './witness.js';

describe('Witness Pattern', () => {
  let targetZone: { id: ZoneId; publicKey: string; privateKey: string };
  let witness1: { id: ZoneId; publicKey: string; privateKey: string };
  let witness2: { id: ZoneId; publicKey: string; privateKey: string };
  let witness3: { id: ZoneId; publicKey: string; privateKey: string };

  beforeAll(async () => {
    targetZone = await generateZone();
    witness1 = await generateZone();
    witness2 = await generateZone();
    witness3 = await generateZone();
  });

  it('should have correct witness canon ID', () => {
    expect(WITNESS_CANON).toBe(computeCanonId('opt:pattern:witness:1.0'));
  });

  it('should create a witness attestation', async () => {
    // Create target attestation
    const targetInput: AttestationInput = {
      zone: targetZone.id,
      subject: sha256Hex('test event'),
      canon: computeCanonId('raw:sha256:1.0'),
      time: Math.floor(Date.now() / 1000),
      refs: [GLR]
    };

    const { attestation: target } = await createAttestation(targetInput, targetZone.privateKey);

    // Create witness
    const witness = await createWitnessAttestation(
      witness1.id,
      witness1.privateKey,
      target,
      'I observed this event'
    );

    expect(witness.zone).toBe(witness1.id);
    expect(witness.canon).toBe(WITNESS_CANON);
    expect(witness.refs).toContain(target.id);
    expect(witness.time).toBeGreaterThanOrEqual(target.time);
  });

  it('should validate sufficient witnesses', async () => {
    // Create target
    const targetInput: AttestationInput = {
      zone: targetZone.id,
      subject: sha256Hex('fishing catch: 5000kg'),
      canon: computeCanonId('raw:sha256:1.0'),
      time: Math.floor(Date.now() / 1000),
      refs: [GLR]
    };

    const { attestation: target } = await createAttestation(targetInput, targetZone.privateKey);

    // Create witnesses
    const w1 = await createWitnessAttestation(
      witness1.id,
      witness1.privateKey,
      target,
      'Confirmed catch weight'
    );

    const w2 = await createWitnessAttestation(
      witness2.id,
      witness2.privateKey,
      target,
      'Verified measurement'
    );

    // Validate
    const publicKeys = new Map([
      [witness1.id, witness1.publicKey],
      [witness2.id, witness2.publicKey]
    ]);

    const result = await validateWitnesses(target, [w1, w2], publicKeys, {
      minWitnesses: 2
    });

    expect(result.valid).toBe(true);
    expect(result.validWitnesses).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail with insufficient witnesses', async () => {
    const targetInput: AttestationInput = {
      zone: targetZone.id,
      subject: sha256Hex('test'),
      canon: computeCanonId('raw:sha256:1.0'),
      time: Math.floor(Date.now() / 1000),
      refs: [GLR]
    };

    const { attestation: target } = await createAttestation(targetInput, targetZone.privateKey);

    const w1 = await createWitnessAttestation(witness1.id, witness1.privateKey, target);

    const publicKeys = new Map([[witness1.id, witness1.publicKey]]);

    const result = await validateWitnesses(target, [w1], publicKeys, {
      minWitnesses: 3 // Require 3 but only have 1
    });

    expect(result.valid).toBe(false);
    expect(result.validWitnesses).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should require specific witnesses when specified', async () => {
    const targetInput: AttestationInput = {
      zone: targetZone.id,
      subject: sha256Hex('important event'),
      canon: computeCanonId('raw:sha256:1.0'),
      time: Math.floor(Date.now() / 1000),
      refs: [GLR]
    };

    const { attestation: target } = await createAttestation(targetInput, targetZone.privateKey);

    const w1 = await createWitnessAttestation(witness1.id, witness1.privateKey, target);

    const publicKeys = new Map([
      [witness1.id, witness1.publicKey],
      [witness2.id, witness2.publicKey]
    ]);

    const result = await validateWitnesses(target, [w1], publicKeys, {
      minWitnesses: 1,
      requiredWitnesses: [witness1.id, witness2.id] // Require both
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`Missing required witness: ${witness2.id}`);
  });

  it('should count witnesses correctly', async () => {
    const targetInput: AttestationInput = {
      zone: targetZone.id,
      subject: sha256Hex('count test'),
      canon: computeCanonId('raw:sha256:1.0'),
      time: Math.floor(Date.now() / 1000),
      refs: [GLR]
    };

    const { attestation: target } = await createAttestation(targetInput, targetZone.privateKey);

    const w1 = await createWitnessAttestation(witness1.id, witness1.privateKey, target);
    const w2 = await createWitnessAttestation(witness2.id, witness2.privateKey, target);
    const w3 = await createWitnessAttestation(witness3.id, witness3.privateKey, target);

    const count = countWitnesses(target, [w1, w2, w3]);
    expect(count).toBe(3);
  });
});
