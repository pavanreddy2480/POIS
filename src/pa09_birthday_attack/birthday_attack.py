"""
PA#9 — Birthday Attack (Collision Finding).
Implements naive sort-based and Floyd's cycle-detection approaches.
"""
import os
import math
import time

def birthday_attack_naive(hash_fn, n_bits: int, num_trials: int = None) -> dict:
    """
    Naive birthday attack: hash random inputs, detect first collision.
    hash_fn: callable(bytes) -> int (truncated to n_bits)
    n_bits: output bit length
    num_trials: max attempts (default 3 * 2^(n/2))
    Returns dict with collision pair, hashes, evaluations, time.
    """
    if num_trials is None:
        num_trials = int(3.0 * (2 ** (n_bits / 2))) + 1000

    seen = {}  # hash_value -> input
    mask = (1 << n_bits) - 1
    start = time.time()

    # Use enough bytes to ensure >> 2^(n/2) distinct inputs are possible
    input_bytes = max(2, (n_bits + 3) // 4)
    for i in range(num_trials):
        x = os.urandom(input_bytes)
        h = hash_fn(x) & mask
        if h in seen and seen[h] != x:
            elapsed = time.time() - start
            return {
                "found": True,
                "x1": x.hex(),
                "x2": seen[h].hex(),
                "hash": hex(h),
                "evaluations": i + 1,
                "expected_2_to_n_over_2": int(2 ** (n_bits / 2)),
                "ratio": (i + 1) / (2 ** (n_bits / 2)),
                "time_sec": elapsed,
            }
        seen[h] = x

    return {"found": False, "evaluations": num_trials}


def birthday_attack_floyd(hash_fn, n_bits: int, max_retries: int = 30) -> dict:
    """
    Floyd's cycle detection (tortoise & hare) collision finder.
    Space-efficient: O(sqrt(N)) time, O(1) memory.

    Collision comes from the rho structure: the tail element x_{mu-1} and the
    element x_{mu+lam-1} at the end of the cycle are both predecessors of
    cycle_start, so f(x_{mu-1}) == f(x_{mu+lam-1}) with x_{mu-1} != x_{mu+lam-1}.
    Retries if starting point lands directly in the cycle (mu=0).
    """
    mask = (1 << n_bits) - 1
    total_evals = 0

    n_bytes = max(1, (n_bits + 7) // 8)

    def f(x: int) -> int:
        b = (x & mask).to_bytes(n_bytes, 'big')
        return hash_fn(b) & mask

    for _ in range(max_retries):
        x0 = int.from_bytes(os.urandom(max(1, n_bits // 8)), 'big') & mask

        # Phase 1: find meeting point
        tortoise = f(x0)
        hare = f(f(x0))
        evals = 3
        while tortoise != hare:
            tortoise = f(tortoise)
            hare = f(f(hare))
            evals += 3

        # Phase 2: find mu (tail length) — reset tortoise to x0
        mu = 0
        tortoise = x0
        while tortoise != hare:
            tortoise = f(tortoise)
            hare = f(hare)
            evals += 2
            mu += 1

        total_evals += evals

        # Need mu > 0 for the tail collision to exist; retry otherwise
        if mu == 0:
            continue

        # Phase 3: find lambda (cycle length)
        lam = 1
        hare = f(tortoise)  # tortoise == cycle_start
        total_evals += 1
        while hare != tortoise:
            hare = f(hare)
            total_evals += 1
            lam += 1

        # Collision: x_{mu-1} and x_{mu+lam-1} are both predecessors of cycle_start
        a = x0
        for _ in range(mu - 1):
            a = f(a)
            total_evals += 1
        b = x0
        for _ in range(mu + lam - 1):
            b = f(b)
            total_evals += 1

        ha = f(a) & mask
        hb = f(b) & mask
        total_evals += 2

        if a != b and ha == hb:
            return {
                "found": True,
                "x1": hex(a),
                "x2": hex(b),
                "hash": hex(ha),
                "evaluations": total_evals,
            }

    return {"found": False, "evaluations": total_evals}


def run_birthday_empirical(hash_fn, n_values, trials_per_n=20):
    """
    Run birthday attack for multiple n_bits values and collect statistics.
    Returns a list of {n, avg_evals, expected, ratio} dicts.
    """
    results = []
    for n in n_values:
        counts = []
        for _ in range(trials_per_n):
            r = birthday_attack_naive(hash_fn, n)
            if r["found"]:
                counts.append(r["evaluations"])
        avg = sum(counts) / len(counts) if counts else 0
        expected = 2 ** (n / 2)
        results.append({
            "n": n,
            "avg_evaluations": avg,
            "expected": expected,
            "ratio": avg / expected if expected else 0,
        })
    return results


if __name__ == "__main__":
    def toy_hash(b: bytes) -> int:
        # Weak toy hash: XOR folding
        v = 0
        for byte in b:
            v = ((v << 3) | (v >> 5)) & 0xFFFF
            v ^= byte
        return v

    print("Naive birthday attack (n=12):")
    r = birthday_attack_naive(toy_hash, 12)
    print(f"  Collision: {r.get('x1','?')} and {r.get('x2','?')} -> {r.get('hash','?')}")
    print(f"  Evaluations: {r.get('evaluations')}, expected ~{2**6}")
