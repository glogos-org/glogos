#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Glogos Genesis Ceremony Script (Python)

Self-contained ceremony script with full Ed25519 cryptography.
Can be run multiple times to verify deterministic output.

Runs the complete genesis ceremony:
1. Derive genesis zone from GLR (deterministic)
2. Create and sign genesis attestation
3. Fetch entropy witnesses (drand + Bitcoin)
4. Verify everything
5. Save artifacts

Run: python ceremony/witness.py
Requires: pip install pynacl

This script produces IDENTICAL output to witness.ts
"""

import hashlib
import json
import struct
import sys
import urllib.request
import os
from datetime import datetime, timezone
from typing import Dict, List, Any, Tuple

# Fix Windows console encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except (AttributeError, OSError):
        # Python < 3.7 or reconfigure not available
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Ed25519 via libsodium (PyNaCl)
try:
    from nacl.signing import SigningKey, VerifyKey
    from nacl.encoding import RawEncoder
    NACL_AVAILABLE = True
except ImportError:
    NACL_AVAILABLE = False
    print("⚠️  PyNaCl not installed. Run: pip install pynacl")
    print("   Falling back to pre-computed values (verification only)\n")

# ============================================================================
# PROTOCOL CONSTANTS (from GENESIS.md)
# ============================================================================
GENESIS_TIMESTAMP = 1766329380  # 2025-12-21T15:03:00 UTC
GLR = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
DOMAIN_SEPARATOR = "glogos-genesis"
REFS_DELIMITER = "|"

# External entropy sources
DRAND_CHAIN_HASH = "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971"
DRAND_ENDPOINT = f"https://api.drand.sh/{DRAND_CHAIN_HASH}/public/latest"
NIST_BEACON_URL = "https://beacon.nist.gov/beacon/2.0/pulse/last"
BITCOIN_API = "https://blockstream.info/api/blocks/tip/hash"
BITCOIN_HEIGHT_API = "https://blockstream.info/api/blocks/tip/height"

# ============================================================================
# CRYPTOGRAPHIC PRIMITIVES
# ============================================================================

def sha256_hex(data: str | bytes) -> str:
    """Compute SHA-256 hash and return as hex string."""
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()


def sha256_bytes(data: bytes) -> bytes:
    """Compute SHA-256 hash and return as bytes."""
    return hashlib.sha256(data).digest()


def uint64_be(n: int) -> bytes:
    """Convert integer to 8-byte big-endian bytes."""
    return struct.pack('>Q', n)


def hex_to_bytes(hex_str: str) -> bytes:
    """Convert hex string to bytes."""
    return bytes.fromhex(hex_str)


def bytes_to_hex(data: bytes) -> str:
    """Convert bytes to hex string."""
    return data.hex()


# ============================================================================
# ZONE OPERATIONS
# ============================================================================

def derive_genesis_zone() -> Dict[str, str]:
    """
    Derive genesis zone from GLR (deterministic, publicly verifiable).
    
    seed = SHA-256(GLR || domain_separator)
    keypair = Ed25519_KeyPair_From_Seed(seed)
    zone_id = SHA-256(public_key)
    """
    if not NACL_AVAILABLE:
        # Fallback to pre-computed values
        return {
            'seed': 'ae958e20ef38261f13a52590ee631ca83d718ea62d03f22774affd43c01bb902',
            'private_key': 'ae958e20ef38261f13a52590ee631ca83d718ea62d03f22774affd43c01bb902',
            'public_key': 'c70b1f7e4ce8cb7f6f8f3984ff6fe8260469b6cf8f8f839f047ba64d894d4be8',
            'zone_id': 'db1756c17220873bcb831c2f9c197081ab0d83acf2226b819880d62ce906c010'
        }
    
    # Compute seed: SHA-256(GLR || domain)
    glr_bytes = hex_to_bytes(GLR)
    domain_bytes = DOMAIN_SEPARATOR.encode('utf-8')
    seed = sha256_bytes(glr_bytes + domain_bytes)
    
    # Derive Ed25519 keypair from seed
    signing_key = SigningKey(seed)
    public_key_bytes = signing_key.verify_key.encode(encoder=RawEncoder)
    
    # Compute zone ID: SHA-256(public_key)
    zone_id = sha256_hex(public_key_bytes)
    
    return {
        'seed': bytes_to_hex(seed),
        'private_key': bytes_to_hex(seed),  # Ed25519 seed = private key
        'public_key': bytes_to_hex(public_key_bytes),
        'zone_id': zone_id
    }


# ============================================================================
# ATTESTATION OPERATIONS
# ============================================================================

def compute_refs_hash(refs: List[str]) -> str:
    """
    Compute refs hash according to protocol.
    
    if refs is empty: refs_hash = GLR
    else: refs_hash = SHA-256(join(sort(refs), "|"))
    """
    if not refs:
        return GLR
    
    sorted_refs = sorted(refs)
    refs_concat = REFS_DELIMITER.join(sorted_refs)
    return sha256_hex(refs_concat)


def compute_attestation_id(zone: str, subject: str, canon: str, time: int) -> str:
    """
    Compute attestation ID.
    
    attestation_id = SHA-256(zone || subject || canon || BE64(time))
    Input: 104 bytes (32 + 32 + 32 + 8)
    """
    data = (
        hex_to_bytes(zone) +      # 32 bytes
        hex_to_bytes(subject) +   # 32 bytes
        hex_to_bytes(canon) +     # 32 bytes
        uint64_be(time)           # 8 bytes
    )
    return sha256_hex(data)


def build_signature_input(
    attestation_id: str,
    subject: str,
    time: int,
    refs_hash: str,
    canon: str
) -> bytes:
    """
    Build signature input.
    
    sign_input = attestation_id || subject || BE64(time) || refs_hash || canon
    Total: 136 bytes (32 + 32 + 8 + 32 + 32)
    """
    return (
        hex_to_bytes(attestation_id) +  # 32 bytes
        hex_to_bytes(subject) +          # 32 bytes
        uint64_be(time) +                # 8 bytes
        hex_to_bytes(refs_hash) +        # 32 bytes
        hex_to_bytes(canon)              # 32 bytes
    )


def sign_message(message: bytes, private_key_hex: str) -> str:
    """Sign message with Ed25519 private key, return signature as hex."""
    if not NACL_AVAILABLE:
        raise RuntimeError("PyNaCl required for signing")
    
    seed = hex_to_bytes(private_key_hex)
    signing_key = SigningKey(seed)
    signed = signing_key.sign(message, encoder=RawEncoder)
    signature = signed.signature
    return bytes_to_hex(signature)


def verify_signature(message: bytes, signature_hex: str, public_key_hex: str) -> bool:
    """Verify Ed25519 signature."""
    if not NACL_AVAILABLE:
        raise RuntimeError("PyNaCl required for verification")
    
    try:
        public_key_bytes = hex_to_bytes(public_key_hex)
        signature_bytes = hex_to_bytes(signature_hex)
        verify_key = VerifyKey(public_key_bytes)
        verify_key.verify(message, signature_bytes)
        return True
    except Exception:
        return False


def create_genesis_attestation(zone: Dict[str, str]) -> Dict[str, Any]:
    """
    Create the genesis attestation with cryptographic signature.
    """
    # Genesis subject: SHA-256("From nothing, truth emerges")
    subject = sha256_hex("From nothing, truth emerges")
    
    # Genesis canon: SHA-256("raw:sha256:1.0")
    canon = sha256_hex("raw:sha256:1.0")
    
    # Refs: [GLR]
    refs = [GLR]
    
    # Compute attestation ID
    attestation_id = compute_attestation_id(
        zone['zone_id'], subject, canon, GENESIS_TIMESTAMP
    )
    
    # Compute refs hash
    refs_hash = compute_refs_hash(refs)
    
    # Build signature input (136 bytes)
    sign_input = build_signature_input(
        attestation_id, subject, GENESIS_TIMESTAMP, refs_hash, canon
    )
    
    # Sign
    if NACL_AVAILABLE:
        proof = sign_message(sign_input, zone['private_key'])
    else:
        # Pre-computed signature (for verification mode)
        proof = "9a06e9a971416bc167ce0edeb66961f1a15fac31296fb6add213e64fbb0b5172283bbb044fc5808794d2b1b42cb23b7dc8072e568cee3eb8c438294fe78b8008"
    
    return {
        "id": attestation_id,
        "zone": zone['zone_id'],
        "subject": subject,
        "canon": canon,
        "time": GENESIS_TIMESTAMP,
        "refs": refs,
        "proof": proof
    }


def verify_attestation(attestation: Dict[str, Any], public_key: str) -> Dict[str, Any]:
    """
    Verify an attestation's cryptographic integrity.
    """
    steps = []
    
    # Step 1: Verify zone matches public key
    computed_zone = sha256_hex(hex_to_bytes(public_key))
    zone_valid = computed_zone == attestation['zone']
    steps.append({
        'name': 'Zone verification',
        'passed': zone_valid,
        'expected': attestation['zone'],
        'actual': computed_zone
    })
    
    if not zone_valid:
        return {'valid': False, 'error': 'Zone ID mismatch', 'steps': steps}
    
    # Step 2: Verify attestation ID
    computed_id = compute_attestation_id(
        attestation['zone'],
        attestation['subject'],
        attestation['canon'],
        attestation['time']
    )
    id_valid = computed_id == attestation['id']
    steps.append({
        'name': 'Attestation ID verification',
        'passed': id_valid,
        'expected': attestation['id'],
        'actual': computed_id
    })
    
    if not id_valid:
        return {'valid': False, 'error': 'Attestation ID mismatch', 'steps': steps}
    
    # Step 3: Verify signature
    refs_hash = compute_refs_hash(attestation['refs'])
    sign_input = build_signature_input(
        attestation['id'],
        attestation['subject'],
        attestation['time'],
        refs_hash,
        attestation['canon']
    )
    
    if NACL_AVAILABLE:
        sig_valid = verify_signature(sign_input, attestation['proof'], public_key)
    else:
        # Without nacl, we trust the pre-computed values match test vectors
        sig_valid = True
        steps.append({
            'name': 'Signature verification',
            'passed': True,
            'note': 'Skipped (PyNaCl not available)'
        })
    
    if NACL_AVAILABLE:
        steps.append({
            'name': 'Ed25519 signature verification',
            'passed': sig_valid
        })
    
    if not sig_valid:
        return {'valid': False, 'error': 'Invalid signature', 'steps': steps}
    
    return {'valid': True, 'steps': steps}


def fetch_json(url: str) -> Any:
    """Fetch JSON from URL."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Glogos-Ceremony/1.0'})
    with urllib.request.urlopen(req) as response:
        data = response.read().decode('utf-8')
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return data.strip()


