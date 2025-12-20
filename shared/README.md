# Shared Assets

Protocol-wide shared resources for Glogos implementations.

## Contents

| Directory       | Description                       |
| --------------- | --------------------------------- |
| `schemas/`      | JSON Schema definitions           |
| `test-vectors/` | Cross-implementation test vectors |
| `artifacts/`    | Genesis attestation               |

## Schemas

- **`attestation.schema.json`** - Attestation validation (JSON Schema draft-07)

## Test Vectors

- **`protocol-vectors.json`** - Hash, canon, derivation test cases

## Validation

The `schemas/attestation.schema.json` can be used with any JSON Schema validator to verify attestation format.
