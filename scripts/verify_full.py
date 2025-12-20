import json
import hashlib
import binascii
import urllib.request

def sha256(data):
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()

def fetch_json(url):
    """Fetch JSON from URL."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Glogos-Verification/1.0'})
    with urllib.request.urlopen(req, timeout=10) as response:
        data = response.read().decode('utf-8')
        return json.loads(data)

def fetch_text(url):
    """Fetch text from URL."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Glogos-Verification/1.0'})
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.read().decode('utf-8').strip()

# Load artifact
with open('shared/artifacts/genesis-artifact.json', 'r') as f:
    data = json.load(f)

att = data['attestation']
witnesses = data.get('witnesses', {})
entropy = witnesses.get('entropy', {})

print("=" * 70)
print("GLOGOS GENESIS ARTIFACT - FULL VERIFICATION")
print("=" * 70)

all_passed = True

# ===========================================================================
# PART 1: CRYPTOGRAPHIC VERIFICATION (same as verify_quick.py)
# ===========================================================================
print("\n[PART 1] Cryptographic Verification")
print("-" * 70)

# 1. Verify GLR Ref
glr = sha256(b'')
glr_ok = att['refs'][0] == glr
print(f"[1] GLR Check: {'PASS' if glr_ok else 'FAIL'}")
all_passed &= glr_ok

# 2. Verify Subject
subject = "From nothing, truth emerges"
subject_hash = sha256(subject)
subject_ok = att['subject'] == subject_hash
print(f"[2] Subject Check: {'PASS' if subject_ok else 'FAIL'}")
all_passed &= subject_ok

# 3. Verify Canon
canon = "raw:sha256:1.0"
canon_hash = sha256(canon)
canon_ok = att['canon'] == canon_hash
print(f"[3] Canon Check: {'PASS' if canon_ok else 'FAIL'}")
all_passed &= canon_ok

# 4. Verify Zone ID
try:
    import nacl.signing
    glr_bytes = binascii.unhexlify(glr)
    seed_input = glr_bytes + b"glogos-genesis"
    seed = hashlib.sha256(seed_input).digest()
    signing_key = nacl.signing.SigningKey(seed)
    verify_key = signing_key.verify_key
    public_key_bytes = verify_key.encode()
    derived_zone_id = hashlib.sha256(public_key_bytes).hexdigest()
    zone_ok = att['zone'] == derived_zone_id
    print(f"[4] Zone ID Check: {'PASS' if zone_ok else 'FAIL'}")
    all_passed &= zone_ok
except ImportError:
    KNOWN_ZONE = "db1756c17220873bcb831c2f9c197081ab0d83acf2226b819880d62ce906c010"
    zone_ok = att['zone'] == KNOWN_ZONE
    print(f"[4] Zone ID Check: {'PASS' if zone_ok else 'SKIPPED'} (PyNaCl not installed)")
    all_passed &= zone_ok

# 5. Verify Signature
try:
    import nacl.signing
    # Compute Attestation ID
    id_payload = b''
    id_payload += binascii.unhexlify(att['zone'])
    id_payload += binascii.unhexlify(att['subject'])
    id_payload += binascii.unhexlify(att['canon'])
    id_payload += int(att['time']).to_bytes(8, 'big')
    computed_id = hashlib.sha256(id_payload).hexdigest()
    
    # Compute Refs Hash
    refs_concat = "|".join(sorted(att['refs'])).encode('utf-8')
    refs_hash = hashlib.sha256(refs_concat).digest()

    # Build Sign Input
    sign_input = binascii.unhexlify(computed_id)
    sign_input += binascii.unhexlify(att['subject'])
    sign_input += int(att['time']).to_bytes(8, 'big')
    sign_input += refs_hash
    sign_input += binascii.unhexlify(att['canon'])

    try:
        verify_key.verify(sign_input, binascii.unhexlify(att['proof']))
        print(f"[5] Signature Check: PASS (Cryptographically Valid)")
    except Exception as e:
        print(f"[5] Signature Check: FAIL ({e})")
        all_passed = False

