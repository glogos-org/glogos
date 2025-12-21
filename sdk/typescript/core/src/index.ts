/**
 * @glogos/core - Core library for the Glogos minimal attestation protocol
 *
 * Glogos is a minimal attestation protocol where identity is derived from content:
 * identity = SHA256(content)
 *
 * @packageDocumentation
 */

// Re-export all modules
export * from './constants.js';
export * from './types/index.js';
export * from './crypto/index.js';
export * from './zone/index.js';
export * from './canon/index.js';
export * from './attestation/index.js';

// Named exports for convenience
export {
  // Constants
  GLR,
  DOMAIN_SEPARATOR,
  GENESIS_TIMESTAMP,
  GENESIS_DATE,
  STANDARD_CANONS,
  GENESIS_ZONE_ID,
  GENESIS_ATTESTATION_ID,
  GENESIS_SUBJECT,
  GENESIS_PUBLIC_KEY
} from './constants.js';

export {
  // Crypto utilities
  sha256Hex,
  bytesToHex,
  hexToBytes,
  stringToBytes,
  concatBytes,
  uint64BE,
  generateKeyPair,
  keyPairFromSeed,
  sign,
  verify,
  isValidHashHex,
  isValidSignatureHex,
  isValidPublicKeyHex
} from './crypto/index.js';

export {
  // Zone operations
  computeZoneId,
  createZoneFromPublicKey,
  generateZone,
  createZoneFromSeed,
  validateZone,
  zoneToJson,
  zoneFromJson
} from './zone/index.js';

export {
  // Canon operations
  computeCanonId,
  createCanon,
  isValidCanonName,
  getStandardCanon,
  isStandardCanon,
  canonToJson,
  parseCanonName,
  RAW_SHA256,
  TIMESTAMP,
  CANON_DEFINITION,
  STANDARD_CANON_REGISTRY
} from './canon/index.js';

export {
  // Attestation operations
  computeAttestationId,
  computeRefsHash,
  buildSignatureInput,
  createAttestation,
  attestContent,
  verifyAttestation,
  parseAttestation,
  validateAttestationStructure,
  referencesGLR,
  checkCausality
} from './attestation/index.js';

// Optional Canons (Extensions)
export * from './optional-canons/index.js';

export {
  // Optional Canon identifiers
  OPTIONAL_CANONS,
  OPTIONAL_CANON_REGISTRY,

  // Triple-Entry Accounting
  validateTripleEntry,
  computeBalance,
  extractIssuer,

  // Taint Propagation
  TaintFilter,
  detectCanon,
  usesCanon,
  usesOptionalCanon
} from './optional-canons/index.js';

/**
 * Library version
 */
export const VERSION = '1.0.0';

/**
 * Protocol version
 */
export const PROTOCOL_VERSION = '1.0.0';
