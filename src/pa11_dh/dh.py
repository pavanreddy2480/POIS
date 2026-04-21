"""
PA#11 — Diffie-Hellman Key Exchange.
Uses PA#13 for prime generation. No external crypto libraries.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa13_miller_rabin.miller_rabin import gen_safe_prime, mod_pow

# Pre-computed toy safe prime (p=2q+1, 64-bit) for speed
_TOY_P = 0xFFFFFFFFFFFFFFC5  # not a real safe prime; we generate one below
_TOY_Q = None
_TOY_G = 2

class DiffieHellman:
    """
    Diffie-Hellman key exchange over Z_p*.
    Uses safe prime p = 2q+1 from PA#13.
    """

    def __init__(self, bits: int = 64, precomputed: tuple = None):
        if precomputed:
            self.p, self.q = precomputed
        else:
            print(f"  [DH] Generating {bits}-bit safe prime (this may take a moment)...")
            self.p, self.q = gen_safe_prime(bits)
        # Find generator g of prime-order subgroup of Z_p*
        self.g = self._find_generator()

    def _find_generator(self) -> int:
        """Find a generator g of the prime-order (q) subgroup of Z_p*."""
        # For safe prime p=2q+1, elements of Z_p* have order 1, 2, q, or 2q.
        # g generates the q-order subgroup iff g^q = 1 mod p and g != 1.
        # We try small values.
        p, q = self.p, self.q
        for g in range(2, p):
            if mod_pow(g, q, p) == 1 and mod_pow(g, 2, p) != 1:
                return g
        return 2

    def _random_exponent(self) -> int:
        nbytes = (self.q.bit_length() + 7) // 8
        while True:
            v = int.from_bytes(os.urandom(nbytes), 'big') % self.q
            if v > 1:
                return v

    def dh_alice_step1(self) -> tuple:
        """Alice samples a, sends A = g^a mod p."""
        a = self._random_exponent()
        A = mod_pow(self.g, a, self.p)
        return a, A

    def dh_bob_step1(self) -> tuple:
        """Bob samples b, sends B = g^b mod p."""
        b = self._random_exponent()
        B = mod_pow(self.g, b, self.p)
        return b, B

    def dh_alice_step2(self, a: int, B: int) -> int:
        """Alice computes shared secret K = B^a mod p."""
        return mod_pow(B, a, self.p)

    def dh_bob_step2(self, b: int, A: int) -> int:
        """Bob computes shared secret K = A^b mod p."""
        return mod_pow(A, b, self.p)

    def mitm_attack(self, A: int, B: int) -> dict:
        """
        Eve's MITM attack:
        Intercepts A and B, substitutes A'=g^e and B'=g^e.
        Eve shares K_A = A^e with Alice and K_B = B^e with Bob.
        """
        e = self._random_exponent()
        E = mod_pow(self.g, e, self.p)
        K_alice = mod_pow(A, e, self.p)  # Eve and Alice share this
        K_bob   = mod_pow(B, e, self.p)  # Eve and Bob share this
        return {
            "eve_exp": hex(e),
            "eve_public": hex(E),
            "key_with_alice": hex(K_alice),
            "key_with_bob": hex(K_bob),
            "intercept_A": hex(A),
            "intercept_B": hex(B),
            "substitute_A_prime": hex(E),
            "substitute_B_prime": hex(E),
        }

    def full_exchange(self) -> dict:
        """Run a complete DH exchange and return all values."""
        a, A = self.dh_alice_step1()
        b, B = self.dh_bob_step1()
        KA = self.dh_alice_step2(a, B)
        KB = self.dh_bob_step2(b, A)
        return {
            "p": hex(self.p),
            "q": hex(self.q),
            "g": hex(self.g),
            "alice_private": hex(a),
            "alice_public": hex(A),
            "bob_private": hex(b),
            "bob_public": hex(B),
            "alice_shared_secret": hex(KA),
            "bob_shared_secret": hex(KB),
            "keys_match": KA == KB,
        }


if __name__ == "__main__":
    dh = DiffieHellman(bits=32)
    result = dh.full_exchange()
    for k, v in result.items():
        print(f"  {k}: {v}")
