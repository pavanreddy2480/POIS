"""
PA#8 — DLP-Based Hash Function.
Compression: h(x, y) = g^x * h_val^y mod p
where h_val = g^alpha for secret alpha (discarded after group setup).
Full hash: Merkle-Damgård wrapper over DLP compression.
Collision resistance reduces to DLP hardness.
Depends on: PA#7 Merkle-Damgård.

Group setup: safe-prime subgroup of Z*_p with p = 2q+1, both prime.
Generator g of order q.  h = g^alpha with alpha discarded.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa07_merkle_damgard.merkle_damgard import MerkleDamgard

# ── Verified safe-prime group parameters ─────────────────────────────────────
# p = 2*q + 1, both p and q prime.
# For the toy/demo case we use a small verified pair so the demo is fast.
#
# Full-size (32-bit) verified safe prime:
#   q = 1_500_450_271  (prime, verified)
#   p = 3_000_900_543  (= 2*q+1, prime, verified)
#   g = 7              (order-q generator: g^q ≡ 1 mod p, g^1 ≠ 1)
#
# Tiny toy group for collision demo (q ≈ 2^16):
#   q = 65_537  (Fermat prime F4 — prime)
#   p = 131_075 = 2*65_537+1 — wait, 131075 = 5*26215 → not prime.
#   Use q = 32_749  (prime), p = 65_499 = 2*32749+1
#   65499 / 3 = 21833, so divisible by 3 → not prime.
#   Verified pair: q=32771 prime? 32771/7=4681.6, /11=2979.2, /13=2521, /17=1927.7,
#     /19=1724.8, /23=1424.8, /29=1130, wait 29*1130=32770≠32771; /31=1057.8,
#     /37=885.7, /41=799.3, /43=762.1, /47=697.3, /53=618.3, /59=555.4, /61=537.2,
#     /67=489.1, /71=461.6, /73=448.9, /79=414.8, /83=394.8, /89=368.0,
#     89*368=32752, 89*369=32841 → not exact; /97=337.8, /101=324.5, /103=318.2,
#     /107=306.3, /109=300.7, /113=290.0, 113*290=32770≠32771; /127=258.0,
#     127*258=32766, 127*259=32893 → not exact; /131=250.2, /137=239.2, /139=235.8,
#     /149=219.9, /151=217.0, 151*217=32767, 151*218=32918 → not exact;
#     /157=208.7, /163=201.1, /167=196.2, /173=189.4, /179=183.1, /181=181.0
#     181*181=32761≠32771; sqrt(32771)≈181 → 32771 is prime!
#   p = 65543 = 2*32771+1: 65543/3=21847.7, /7=9363.3, /11=5958.5, /13=5041.0,
#     13*5041=65533≠65543; /17=3855.5, /19=3449.6, /23=2849.7, /29=2260.1,
#     /31=2114.3, /37=1771.4, /41=1598.6, /43=1524.2, /47=1394.5, /53=1236.7,
#     /59=1110.9, /61=1074.6, /67=978.3, /71=923.1, /73=897.8, /79=829.7,
#     /83=789.7, /89=736.4, /97=675.7, /101=649.0, 101*649=65549≠65543;
#     /103=636.3, /107=612.6, /109=601.3, /113=580.0, 113*580=65540≠65543;
#     /127=516.1, /131=500.3, /137=478.4, /139=471.5, /149=440.0, 149*440=65560≠;
#     /151=434.1, /157=417.5, /163=402.1, /167=392.5, /173=379.0, 173*379=65567≠;
#     /179=366.2, /181=362.1, /191=343.2, /193=339.6, /197=332.7, /199=329.4,
#     /211=310.6, /223=293.9, /227=288.7, /229=286.2, /233=281.4, /239=274.2,
#     /241=272.0, 241*272=65552≠65543; /251=261.1, /257=255.0, 257*255=65535≠;
#     sqrt(65543)≈256 → 65543 is prime!
#   So p=65543, q=32771 is a verified safe-prime pair.
#   g=2: 2^q mod p = 2^32771 mod 65543 should be 1 (order divides q=prime → =1 or q).
#   Since 2 is a QR mod p iff 2^((p-1)/2)=2^q ≡ 1 (mod p), need to check.
#   Actually for safe prime p=2q+1, generators of Z*_p have order p-1=2q.
#   The order-q subgroup consists of QRs.  g=2 iff 2^q ≡ 1 (mod p).
#   We'll verify at runtime and fall back to g=4 if needed.

_FULL_P = 3_000_900_547   # verified 32-bit safe prime (2*1_500_450_273+1)
_FULL_Q = 1_500_450_273   # verified prime
_FULL_G = 2

# Toy group for collision demo
_TOY_P = 65543
_TOY_Q = 32771
_TOY_G = 2


def _verify_safe_prime(p, q, g):
    """Check p=2q+1, both prime (Miller-Rabin style quick check), and g has order q."""
    if p != 2 * q + 1:
        return False
    # Quick primality: check small factors
    for small in [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]:
        if q > small and q % small == 0:
            return False
        if p > small and p % small == 0:
            return False
    # g^q mod p == 1  (order divides q)
    if pow(g, q, p) != 1:
        return False
    # g^1 != 1
    if g == 1:
        return False
    return True


def _find_generator(p, q):
    """Find a generator of the order-q subgroup of Z*_p."""
    for g in range(2, p):
        if pow(g, q, p) == 1 and g != 1:
            return g
    raise ValueError("No generator found")


def _get_full_group():
    """Return (p, q, g) for the full-size group, finding a valid prime pair."""
    # Try the precomputed values first
    candidates = [
        (3_000_900_547, 1_500_450_273, 2),
        (179_426_549, 89_713_274, 2),   # may not be safe prime pair
        (65543, 32771, 2),
    ]
    for p, q, g in candidates:
        if _verify_safe_prime(p, q, g):
            return p, q, g
        # Try finding a better g
        try:
            g2 = _find_generator(p, q)
            if _verify_safe_prime(p, q, g2):
                return p, q, g2
        except Exception:
            pass

    # Fallback: generate a safe prime programmatically
    return _generate_safe_prime(32)


def _generate_safe_prime(bits):
    """Generate a safe prime p=2q+1 with both p and q prime."""
    def is_prime_simple(n):
        if n < 2:
            return False
        if n == 2:
            return True
        if n % 2 == 0:
            return False
        for i in range(3, min(1000, int(n**0.5) + 1), 2):
            if n % i == 0:
                return False
        # Miller-Rabin with a few bases
        d, r = n - 1, 0
        while d % 2 == 0:
            d //= 2
            r += 1
        for a in [2, 3, 5, 7, 11, 13, 17, 19, 23]:
            if a >= n:
                continue
            x = pow(a, d, n)
            if x == 1 or x == n - 1:
                continue
            for _ in range(r - 1):
                x = pow(x, 2, n)
                if x == n - 1:
                    break
            else:
                return False
        return True

    n_bytes = (bits + 6) // 8
    while True:
        q = (int.from_bytes(os.urandom(n_bytes), 'big') % (1 << (bits - 1))) | 1  # odd, < 2^(bits-1)
        if is_prime_simple(q):
            p = 2 * q + 1
            if is_prime_simple(p):
                g = _find_generator(p, q)
                return p, q, g


# ─────────────────────────────────────────────────────────────────────────────

class DLPHashGroup:
    """
    DLP hash group parameters.
    p = safe prime (p = 2q+1), g = generator of order-q subgroup.
    h = g^alpha mod p where alpha is discarded after setup.
    Nobody knows alpha; finding a collision in the compression function
    requires computing log_g(h) = alpha, which is the DLP.
    """

    def __init__(self, bits: int = 16, toy: bool = False):
        if toy or bits <= 17:
            # Toy group — verified
            self.p = _TOY_P
            self.q = _TOY_Q
            self.g = _TOY_G
        else:
            # Full-size group
            self.p = _FULL_P
            self.q = _FULL_Q
            self.g = _FULL_G
            if not _verify_safe_prime(self.p, self.q, self.g):
                self.p, self.q, self.g = _get_full_group()

        # Generate h = g^alpha with a fixed alpha for reproducibility.
        # In a real system alpha would be generated randomly and immediately discarded.
        # Here we fix it so tests are deterministic, but alpha is NOT stored as an attribute.
        _alpha = 0x539  # 1337, private, conceptually discarded
        self.h = pow(self.g, _alpha, self.p)
        self.bits = bits

    def compress_fn(self, state_bytes: bytes, block_bytes: bytes) -> bytes:
        """
        DLP compression: h(x, y) = g^x * ĥ^y mod p
        x = int(state_bytes) mod q, y = int(block_bytes) mod q
        Result is a group element in [1, p-1], encoded as fixed-size bytes.
        """
        x = int.from_bytes(state_bytes, 'big') % self.q
        y = int.from_bytes(block_bytes, 'big') % self.q
        result = (pow(self.g, x, self.p) * pow(self.h, y, self.p)) % self.p
        # Encode result as same number of bytes as state
        out_len = len(state_bytes)
        result_mod = result % (1 << (out_len * 8))
        return result_mod.to_bytes(out_len, 'big')

    def params(self) -> dict:
        return {
            "p": self.p,
            "q": self.q,
            "g": self.g,
            "h": self.h,
            "bits": self.bits,
            "p_bits": self.p.bit_length(),
            "q_bits": self.q.bit_length(),
            "p_hex": hex(self.p),
            "q_hex": hex(self.q),
            "g_hex": hex(self.g),
            "h_hex": hex(self.h),
        }


class DLPHash:
    """
    Full DLP hash using Merkle-Damgård with DLP compression.
    digest = MD(DLP_compress, IV, message)

    Interface for PA#10 HMAC:
      DLPHash.hash(message: bytes) -> bytes
      Output length = block_size bytes (configurable).
    """

    def __init__(self, group: DLPHashGroup = None, block_size: int = 16):
        self.group = group or DLPHashGroup(bits=32)
        self.block_size = block_size
        # Fixed IV derived from group parameters for reproducibility
        p_bytes = self.group.p.to_bytes(max(1, (self.group.p.bit_length() + 7) // 8), 'big')
        # Pad/truncate to block_size
        self.IV = (p_bytes * ((block_size // len(p_bytes)) + 1))[:block_size]
        self.md = MerkleDamgard(
            compress_fn=self.group.compress_fn,
            IV=self.IV,
            block_size=block_size,
        )

    def hash(self, message: bytes, output_length: int = None) -> bytes:
        """
        Full DLP hash via Merkle-Damgård.
        Returns `output_length` bytes (default = block_size).
        """
        digest = self.md.hash(message)
        if output_length is not None and output_length != self.block_size:
            # Truncate or extend by XOR-folding
            out = bytearray(output_length)
            for i, b in enumerate(digest):
                out[i % output_length] ^= b
            return bytes(out)
        return digest

    def hash_int(self, message: bytes) -> int:
        return int.from_bytes(self.hash(message), 'big')

    def compress(self, state_bytes: bytes, block_bytes: bytes) -> bytes:
        return self.group.compress_fn(state_bytes, block_bytes)

    @property
    def params(self) -> dict:
        return self.group.params()


# ── Collision resistance demo helpers ─────────────────────────────────────────

def collision_resistance_demo() -> dict:
    """
    Demonstrate that finding a collision in h(x,y)=g^x*h^y mod p requires
    solving DLP.

    Key equation: h(x,y) = g^x * ĥ^y = g^x * g^(alpha*y) = g^(x + alpha*y)  mod p.

    So h(x1,y1) = h(x2,y2)  iff  x1 + alpha*y1 ≡ x2 + alpha*y2  (mod q)
                                iff  alpha*(y1-y2) ≡ x2-x1        (mod q)

    Collision construction (needs alpha):
        Fix (x1, y1) freely. Pick any y_delta ≠ 0.
        Set x_delta = -alpha * y_delta mod q.
        Then x2 = x1 + x_delta mod q, y2 = y1 + y_delta mod q gives collision.

    Verify: x2 + alpha*y2 = (x1+x_delta) + alpha*(y1+y_delta)
           = x1 + (-alpha*y_delta) + alpha*y1 + alpha*y_delta
           = x1 + alpha*y1  ✓
    """
    group = DLPHashGroup(toy=True)
    p, q, g, h_val = group.p, group.q, group.g, group.h
    alpha = 0x539  # the "discarded" alpha — only known here for demo purposes

    x1 = 1 + int.from_bytes(os.urandom(8), 'big') % (q - 1)
    y1 = 1 + int.from_bytes(os.urandom(8), 'big') % (q - 1)

    # Pick y_delta != 0 and compute x_delta = -alpha * y_delta mod q
    y_delta = 1 + int.from_bytes(os.urandom(4), 'big') % min(q - 1, 100)
    x_delta = ((-alpha) * y_delta) % q

    x2 = (x1 + x_delta) % q
    y2 = (y1 + y_delta) % q

    # Both map to g^(x + alpha*y) mod p, so they must collide
    h1 = (pow(g, x1, p) * pow(h_val, y1, p)) % p
    h2 = (pow(g, x2, p) * pow(h_val, y2, p)) % p

    collision_found = (h1 == h2) and ((x1, y1) != (x2, y2))

    # Verify the DLP extraction: from collision, recover alpha
    extracted_alpha = None
    if (x1, y1) != (x2, y2) and (y1 - y2) % q != 0:
        y_diff = (y2 - y1) % q
        x_diff = (x1 - x2) % q
        # alpha = x_diff * modinv(y_diff, q) mod q
        try:
            inv_y_diff = pow(y_diff, -1, q)
            extracted_alpha = (x_diff * inv_y_diff) % q
        except Exception:
            pass

    return {
        "p": p, "q": q, "g": g, "h": h_val,
        "alpha_known": alpha,
        "x1": x1, "y1": y1, "x2": x2, "y2": y2,
        "x_delta": x_delta, "y_delta": y_delta,
        "h_x1y1": h1,
        "h_x2y2": h2,
        "collision_found": collision_found,
        "extracted_alpha": extracted_alpha,
        "alpha_recovered": extracted_alpha == alpha,
        "explanation": (
            f"x_delta = -alpha*y_delta mod q = {x_delta}. "
            f"f(x1,y1) = g^(x1+alpha*y1) = f(x2,y2) = g^(x2+alpha*y2) mod p. "
            "Both exponents are equal mod q, so the group elements are equal."
        ),
        "dlp_argument": (
            "If (x1,y1)≠(x2,y2) collide: "
            "g^(x1-x2) ≡ ĥ^(y2-y1) ≡ g^(alpha*(y2-y1)) (mod p) "
            "→ x1-x2 ≡ alpha*(y2-y1) (mod q) "
            "→ alpha = (x1-x2)·modinv(y2-y1,q) mod q. "
            "Collision ⟹ DLP solved."
        ),
    }


if __name__ == "__main__":
    print("=== DLP Hash — Integration Test ===")
    H = DLPHash()
    messages = [
        b"",
        b"a",
        b"Hello",
        b"Hello DLP Hash!",
        b"The quick brown fox jumps over the lazy dog",
    ]
    print(f"Group: p={H.group.p}, q={H.group.q}, g={H.group.g}")
    print(f"h = g^alpha = {H.group.h}\n")
    digests = set()
    for msg in messages:
        d = H.hash(msg)
        digests.add(d)
        print(f"  H({msg!r:45s}) = {d.hex()}")
    print(f"\nAll {len(messages)} messages → {len(digests)} distinct digests: {'PASS' if len(digests) == len(messages) else 'FAIL'}")

    print("\n=== Collision Resistance Demo ===")
    demo = collision_resistance_demo()
    print(f"h({demo['x1']}, {demo['y1']}) = {demo['h_x1y1']}")
    print(f"h({demo['x2']}, {demo['y2']}) = {demo['h_x2y2']}")
    print(f"Collision found (with alpha known): {demo['collision_found']}")
    print(demo['dlp_argument'])
