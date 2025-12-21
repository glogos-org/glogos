/**
 * Canon Module for Glogos Protocol
 *
 * A Canon defines semantic namespace for attestation interpretation:
 * canon_id = SHA-256(utf8(canon_name))
 *
 * Canon names follow the convention {namespace}:{type}:{version}
 *
 * @module canon
 */

import { sha256Hex } from '../crypto/index.js';
import { STANDARD_CANONS } from '../constants.js';
import type { CanonId, Canon } from '../types/index.js';

/**
 * Compute canon ID from a canon name
 *
 * @param name - Canon name following {namespace}:{type}:{version} convention
 * @returns Canon ID (SHA-256 of UTF-8 encoded name)
 */
export function computeCanonId(name: string): CanonId {
  return sha256Hex(name) as CanonId;
}

/**
 * Create a Canon from a name
 *
 * @param name - Canon name
 * @param description - Optional description
 * @returns Canon object
 */
export function createCanon(name: string, description?: string): Canon {
  return {
    id: computeCanonId(name),
    name,
    description
  };
}

/**
 * Validate canon name format
 * Recommended format: {namespace}:{type}:{version}
 *
 * @param name - Canon name to validate
 * @returns True if the name follows the recommended format
 */
export function isValidCanonName(name: string): boolean {
  // Basic validation: should have at least namespace:type:version
  const parts = name.split(':');
  if (parts.length < 3) {
    return false;
  }

  // Check version is valid semver-like
  const version = parts[parts.length - 1];
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) {
    return false;
  }

  // Check namespace and type are non-empty
  return parts.slice(0, -1).every((part) => part.length > 0);
}

/**
 * Standard canon: raw:sha256:1.0
 * Used for raw data hash attestation
 */
export const RAW_SHA256: Canon = {
  id: STANDARD_CANONS.RAW_SHA256 as CanonId,
  name: 'raw:sha256:1.0',
  description: 'Raw data hash attestation - subject is SHA256 of arbitrary data'
};

/**
 * Standard canon: timestamp:simple:1.0
 * Used for simple timestamping
 */
export const TIMESTAMP: Canon = {
  id: STANDARD_CANONS.TIMESTAMP as CanonId,
  name: 'timestamp:simple:1.0',
  description: 'Simple timestamping - proves data existed at attestation time'
};

/**
 * Standard canon: canon:definition:1.0
 * Used for defining new canons
 */
export const CANON_DEFINITION: Canon = {
  id: STANDARD_CANONS.CANON_DEFINITION as CanonId,
  name: 'canon:definition:1.0',
  description: 'Define new canons - subject is hash of canon definition document'
};

/**
 * Registry of standard canons
 */
export const STANDARD_CANON_REGISTRY: ReadonlyMap<string, Canon> = new Map([
  [RAW_SHA256.id, RAW_SHA256],
  [TIMESTAMP.id, TIMESTAMP],
  [CANON_DEFINITION.id, CANON_DEFINITION]
]);

/**
 * Look up a standard canon by ID
 */
export function getStandardCanon(canonId: string): Canon | undefined {
  return STANDARD_CANON_REGISTRY.get(canonId);
}

/**
 * Check if a canon ID is a standard canon
 */
export function isStandardCanon(canonId: string): boolean {
  return STANDARD_CANON_REGISTRY.has(canonId);
}

/**
 * Export canon to JSON format
 */
export function canonToJson(canon: Canon): string {
  return JSON.stringify(
    {
      id: canon.id,
      name: canon.name,
      description: canon.description
    },
    null,
    2
  );
}

/**
 * Parse namespace, type, and version from a canon name
 */
export function parseCanonName(name: string): {
  namespace: string;
  type: string;
  version: string;
} | null {
  const parts = name.split(':');
  if (parts.length < 3) {
    return null;
  }

  const version = parts[parts.length - 1];
  const type = parts[parts.length - 2];
  const namespace = parts.slice(0, -2).join(':');

  return { namespace, type, version };
}
