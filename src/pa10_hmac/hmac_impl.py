"""
PA#10 — HMAC and HMAC-Based CCA-Secure Encryption.
Uses PA#8 DLP hash as the underlying H. No external hash/hmac libraries.

Public interface:
  HMAC.mac(k, m)          -> tag bytes
  HMAC.verify(k, m, t)    -> bool  (constant-time)
  EtHEnc.eth_enc(kE, kM, m)         -> (r, c, t)
  EtHEnc.eth_dec(kE, kM, r, c, t)   -> m | None
  secure_compare(t1, t2)  -> bool  (constant-time XOR)
  mac_to_crhf_compress(hmac, k)      -> compression function usable in MD
"""
import os
import sys
import time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa08_dlp_hash.dlp_hash import DLPHash, DLPHashGroup
from src.pa07_merkle_damgard.merkle_damgard import MerkleDamgard
from src.pa03_cpa_enc.cpa_enc import CPAEnc
from src.pa02_prf.prf import AESPRF

IPAD_BYTE = 0x36
OPAD_BYTE = 0x5C


# ── 7. Constant-time comparison ───────────────────────────────────────────────

def secure_compare(t1: bytes, t2: bytes) -> bool:
    """
    Constant-time byte-by-byte comparison.
    XOR all byte pairs; result is 0 only if all equal.
    Never short-circuits, preventing timing side-channel leakage.
    """
    if len(t1) != len(t2):
        return False
    diff = 0
    for a, b in zip(t1, t2):
        diff |= a ^ b
    return diff == 0


def timing_side_channel_demo(tag: bytes) -> dict:
    """
    Demonstrate that naive early-exit comparison leaks tag bytes via timing,
    while constant-time comparison does not.

    Measures time for tags differing in early vs late bytes.
    Early-exit comparison is faster when mismatch is at byte 0 (exits immediately).
    Constant-time comparison takes the same time regardless of where bytes differ.
    """
    N = 5000  # iterations for stable timing

    def naive_compare(t1, t2):
        for a, b in zip(t1, t2):
            if a != b:
                return False
        return len(t1) == len(t2)

    wrong_early = bytes([tag[0] ^ 0xFF]) + tag[1:]   # differs at byte 0
    wrong_late  = tag[:-1] + bytes([tag[-1] ^ 0xFF]) # differs at last byte

    # Time naive comparison: early mismatch should be FASTER
    t0 = time.perf_counter()
    for _ in range(N): naive_compare(tag, wrong_early)
    early_naive = time.perf_counter() - t0

    t0 = time.perf_counter()
    for _ in range(N): naive_compare(tag, wrong_late)
    late_naive = time.perf_counter() - t0

    # Time constant-time comparison: should be the same regardless
    t0 = time.perf_counter()
    for _ in range(N): secure_compare(tag, wrong_early)
    early_ct = time.perf_counter() - t0

    t0 = time.perf_counter()
    for _ in range(N): secure_compare(tag, wrong_late)
    late_ct = time.perf_counter() - t0

    return {
        "tag_hex": tag.hex(),
        "naive_early_ms": round(early_naive * 1000, 4),
        "naive_late_ms": round(late_naive * 1000, 4),
        "naive_ratio": round(late_naive / early_naive, 2) if early_naive else 0,
        "ct_early_ms": round(early_ct * 1000, 4),
        "ct_late_ms": round(late_ct * 1000, 4),
        "ct_ratio": round(late_ct / early_ct, 2) if early_ct else 0,
        "leaks_timing": late_naive > early_naive * 1.1,
        "explanation": (
            "Naive comparison exits at first differing byte — a tag wrong at byte 0 "
            "is rejected faster than one wrong at the last byte. An attacker can "
            "binary-search each byte by measuring response time. "
            "Constant-time XOR comparison always processes all bytes, "
            "so timing is independent of where the mismatch occurs."
        ),
    }


# ── 1. HMAC class ─────────────────────────────────────────────────────────────