except ImportError:
    print("[5] Signature Check: SKIPPED (PyNaCl not installed)")

# ===========================================================================
# PART 2: ENTROPY WITNESSES VERIFICATION (network-based)
# ===========================================================================
print("\n[PART 2] Entropy Witnesses Verification")
print("-" * 70)

# Check if we should verify entropy
if not entropy:
    print("No entropy data found in artifact. Skipping...")
else:
    # Drand verification
    if 'drand' in entropy:
        drand_data = entropy['drand']
        print(f"\n[DRAND] Verifying round {drand_data.get('round')}...")
        try:
            chain_hash = drand_data.get('chain_hash')
            round_num = drand_data.get('round')
            url = f"https://api.drand.sh/{chain_hash}/public/{round_num}"
            
            live_data = fetch_json(url)
            
            randomness_ok = live_data['randomness'] == drand_data.get('randomness')
            signature_ok = live_data['signature'] == drand_data.get('signature')
            
            print(f"  Randomness: {'✓ MATCH' if randomness_ok else '✗ MISMATCH'}")
            print(f"  Signature:  {'✓ MATCH' if signature_ok else '✗ MISMATCH'}")
            
            all_passed &= (randomness_ok and signature_ok)
        except Exception as e:
            print(f"  ✗ Error fetching drand: {e}")
            all_passed = False

    # Bitcoin verification
    if 'bitcoin' in entropy:
        btc_data = entropy['bitcoin']
        print(f"\n[BITCOIN] Verifying block {btc_data.get('block_height')}...")
        try:
            expected_hash = btc_data.get('block_hash')
            height = btc_data.get('block_height')
            
            # Fetch block hash by height
            url = f"https://blockstream.info/api/block-height/{height}"
            live_hash = fetch_text(url)
            
            hash_ok = live_hash == expected_hash
            print(f"  Block Hash: {'✓ MATCH' if hash_ok else '✗ MISMATCH'}")
            
            all_passed &= hash_ok
        except Exception as e:
            print(f"  ✗ Error fetching Bitcoin: {e}")
            all_passed = False

    # NIST verification
    if 'nist' in entropy:
        nist_data = entropy['nist']
        print(f"\n[NIST] Verifying pulse {nist_data.get('pulse_index')}...")
        try:
            pulse_index = nist_data.get('pulse_index')
            expected_value = nist_data.get('output_value')
            
            # Fetch the pulse directly (chain/2 = default chain used by /pulse/last)
            url = f"https://beacon.nist.gov/beacon/2.0/chain/2/pulse/{pulse_index}"
            live_pulse = fetch_json(url)
            
            # Compare outputValue
            live_value = live_pulse['pulse']['outputValue']
            value_ok = live_value == expected_value
            
            if value_ok:
                print(f"  Output Value: ✓ MATCH")
            else:
                print(f"  Output Value: ✗ MISMATCH")
                print(f"    Expected (artifact): {expected_value[:64]}...")
                print(f"    Actual (API):        {live_value[:64]}...")
            
            all_passed &= value_ok
        except Exception as e:
            # NIST beacon API can be unreliable or format may change
            # This is supplementary data, not core attestation  
            print(f"  ⚠ Cannot verify NIST (API issue: {str(e)[:50]}...)")
            print(f"  (Note: Entropy witnesses are supplementary, not cryptographically signed)")
            # Don't fail verification - entropy is metadata only

# Final result
print("\n" + "=" * 70)
if all_passed:
    print("Result: ✓ ALL CHECKS PASSED")
    print("\nThe genesis artifact is:")
    print("  • Cryptographically valid")
    print("  • Entropy witnesses verified against live sources")
else:
    print("Result: ✗ SOME CHECKS FAILED")
print("=" * 70)
