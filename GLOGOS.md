# GLOGOS Protocol Specification

**Version:** 1.0.0-rc.1
**Status:** DRAFT

## 1. Abstract

Glogos is a minimal Layer 0 protocol for creating decentralized, verifiable identities and attestations rooted in pure mathematics and physical entropy, without reliance on any specific blockchain, server, or centralized authority.

The core axiom of Glogos is:

> **Identity is Content.**

Specifically:
`Identity = SHA256(Content)`

## 2. Core Primitives

### 2.1. The GLR (Glogos Life Root)

The absolute root of the Glogos protocol is the SHA-256 hash of an empty string. This serves as the "genesis block" for the entire system.

- **Value:** `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- **Derivation:** `SHA256("")`

### 2.2. Zone (Identity)

A "Zone" is a sovereign identity in Glogos. It is defined by an Ed25519 public key.

- **Zone ID:** `SHA256(Ed25519_PublicKey_Bytes)`
- **Function:** Signs attestations to prove authorship.

### 2.3. Canon (Schema/Standard)

A "Canon" defines the structure and semantics of a claim. It is itself a content-addressable object.

- **Canon ID:** `SHA256(Canon_Definition_Bytes)`
- **Standard Canon:** `raw:sha256:1.0` (The simplest possible claim: "This byte sequence exists")

### 2.4. Attestation (Claim)

An "Attestation" is a signed statement linking a Subject (content) to a Zone (identity) via a Canon (meaning), anchored by References (causality).

**Structure:**

```json
{
  "zone": "ZoneID",
  "sub": "SubjectHash",
  "can": "CanonID",
  "time": UnixTimestamp,
  "ref": ["PreviousHash1", "PreviousHash2"],
  "sig": "Ed25519_Signature"
}
```

## 3. The Genesis Ceremony

The Glogos protocol will be officially instantiated on **December 21, 2025 at 15:03 UTC** (Winter Solstice).

At this moment, a "Genesis Zone" will be derived deterministically from the GLR and other entropy sources to sign the first attestation:

> **"From nothing, truth emerges"**

This event anchors the protocol in time and space.
