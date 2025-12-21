# Glogos Protocol

The Layer 0 for Truth and Coordination.

```javascript
identity = hash(content);
```

---

## Specification

- **[GLOGOS.md](./GLOGOS.md)**: Core specification (abstract)
- **[GENESIS.md](./GENESIS.md)**: Genesis specification (concrete)
- **[genesis-artifact.json](./shared/artifacts/genesis-artifact.json)**: Official genesis data

---

## Quick Verify (No Install Required)

Anyone can verify these values with just a terminal:

```bash
# 1. GLR (Glogos Root) - SHA-256 of empty string
printf '' | sha256sum
# Expected: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

# 2. Standard Canon - SHA-256 of "raw:sha256:1.0"
printf 'raw:sha256:1.0' | sha256sum
# Expected: c794a6fc786ffc3941ec1a46065c4a94a97b6d548da7f8b717872f550619b327
```

---

## Run Full Verification

```bash
# Clone and install
git clone https://github.com/glogos-org/glogos.git
cd glogos
pnpm install

# Build and test
pnpm build
pnpm test
```

---

### Run Implementation

```bash
# Python (Requires: pip install pynacl)
pnpm ceremony:py

# TypeScript (Recommended)
pnpm ceremony
```

---

## Project Structure

- **[GLOGOS.md](./GLOGOS.md)**: The abstract Layer 0 protocol specification.
- **[GENESIS.md](./GENESIS.md)**: Concrete rules and constants for the genesis event.
- **[ceremony/](./ceremony/)**: Cross-language script implementations for the genesis ritual.
  - `witness.ts`: Primary TypeScript ritual implementation.
  - `witness.py`: Reference Python ritual implementation.
- **[sdk/typescript/](./sdk/typescript/)**:
  - `core`: Pure cryptographic primitives and protocol logic.
  - `patterns`: High-level usage patterns (Commit-Reveal, Milestones).
- **[shared/](./shared/)**: Source of truth for schemas, test vectors, and official artifacts.

---

## License

- Documentation: CC-BY-4.0
- Code: MIT

---

**Genesis: December 21, 2025, 15:03 UTC**

"From nothing, truth emerges"
