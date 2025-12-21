/**
 * Glogos Protocol Type Definitions
 *
 * These types define the data structures used throughout the protocol.
 * They are designed to be serialization-format agnostic.
 *
 * @module types
 */

/**
 * A 64-character lowercase hexadecimal string representing a SHA-256 hash
 */
export type HashHex = string & { readonly __brand: 'HashHex' };

/**
 * A 128-character lowercase hexadecimal string representing an Ed25519 signature
 */
export type SignatureHex = string & { readonly __brand: 'SignatureHex' };

/**
 * A 64-character lowercase hexadecimal string representing an Ed25519 public key
 */
export type PublicKeyHex = string & { readonly __brand: 'PublicKeyHex' };

/**
 * Zone identifier - SHA-256 hash of a public key
 */
export type ZoneId = HashHex & { readonly __zoneId: true };

/**
 * Attestation identifier - SHA-256 hash of attestation content
 */
export type AttestationId = HashHex & { readonly __attestationId: true };

/**
 * Canon identifier - SHA-256 hash of canon name
 */
export type CanonId = HashHex & { readonly __canonId: true };

/**
 * Subject identifier - SHA-256 hash of attested content
 */
export type SubjectHash = HashHex & { readonly __subjectHash: true };

/**
 * Unix timestamp in seconds
 */
export type UnixTimestamp = number & { readonly __unixTimestamp: true };

/**
 * Attestation structure as defined in the protocol
 */
export interface Attestation {
  /** Attestation identifier (computed) */
  readonly id: AttestationId;
  /** Zone ID of the attester */
  readonly zone: ZoneId;
  /** SHA256 hash of the content being attested */
  readonly subject: SubjectHash;
  /** Canon ID defining interpretation */
  readonly canon: CanonId;
  /** Unix timestamp in seconds */
  readonly time: UnixTimestamp;
  /** Referenced identifiers (attestation IDs or GLR) */
  readonly refs: readonly HashHex[];
  /** Ed25519 signature */
  readonly proof: SignatureHex;
}

/**
 * Input for creating a new attestation (before ID and proof are computed)
 */
export interface AttestationInput {
  /** Zone ID of the attester */
  readonly zone: ZoneId;
  /** SHA256 hash of the content being attested */
  readonly subject: SubjectHash;
  /** Canon ID defining interpretation */
  readonly canon: CanonId;
  /** Unix timestamp in seconds */
  readonly time: UnixTimestamp;
  /** Referenced identifiers (attestation IDs or GLR) */
  readonly refs: readonly HashHex[];
}

/**
 * Zone structure containing identity information
 */
export interface Zone {
  /** Zone identifier - SHA-256 of public key */
  readonly id: ZoneId;
  /** Ed25519 public key in hex */
  readonly publicKey: PublicKeyHex;
}

/**
 * Zone with private key for signing
 */
export interface ZoneWithPrivateKey extends Zone {
  /** Ed25519 private key (seed) in hex */
  readonly privateKey: string;
}

/**
 * Canon definition
 */
export interface Canon {
  /** Canon identifier - SHA256 of name */
  readonly id: CanonId;
  /** Canon name following {namespace}:{type}:{version} convention */
  readonly name: string;
  /** Optional description */
  readonly description?: string;
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Whether the verification passed */
  readonly valid: boolean;
  /** Error message if invalid */
  readonly error?: string;
  /** Detailed verification steps */
  readonly steps?: readonly VerificationStep[];
}

/**
 * Individual verification step
 */
export interface VerificationStep {
  /** Step name */
  readonly name: string;
  /** Whether this step passed */
  readonly passed: boolean;
  /** Expected value */
  readonly expected?: string;
  /** Actual value */
  readonly actual?: string;
}

/**
 * Genesis attestation with all computed values
 */
export interface GenesisAttestation extends Attestation {
  /** Genesis public key */
  readonly genesisPublicKey: PublicKeyHex;
}

/**
 * Result of creating an attestation
 */
export interface CreateAttestationResult {
  /** The created attestation */
  readonly attestation: Attestation;
  /** The attestation in JSON format */
  readonly json: string;
}

/**
 * Options for attestation creation
 */
export interface CreateAttestationOptions {
  /** Override timestamp (for testing) */
  readonly timestamp?: UnixTimestamp;
  /** Pretty print JSON output */
  readonly prettyPrint?: boolean;
}
