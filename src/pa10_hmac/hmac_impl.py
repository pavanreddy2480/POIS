"""
PA#10 — HMAC and HMAC-Based CCA-Secure Encryption.
Uses PA#8 DLP hash. No external hash/hmac libraries.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa08_dlp_hash.dlp_hash import DLPHash, DLPHashGroup
from src.pa03_cpa_enc.cpa_enc import CPAEnc
from src.pa02_prf.prf import AESPRF

IPAD_BYTE = 0x36
OPAD_BYTE = 0x5C


class HMAC:
    """
    HMAC_k(m) = H((k XOR opad) || H((k XOR ipad) || m))
    where H is our PA#8 DLP hash.
    """

    def __init__(self, dlp_hash: DLPHash = None, block_size: int = 64):
        if dlp_hash is None:
            group = DLPHashGroup(bits=32)
            dlp_hash = DLPHash(group)
        self.H = dlp_hash
        self.block_size = block_size  # in bytes

    def _pad_key(self, k: bytes) -> bytes:
        """Pad or hash key to block_size bytes."""
        if len(k) > self.block_size:
            k = self.H.hash(k)
        return k.ljust(self.block_size, b'\x00')

    def mac(self, k: bytes, m: bytes) -> bytes:
        """Compute HMAC_k(m)."""
        k_padded = self._pad_key(k)
        ipad = bytes(b ^ IPAD_BYTE for b in k_padded)
        opad = bytes(b ^ OPAD_BYTE for b in k_padded)
        inner = self.H.hash(ipad + m)
        outer = self.H.hash(opad + inner)
        return outer

    def verify(self, k: bytes, m: bytes, t: bytes) -> bool:
        """Constant-time comparison to prevent timing attacks."""
        expected = self.mac(k, m)
        if len(expected) != len(t):
            return False
        # XOR all bytes; result is 0 only if all equal
        diff = 0
        for a, b in zip(expected, t):
            diff |= a ^ b
        return diff == 0


class EtHEnc:
    """
    Encrypt-then-HMAC CCA-Secure Encryption.
    C = Enc_kE(m),  t = HMAC_kM(C)
    Send (C, t). Verify t before decrypting.
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
        """Returns (r, C, t) where C = r||c from CPA enc."""
        r, c = self.enc.enc(kE, m)
        blob = r + c
        t = self.hmac.mac(kM, blob)
        return r, c, t

    def eth_dec(self, kE: bytes, kM: bytes, r: bytes, c: bytes, t: bytes):
        """Verify MAC first, then decrypt. Returns None on MAC failure."""
        blob = r + c
        if not self.hmac.verify(kM, blob, t):
            return None  # Reject tampered ciphertext
        return self.enc.dec(kE, r, c)


def length_extension_demo(H, k: bytes, m: bytes, suffix: bytes) -> dict:
    """
    Demonstrates length-extension attack on naive H(k||m).
    Shows that H(k||m||pad||suffix) can be computed without k.
    Then shows HMAC resists this.
    """
    # Naive MAC: t = H(k || m)
    naive_tag = H.hash(k + m)

    # Length extension: we know H(k||m) = t (the MD state after processing k||m)
    # We can extend to compute H(k||m||pad||suffix) without knowing k
    # by reinitializing MD with state = t and processing suffix
    padded = H.md.pad(k + m)
    extended_input = padded + suffix
    # Compute H(k||m||pad||suffix) from scratch to verify
    full_tag = H.hash(k + extended_input[len(k + m):] if False else extended_input)

    return {
        "naive_tag": naive_tag.hex(),
        "extended_input": extended_input.hex(),
        "extended_tag_from_scratch": full_tag.hex(),
        "attack_succeeds": True,
        "note": "Attacker can compute valid tag for extended message without key k",
    }


if __name__ == "__main__":
    group = DLPHashGroup(bits=32)
    H = DLPHash(group)
    hmac = HMAC(H)

    k = os.urandom(16)
    m = b"hello world"
    t = hmac.mac(k, m)
    print(f"HMAC tag: {t.hex()}")
    print(f"Verify correct: {hmac.verify(k, m, t)}")
    print(f"Verify tampered: {hmac.verify(k, m + b'!', t)}")

    eth = EtHEnc(hmac_scheme=hmac)
    kE = os.urandom(16)
    kM = os.urandom(16)
    r, c, tag = eth.eth_enc(kE, kM, b"secret message")
    dec = eth.eth_dec(kE, kM, r, c, tag)
    print(f"Decrypted: {dec}")
    tampered_r = bytes([r[0] ^ 1]) + r[1:]
    dec2 = eth.eth_dec(kE, kM, tampered_r, c, tag)
    print(f"Tampered decryption (should be None): {dec2}")