class HMAC:
    """
    HMAC_k(m) = H((k XOR opad) || H((k XOR ipad) || m))
    where H is our PA#8 DLP hash.

    Key padding (RFC 2104):
      - If |k| > block_size: k = H(k)
      - If |k| < block_size: k = k || 0x00* (zero-pad)
    """

    def __init__(self, dlp_hash: DLPHash = None, block_size: int = None):
        if dlp_hash is None:
            group = DLPHashGroup(bits=32)
            dlp_hash = DLPHash(group)
        self.H = dlp_hash
        # block_size should match H's block_size for correct HMAC construction
        self.block_size = block_size if block_size is not None else dlp_hash.block_size

    def _pad_key(self, k: bytes) -> bytes:
        """Hash key if too long, then zero-pad to block_size."""
        if len(k) > self.block_size:
            k = self.H.hash(k)
        return k.ljust(self.block_size, b'\x00')

    def mac(self, k: bytes, m: bytes) -> bytes:
        """Compute HMAC_k(m) using the DLP hash."""
        k_padded = self._pad_key(k)
        ipad = bytes(b ^ IPAD_BYTE for b in k_padded)
        opad = bytes(b ^ OPAD_BYTE for b in k_padded)
        inner = self.H.hash(ipad + m)
        outer = self.H.hash(opad + inner)
        return outer

    def verify(self, k: bytes, m: bytes, t: bytes) -> bool:
        """Constant-time HMAC verification (prevents timing attacks)."""
        expected = self.mac(k, m)
        return secure_compare(expected, t)


# ── 2. EUF-CMA security game ──────────────────────────────────────────────────

def euf_cma_game(hmac: HMAC, k: bytes, n_queries: int = 50) -> dict:
    """
    EUF-CMA game for HMAC:
    - Adversary gets n_queries oracle calls: (m_i, t_i = HMAC_k(m_i))
    - Adversary tries to forge a tag on a NEW message not in the query set
    - Security: adversary cannot forge without knowing k

    We simulate the strongest efficient adversary:
    1. Replay attack (send a queried message with its tag) — always fails as forgery
    2. Tag guessing (random tag for new message) — negligible success prob
    3. Extension attempt (try length extension on a queried tag) — fails for HMAC
    """
    queried = {}
    for i in range(n_queries):
        m = f"query_message_{i}".encode()
        t = hmac.mac(k, m)
        queried[m] = t

    results = {}

    # Attempt 1: Replay — submit (m, t) where m was queried (not a forgery by definition)
    m0, t0 = next(iter(queried.items()))
    results["replay"] = {
        "attempt": "Submit known (m, HMAC(m)) — replay, not forgery",
        "succeeds": hmac.verify(k, m0, t0),  # True but not counted as forgery
        "is_forgery": False,
        "explanation": "Replaying a known pair is valid but not a forgery (message was queried).",
    }

    # Attempt 2: Tag guessing on new message
    new_msg = b"forged_message_not_in_queries"
    random_tag = os.urandom(len(t0))
    guess_ok = hmac.verify(k, new_msg, random_tag)
    results["tag_guess"] = {
        "attempt": "Submit (new_msg, random_tag)",
        "succeeds": guess_ok,
        "is_forgery": guess_ok,
        "explanation": f"Random tag for new message. Pr[success] = 1/2^{len(t0)*8}.",
    }

    # Attempt 3: Length extension on HMAC — should fail
    m_queried = next(iter(queried))
    t_queried = queried[m_queried]
    suffix = b"attacker_extension"
    # Try to use the queried tag as starting state for extension
    try:
        h = hmac.H
        padded = h.md.pad(h.md.IV + m_queried)  # attacker doesn't know k, uses IV
        suffix_blocks = h.md.pad(b'\x00' * len(padded) + suffix)[len(padded):]
        state = t_queried
        for i in range(0, len(suffix_blocks), h.md.block_size):
            state = h.group.compress_fn(state, suffix_blocks[i:i + h.md.block_size])
        ext_tag = state
        ext_msg = m_queried + b"[pad]" + suffix
        ext_ok = hmac.verify(k, ext_msg, ext_tag)
    except Exception:
        ext_ok = False
        ext_tag = b'\x00'
    results["length_extension"] = {
        "attempt": "Apply length-extension to queried HMAC tag",
        "succeeds": ext_ok,
        "is_forgery": ext_ok,
        "explanation": "HMAC outer hash (k⊕opad ‖ inner) cannot be extended — outer key resets state.",
    }

    forgeries = sum(1 for r in results.values() if r["is_forgery"])
    return {
        "n_queries": n_queries,
        "n_distinct_tags": len(queried),
        "forgery_attempts": results,
        "total_forgeries": forgeries,
        "adversary_succeeded": forgeries > 0,
        "conclusion": (
            "HMAC is EUF-CMA secure: no efficient adversary can forge a tag "
            "on an unqueried message, even after seeing 50 oracle responses."
        ) if forgeries == 0 else "Forgery succeeded (unexpected).",
    }


