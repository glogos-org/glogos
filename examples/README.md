# Glogos Examples

Reference implementations demonstrating the Glogos protocol across multiple domains.

## Quick Start

```bash
# From project root
cd examples
pnpm install

# Run all 22 demos
pnpm run all

# Run a specific demo
pnpm run supply-chain
pnpm run art-provenance
pnpm run game
```

## TypeScript Use Cases (22 Demos)

### 📊 Economics (GENESIS.md Coverage)

| Demo                                                  | Canon                     | Description                                          |
| ----------------------------------------------------- | ------------------------- | ---------------------------------------------------- |
| [impact-evaluation](./use-cases/impact-evaluation.ts) | `opt:coord:rct:1.0`       | Randomized Controlled Trials (Banerjee/Duflo/Kremer) |
| [matching-market](./use-cases/matching-market.ts)     | `opt:coord:matching:1.0`  | Stable allocations (Roth/Shapley)                    |
| [liquidity-pool](./use-cases/liquidity-pool.ts)       | `opt:coord:liquidity:1.0` | Proof-of-reserves (Diamond/Dybvig)                   |

### 🏢 Business (GENESIS.md Coverage)

| Demo                                        | Canon                      | Description                    |
| ------------------------------------------- | -------------------------- | ------------------------------ |
| [constitution](./use-cases/constitution.ts) | `opt:biz:governance:1.0`   | Digital governance & voting    |
| [supply-chain](./use-cases/supply-chain.ts) | `opt:biz:supply-chain:1.0` | End-to-end provenance tracking |
| [transaction](./use-cases/transaction.ts)   | `opt:biz:transaction:1.0`  | B2B with proof-of-delivery     |

### 🔬 Science (GENESIS.md Coverage)

| Demo                                            | Canon                          | Description               |
| ----------------------------------------------- | ------------------------------ | ------------------------- |
| [data-integrity](./use-cases/data-integrity.ts) | `opt:science:data:1.0`         | Tamper-proof datasets     |
| [peer-review](./use-cases/peer-review.ts)       | `opt:science:reproducible:1.0` | Decentralized peer review |

### 🎨 Media (GENESIS.md Coverage)

| Demo                                            | Canon                                         | Description                          |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------------ |
| [art-provenance](./use-cases/art-provenance.ts) | `opt:media:art:1.0`<br>`opt:media:poetry:1.0` | NFT ownership & literary attribution |

### 🎓 Nobel Prize Economics

| Demo                                                  | Prize | Laureates                                          |
| ----------------------------------------------------- | ----- | -------------------------------------------------- |
| [carbon-credit](./use-cases/carbon-credit.ts)         | 2020  | Milgrom & Wilson (Auction Theory)                  |
| [employment](./use-cases/employment.ts)               | 2010  | Diamond, Mortensen & Pissarides (Search Theory)    |
| [prediction-market](./use-cases/prediction-market.ts) | 2013  | Fama, Hansen & Shiller (Asset Pricing)             |
| [principal-agent](./use-cases/principal-agent.ts)     | 2001  | Akerlof, Spence & Stiglitz (Information Asymmetry) |
| [mechanism-design](./use-cases/mechanism-design.ts)   | 2007  | Hurwicz, Maskin & Myerson                          |
| [public-goods](./use-cases/public-goods.ts)           | 1996  | Mirrlees & Vickrey (Optimal Taxation)              |
| [commitment-device](./use-cases/commitment-device.ts) | 2017  | Thaler (Behavioral Economics)                      |

### 🔧 Technical Features

| Demo                                                          | Feature    | Description                   |
| ------------------------------------------------------------- | ---------- | ----------------------------- |
| [federation](./use-cases/federation.ts)                       | Cross-zone | Multi-zone attestation chains |
| [key-rotation](./use-cases/key-rotation.ts)                   | Identity   | Cryptographic key rotation    |
| [gns-resolver](./use-cases/gns-resolver.ts)                   | Naming     | DNS-like resolution system    |
| [sybil-resistance](./use-cases/sybil-resistance.ts)           | Security   | Anti-Sybil mechanisms         |
| [right-to-be-forgotten](./use-cases/right-to-be-forgotten.ts) | Privacy    | GDPR compliance               |

### 🎯 Game Theory

| Demo                                      | Concept          | Description                   |
| ----------------------------------------- | ---------------- | ----------------------------- |
| [game-theory](./use-cases/game-theory.ts) | Nash Equilibrium | Prisoner's Dilemma resolution |

## Running Use Cases

**Run all 22 demos:**

```bash
pnpm run all
# Runs sequentially with summary at the end
```

**Run a specific demo:**

```bash
pnpm run <demo-name>

# Examples:
pnpm run supply-chain
pnpm run art-provenance
pnpm run game
pnpm run transaction
```

**Available demos:** See `package.json` scripts or run `pnpm run` to list all.

## Demo Output

Each demo produces:

- ✅ Attestation chains with cryptographic proofs
- 📊 Summary statistics and metrics
- 🔍 Verification results
- 💡 Key protocol benefits demonstrated

## Coverage Metrics

| Domain        | Coverage        | Canons                                |
| ------------- | --------------- | ------------------------------------- |
| **Economics** | 100% (3/3)      | RCT, Matching, Liquidity              |
| **Business**  | 100% (3/3)      | Governance, Supply Chain, Transaction |
| **Science**   | 100% (2/2)      | Data Integrity, Peer Review           |
| **Media**     | 100% (2/2)      | Art, Poetry                           |
| **Social**    | 33% (1/3)       | Commitment                            |
| **Overall**   | **77% (10/13)** | GENESIS.md domains                    |

---
