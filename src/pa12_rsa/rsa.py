"""
PA#12 — Textbook RSA + PKCS#1 v1.5.
Uses PA#13 Miller-Rabin for prime generation. No external crypto libraries.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa13_miller_rabin.miller_rabin import gen_prime, mod_inverse, mod_pow, is_prime

RSA_E = 65537


class RSA:
    def keygen(self, bits: int = 512) -> dict:
        """
        Generate RSA key pair.
        Returns {pk: (N, e), sk: {N, d, p, q, dp, dq, q_inv}}.
        """
        half = bits // 2
        while True:
            p = gen_prime(half)
            q = gen_prime(half)
            if p == q:
                continue
            N = p * q
            phi = (p - 1) * (q - 1)
            if phi % RSA_E != 0:  # gcd(e, phi) must be 1
                try:
                    d = mod_inverse(RSA_E, phi)
                    break
                except ValueError:
                    continue

        d  = mod_inverse(RSA_E, phi)
        dp = d % (p - 1)
        dq = d % (q - 1)
        q_inv = mod_inverse(q, p)

        return {
            "pk": (N, RSA_E),
            "sk": {
                "N": N, "d": d, "p": p, "q": q,
                "dp": dp, "dq": dq, "q_inv": q_inv
            }
        }

    def rsa_enc(self, pk: tuple, m: int) -> int:
        """Textbook RSA encrypt: C = m^e mod N."""
        N, e = pk
        assert 0 < m < N, "Message must be in range (0, N)"
        return mod_pow(m, e, N)

    def rsa_dec(self, sk: dict, c: int) -> int:
        """Textbook RSA decrypt: M = c^d mod N."""
        return mod_pow(c, sk["d"], sk["N"])

    def rsa_dec_crt(self, sk: dict, c: int) -> int:
        """
        CRT-based RSA decryption (Garner's algorithm).
        ~4x faster than naive c^d mod N.
        """
        p, q = sk["p"], sk["q"]
        dp, dq, q_inv = sk["dp"], sk["dq"], sk["q_inv"]

        mp = mod_pow(c, dp, p)  # c^dp mod p
        mq = mod_pow(c, dq, q)  # c^dq mod q

        # Garner's CRT recombination
        h = (q_inv * (mp - mq)) % p
        m = mq + h * q
        return m % sk["N"]

    def pkcs15_enc(self, pk: tuple, m: bytes) -> int:
        """
        PKCS#1 v1.5 encryption padding then RSA.
        EM = 0x00 || 0x02 || PS (random nonzero, >=8 bytes) || 0x00 || m
        """
        N, e = pk
        k = (N.bit_length() + 7) // 8  # modulus byte length
        if len(m) > k - 11:
            raise ValueError(f"Message too long: {len(m)} > {k-11}")

        ps_len = k - len(m) - 3
        # Generate random nonzero PS bytes
        ps = bytearray()
        while len(ps) < ps_len:
            b = os.urandom(1)[0]
            if b != 0:
                ps.append(b)

        em = bytes([0x00, 0x02]) + bytes(ps) + bytes([0x00]) + m
        m_int = int.from_bytes(em, 'big')
        return self.rsa_enc(pk, m_int)

    def pkcs15_dec(self, sk: dict, c: int) -> bytes:
        """
        PKCS#1 v1.5 decryption: RSA decrypt then strip padding.
        Returns None on malformed padding (padding oracle would return this).
        """
        N = sk["N"]
        k = (N.bit_length() + 7) // 8
        m_int = self.rsa_dec(sk, c)
        em = m_int.to_bytes(k, 'big')

        if em[0] != 0x00 or em[1] != 0x02:
            return None  # Bad padding

        # Find separator 0x00
        try:
            sep = em.index(0x00, 2)
        except ValueError:
            return None  # No separator

        if sep - 2 < 8:
            return None  # PS too short

        return em[sep + 1:]


if __name__ == "__main__":
    rsa = RSA()
    print("Generating 512-bit RSA key pair...")
    keys = rsa.keygen(512)
    pk, sk = keys["pk"], keys["sk"]
    print(f"  N = {hex(pk[0])[:20]}...")
    print(f"  e = {pk[1]}")

    m = 42
    c = rsa.rsa_enc(pk, m)
    m2 = rsa.rsa_dec(sk, c)
    m3 = rsa.rsa_dec_crt(sk, c)
    print(f"  Encrypt {m} -> Decrypt -> {m2} (CRT: {m3})")
    assert m == m2 == m3, "RSA roundtrip failed"

    msg = b"Hello RSA"
    c2 = rsa.pkcs15_enc(pk, msg)
    msg2 = rsa.pkcs15_dec(sk, c2)
    print(f"  PKCS#1 v1.5: '{msg.decode()}' -> '{msg2.decode()}'")
    assert msg == msg2
    print("RSA tests PASSED")