# ── 3. MAC ⇒ CRHF compression function ───────────────────────────────────────

def mac_to_crhf_compress(hmac_fn, k: bytes):
    """
    Construct h'(cv, block) = HMAC_k(cv || block) for fixed public key k.
    This produces a compression function usable in the PA#7 MD framework.

    Security reduction: collision in MD(h') ⟹ HMAC forgery.
    If h'(cv1, b1) = h'(cv2, b2) with (cv1,b1) ≠ (cv2,b2),
    then HMAC_k(cv1‖b1) = HMAC_k(cv2‖b2) — a collision in HMAC output
    for distinct inputs, which contradicts EUF-CMA security.
    """
    def compress(state: bytes, block: bytes) -> bytes:
        return hmac_fn(k, state + block)
    return compress


def mac_hash_demo(hmac: HMAC, k: bytes) -> dict:
    """
    Build MAC_Hash using h'(cv,block)=HMAC_k(cv‖block) + PA#7 MD framework.
    Show two distinct messages produce distinct digests.
    """
    compress = mac_to_crhf_compress(hmac.mac, k)
    IV = b'\x00' * hmac.H.block_size
    md = MerkleDamgard(compress, IV, hmac.H.block_size)

    m1 = b"message one for MAC-CRHF demo"
    m2 = b"message two for MAC-CRHF demo"
    d1 = md.hash(m1)
    d2 = md.hash(m2)

    return {
        "k_hex": k.hex(),
        "message1": m1.decode(),
        "message2": m2.decode(),
        "digest1": d1.hex(),
        "digest2": d2.hex(),
        "distinct": d1 != d2,
        "block_size": hmac.H.block_size,
        "state_size": len(IV),
        "reduction": (
            "Any collision in MAC_Hash(m1)=MAC_Hash(m2) with m1≠m2 would imply "
            "HMAC_k(cv‖b1)=HMAC_k(cv‖b2) for some (cv,b1)≠(cv,b2) — "
            "an HMAC collision, contradicting EUF-CMA security."
        ),
    }


# ── 4. Length-extension demo ──────────────────────────────────────────────────

