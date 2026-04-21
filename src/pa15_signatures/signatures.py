"""
PA#15 — Digital Signatures (RSA + Hash-then-Sign).
Uses PA#12 RSA and PA#8 DLP hash. No external crypto libraries.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa12_rsa.rsa import RSA, RSA_E
from src.pa08_dlp_hash.dlp_hash import DLPHash, DLPHashGroup
from src.pa13_miller_rabin.miller_rabin import mod_pow


class RSASignature:
    """
    RSA Digital Signature: sign(sk, m) = H(m)^d mod N
    Verify: sigma^e mod N == H(m)
    """

    def __init__(self, rsa: RSA = None, dlp_hash: DLPHash = None, bits: int = 512):
        self.rsa = rsa or RSA()
        if dlp_hash is None:
            group = DLPHashGroup(bits=32)
            dlp_hash = DLPHash(group)
        self.H = dlp_hash

    def _hash_to_int(self, m: bytes, N: int) -> int:
        """Hash message and reduce to integer in Z_N."""
        h_bytes = self.H.hash(m)
        h_int = int.from_bytes(h_bytes, 'big')
        return h_int % N

    def sign(self, sk: dict, m: bytes) -> int:
        """Sign message m: sigma = H(m)^d mod N."""
        h = self._hash_to_int(m, sk["N"])
        sigma = mod_pow(h, sk["d"], sk["N"])
        return sigma

    def verify(self, vk: tuple, m: bytes, sigma: int) -> bool:
        """Verify signature: sigma^e mod N == H(m)."""
        N, e = vk
        h_expected = self._hash_to_int(m, N)
        h_recovered = mod_pow(sigma, e, N)
        return h_recovered == h_expected

    def multiplicative_forgery_demo(self, vk: tuple, m1: bytes, sig1: int,
                                     m2: bytes, sig2: int) -> dict:
        """
        Multiplicative homomorphism attack on raw RSA signatures (no hash).
        Given sign(m1) and sign(m2), forge sign(m1*m2) as sig1*sig2 mod N.
        This shows why hashing is necessary.
        """
        N, e = vk
        # Raw RSA sign without hash: s_i = m_i^d mod N
        # Product: s1 * s2 = (m1^d)(m2^d) = (m1*m2)^d mod N
        forged_sig = (sig1 * sig2) % N
        m12 = (int.from_bytes(m1, 'big') * int.from_bytes(m2, 'big')) % N
        m12_bytes = m12.to_bytes((m12.bit_length() + 7) // 8, 'big')

        # Verify the forged sig as raw (no hash)
        recovered = mod_pow(forged_sig, e, N)
        return {
            "m1": m1.hex(),
            "m2": m2.hex(),
            "m1_times_m2_mod_N": hex(m12),
            "forged_sig": hex(forged_sig),
            "recovered": hex(recovered),
            "forgery_valid": recovered == m12,
            "note": "Hash-then-sign prevents this: H(m1*m2) != H(m1)*H(m2)"
        }


if __name__ == "__main__":
    rsa = RSA()
    print("Generating 512-bit RSA key pair for signatures...")
    keys = rsa.keygen(512)
    sig_scheme = RSASignature(rsa)

    m = b"Vote: Yes"
    sigma = sig_scheme.sign(keys["sk"], m)
    valid = sig_scheme.verify(keys["pk"], m, sigma)
    print(f"  Sign '{m.decode()}' -> sigma={hex(sigma)[:20]}...")
    print(f"  Verify: {valid}")
    assert valid

    tampered = b"Vote: No"
    invalid = sig_scheme.verify(keys["pk"], tampered, sigma)
    print(f"  Verify tampered: {invalid}")
    assert not invalid
    print("PA15 Signatures PASSED")
