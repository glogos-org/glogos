# Glogos

A Minimal Attestation Protocol

```
identity = hash(content)
```

---

## Attestation Structure

```text
{
  "zone": hash(public_key),        // Who
  "subject": hash(content),        // What
  "canon": hash(interpretation),   // How to interpret
  "time": unix_timestamp,          // When
  "refs": [attestation_ids],       // Causal chain
  "proof": ed25519_signature       // Binding
}
```

All identifiers are self-certifying, content-addressed, and universally verifiable.

---

## Universal Anchor

**GLR** (Glogos Root) = SHA-256("")

```
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

Any attestation tracing refs to GLR belongs to the Glogos family.

---

## Key Properties

| Property            | Description                                             |
| ------------------- | ------------------------------------------------------- |
| **Self-certifying** | zone = hash(public_key)                                 |
| **Causal ordering** | refs chain provides ordering without external witnesses |
| **No consensus**    | Simpler than blockchain                                 |
| **DID interop**     | did:glogos ↔ did:key via alsoKnownAs                    |

---

## DID Interoperability

Glogos zones map to W3C Decentralized Identifiers:

```json
{
  "id": "did:glogos:<zone_id>",
  "alsoKnownAs": ["did:key:z6Mk..."]
}
```

Same public key, different encoding — interoperable with did:key ecosystem.

---

## Specification

| Document                                                          | Description                           |
| ----------------------------------------------------------------- | ------------------------------------- |
| [GLOGOS.md](./GLOGOS.md)                                          | Abstract protocol (no version number) |
| [GENESIS.md](./GENESIS.md)                                        | Winter Solstice 2025 genesis rules    |
| [genesis-artifact.json](./shared/artifacts/genesis-artifact.json) | Official genesis data                 |

---

## Attestation DAG

```
GLR (e3b0c442...)
      │
      ▼
Genesis Attestation (03b42642...)   ← genesis-artifact.json (IS the attestation)
      │
      ▼
GLOGOS.md (cc1d6cf2...)             ← GLOGOS.md.glo
      │
      ▼
GENESIS.md (8af1734f...)            ← GENESIS.md.glo
      │
      ▼
witness.py (fca075a7...)            ← ceremony/witness.py.glo
      │
      ▼
genesis-artifact.json (86240184...) ← shared/artifacts/genesis-artifact.json.glo
```

| File                                                              | Attestation                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [genesis-artifact.json](./shared/artifacts/genesis-artifact.json) | Genesis Attestation itself                                                |
| [GLOGOS.md](./GLOGOS.md)                                          | [GLOGOS.md.glo](./GLOGOS.md.glo)                                          |
| [GENESIS.md](./GENESIS.md)                                        | [GENESIS.md.glo](./GENESIS.md.glo)                                        |
| [witness.py](./ceremony/witness.py)                               | [witness.py.glo](./ceremony/witness.py.glo)                               |
| [genesis-artifact.json](./shared/artifacts/genesis-artifact.json) | [genesis-artifact.json.glo](./shared/artifacts/genesis-artifact.json.glo) |

---

## Example Zone

See [shared/zones/](./shared/zones/) for zone examples:

| File                                                        | Description      |
| ----------------------------------------------------------- | ---------------- |
| [zone-1-identity.json](./shared/zones/zone-1-identity.json) | Zone metadata    |
| [zone-1-did.json](./shared/zones/zone-1-did.json)           | W3C DID Document |

---

## Quick Verify

```bash
# GLR - SHA-256 of empty string
printf '' | sha256sum
# e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

# Genesis subject - SHA-256 of motto
printf 'From nothing, truth emerges' | sha256sum
# 73c14a502ae8b0e3035ab28c1f379567343c47afed318c898978474398ebe042
```

---

## Run Verification

```bash
git clone https://github.com/glogos-org/glogos.git
cd glogos
pnpm install && pnpm build && pnpm test
```

---

## PoC Use Cases (Logic Layer 0 in Action)

The `examples/` directory contains functioning Proofs of Concept demonstrating Glogos across various domains:

| Domain         | PoC Example                                                    | Key Concept                      |
| :------------- | :------------------------------------------------------------- | :------------------------------- |
| **Governance** | [Digital Constitution](./examples/use-cases/constitution.ts)   | Social Coordination Layer 0      |
| **Governance** | [Commitment Device](./examples/use-cases/commitment-device.ts) | Causal Proofs of Credibility     |
| **Governance** | [Sybil Resistance](./examples/use-cases/sybil-resistance.ts)   | Web of Trust / Trust Graphs      |
| **Finance**    | [Liquidity Pool](./examples/use-cases/liquidity-pool.ts)       | Automated Liquidity Coordination |
| **Finance**    | [Payment Transaction](./examples/use-cases/transaction.ts)     | Triple-Entry Accounting Proofs   |
| **Science**    | [Impact Evaluation](./examples/use-cases/impact-evaluation.ts) | Public Goods & Social Impact     |
| **Science**    | [Data Integrity](./examples/use-cases/data-integrity.ts)       | Reproducible Research Integrity  |
| **Economy**    | [Matching Market](./examples/use-cases/matching-market.ts)     | Stable Matching / Gale-Shapley   |
| **Economy**    | [Mechanism Design](./examples/use-cases/mechanism-design.ts)   | Incentive Compatibility          |
| **Economy**    | [Supply Chain](./examples/use-cases/supply-chain.ts)           | Resilient Cross-border Trade     |

Run all examples:

```bash
cd examples
pnpm run all
```

---

## Related

| Repo                                             | Description                      |
| ------------------------------------------------ | -------------------------------- |
| [glo-cli](https://github.com/glogos-org/glo-cli) | CLI tool (`pip install glo-cli`) |

---

## Project Structure

| Component                | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| **GLOGOS.md**            | Abstract Layer 0 specification (sealed)                           |
| **GENESIS.md**           | Concrete genesis rules (sealed)                                   |
| [examples/](./examples/) | **Proofs of Concept** (Nobel-themed use cases: Gov, Fin, Science) |
| [sdk/](./sdk/)           | SDK implementations for developers (TypeScript/Node.js)           |
| [ceremony/](./ceremony/) | Genesis ceremony scripts (Python/TypeScript reference)            |
| [shared/](./shared/)     | Universal schemas, test vectors, and artifacts                    |

---

## References

| Standard                                                                 | Description               |
| ------------------------------------------------------------------------ | ------------------------- |
| [FIPS 180-4](https://csrc.nist.gov/publications/detail/fips/180/4/final) | SHA-256 specification     |
| [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032)                | Ed25519 signature scheme  |
| [RFC 8259](https://datatracker.ietf.org/doc/html/rfc8259)                | JSON format               |
| [W3C DID Core](https://www.w3.org/TR/did-core/)                          | Decentralized Identifiers |
| [W3C VC](https://www.w3.org/TR/vc-data-model/)                           | Verifiable Credentials    |
| [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119)                | Requirement keywords      |

---

## License

- Documentation: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)
- Code: [MIT](https://opensource.org/license/MIT)

---

**Genesis: 2025-12-21T15:03:00 UTC (Winter Solstice)**

_"From nothing, truth emerges"_
