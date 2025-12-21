/**
 * Cryptographic Utilities for Glogos Protocol
 * 
 * This module provides all cryptographic operations required by the protocol:
 * - SHA-256 hashing (FIPS 180-4)
 * - Ed25519 signatures (RFC 8032)
 * - Key generation and derivation
 * 
 * @module crypto
 */

import { sha256 } from '@noble/hashes/sha256';
import * as ed25519 from '@noble/ed25519';
import { 
  HASH_HEX_LENGTH, 
  SIGNATURE_HEX_LENGTH, 
  PUBLIC_KEY_HEX_LENGTH,
  PRIVATE_KEY_LENGTH 
} from '../constants.js';
import type { HashHex, SignatureHex, PublicKeyHex } from '../types/index.js';

/**
 * Convert bytes to lowercase hexadecimal string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hexadecimal string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert string to UTF-8 bytes
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Compute SHA-256 hash of bytes
 */
export function sha256Hash(data: Uint8Array): Uint8Array {
  return sha256(data);
}

/**
 * Compute SHA-256 hash and return as hex string
 */
export function sha256Hex(data: Uint8Array | string): HashHex {
  const bytes = typeof data === 'string' ? stringToBytes(data) : data;
  return bytesToHex(sha256(bytes)) as HashHex;
}

/**
 * Concatenate multiple byte arrays
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Encode a 64-bit unsigned integer as big-endian bytes
 */
export function uint64BE(value: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  // JavaScript numbers are 64-bit floats, safe for integers up to 2^53-1
  view.setBigUint64(0, BigInt(value), false); // false = big-endian
  return new Uint8Array(buffer);
}

/**
 * Generate a new Ed25519 keypair
 */
export async function generateKeyPair(): Promise<{
  publicKey: PublicKeyHex;
  privateKey: string;
}> {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);
  return {
    publicKey: bytesToHex(publicKey) as PublicKeyHex,
    privateKey: bytesToHex(privateKey),
  };
}

/**
 * Derive Ed25519 keypair from a seed (32 bytes)
 */
export async function keyPairFromSeed(seed: Uint8Array): Promise<{
  publicKey: PublicKeyHex;
  privateKey: string;
}> {
  if (seed.length !== PRIVATE_KEY_LENGTH) {
    throw new Error(`Seed must be ${PRIVATE_KEY_LENGTH} bytes`);
  }
  const publicKey = await ed25519.getPublicKeyAsync(seed);
  return {
    publicKey: bytesToHex(publicKey) as PublicKeyHex,
    privateKey: bytesToHex(seed),
  };
}

/**
 * Sign a message with Ed25519
 */
export async function sign(
  message: Uint8Array,
  privateKey: string | Uint8Array
): Promise<SignatureHex> {
  const privateKeyBytes = typeof privateKey === 'string' 
    ? hexToBytes(privateKey) 
    : privateKey;
  const signature = await ed25519.signAsync(message, privateKeyBytes);
  return bytesToHex(signature) as SignatureHex;
}

/**
 * Verify an Ed25519 signature
 */
export async function verify(
  message: Uint8Array,
  signature: string | Uint8Array,
  publicKey: string | Uint8Array
): Promise<boolean> {
  const signatureBytes = typeof signature === 'string' 
    ? hexToBytes(signature) 
    : signature;
  const publicKeyBytes = typeof publicKey === 'string' 
    ? hexToBytes(publicKey) 
    : publicKey;
  
  try {
    return await ed25519.verifyAsync(signatureBytes, message, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Validate that a string is a valid hex hash (64 characters)
 */
export function isValidHashHex(value: string): value is HashHex {
  return (
    typeof value === 'string' &&
    value.length === HASH_HEX_LENGTH &&
    /^[0-9a-f]+$/.test(value)
  );
}

/**
 * Validate that a string is a valid signature hex (128 characters)
 */
export function isValidSignatureHex(value: string): value is SignatureHex {
  return (
    typeof value === 'string' &&
    value.length === SIGNATURE_HEX_LENGTH &&
    /^[0-9a-f]+$/.test(value)
  );
}

/**
 * Validate that a string is a valid public key hex (64 characters)
 */
export function isValidPublicKeyHex(value: string): value is PublicKeyHex {
  return (
    typeof value === 'string' &&
    value.length === PUBLIC_KEY_HEX_LENGTH &&
    /^[0-9a-f]+$/.test(value)
  );
}

export { sha256 } from '@noble/hashes/sha256';
export * as ed25519 from '@noble/ed25519';
