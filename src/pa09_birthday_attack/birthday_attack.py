"""
PA#9 — Birthday Attack (Collision Finding).

Implements:
  1. Naive birthday attack (hash table approach)
  2. Floyd's cycle-detection attack (O(1) memory)
  3. Deliberately weak toy hash functions (n=8,12,16 bits)
  4. Empirical birthday curve: 100 trials per n, CDF vs theoretical
  5. DLP hash truncated attack
  6. MD5/SHA-1 context: 2^(n/2) in CPU time
"""
import os
import math
import time


# ── 1. Naive birthday attack ──────────────────────────────────────────────────

def birthday_attack_naive(hash_fn, n_bits: int, num_trials: int = None) -> dict:
    """
    Naive birthday attack: hash random inputs, store outputs, detect collision.
    hash_fn: callable(bytes) -> int (will be masked to n_bits)
    n_bits:  output bit length
    num_trials: max attempts (default 3 * 2^(n/2) + 1000)

    Returns dict with collision pair, evaluations, ratio, time.
    """
    if num_trials is None:
        num_trials = int(3.0 * (2 ** (n_bits / 2))) + 1000

    seen = {}  # hash_value -> input
    mask = (1 << n_bits) - 1
    start = time.time()
    expected = 2 ** (n_bits / 2)

    # Enough input bytes to avoid input collisions swamping hash collisions
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
                "expected_2_to_n_over_2": int(expected),
                "ratio": (i + 1) / expected,
                "time_sec": elapsed,
                "n_bits": n_bits,
            }
        seen[h] = x

    return {"found": False, "evaluations": num_trials, "n_bits": n_bits,
            "expected_2_to_n_over_2": int(expected)}


# ── 2. Floyd's cycle-detection attack ─────────────────────────────────────────