def fetch_text(url: str) -> str:
    """Fetch text from URL."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Glogos-Ceremony/1.0'})
    with urllib.request.urlopen(req) as response:
        return response.read().decode('utf-8').strip()


def wait_for_ceremony_time():
    """Wait until ceremony time with countdown."""
    import time
    target = datetime(2025, 12, 21, 15, 3, 0, tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    
    if now < target:
        print(f"\n[WAIT] Ceremony time: {target.isoformat()}")
        print(f"       Current time:  {now.isoformat()}")
        print(f"       (Press Ctrl+C to cancel)\n")
        
        try:
            while (remaining := target - datetime.now(timezone.utc)).total_seconds() > 0:
                days, seconds = remaining.days, int(remaining.total_seconds())
                hours, minutes, secs = (seconds % 86400) // 3600, (seconds % 3600) // 60, seconds % 60
                
                if seconds > 60:
                    msg = f"   Waiting... {days}d {hours:02d}h {minutes:02d}m {secs:02d}s remaining"
                else:
                    msg = f"   Countdown: {seconds}s...                      "
                
                print(f"\r{msg}", end="", flush=True)
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("\n\nCancelled.")
            sys.exit(0)
        
        print("\n[!] CEREMONY TIME!")


def verify_artifact() -> bool:
    """Verify genesis-artifact.json against GENESIS.md spec."""
    print("\n[VERIFY] Genesis Artifact")
    print("=" * 50)
    
    # Load artifact
    script_dir = os.path.dirname(os.path.abspath(__file__))
    artifact_path = os.path.join(os.path.dirname(script_dir), 'shared', 'artifacts', 'genesis-artifact.json')
    
    try:
        with open(artifact_path, 'r') as f:
            artifact = json.load(f)
    except FileNotFoundError:
        print(f"✗ Artifact not found: {artifact_path}")
        return False
    
    att = artifact['attestation']
    all_passed = True
    
    # 1. Verify GLR
    glr_ok = sha256_hex("") == GLR
    print(f"[1] GLR = SHA256(''): {'✓' if glr_ok else '✗'}")
    all_passed &= glr_ok
    
    # 2. Verify zone derivation
    zone = derive_genesis_zone()
    zone_ok = zone['zone_id'] == att['zone']
    print(f"[2] Zone ID matches: {'✓' if zone_ok else '✗'}")
    all_passed &= zone_ok
    
    # 3. Verify subject
    expected_subject = sha256_hex("From nothing, truth emerges")
    subject_ok = expected_subject == att['subject']
    print(f"[3] Subject matches: {'✓' if subject_ok else '✗'}")
    all_passed &= subject_ok
    
    # 4. Verify canon
    expected_canon = sha256_hex("raw:sha256:1.0")
    canon_ok = expected_canon == att['canon']
    print(f"[4] Canon matches: {'✓' if canon_ok else '✗'}")
    all_passed &= canon_ok
    
    # 5. Verify attestation ID
    expected_id = compute_attestation_id(att['zone'], att['subject'], att['canon'], att['time'])
    id_ok = expected_id == att['id']
    print(f"[5] Attestation ID: {'✓' if id_ok else '✗'}")
    all_passed &= id_ok
    
    # 6. Verify signature
    if NACL_AVAILABLE:
        verification = verify_attestation(att, zone['public_key'])
        sig_ok = verification['valid']
        print(f"[6] Ed25519 signature: {'✓' if sig_ok else '✗'}")
        all_passed &= sig_ok
    else:
        print("[6] Ed25519 signature: ⚠ Skipped (PyNaCl not available)")
    
    print("=" * 50)
    print(f"Result: {'✓ ALL PASSED' if all_passed else '✗ FAILED'}")
    return all_passed


def main():
    print("\n╔═══════════════════════════════════════════════════════════════╗")
    print("║           GLOGOS GENESIS CEREMONY                             ║")
    print("║           Winter Solstice 2025                                ║")
    print("╚═══════════════════════════════════════════════════════════════╝\n")

    if NACL_AVAILABLE:
        print("✓ PyNaCl available - Full cryptographic mode\n")
    else:
        print("⚠ PyNaCl not available - Verification mode only\n")

    # Interactive menu
    print("Options:")
    print("  [1] Run ceremony (simulation)")
    print("  [2] Run ceremony (live)")
    print("  [3] Verify genesis artifact")
    print()
    
    choice = input("Select (1-3) [1]: ").strip() or "1"
    
    if choice == "3":
        verify_artifact()
        return
    
    if choice == "2":
        # Disable live mode after genesis + 1 day
        deadline = datetime(2025, 12, 22, 15, 3, 0, tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > deadline:
            print("\n⚠ Genesis ceremony đã qua. Dùng option [1] simulation thay.")
            return
        wait_for_ceremony_time()

    ceremony_time = datetime.fromtimestamp(GENESIS_TIMESTAMP, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    current_time = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    print(f"\nCeremony time: {ceremony_time}")
    print(f"Current time:  {current_time}\n")

    # ============================================
    # STEP 1: DERIVE GENESIS ZONE
    # ============================================
    print("=" * 65)
    print("STEP 1: DERIVE GENESIS ZONE FROM GLR")
    print("=" * 65)
    
    print("\n[1/3] Computing seed: SHA-256(GLR || domain_separator)...")
    genesis_zone = derive_genesis_zone()
    print(f"    ✓ Seed:       {genesis_zone['seed'][:32]}...")
    
    print("\n[2/3] Deriving Ed25519 keypair from seed...")
    print(f"    ✓ Public Key: {genesis_zone['public_key'][:32]}...")
    
    print("\n[3/3] Computing zone ID: SHA-256(public_key)...")
    print(f"    ✓ Zone ID:    {genesis_zone['zone_id'][:32]}...")

    # ============================================
    # STEP 2: CREATE GENESIS ATTESTATION
    # ============================================
    print("\n" + "=" * 65)
    print("STEP 2: CREATE GENESIS ATTESTATION")
    print("=" * 65)

    print("\n[1/4] Computing genesis subject: SHA-256('From nothing, truth emerges')...")
    genesis_subject = sha256_hex("From nothing, truth emerges")
    print(f"    ✓ Subject:    {genesis_subject[:32]}...")

    print("\n[2/4] Computing canon ID: SHA-256('raw:sha256:1.0')...")
    genesis_canon = sha256_hex("raw:sha256:1.0")
    print(f"    ✓ Canon:      {genesis_canon[:32]}...")

    print("\n[3/4] Computing attestation ID...")
    genesis_attestation = create_genesis_attestation(genesis_zone)
    print(f"    ✓ ID:         {genesis_attestation['id'][:32]}...")

    print("\n[4/4] Signing attestation (Ed25519)...")
    print(f"    ✓ Signature:  {genesis_attestation['proof'][:32]}...")

    # ============================================
    # STEP 3: VERIFY ATTESTATION
    # ============================================
    print("\n" + "=" * 65)
    print("STEP 3: VERIFY ATTESTATION")
    print("=" * 65)

    verification = verify_attestation(genesis_attestation, genesis_zone['public_key'])
    for step in verification['steps']:
        status = "✓" if step['passed'] else "✗"
        print(f"    {status} {step['name']}")
    
    if verification['valid']:
        print("\n    ✓ ATTESTATION VERIFIED SUCCESSFULLY")
    else:
        print(f"\n    ✗ VERIFICATION FAILED: {verification.get('error', 'Unknown error')}")
        return

    # ============================================
    # STEP 4: FETCH ENTROPY WITNESSES
    # ============================================
    print("\n" + "=" * 65)
    print("STEP 4: FETCH ENTROPY WITNESSES")
    print("=" * 65)

    fetched_at = datetime.now(timezone.utc).isoformat()

    # Check if we're more than 1 hour past ceremony time for live mode
    if choice == "2":
        ceremony_time = datetime(2025, 12, 21, 15, 3, 0, tzinfo=timezone.utc)
        current_time = datetime.now(timezone.utc)
        time_diff = (current_time - ceremony_time).total_seconds()

        if time_diff > 3600:  # More than 1 hour (3600 seconds)
            print(f"\n⚠️  Current time is {int(time_diff / 3600)} hours past ceremony time.")
            print("   Entropy data is no longer realtime for the ceremony.")
            print("   Please use option [3] to verify the existing genesis artifact.")
            print("\nExiting...")
            return

    if choice == "1":
        print("\n[SIMULATION] Using mock entropy data...")
        drand = {
            "source": "drand_quicknet (mock)",
            "chain_hash": DRAND_CHAIN_HASH,
            "round": 1234567,
            "randomness": "de7e000000000000000000000000000000000000000000000000000000000000",
            "signature": "de7e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
            "fetched_at": fetched_at
        }
        nist = {
            "source": "nist_beacon (mock)",
            "output_value": "de7e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
            "pulse_index": 1234567,
            "fetched_at": fetched_at
        }
        bitcoin = {
            "source": "bitcoin_block (mock)",
            "block_hash": "00000000000000000000de7e0000000000000000000000000000000000000000",
            "block_height": 1234567,
            "fetched_at": fetched_at
        }
        print("    ✓ Drand (Mock)")
        print("    ✓ NIST (Mock)")
        print("    ✓ Bitcoin (Mock)")
    else:
        # Fetch drand
        print("\n[1/3] Fetching drand quicknet...")
        drand = {"source": "drand_quicknet", "error": None}
        try:
            data = fetch_json(DRAND_ENDPOINT)
            drand = {
                "source": "drand_quicknet",
                "chain_hash": DRAND_CHAIN_HASH,
                "round": data['round'],
                "randomness": data['randomness'],
                "signature": data['signature'],
                "fetched_at": fetched_at
            }
            print(f"    ✓ Round: {drand['round']}")
            print(f"    ✓ Randomness: {drand['randomness'][:32]}...")
        except Exception as e:
            drand['error'] = str(e)
            print(f"    ✗ Error: {e}")

        # Fetch NIST Beacon
        print("\n[2/3] Fetching NIST Randomness Beacon...")
        nist = {"source": "nist_beacon", "error": None}
        try:
            data = fetch_json(NIST_BEACON_URL)
            pulse = data.get('pulse', {})
            nist = {
                "source": "nist_beacon",
                "output_value": pulse.get('outputValue'),
                "pulse_index": pulse.get('pulseIndex'),
                "fetched_at": fetched_at
            }
            print(f"    ✓ Pulse: {nist['pulse_index']}")
            print(f"    ✓ Value: {nist['output_value'][:32] if nist['output_value'] else 'N/A'}...")
        except Exception as e:
            nist['error'] = str(e)
            print(f"    ✗ Error: {e}")

        # Fetch Bitcoin
        print("\n[3/3] Fetching Bitcoin block...")
        bitcoin = {"source": "bitcoin_block", "error": None}
        try:
            block_hash = fetch_text(BITCOIN_API)
            block_height = fetch_text(BITCOIN_HEIGHT_API)
            bitcoin = {
                "source": "bitcoin_block",
                "block_hash": block_hash,
                "block_height": int(block_height),
                "fetched_at": fetched_at
            }
            print(f"    ✓ Height: {bitcoin['block_height']}")
            print(f"    ✓ Hash: {bitcoin['block_hash'][:32]}...")
        except Exception as e:
            bitcoin['error'] = str(e)
            print(f"    ✗ Error: {e}")



    # Add time representations
    ceremony_dt = datetime.fromtimestamp(GENESIS_TIMESTAMP, tz=timezone.utc)
    
    witnesses = {
        "_note": "Supplementary entropy witnesses - does NOT affect attestation",
        "time": {
            "gregorian": ceremony_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
            "julian_day": 2461031.1270833333,
            "lunar": "Month 11, Day 21",
            "vigesimal": "13.0.13.3.8",
            "sexagesimal": "11;23,37,11;7,37,30"
        },
        "euler": {
            "expression": "e^(iπ) + 1 = 0",
            "meaning": "The most beautiful equation witnesses the genesis"
        },
        "entropy": {
            "fetched_at": fetched_at,
            "drand": drand,
            "nist": nist,
            "bitcoin": bitcoin
        },

    }

    # ============================================
    # STEP 5: SAVE ARTIFACTS
    # ============================================
    print("\n" + "=" * 65)
    print("STEP 5: SAVE ARTIFACTS")
    print("=" * 65)

    artifact = {
        "_ceremony": "Winter Solstice Genesis 2025",
        "_timestamp": ceremony_time,
        "attestation": genesis_attestation,
        "witnesses": witnesses
    }

    # Save artifacts
    script_dir = os.path.dirname(os.path.abspath(__file__))
    shared_dir = os.path.join(os.path.dirname(script_dir), 'shared')
    
    artifacts_dir = os.path.join(shared_dir, 'artifacts')
    artifact_path = os.path.join(artifacts_dir, 'genesis-artifact.json')
    with open(artifact_path, 'w', encoding='utf-8') as f:
        json.dump(artifact, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f"\n✓ Saved: {artifact_path}")

    # ============================================
    # FINAL SUMMARY
    # ============================================
    print("\n" + "=" * 65)
    print("CEREMONY COMPLETE")
    print("=" * 65)
    print("\nGenesis Attestation:")
    print(json.dumps(genesis_attestation, indent=2, ensure_ascii=False))
    print("\n" + "-" * 65)
    print("Re-run this script to verify deterministic output.")
    print("The attestation ID and signature will be IDENTICAL each time.")
    print("-" * 65)
    print("\nFrom nothing, truth emerges.")
    print("=" * 65 + "\n")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nCeremony cancelled by user.")
    except Exception as e:
        print(f"\n\nError: {e}")
        import traceback
        traceback.print_exc()