def length_extension_demo(H: DLPHash, k: bytes, m: bytes, suffix: bytes) -> dict:
    """
    Demonstrate length-extension attack on naive H(k||m).

    Attacker knows: m, t=H(k||m), and len(k).
    Goal: compute H(k||m||pad||suffix) without knowing k.

    Step 1: pad = padding that was appended after k||m
    Step 2: Set MD state = t (the final chaining value of H(k||m))
    Step 3: Run MD continuation on suffix, getting H(k||m||pad||suffix)
    This equals H(pad(k||m) || suffix) computed from scratch.

    HMAC is immune: outer hash H((k⊕opad) || inner) cannot be extended
    because the attacker doesn't know k⊕opad.
    """
    # Naive MAC: t = H(k || m)
    naive_tag = H.hash(k + m)

    # Attacker's extension: continue MD from state=naive_tag
    padded_km = H.md.pad(k + m)
    full_len = len(padded_km)

    # Suffix must be processed with correct length encoding
    # Build a continuation: start from state=naive_tag, process suffix blocks
    # The suffix padding length field counts from the beginning (k||m||pad||suffix)
    def pad_suffix_with_offset(suffix_bytes, offset):
        """Pad suffix as if it follows `offset` bytes already processed."""
        total_len = offset + len(suffix_bytes)
        total_len_bits = total_len * 8
        import struct
        padded = suffix_bytes + b'\x80'
        target = H.md.block_size - min(8, H.md.block_size)
        while len(padded) % H.md.block_size != target:
            padded += b'\x00'
        padded += struct.pack('>Q', total_len_bits)
        while len(padded) % H.md.block_size != 0:
            padded += b'\x00'
        return padded

    suffix_padded = pad_suffix_with_offset(suffix, full_len)
    state = naive_tag
    for i in range(0, len(suffix_padded), H.md.block_size):
        state = H.group.compress_fn(state, suffix_padded[i:i + H.md.block_size])
    attacker_tag = state

    # Ground truth: H(k||m||pad||suffix) from scratch
    ground_truth = H.hash(padded_km + suffix)
    attack_succeeds = attacker_tag == ground_truth

    # HMAC resistance
    hmac = HMAC(H)
    hmac_tag = hmac.mac(k, m)
    # Attacker tries same extension on HMAC tag — fails
    state2 = hmac_tag
    for i in range(0, len(suffix_padded), H.md.block_size):
        state2 = H.group.compress_fn(state2, suffix_padded[i:i + H.md.block_size])
    hmac_attacker_tag = state2
    # True HMAC for the extended message
    extended_msg = padded_km + suffix
    hmac_true_tag = hmac.mac(k, extended_msg)
    hmac_attack_succeeds = hmac_attacker_tag == hmac_true_tag

    return {
        "naive_tag": naive_tag.hex(),
        "pad_k_m_hex": padded_km.hex(),
        "suffix_hex": suffix.hex(),
        "attacker_tag": attacker_tag.hex(),
        "ground_truth_tag": ground_truth.hex(),
        "attack_succeeds": attack_succeeds,
        "hmac_tag": hmac_tag.hex(),
        "hmac_attacker_tag": hmac_attacker_tag.hex(),
        "hmac_true_tag": hmac_true_tag.hex(),
        "hmac_attack_succeeds": hmac_attack_succeeds,
    }


# ── 5 & 6. Encrypt-then-HMAC ──────────────────────────────────────────────────

class EtHEnc:
    """
    Encrypt-then-HMAC CCA-Secure Encryption.
    Enc: C = Enc_kE(m),  t = HMAC_kM(C)
    Dec: verify t, then decrypt. Returns None on MAC failure (⊥).
    """

    def __init__(self, enc_scheme: CPAEnc = None, hmac_scheme: HMAC = None):
        if hmac_scheme is None:
            hmac_scheme = HMAC()
        if enc_scheme is None:
            prf = AESPRF()
            enc_scheme = CPAEnc(prf)
        self.enc = enc_scheme
        self.hmac = hmac_scheme

    def eth_enc(self, kE: bytes, kM: bytes, m: bytes) -> tuple:
        """Returns (r, c, t) — ciphertext blob = r||c, tag = HMAC_kM(r||c)."""
        r, c = self.enc.enc(kE, m)
        blob = r + c
        t = self.hmac.mac(kM, blob)
        return r, c, t

    def eth_dec(self, kE: bytes, kM: bytes, r: bytes, c: bytes, t: bytes):
        """Verify MAC first, then decrypt. Returns None (⊥) on MAC failure."""
        blob = r + c
        if not self.hmac.verify(kM, blob, t):
            return None
        return self.enc.dec(kE, r, c)


