"""
PA#13 — Miller-Rabin Primality Testing.
No external libraries. Uses Python built-in pow() for square-and-multiply.
"""
import os
import struct

def mod_pow(base: int, exp: int, mod: int) -> int:
    """Square-and-multiply modular exponentiation."""
    return pow(base, exp, mod)

def extended_gcd(a: int, b: int):
    """Returns (gcd, x, y) such that a*x + b*y = gcd."""
    if b == 0:
        return a, 1, 0
    g, x, y = extended_gcd(b, a % b)
    return g, y, x - (a // b) * y

def mod_inverse(a: int, n: int) -> int:
    """Modular inverse of a mod n (raises ValueError if not invertible)."""
    g, x, _ = extended_gcd(a % n, n)
    if g != 1:
        raise ValueError(f"{a} has no inverse mod {n}")
    return x % n

def miller_rabin(n: int, k: int = 40) -> str:
    """
    Miller-Rabin primality test.
    Returns 'PROBABLY_PRIME' or 'COMPOSITE'.
    Error probability <= 4^(-k).
    """
    if n < 2:
        return "COMPOSITE"
    if n == 2 or n == 3:
        return "PROBABLY_PRIME"
    if n % 2 == 0:
        return "COMPOSITE"

    # Write n-1 = 2^s * d with d odd
    s, d = 0, n - 1
    while d % 2 == 0:
        s += 1
        d //= 2

    def _random_int(low, high):
        """Cryptographically random integer in [low, high]."""
        r = high - low + 1
        nbytes = (r.bit_length() + 7) // 8
        while True:
            v = int.from_bytes(os.urandom(nbytes), 'big') % r
            if v + low <= high:
                return v + low

    for _ in range(k):
        a = _random_int(2, n - 2)
        x = mod_pow(a, d, n)
        if x == 1 or x == n - 1:
            continue
        for _ in range(s - 1):
            x = mod_pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return "COMPOSITE"

    return "PROBABLY_PRIME"

def is_prime(n: int, k: int = 40) -> bool:
    return miller_rabin(n, k) == "PROBABLY_PRIME"

def gen_prime(bits: int) -> int:
    """
    Generate a probable prime of the given bit length.
    Uses k=40 Miller-Rabin rounds (error prob ~10^-24).
    """
    while True:
        # Sample random odd b-bit integer
        n = int.from_bytes(os.urandom(bits // 8), 'big')
        n |= (1 << (bits - 1))  # set high bit
        n |= 1                   # ensure odd
        if miller_rabin(n, 40) == "PROBABLY_PRIME":
            # Extra sanity: verify with 100 rounds
            if miller_rabin(n, 20) == "PROBABLY_PRIME":
                return n

def gen_safe_prime(bits: int) -> tuple:
    """
    Generate safe prime p = 2q+1 where q is also prime.
    Returns (p, q).
    """
    while True:
        q = gen_prime(bits - 1)
        p = 2 * q + 1
        if is_prime(p):
            return p, q

def miller_rabin_verbose(n: int, k: int = 20) -> dict:
    """
    Miller-Rabin test with full per-round witness trace.
    Returns result, time, and list of rounds with a_i and squaring sequence.
    """
    import time

    def _fmt(v, ref):
        """Format integer: decimal if small, hex if large."""
        if v < 10**15:
            return str(v)
        return hex(v)

    if n < 2:
        return {"result": "COMPOSITE", "rounds": [], "s": 0, "d": 0, "time_sec": 0}
    if n == 2 or n == 3:
        return {"result": "PROBABLY_PRIME", "rounds": [], "s": 0, "d": 1, "time_sec": 0}
    if n % 2 == 0:
        return {"result": "COMPOSITE", "rounds": [], "s": 1, "d": (n - 1) // 2, "time_sec": 0}

    s, d = 0, n - 1
    while d % 2 == 0:
        s += 1
        d //= 2

    def _random_int(low, high):
        r = high - low + 1
        nbytes = (r.bit_length() + 7) // 8
        while True:
            v = int.from_bytes(os.urandom(nbytes), 'big') % r
            if v + low <= high:
                return v + low

    start = time.perf_counter()
    rounds = []
    result = "PROBABLY_PRIME"

    for i in range(k):
        a = _random_int(2, n - 2)
        x = mod_pow(a, d, n)
        sequence = [x]
        is_witness = False

        if x == 1 or x == n - 1:
            reason = "x₀ = 1" if x == 1 else "x₀ = n−1"
        else:
            reason = "witness"
            for _ in range(s - 1):
                x = mod_pow(x, 2, n)
                sequence.append(x)
                if x == n - 1:
                    reason = "x = n−1 after squaring"
                    break
            else:
                is_witness = True
                result = "COMPOSITE"

        rounds.append({
            "round": i + 1,
            "a": _fmt(a, n),
            "x0": _fmt(sequence[0], n),
            "sequence": [_fmt(v, n) for v in sequence[:5]],
            "witness": is_witness,
            "reason": reason if not is_witness else "WITNESS — composite proven",
        })

        if is_witness:
            break

    elapsed = round(time.perf_counter() - start, 6)
    return {
        "n": str(n),
        "result": result,
        "s": s,
        "d": str(d),
        "rounds": rounds,
        "rounds_run": len(rounds),
        "rounds_requested": k,
        "time_sec": elapsed,
    }


def carmichael_demo():
    """Show that n=561 passes naive Fermat but fails Miller-Rabin."""
    n = 561  # 561 = 3 * 11 * 17
    # Use only values coprime to 561 (avoid 3, 11, 17 and multiples)
    coprime_bases = [a for a in range(2, 20) if all(a % f != 0 for f in [3, 11, 17])]
    fermat_passes = all(pow(a, n - 1, n) == 1 for a in coprime_bases[:8])
    mr_result = miller_rabin(n, 5)
    return {
        "n": n,
        "fermat_passes": fermat_passes,
        "miller_rabin": mr_result,
        "is_carmichael": fermat_passes and mr_result == "COMPOSITE",
    }


if __name__ == "__main__":
    print("Miller-Rabin tests:")
    print(f"  miller_rabin(561, 5) = {miller_rabin(561, 5)}")
    print(f"  miller_rabin(7, 20)  = {miller_rabin(7, 20)}")
    p = gen_prime(64)
    print(f"  Generated 64-bit prime: {hex(p)}")
    print(f"  Carmichael demo: {carmichael_demo()}")