def birthday_attack_floyd(hash_fn, n_bits: int, max_retries: int = 30) -> dict:
    """
    Floyd's cycle detection (tortoise-and-hare) collision finder.
    Space-efficient: O(sqrt(N)) time, O(1) memory.

    Builds the functional graph x -> H(x) (treating n-bit output as next input).
    The rho structure guarantees a cycle; the tail gives the collision pair.
    """
    mask = (1 << n_bits) - 1
    total_evals = 0
    n_bytes = max(1, (n_bits + 7) // 8)
    expected = int(2 ** (n_bits / 2))

    def f(x: int) -> int:
        b = (x & mask).to_bytes(n_bytes, 'big')
        return hash_fn(b) & mask

    start = time.time()

    for attempt in range(max_retries):
        x0 = int.from_bytes(os.urandom(max(1, n_bits // 8)), 'big') & mask

        # Phase 1: detect cycle (tortoise and hare)
        tortoise = f(x0)
        hare = f(f(x0))
        evals = 3
        while tortoise != hare:
            tortoise = f(tortoise)
            hare = f(f(hare))
            evals += 3

        # Phase 2: find mu (tail length)
        mu = 0
        tortoise = x0
        while tortoise != hare:
            tortoise = f(tortoise)
            hare = f(hare)
            evals += 2
            mu += 1

        total_evals += evals

        if mu == 0:
            continue  # started in cycle, retry

        # Phase 3: find lambda (cycle length)
        lam = 1
        hare = f(tortoise)   # tortoise == cycle_start
        total_evals += 1
        while hare != tortoise:
            hare = f(hare)
            total_evals += 1
            lam += 1

        # Collision: x_{mu-1} and x_{mu+lam-1} are predecessors of cycle_start
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
            elapsed = time.time() - start
            return {
                "found": True,
                "x1": hex(a),
                "x2": hex(b),
                "hash": hex(ha),
                "evaluations": total_evals,
                "expected_2_to_n_over_2": expected,
                "ratio": total_evals / expected,
                "time_sec": elapsed,
                "n_bits": n_bits,
                "attempts": attempt + 1,
            }

    return {"found": False, "evaluations": total_evals, "n_bits": n_bits,
            "expected_2_to_n_over_2": expected}


# ── 3. Deliberately weak toy hash ─────────────────────────────────────────────

def weak_toy_hash(data: bytes, n_bits: int = 12) -> int:
    """
    Deliberately weak hash function for birthday-attack demonstrations.
    Uses XOR-rotate mixing — fast and uniformly distributed, but tiny output.
    n_bits ∈ {8, 12, 16} gives 256 / 4096 / 65536 possible outputs.
    """
    v = 0x5A5A5A5A
    for byte in data:
        v = (((v << 5) | (v >> 27)) & 0xFFFFFFFF) ^ byte
        v = (v * 0x08088405 + 1) & 0xFFFFFFFF
    mask = (1 << n_bits) - 1
    # XOR fold 32-bit value down to n_bits
    folded = (v ^ (v >> 16)) & 0xFFFF
    folded = (folded ^ (folded >> 8)) & 0xFF if n_bits <= 8 else folded
    return folded & mask


def toy_hash_attack(n_bits: int = 12) -> dict:
    """
    Run both naive and Floyd attacks on the weak toy hash at n_bits.
    Compare evaluations against the 2^(n/2) birthday bound.
    """
    hf = lambda b: weak_toy_hash(b, n_bits)

    r_naive = birthday_attack_naive(hf, n_bits)
    r_floyd = birthday_attack_floyd(hf, n_bits)

    expected = int(2 ** (n_bits / 2))
    return {
        "n_bits": n_bits,
        "expected_2_to_n_over_2": expected,
        "naive": r_naive,
        "floyd": r_floyd,
    }


# ── 4. Empirical birthday curve ───────────────────────────────────────────────

def empirical_birthday_curve(n_values=None, trials_per_n: int = 100) -> list:
    """
    Run `trials_per_n` independent trials for each n in n_values.
    For each n, returns the sorted list of evaluations-until-collision,
    the mean, and the theoretical prediction.

    The CDF of evaluations k is approximately 1 - e^(-k(k-1) / 2^(n+1)).
    """
    if n_values is None:
        n_values = [8, 10, 12, 14, 16]

    results = []
    for n in n_values:
        hf = lambda b, _n=n: weak_toy_hash(b, _n)
        counts = []
        for _ in range(trials_per_n):
            r = birthday_attack_naive(hf, n)
            if r["found"]:
                counts.append(r["evaluations"])

        counts.sort()
        mean = sum(counts) / len(counts) if counts else 0
        expected = 2 ** (n / 2)

        # CDF points: fraction of trials with evaluations <= k
        cdf_points = []
        for k in range(0, max(counts or [1]) + 1, max(1, max(counts or [1]) // 50)):
            frac = sum(1 for c in counts if c <= k) / len(counts) if counts else 0
            theory = 1 - math.exp(-k * (k - 1) / (2 ** (n + 1)))
            cdf_points.append({"k": k, "empirical": round(frac, 4),
                                "theoretical": round(theory, 4)})

        results.append({
            "n": n,
            "trials": len(counts),
            "mean_evaluations": round(mean, 2),
            "expected_2_to_n_over_2": round(expected, 2),
            "ratio": round(mean / expected, 3) if expected else 0,
            "sorted_counts": counts[:20],  # first 20 for UI
            "cdf_points": cdf_points[:60],  # up to 60 points
        })

    return results


# ── 5. DLP hash truncated attack ─────────────────────────────────────────────

def attack_dlp_truncated(n_bits: int = 16, dlp_hash_fn=None) -> dict:
    """
    Attack the PA#8 DLP hash truncated to n_bits output.
    Reports: evaluations, ratio, colliding inputs.
    Shows that even a provably-secure hash breaks at the birthday bound.
    """
    if dlp_hash_fn is None:
        # Fallback to weak toy hash if DLP hash not provided
        dlp_hash_fn = lambda b: weak_toy_hash(b, n_bits)

    mask = (1 << n_bits) - 1
    hf = lambda b: dlp_hash_fn(b) & mask

    r = birthday_attack_naive(hf, n_bits)
    return {
        "hash_type": "DLP-CRHF (truncated to n bits)",
        "n_bits": n_bits,
        "result": r,
        "analysis": (
            f"DLP hash is provably collision-resistant under DLP hardness. "
            f"But with only {n_bits}-bit output, the birthday bound forces a collision "
            f"after ~2^(n/2) = {int(2**(n_bits/2))} evaluations — "
            f"regardless of the hash's algebraic structure. "
            f"This shows output length is the binding constraint."
        ),
    }


# ── 6. MD5/SHA-1 context ─────────────────────────────────────────────────────

def md5_sha1_context(hashes_per_second: float = 1e9) -> dict:
    """
    Compute the birthday bound cost for MD5 (n=128) and SHA-1 (n=160).
    Expresses in seconds and years at a given CPU speed.
    """
    SECONDS_PER_YEAR = 365.25 * 24 * 3600

    def cost(n):
        ops = 2 ** (n / 2)
        seconds = ops / hashes_per_second
        years = seconds / SECONDS_PER_YEAR
        return {
            "n_bits": n,
            "ops_needed": ops,
            "ops_scientific": f"2^{n//2}" if n % 2 == 0 else f"2^{n/2:.1f}",
            "seconds": seconds,
            "years": years,
            "years_scientific": f"{years:.2e}",
            "universe_ages": years / 1.38e10,
        }

    age_of_universe_years = 1.38e10
    return {
        "hashes_per_second": hashes_per_second,
        "md5": cost(128),
        "sha1": cost(160),
        "sha256": cost(256),
        "age_of_universe_years": age_of_universe_years,
        "note": (
            "MD5 (n=128) was practically broken by 2004 via differential attacks, "
            "but even birthday resistance only holds to 2^64 ≈ 1.8×10^19 ops. "
            "SHA-1 (n=160) birthday bound is 2^80 ≈ 1.2×10^24 ops — "
            "still impractically large for birthday, but differential attacks "
            "broke it in 2^63 ops (SHAttered, 2017)."
        ),
    }


# ── Empirical run for multiple n (statistics) ─────────────────────────────────

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


# ── Self-test ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== PA#9 Birthday Attack Self-Test ===\n")

    for n in [8, 12, 16]:
        hf = lambda b, _n=n: weak_toy_hash(b, _n)
        r = birthday_attack_naive(hf, n)
        expected = int(2 ** (n / 2))
        print(f"n={n:2d}: collision in {r.get('evaluations',0):5d} evals "
              f"(expected ~{expected}), ratio={r.get('ratio',0):.2f}x")

    print("\n=== Floyd vs Naive (n=12) ===")
    hf12 = lambda b: weak_toy_hash(b, 12)
    rn = birthday_attack_naive(hf12, 12)
    rf = birthday_attack_floyd(hf12, 12)
    print(f"  Naive: {rn.get('evaluations')} evals, "
          f"ratio={rn.get('ratio',0):.2f}x")
    print(f"  Floyd: {rf.get('evaluations')} evals, "
          f"ratio={rf.get('ratio',0):.2f}x")

    print("\n=== MD5/SHA-1 Context ===")
    ctx = md5_sha1_context()
    for name, d in [("MD5", ctx["md5"]), ("SHA-1", ctx["sha1"]), ("SHA-256", ctx["sha256"])]:
        print(f"  {name} (n={d['n_bits']}): {d['ops_scientific']} ops "
              f"≈ {d['years_scientific']} years")
