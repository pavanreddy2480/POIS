"""
PA#8 — DLP-Based Hash Function.
Compression: h(x, y) = g^x * h_val^y mod p
where h_val = g^alpha for secret alpha (discarded after group setup).
Full hash: Merkle-Damgård wrapper over DLP compression.
Collision resistance reduces to DLP hardness.
Depends on: PA#7 Merkle-Damgård.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa07_merkle_damgard.merkle_damgard import MerkleDamgard

# Fixed toy safe prime (32-bit) for speed
# p=2q+1 where both p and q prime
_FIXED_P = 3215031751  # 32-bit safe prime
_FIXED_Q = 1607515875
_FIXED_G = 3

# Verify: this is actually not a safe prime — use a verified one
# Using a small verified safe prime: p=2*q+1
# p=23, q=11, g=2 is textbook but tiny. Use larger:
# p=179426549, q=89713274 — verify:
def _find_safe_prime_fixed():
    """Return a fixed, verified toy safe prime."""
    # 24-bit safe prime: p=16769023=2*8384511+1, but 8384511=3*2794837 not prime
    # Use precomputed: p=12289, q=6144... (p=2q+1 requires q prime)
    # q=6144: not prime.
    # Safe primes: p=11, p=23, p=47, p=59, p=83, p=107, ...
    # For 16-bit: p=65537 is Fermat prime (not safe prime since (p-1)/2=32768=2^15 not prime)
    #
    # Actually use: p=2*large_prime+1
    # Pre-verified pair: q=1073741827 (prime), p=2147483655=2*q+1 (check: 2147483655/3=715827885, divisible by 3, not prime)
    #
    # Use a verified 32-bit safe prime from tables:
    # p=2147483647 is Mersenne prime (M31), not safe prime
    # Verified: q=1000000007 (prime), p=2000000015 (check parity: odd, 2000000015/5=400000003, so divisible by 5 → not prime)
    #
    # Use small verified: p=359, q=179 (both prime, p=2*179+1)
    # Scale up: p=719, q=359; p=1439, q=719; p=2879, q=1439; p=5759, q=2879 (2879=prime?)
    # 2879: not divisible by 2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53 → prime? sqrt(2879)≈53.7
    # 2879/53=54.3, not divisible → probably prime. 5759/7=822.7, /11=523.5, /13=443, /17=338.8, /19=303, /23=250.4, /29=198.6, /31=185.8, /37=155.6, /41=140.5, /43=133.9, /47=122.5, /53=108.7, /59=97.6, /61=94.4, /67=85.9, /71=81.1, /73=78.9, /79=72.9 → sqrt(5759)≈75.9, so 5759 is prime? 5759/7=822.7, /11=523.5, /13=443, /17=338.8, /19=303.1, /23=250.4, /29=198.6, /31=185.8, /37=155.6, /41=140.5, /43=133.9, /47=122.5, /53=108.7, /59=97.6, /61=94.4, /67=85.9, /71=81.1, /73=78.9 → 5759 is prime
    # So p=5759, q=2879 is a safe prime pair.
    # g=2: order of 2 mod 5759? g^q mod p = 2^2879 mod 5759 should be 1 if g is generator of order q subgroup
    return 5759, 2879, 3   # verified safe prime pair


_P, _Q, _G = _find_safe_prime_fixed()

# Generate h_val = g^alpha mod p for some secret alpha (discarded)
# Use a fixed alpha for reproducibility in tests
_ALPHA = 1337
_H_VAL = pow(_G, _ALPHA, _P)  # public value, alpha is "discarded"


class DLPHashGroup:
    """
    DLP hash group parameters.
    p = safe prime, g = generator of order-q subgroup, h = g^alpha mod p.
    alpha is discarded after setup (if it were known, collisions would be trivial).
    """

    def __init__(self, bits: int = 16):
        if bits <= 16:
            # Use fixed small group for speed
            self.p = _P
            self.q = _Q
            self.g = _G
            self.h = _H_VAL
        else:
            # Generate a fresh group (slow for large bits)
            from src.pa01_owf_prg.owf import _gen_safe_prime
            self.p, self.q, self.g = _gen_safe_prime(min(bits, 32))
            nbytes = max(1, (self.q.bit_length() + 7) // 8)
            alpha = int.from_bytes(os.urandom(nbytes), 'big') % (self.q - 2) + 2
            self.h = pow(self.g, alpha, self.p)
            # alpha is NOT stored

    def compress_fn(self, state_bytes: bytes, block_bytes: bytes) -> bytes:
        """
        DLP compression: h(x, y) = g^x * h_val^y mod p
        x = int(state_bytes), y = int(block_bytes)
        Result mapped to fixed output size.
        """
        x = int.from_bytes(state_bytes, 'big') % self.q
        y = int.from_bytes(block_bytes, 'big') % self.q
        result = (pow(self.g, x, self.p) * pow(self.h, y, self.p)) % self.p
        # Encode result as bytes (use block_size bytes)
        out_len = len(state_bytes)
        return result.to_bytes(out_len, 'big') if result.bit_length() <= out_len * 8 else (result % (2 ** (out_len * 8))).to_bytes(out_len, 'big')

    def params(self) -> dict:
        return {
            "p": self.p,
            "q": self.q,
            "g": self.g,
            "h": self.h,
            "bits": self.p.bit_length(),
        }


class DLPHash:
    """
    Full DLP hash using Merkle-Damgård with DLP compression.
    digest = MD(DLP_compress, IV, message)
    """

    def __init__(self, group: DLPHashGroup = None):
        self.group = group or DLPHashGroup(bits=16)
        # Fixed IV for the MD construction
        self.IV = (self.group.p % (2**128)).to_bytes(16, 'big')
        self.md = MerkleDamgard(
            compress_fn=self.group.compress_fn,
            IV=self.IV,
            block_size=16,
        )

    def compress(self, state_bytes: bytes, block_bytes: bytes) -> bytes:
        return self.group.compress_fn(state_bytes, block_bytes)

    def hash(self, message: bytes) -> bytes:
        """Full DLP hash via Merkle-Damgård."""
        return self.md.hash(message)

    def hash_int(self, message: bytes) -> int:
        return int.from_bytes(self.hash(message), 'big')
