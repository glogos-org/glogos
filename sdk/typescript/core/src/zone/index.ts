/**
 * Zone Module for Glogos Protocol
 * 
 * A Zone is an identity derived from a public key:
 * zone_id = SHA256(public_key_bytes)
 * 
 * @module zone
 */

import { 
  sha256Hex, 
  hexToBytes, 
  generateKeyPair as cryptoGenerateKeyPair,
  keyPairFromSeed,
  isValidPublicKeyHex 
} from '../crypto/index.js';
import type { ZoneId, PublicKeyHex, Zone, ZoneWithPrivateKey } from '../types/index.js';

/**
 * Compute zone ID from a public key
 * 
 * @param publicKey - Ed25519 public key in hex format
 * @returns Zone ID (SHA256 of public key bytes)
 */
export function computeZoneId(publicKey: string): ZoneId {
  if (!isValidPublicKeyHex(publicKey)) {
    throw new Error('Invalid public key format');
  }
  const publicKeyBytes = hexToBytes(publicKey);
  return sha256Hex(publicKeyBytes) as ZoneId;
}

/**
 * Create a Zone from an existing public key
 * 
 * @param publicKey - Ed25519 public key in hex format
 * @returns Zone object
 */
export function createZoneFromPublicKey(publicKey: string): Zone {
  const id = computeZoneId(publicKey);
  return {
    id,
    publicKey: publicKey as PublicKeyHex,
  };
}

/**
 * Generate a new Zone with a fresh keypair
 * 
 * @returns Zone with private key for signing
 */
export async function generateZone(): Promise<ZoneWithPrivateKey> {
  const { publicKey, privateKey } = await cryptoGenerateKeyPair();
  const id = computeZoneId(publicKey);
  return {
    id,
    publicKey,
    privateKey,
  };
}

/**
 * Create a Zone from a seed (deterministic generation)
 * 
 * @param seed - 32-byte seed for deterministic key derivation
 * @returns Zone with private key
 */
export async function createZoneFromSeed(seed: Uint8Array): Promise<ZoneWithPrivateKey> {
  const { publicKey, privateKey } = await keyPairFromSeed(seed);
  const id = computeZoneId(publicKey);
  return {
    id,
    publicKey,
    privateKey,
  };
}

/**
 * Validate that a zone ID matches a public key
 * 
 * @param zoneId - Zone ID to validate
 * @param publicKey - Public key to check against
 * @returns True if the zone ID is correctly derived from the public key
 */
export function validateZone(zoneId: string, publicKey: string): boolean {
  try {
    const computed = computeZoneId(publicKey);
    return computed === zoneId;
  } catch {
    return false;
  }
}

/**
 * Export zone to JSON format
 */
export function zoneToJson(zone: Zone, includePrivateKey = false): string {
  const data: Record<string, string> = {
    id: zone.id,
    publicKey: zone.publicKey,
  };
  
  if (includePrivateKey && 'privateKey' in zone) {
    data.privateKey = (zone as ZoneWithPrivateKey).privateKey;
  }
  
  return JSON.stringify(data, null, 2);
}

/**
 * Import zone from JSON format
 */
export function zoneFromJson(json: string): Zone | ZoneWithPrivateKey {
  const data = JSON.parse(json) as Record<string, string>;
  
  if (!data.id || !data.publicKey) {
    throw new Error('Invalid zone JSON: missing required fields');
  }
  
  // Validate the zone ID matches the public key
  if (!validateZone(data.id, data.publicKey)) {
    throw new Error('Invalid zone: ID does not match public key');
  }
  
  if (data.privateKey) {
    return {
      id: data.id as ZoneId,
      publicKey: data.publicKey as PublicKeyHex,
      privateKey: data.privateKey,
    };
  }
  
  return {
    id: data.id as ZoneId,
    publicKey: data.publicKey as PublicKeyHex,
  };
}
