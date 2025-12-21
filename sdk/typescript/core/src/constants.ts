/**
 * Glogos Protocol Constants
 *
 * These are mathematical constants that define the Glogos protocol.
 * They are immutable and shared across all implementations.
 *
 * @module constants
 */

import type { ZoneId } from './types/index.js';

/**
 * GLR (Glogos Root) - The SHA-256 hash of the empty string.
 * This is the universal anchor point for all Glogos networks.
 *
 * Verification: printf '' | sha256sum
 */
export const GLR = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' as const;

/**
 * Domain separator for Winter Solstice Genesis 2025
 */
export const DOMAIN_SEPARATOR = 'glogos-genesis' as const;

/**
 * Genesis timestamp - Winter Solstice 2025 at 15:03 UTC
 * The exact astronomical moment when the Sun reaches its southernmost declination.
 */
export const GENESIS_TIMESTAMP = 1766329380 as const;

/**
 * Genesis date in ISO format
 */
export const GENESIS_DATE = '2025-12-21T15:03:00Z' as const;

/**
 * Standard canon identifiers
 */
export const STANDARD_CANONS = {
  /** Raw SHA-256 data hash attestation (raw:sha256:1.0) */
  RAW_SHA256: 'c794a6fc786ffc3941ec1a46065c4a94a97b6d548da7f8b717872f550619b327',
  /** Simple timestamping (timestamp:simple:1.0) */
  TIMESTAMP: '5c25b519c7892bf36d29a1d3cabe62cd56ec8c9438032d574cacce7e0e8e94ba',
  /** Define new canons (canon:definition:1.0) */
  CANON_DEFINITION: 'df4e66f5a2be89be05bae031aae388bc47ae51dedb4a863ee56228cc76f48265'
} as const;

/**
 * Genesis zone ID - derived deterministically from GLR
 */
export const GENESIS_ZONE_ID =
  'db1756c17220873bcb831c2f9c197081ab0d83acf2226b819880d62ce906c010' as ZoneId;

/**
 * Genesis attestation ID
 */
export const GENESIS_ATTESTATION_ID =
  '03b426423c8a7f3fe1d1204e564efcc9415f1f5d524b3e2fe7dfa78f38756546' as const;

/**
 * Genesis subject - SHA-256("From nothing, truth emerges")
 */
export const GENESIS_SUBJECT =
  '73c14a502ae8b0e3035ab28c1f379567343c47afed318c898978474398ebe042' as const;

/**
 * Genesis public key (Ed25519)
 */
export const GENESIS_PUBLIC_KEY =
  'c70b1f7e4ce8cb7f6f8f3984ff6fe8260469b6cf8f8f839f047ba64d894d4be8' as const;

/**
 * Hash output length in bytes
 */
export const HASH_LENGTH = 32 as const;

/**
 * Hash output length in hex characters
 */
export const HASH_HEX_LENGTH = 64 as const;

/**
 * Ed25519 signature length in bytes
 */
export const SIGNATURE_LENGTH = 64 as const;

/**
 * Ed25519 signature length in hex characters
 */
export const SIGNATURE_HEX_LENGTH = 128 as const;

/**
 * Ed25519 public key length in bytes
 */
export const PUBLIC_KEY_LENGTH = 32 as const;

/**
 * Ed25519 public key length in hex characters
 */
export const PUBLIC_KEY_HEX_LENGTH = 64 as const;

/**
 * Ed25519 private key (seed) length in bytes
 */
export const PRIVATE_KEY_LENGTH = 32 as const;

/**
 * Refs delimiter character for hash computation
 */
export const REFS_DELIMITER = '|' as const;
