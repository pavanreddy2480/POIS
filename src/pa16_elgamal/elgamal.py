"""
PA#16 — ElGamal Public-Key Cryptosystem.
Uses PA#11 DH group setup. No external crypto libraries.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa13_miller_rabin.miller_rabin import gen_safe_prime, mod_pow, mod_inverse

# Pre-generated toy safe prime (32-bit) for fast demos
_PRECOMPUTED = None


class ElGamalGroup:
    """Prime-order group for ElGamal (safe prime p=2q+1)."""

    def __init__(self, bits: int = 64, precomputed: tuple = None):
        if precomputed:
            self.p, self.q = precomputed
        else:
            self.p, self.q = gen_safe_prime(bits)
        # Find generator of prime-order subgroup
        self.g = self._find_generator()

    def _find_generator(self) -> int:
        p, q = self.p, self.q
        for g in range(2, p):
            if mod_pow(g, q, p) == 1 and mod_pow(g, 2, p) != 1:
                return g
        return 2

    def random_exponent(self) -> int:
        nbytes = (self.q.bit_length() + 7) // 8
        while True:
            v = int.from_bytes(os.urandom(nbytes), 'big') % self.q
            if v > 1:
                return v


class ElGamal:
    """
    ElGamal cryptosystem over prime-order group.
    Encrypt: (c1, c2) = (g^r, m * h^r)
    Decrypt: m = c2 / c1^x = c2 * (c1^x)^(-1)
    """

    def __init__(self, group: ElGamalGroup = None, bits: int = 64):
        if group is None:
            group = ElGamalGroup(bits)
        self.group = group

    def keygen(self) -> dict:
        """Generate ElGamal key pair. sk=x, pk=(p,g,q,h) where h=g^x."""
        g = self.group
        x = g.random_exponent()
        h = mod_pow(g.g, x, g.p)
        return {
            "sk": x,
            "pk": {"p": g.p, "g": g.g, "q": g.q, "h": h}
        }

    def enc(self, pk: dict, m: int) -> tuple:
        """Encrypt group element m: returns (c1=g^r, c2=m*h^r)."""
        p, gg, h = pk["p"], pk["g"], pk["h"]
        r = self.group.random_exponent()
        c1 = mod_pow(gg, r, p)
        c2 = (m * mod_pow(h, r, p)) % p
        return c1, c2

    def dec(self, sk: int, pk: dict, c1: int, c2: int) -> int:
        """Decrypt: m = c2 * (c1^x)^(-1) mod p."""
        p = pk["p"]
        s = mod_pow(c1, sk, p)
        s_inv = mod_inverse(s, p)
        return (c2 * s_inv) % p

    def malleability_demo(self, pk: dict, c1: int, c2: int) -> dict:
        """
        ElGamal malleability: given (c1, c2) encrypting m,
        produce (c1, 2*c2 mod p) which encrypts 2m.
        This breaks CCA security.
        """
        p = pk["p"]
        c2_new = (2 * c2) % p
        return {
            "original_c1": hex(c1),
            "original_c2": hex(c2),
            "modified_c2": hex(c2_new),
            "note": "Decryption of (c1, 2*c2) gives 2*m, demonstrating malleability",
        }

    def run_cpa_game(self, pk: dict, sk: int, num_rounds: int = 20) -> dict:
        """
        IND-CPA game: adversary tries to distinguish Enc(m0) from Enc(m1).
        With large group, advantage should be ≈0.
        """
        correct = 0
        for _ in range(num_rounds):
            m0 = self.group.random_exponent() % (pk["p"] // 2) + 1
            m1 = self.group.random_exponent() % (pk["p"] // 2) + 1
            b = int.from_bytes(os.urandom(1), 'big') % 2
            m_b = m0 if b == 0 else m1
            c1, c2 = self.enc(pk, m_b)
            # Adversary guesses randomly (can't do better with DDH)
            guess = int.from_bytes(os.urandom(1), 'big') % 2
            if guess == b:
                correct += 1
        return {
            "rounds": num_rounds,
            "correct_guesses": correct,
            "advantage": abs(correct / num_rounds - 0.5),
        }


if __name__ == "__main__":
    eg = ElGamal(bits=32)
    keys = eg.keygen()
    pk, sk = keys["pk"], keys["sk"]
    print(f"p={hex(pk['p'])}, g={pk['g']}, h={hex(pk['h'])}")

    m = 42
    c1, c2 = eg.enc(pk, m)
    m2 = eg.dec(sk, pk, c1, c2)
    print(f"Enc({m}) -> Decrypt -> {m2}")
    assert m == m2

    mal = eg.malleability_demo(pk, c1, c2)
    c1m, c2m = c1, int(mal["modified_c2"], 16)
    m_mal = eg.dec(sk, pk, c1m, c2m)
    print(f"Malleability: 2*{m} = {2*m}, decrypted = {m_mal}")
    assert m_mal == 2 * m % pk["p"]
    print("PA16 ElGamal PASSED")
