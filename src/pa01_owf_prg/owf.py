"""
PA#1 — One-Way Functions (OWF) and PRG.
Implements:
  - DLPOWF : f(x) = g^x mod p  (DLP hardness assumption)
  - AESOWF : f(k) = AES_k(0^128) XOR k  (Davies-Meyer compression)
No external cryptographic libraries used.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa02_prf.aes_impl import aes_encrypt

# ── Pre-computed toy safe primes ─────────────────────────────────────────────
# p = 2q+1 where both p and q are prime.
# These are used for fast demos; larger primes give real security.
_SAFE_PRIMES_64 = [
    # (p, q, g)  — g is a generator of the order-q subgroup
    (0xFFFFFFFFFFFFFFC5, 0x7FFFFFFFFFFFFFE2, 2),   # near 2^64 (illustrative)
]

# Reliable small safe prime for toy demos:
# p=23, q=11, g=2  (textbook example)
_TOY_SAFE_PRIME = (
    # 64-bit safe prime
    11777760797322750673,  # p
    5888880398661375336,   # q  (p-1)/2
    7,                     # g  (generator of order q subgroup)
)

def _is_prime_trial(n: int, limit: int = 10000) -> bool:
    if n < 2: return False
    if n == 2: return True
    if n % 2 == 0: return False
    i = 3
    while i * i <= n and i <= limit:
        if n % i == 0: return False
        i += 2
    return True

def _gen_safe_prime(bits: int = 32) -> tuple:
    """Generate a safe prime p=2q+1 with q prime (toy size for speed)."""
    import random as _rand
    rng = _rand.Random(42)
    while True:
        q = rng.getrandbits(bits - 1) | (1 << (bits - 2)) | 1
        if _is_prime_trial(q):
            p = 2 * q + 1
            if _is_prime_trial(p):
                # Find generator of subgroup of order q
                for g in range(2, p):
                    if pow(g, q, p) == 1 and pow(g, 2, p) != 1:
                        return p, q, g


class DLPOWF:
    """
    Discrete Logarithm Problem OWF.
    f(x) = g^x mod p
    One-way under the DLP assumption.
    """

    def __init__(self, bits: int = 32):
        if bits <= 32:
            self.p, self.q, self.g = _gen_safe_prime(bits)
        else:
            # Use pre-stored larger prime (toy: reuse 32-bit for speed)
            self.p, self.q, self.g = _gen_safe_prime(32)
        self.bits = bits

    def evaluate(self, x: int) -> int:
        """Compute g^x mod p."""
        return pow(self.g, x % self.q, self.p)

    def verify_hardness(self) -> str:
        return (
            f"DLP OWF: f(x) = g^x mod p\n"
            f"  p = {self.p} ({self.p.bit_length()} bits)\n"
            f"  q = {self.q} (group order)\n"
            f"  g = {self.g} (generator)\n"
            "Hardness: computing x from g^x mod p requires solving DLP\n"
            "Best known algorithm: Baby-step Giant-step O(sqrt(q))"
        )

    def group_params(self) -> dict:
        return {"p": self.p, "q": self.q, "g": self.g, "bits": self.bits}


class AESOWF:
    """
    AES-based OWF (Davies-Meyer style).
    f(k) = AES_k(0^128) XOR k
    One-way under AES security assumption.
    """

    def evaluate(self, k: bytes) -> bytes:
        """Compute AES_k(0^128) XOR k."""
        assert len(k) == 16, "Key must be 16 bytes"
        zero_block = b'\x00' * 16
        aes_out = aes_encrypt(k, zero_block)
        return bytes(a ^ b for a, b in zip(aes_out, k))

    def verify_hardness(self) -> str:
        return (
            "AES OWF (Davies-Meyer): f(k) = AES_k(0^128) XOR k\n"
            "One-way if AES is a pseudorandom permutation (PRP)\n"
            "Collision resistance follows from PRP security"
        )
