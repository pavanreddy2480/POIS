"""
PA#14 — Chinese Remainder Theorem & Breaking Textbook RSA (Håstad's Attack).
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa13_miller_rabin.miller_rabin import mod_inverse, mod_pow


def crt(residues: list, moduli: list) -> int:
    """
    CRT solver: given a_i, n_i (pairwise coprime), find unique x mod N = prod(n_i).
    x = sum(a_i * M_i * (M_i^-1 mod n_i)) mod N  where M_i = N / n_i
    """
    N = 1
    for ni in moduli:
        N *= ni

    x = 0
    for ai, ni in zip(residues, moduli):
        Mi = N // ni
        Mi_inv = mod_inverse(Mi, ni)
        x += ai * Mi * Mi_inv

    return x % N


def integer_nth_root(n: int, e: int) -> int:
    """
    Compute floor(n^(1/e)) using Newton's method for integer roots.
    """
    if n == 0:
        return 0
    if e == 1:
        return n

    # Initial guess
    x = int(n ** (1.0 / e)) + 2

    while True:
        x1 = ((e - 1) * x + n // (x ** (e - 1))) // e
        if x1 >= x:
            break
        x = x1

    # Verify and adjust
    while x ** e > n:
        x -= 1
    while (x + 1) ** e <= n:
        x += 1

    return x


def hastad_attack(ciphertexts: list, moduli: list, e: int = 3) -> int:
    """
    Håstad's Broadcast Attack:
    Given c_i = m^e mod N_i for i=0..e-1, recover m.
    Steps:
      1. Apply CRT to get x = m^e mod (N0*N1*...*N(e-1))
      2. Since m < N_i, m^e < product, so x = m^e as integer
      3. Take integer e-th root
    Returns recovered plaintext m.
    """
    assert len(ciphertexts) == e == len(moduli), "Need exactly e ciphertexts/moduli"

    # Step 1: CRT
    x = crt(ciphertexts, moduli)

    # Step 2: Integer e-th root
    m = integer_nth_root(x, e)

    # Verify
    for ci, ni in zip(ciphertexts, moduli):
        assert mod_pow(m, e, ni) == ci, f"Håstad verification failed"

    return m


def rsa_dec_crt_garner(c: int, sk: dict) -> int:
    """
    Garner's CRT RSA decryption.
    sk must have p, q, dp, dq, q_inv.
    """
    p, q = sk["p"], sk["q"]
    mp = mod_pow(c, sk["dp"], p)
    mq = mod_pow(c, sk["dq"], q)
    h = (sk["q_inv"] * (mp - mq)) % p
    return mq + h * q


if __name__ == "__main__":
    # CRT test
    x = crt([2, 3, 2], [3, 5, 7])
    print(f"CRT([2,3,2], [3,5,7]) = {x}  (expected 23)")
    assert x == 23

    # Håstad attack test
    from src.pa12_rsa.rsa import RSA
    rsa = RSA()
    e = 3
    m = 42  # small message

    keys_list = [rsa.keygen(128) for _ in range(e)]
    pks = [k["pk"] for k in keys_list]
    N_list = [pk[0] for pk in pks]

    # Encrypt same message to all 3 recipients (textbook RSA, no padding!)
    ciphertexts = [mod_pow(m, e, N) for N in N_list]

    recovered = hastad_attack(ciphertexts, N_list, e)
    print(f"Håstad attack: m={m}, recovered={recovered}, success={m==recovered}")
    assert m == recovered
    print("PA14 tests PASSED")
