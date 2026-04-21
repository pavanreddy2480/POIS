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

    for i in range(num_trials):
        x = os.urandom(max(1, n_bits // 8))
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


def birthday_attack_floyd(hash_fn, n_bits: int) -> dict:
    """
    Floyd's cycle detection (tortoise & hare) collision finder.
    Space-efficient: O(1) memory.
    """
    mask = (1 << n_bits) - 1

    def f(x: int) -> int:
        b = x.to_bytes(max(1, (x.bit_length() + 7) // 8) or 1, 'big')
        return hash_fn(b) & mask

    # Phase 1: find meeting point
    x_seed = int.from_bytes(os.urandom(max(1, n_bits // 8)), 'big') & mask
    tortoise = f(x_seed)
    hare = f(f(x_seed))
    evals = 3

    while tortoise != hare:
        tortoise = f(tortoise)
        hare = f(f(hare))
        evals += 3

    # Phase 2: find cycle start
    tortoise = x_seed
    while tortoise != hare:
        tortoise = f(tortoise)
        hare = f(hare)
        evals += 2

    cycle_start = tortoise

    # Phase 3: find second preimage
    tortoise = f(cycle_start)
    evals += 1
    while f(tortoise) != f(cycle_start) or tortoise == cycle_start:
        tortoise = f(tortoise)
        evals += 1

    h1 = f(cycle_start) & mask
    h2 = f(tortoise) & mask
    if h1 == h2 and cycle_start != tortoise:
        return {
            "found": True,
            "x1": hex(cycle_start),
            "x2": hex(tortoise),
            "hash": hex(h1),
            "evaluations": evals,
        }
    return {"found": False, "evaluations": evals}


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