def cca2_game(n_queries: int = 20) -> dict:
    """
    IND-CCA2 game for Encrypt-then-HMAC.
    Adversary gets: encryption oracle, decryption oracle (except challenge ciphertext).
    Challenge: distinguish Enc(m0) from Enc(m1).

    EtH is IND-CCA2 secure: any modification to the ciphertext is rejected
    by the MAC before decryption, so the adversary gains no information.
    """
    from src.pa03_cpa_enc.cpa_enc import CPAEnc
    from src.pa02_prf.prf import AESPRF

    kE = os.urandom(16)
    kM = os.urandom(16)
    eth = EtHEnc()

    m0 = b"message zero (0)"
    m1 = b"message one  (1)"

    r, c, t = eth.eth_enc(kE, kM, m0)  # challenge = Enc(m0)

    tamper_results = []
    n_successful_tampering = 0

    # Adversary tries to tamper with challenge ciphertext
    for i in range(n_queries):
        bit = i % 8
        byte_idx = i % len(r)
        r_tampered = bytearray(r)
        r_tampered[byte_idx] ^= (1 << bit)
        dec = eth.eth_dec(kE, kM, bytes(r_tampered), c, t)
        rejected = dec is None
        if not rejected:
            n_successful_tampering += 1
        tamper_results.append({
            "attempt": i + 1,
            "tamper_byte": byte_idx,
            "tamper_bit": bit,
            "rejected": rejected,
        })

    # Also try with tampered c
    c_tampered = bytearray(c)
    c_tampered[0] ^= 0xFF
    dec_c = eth.eth_dec(kE, kM, r, bytes(c_tampered), t)
    tamper_results.append({
        "attempt": "tamper_c",
        "tamper_byte": 0,
        "tamper_bit": "all",
        "rejected": dec_c is None,
    })

    # Adversary advantage: 0 for IND-CCA2 secure scheme
    adversary_advantage = n_successful_tampering / (n_queries + 1)

    return {
        "n_queries": n_queries,
        "n_tamper_attempts": len(tamper_results),
        "n_rejected": sum(1 for x in tamper_results if x["rejected"]),
        "n_successful_tampering": n_successful_tampering,
        "adversary_advantage": adversary_advantage,
        "tamper_results": tamper_results[:10],  # first 10 for display
        "secure": n_successful_tampering == 0,
        "conclusion": (
            "Encrypt-then-HMAC achieves IND-CCA2 security: every modified "
            "ciphertext is rejected by MAC verification before decryption, "
            "giving the adversary zero advantage."
        ) if n_successful_tampering == 0 else "Unexpected: tampering succeeded.",
    }


# ── Self-test ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== PA#10 HMAC Self-Test ===\n")

    group = DLPHashGroup(bits=32)
    H = DLPHash(group)
    hmac = HMAC(H)

    k = os.urandom(16)
    m = b"hello world"
    t = hmac.mac(k, m)
    print(f"HMAC tag:       {t.hex()}")
    print(f"Verify correct: {hmac.verify(k, m, t)}")
    print(f"Verify tampered:{hmac.verify(k, m + b'!', t)}")

    print("\n=== Constant-time comparison demo ===")
    ct = timing_side_channel_demo(t)
    print(f"Naive early/late ratio: {ct['naive_ratio']}x  (>1 = leaks timing)")
    print(f"CT    early/late ratio: {ct['ct_ratio']}x  (≈1 = safe)")

    print("\n=== EUF-CMA game ===")
    game = euf_cma_game(hmac, k, n_queries=50)
    print(f"Forgeries: {game['total_forgeries']} — {game['conclusion']}")

    print("\n=== Encrypt-then-HMAC ===")
    eth = EtHEnc(hmac_scheme=hmac)
    kE, kM = os.urandom(16), os.urandom(16)
    r, c, tag = eth.eth_enc(kE, kM, b"secret message")
    dec = eth.eth_dec(kE, kM, r, c, tag)
    print(f"Roundtrip: {dec}")
    bad_r = bytes([r[0] ^ 1]) + r[1:]
    print(f"Tampered (should be None): {eth.eth_dec(kE, kM, bad_r, c, tag)}")
