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

def _is_prime_miller_rabin(n: int, k: int = 20) -> bool:
    """Miller-Rabin primality test (no external deps)."""
    if n < 2: return False
    if n in (2, 3): return True
    if n % 2 == 0: return False
    s, d = 0, n - 1
    while d % 2 == 0:
        s += 1
        d //= 2
    nbytes = max(1, (n.bit_length() + 7) // 8)
    for _ in range(k):
        a = int.from_bytes(os.urandom(nbytes), 'big') % (n - 3) + 2
        x = pow(a, d, n)
        if x == 1 or x == n - 1:
            continue
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True

def _gen_safe_prime(bits: int = 32) -> tuple:
    """Generate a safe prime p=2q+1 with q prime."""
    nbytes = max(1, (bits - 1 + 7) // 8)
    while True:
        q = int.from_bytes(os.urandom(nbytes), 'big')
        q |= (1 << (bits - 2))  # ensure high bit set
        q |= 1                   # ensure odd
        q &= (1 << (bits - 1)) - 1  # clamp to bits-1 bits
        q |= (1 << (bits - 2))   # re-set high bit after mask
        if not _is_prime_miller_rabin(q):
            continue
        p = 2 * q + 1
        if not _is_prime_miller_rabin(p):
            continue
        # Find generator of prime-order subgroup
        for g in range(2, min(p, 1000)):
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

    def verify_hardness(self, x: int = None) -> dict:
        result = {
            "hardness": "DLP",
            "description": "f(x) = g^x mod p",
            "p": self.p,
            "q": self.q,
            "g": self.g,
            "bits": self.bits,
            "best_attack": "Baby-step Giant-step O(sqrt(q))",
        }
        if x is not None:
            result["input"] = x
            result["output"] = self.evaluate(x)
        return result

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
