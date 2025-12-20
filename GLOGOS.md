# Glogos

A Minimal Attestation Protocol

---

## 1. Root

**GLR** (Glogos Root) is the SHA-256 hash of the empty string:

```
GLR = SHA-256("")
    = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

GLR serves as the universal anchor point. Any attestation network that traces its references to GLR belongs to the Glogos family.

---

## 2. Principle

```
identity = hash(content)
```

All identifiers are derived from content through cryptographic hashing. This makes them self-certifying, content-addressed, and universally verifiable without relying on external authorities.

---

## 3. Attestation

An attestation consists of six fields:

| Field       | Type      | Meaning                                             |
| ----------- | --------- | --------------------------------------------------- |
| **zone**    | hash      | Who: `hash(public_key)`                             |
| **subject** | hash      | What: `hash(content)`                               |
| **canon**   | hash      | How to interpret: `hash(canon_name)`                |
| **time**    | integer   | When: temporal coordinate                           |
| **refs**    | hash[]    | From where: references to other attestations or GLR |
| **proof**   | signature | Binding: cryptographic signature                    |

---

## 4. Computation

### Attestation ID

```
attestation_id = hash(zone || subject || canon || time_bytes)
```

### Refs Hash

```
if refs is empty:
    refs_hash = GLR
else:
    refs_hash = hash(join(sort(refs), "|"))
```

### Signature Input

```
sign_input = attestation_id || subject || time_bytes || refs_hash || canon
```

---

## 5. Invariants

1. `zone_id = hash(public_key)`
2. `verify(proof, sign_input, public_key) = true`
3. DAG is acyclic
4. If A refs B (attestation, B ≠ GLR), then `A.time > B.time`
5. Same inputs produce same attestation_id
6. Implementations should warn if `A.time >> max(B.time)` (anomalous gap)

---

## 6. Neutrality

The protocol accepts all cryptographically valid attestations. It does not evaluate content, reputation, or meaning. Semantic interpretation is the responsibility of applications built on top.

Truth is determined by provenance, not authority. The refs field creates a path that gives claims their meaning.

---

## 7. Extensibility

This document defines structure only. Specific choices — hash function, signature scheme, serialization format, optional features — are specified in genesis documents.

**Hash function requirements:** collision resistance, preimage resistance, second-preimage resistance.

**Signature scheme requirements:** existential unforgeability (EUF-CMA).

---

_This document describes a mathematical structure. It has no version number._

_Realized by Le Manh Thanh_
