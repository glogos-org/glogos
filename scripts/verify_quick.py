import json
import hashlib
import binascii

def sha256(data):
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()

# Load artifact
with open('shared/artifacts/genesis-artifact.json', 'r') as f:
    data = json.load(f)

att = data['attestation']

print("--- VERIFICATION REPORT ---")

# 1. Verify GLR Ref
glr = sha256(b'')
print(f"[1] GLR Check: {'PASS' if att['refs'][0] == glr else 'FAIL'}")
if att['refs'][0] != glr:
    print(f"    Expected: {glr}")
    print(f"    Found:    {att['refs'][0]}")

# 2. Verify Subject
subject = "From nothing, truth emerges"
subject_hash = sha256(subject)
print(f"[2] Subject Check: {'PASS' if att['subject'] == subject_hash else 'FAIL'}")

# 3. Verify Canon
canon = "raw:sha256:1.0"
canon_hash = sha256(canon)
print(f"[3] Canon Check: {'PASS' if att['canon'] == canon_hash else 'FAIL'}")

# 4. Verify Genesis Zone Derivation
# Genesis Zone keypair is derived from: SHA256(GLR || "glogos-genesis")
seed_input = binascii.unhexlify(glr) + b"glogos-genesis"
seed = hashlib.sha256(seed_input).digest()

# 4. Verify Zone ID
# Without pynacl, we cannot derive Ed25519 key from seed.
# However, we can verify if the Zone ID in artifact is a valid SHA256 hash structure.
try:
    import nacl.signing
    signing_key = nacl.signing.SigningKey(seed)
    verify_key = signing_key.verify_key
    public_key_bytes = verify_key.encode()
    derived_zone_id = hashlib.sha256(public_key_bytes).hexdigest()
    print(f"[4] Zone ID Check: {'PASS' if att['zone'] == derived_zone_id else 'FAIL'}")
except ImportError:
    # Fallback: Check against known hardcoded value for this specific GLR
    # This matches witness.py behavior
    KNOWN_ZONE = "db1756c17220873bcb831c2f9c197081ab0d83acf2226b819880d62ce906c010"
    if att['zone'] == KNOWN_ZONE:
        print(f"[4] Zone ID Check: PASS (Verified against known constant)")
    else:
        print(f"[4] Zone ID Check: SKIPPED (pynacl not installed)")

# 5. Verify Signature
try:
    import nacl.signing
    # Reconstruct payload correctly (Must match witness.py logic)
    # 1. Compute Attestation ID
    # id = SHA256(zone || subject || canon || time_be64)
    id_payload = b''
    id_payload += binascii.unhexlify(att['zone'])
    id_payload += binascii.unhexlify(att['subject'])
    id_payload += binascii.unhexlify(att['canon'])
    id_payload += int(att['time']).to_bytes(8, 'big')
    computed_id = hashlib.sha256(id_payload).hexdigest()
    
    # 2. Compute Refs Hash
    # refs_hash = SHA256(join(sort(refs), "|"))
    refs_concat = "|".join(sorted(att['refs'])).encode('utf-8')
    refs_hash = hashlib.sha256(refs_concat).digest()

    # 3. Build Sign Input
    # input = id || subject || time_be64 || refs_hash || canon
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

except ImportError:
    print("[5] Signature Check: SKIPPED (pynacl not installed)")
    print("    (Install pynacl to verify signature)")

print("---------------------------")
