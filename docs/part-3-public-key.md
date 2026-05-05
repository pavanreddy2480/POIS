# Part 3: Public-Key Cryptography — PA11 to PA15

This part covers the shift from symmetric cryptography (shared secret keys) to **public-key (asymmetric) cryptography**. The central mathematical tool is modular arithmetic over large integers — specifically, problems that are easy to compute in one direction but computationally infeasible to reverse without secret information. PA13 (Miller-Rabin) provides the prime-generation machinery that every other PA in this group depends on.

---

## PA11 — Diffie-Hellman Key Exchange

### What it achieves

Diffie-Hellman (DH) solves a fundamental problem: how can two parties who have never met before establish a shared secret over a completely public channel, even when an eavesdropper can observe every message? The answer is based on the **Discrete Logarithm Problem (DLP)**: computing `g^a mod p` is fast, but recovering `a` from `g^a mod p` is believed to be computationally infeasible for large primes `p`.

### Source: `src/pa11_dh/dh.py`

#### Class: `DiffieHellman`

The class wraps all DH operations around a fixed set of public domain parameters: a **safe prime** `p`, its cofactor `q`, and a **generator** `g` of the prime-order subgroup.

---

#### `__init__(self, bits=64, precomputed=None)`

**Input:** `bits` — bit length of the prime `p` to generate (default 64). Optionally a `(p, q)` tuple to skip generation.

**What it does:**
- Calls `gen_safe_prime(bits)` from PA13 to produce a safe prime `p = 2q + 1` and its Sophie Germain prime `q`.
- Calls `_find_generator()` to select a generator `g` of the prime-order subgroup of `Z_p*`.

**Why a safe prime?** A safe prime `p = 2q + 1` ensures that the multiplicative group `Z_p*` has order `2q`. The subgroup of prime order `q` is the cryptographically useful piece — its large prime order makes the DLP hard. If `p - 1` had only small factors, the Pohlig-Hellman algorithm would break DLP efficiently.

---

#### `_find_generator(self) -> int`

**Input:** none (uses `self.p`, `self.q`).

**Output:** An integer `g` in `[2, p)` that generates the prime-order-`q` subgroup of `Z_p*`.

**What it does:**
- For a safe prime `p = 2q + 1`, every element of `Z_p*` has order 1, 2, `q`, or `2q`.
- Iterates `g = 2, 3, 4, ...` and checks two conditions:
  - `g^q mod p == 1` — confirms `g` is in the order-`q` or order-1 subgroup.
  - `g^2 mod p != 1` — rules out `g = 1` and `g = p-1` (which have order 2).
- The first `g` satisfying both conditions is a generator of the prime-order-`q` subgroup.

**Why this matters:** Working in a prime-order subgroup avoids small-subgroup attacks. An attacker cannot force the DH computation into a tiny subgroup to recover the secret.

---

#### `_random_exponent(self) -> int`

**Input:** none.

**Output:** A random integer `a` in `(1, q)`.

**What it does:**
- Computes the byte length needed to represent `q`.
- Samples `os.urandom(nbytes)`, interprets as big-endian integer, reduces mod `q`.
- Retries if `v <= 1` (to avoid trivial exponents).

**Security note:** Uses `os.urandom`, not `random`. This is critical — a predictable exponent completely breaks DH security.

---

#### `dh_alice_step1(self) -> tuple`

**Input:** none.

**Output:** `(a, A)` — Alice's private exponent `a` and public value `A = g^a mod p`.

**What it does:**
- Samples private exponent `a` using `_random_exponent()`.
- Computes `A = mod_pow(g, a, p)`.
- Returns `(a, A)`. Alice sends `A` to Bob and keeps `a` secret.

---

#### `dh_bob_step1(self) -> tuple`

**Input:** none.

**Output:** `(b, B)` — Bob's private exponent `b` and public value `B = g^b mod p`.

**What it does:** Identical structure to Alice's step. Bob sends `B` to Alice.

---

#### `dh_alice_step2(self, a: int, B: int) -> int`

**Input:** Alice's private exponent `a`, Bob's public value `B`.

**Output:** Shared secret `K = B^a mod p`.

**What it does:** `K = (g^b)^a = g^(ab) mod p`. This is Alice's computation of the shared secret.

---

#### `dh_bob_step2(self, b: int, A: int) -> int`

**Input:** Bob's private exponent `b`, Alice's public value `A`.

**Output:** Shared secret `K = A^b mod p`.

**What it does:** `K = (g^a)^b = g^(ab) mod p`. Both Alice and Bob arrive at the same secret `g^(ab) mod p` without either one knowing the other's private exponent.

---

#### `mitm_attack(self, A: int, B: int) -> dict`

**Input:** Alice's public value `A`, Bob's public value `B` (as intercepted by Eve).

**Output:** A dict with:
- `eve_exp` — Eve's private exponent `e` (hex).
- `eve_public` — Eve's public value `E = g^e mod p` (hex).
- `key_with_alice` — `K_A = A^e mod p`, the secret Eve shares with Alice (hex).
- `key_with_bob` — `K_B = B^e mod p`, the secret Eve shares with Bob (hex).
- `intercept_A`, `intercept_B` — the intercepted values.
- `substitute_A_prime`, `substitute_B_prime` — Eve's substituted public values (both `E`).

**What it does:**
- Eve intercepts Alice's `A` and Bob's `B`.
- Eve picks her own exponent `e` and computes `E = g^e mod p`.
- Eve sends `E` to both Alice (pretending to be Bob) and Bob (pretending to be Alice).
- Alice computes `K_A = E^a = g^(ae) mod p`. Eve computes the same: `K_A = A^e = g^(ae) mod p`.
- Bob computes `K_B = E^b = g^(be) mod p`. Eve computes the same: `K_B = B^e = g^(be) mod p`.
- Eve now decrypts Alice's traffic with `K_A`, re-encrypts for Bob with `K_B`, and neither party knows.

**Why DH is vulnerable to MITM:** DH provides no authentication. Neither party can verify that the public value they received came from who they think. This motivates authenticated DH (station-to-station protocol) and certificate-based PKI.

---

#### `full_exchange(self) -> dict`

**Input:** none.

**Output:** A dict with all DH exchange values:
- `p`, `q`, `g` — domain parameters (hex).
- `alice_private`, `alice_public` — `a`, `A = g^a mod p`.
- `bob_private`, `bob_public` — `b`, `B = g^b mod p`.
- `alice_shared_secret`, `bob_shared_secret` — both equal `g^(ab) mod p`.
- `keys_match` — boolean confirming the shared secrets are identical.

**What it does:** Runs the entire DH protocol in one call and packages the result for inspection.

---

### Mathematical foundation

The security of DH rests on the **Computational Diffie-Hellman (CDH) problem**: given `g`, `g^a mod p`, and `g^b mod p`, compute `g^(ab) mod p`. This is believed hard whenever the **Discrete Logarithm Problem** is hard in the group — i.e., recovering `a` from `g^a mod p` is infeasible.

```
Public:  p, q, g
Alice:   a  ->  A = g^a mod p          (sends A)
Bob:     b  ->  B = g^b mod p          (sends B)
Alice:   K = B^a mod p = g^(ab) mod p
Bob:     K = A^b mod p = g^(ab) mod p
Eve: knows A, B, p, q, g — cannot compute K without solving DLP
```

---

## PA13 — Miller-Rabin Primality Testing

PA13 is listed after PA11 and PA12 numerically but is a **dependency** of both — it provides the prime generation machinery. It is covered here in logical dependency order.

### What it achieves

Generating large RSA and DH primes requires efficiently testing whether a random large integer is prime. Naive trial division is impossibly slow for 512-bit numbers. The **Miller-Rabin test** is a probabilistic primality test that can distinguish primes from composites with arbitrarily low error probability using a polynomial number of modular exponentiations.

### Source: `src/pa13_miller_rabin/miller_rabin.py`

---

#### `mod_pow(base: int, exp: int, mod: int) -> int`

**Input:** `base`, `exp`, `mod` — all integers.

**Output:** `base^exp mod mod`.

**What it does:** Delegates to Python's built-in `pow(base, exp, mod)`, which uses square-and-multiply (binary exponentiation) internally. This runs in `O(log exp)` multiplications.

**Why it exists as a wrapper:** Named exports make the dependency explicit — PA11, PA12, PA14, PA15 all import `mod_pow` from this module, centralizing the fast exponentiation.

---

#### `extended_gcd(a: int, b: int) -> tuple`

**Input:** Two integers `a`, `b`.

**Output:** `(gcd, x, y)` such that `a*x + b*y = gcd`.

**What it does:** Recursive implementation of the Extended Euclidean Algorithm (EEA). At each step:
- Base case: if `b == 0`, return `(a, 1, 0)`.
- Recursive case: compute `gcd(b, a mod b)`, then back-substitute the Bézout coefficients.

**Why it matters:** The Bézout coefficient `x` (where `a*x ≡ gcd mod b`) is used directly to compute modular inverses.

---

#### `mod_inverse(a: int, n: int) -> int`

**Input:** Integer `a`, modulus `n`.

**Output:** `a^(-1) mod n` — the modular inverse of `a`.

**What it does:**
- Calls `extended_gcd(a % n, n)` to get `(g, x, _)`.
- If `g != 1`, raises `ValueError` (no inverse exists — `gcd(a, n) > 1`).
- Returns `x % n` to normalize to `[0, n)`.

**Used by:** RSA key generation (computing `d = e^(-1) mod phi(N)`), CRT (`M_i^(-1) mod n_i`), DH CRT decryption.

---

#### `miller_rabin(n: int, k: int = 40) -> str`

**Input:**
- `n` — the integer to test for primality.
- `k` — number of witness rounds (default 40).

**Output:** The string `"PROBABLY_PRIME"` or `"COMPOSITE"`.

**What it does:**

1. **Base cases:** `n < 2` is composite; `n == 2` or `n == 3` is prime; even `n > 2` is composite.

2. **Factor out powers of 2:** Write `n - 1 = 2^s * d` where `d` is odd. This is the key decomposition — for a prime `p`, Fermat's little theorem tells us `a^(p-1) ≡ 1 mod p`, and by repeatedly square-rooting from `a^(p-1)`, any root of 1 mod a prime must be ±1.

3. **For each of `k` rounds:**
   - Pick a cryptographically random witness `a` in `[2, n-2]`.
   - Compute `x = a^d mod n`.
   - If `x == 1` or `x == n-1`, this witness does not detect compositeness — continue.
   - Repeatedly square: `x = x^2 mod n`, up to `s-1` times.
   - If at any point `x == n-1`, the witness does not detect compositeness — break.
   - If we exhaust all squarings without hitting `n-1`, `n` is **definitely composite** — return `"COMPOSITE"`.

4. If all `k` witnesses pass, return `"PROBABLY_PRIME"`.

**Error probability:** Each round has at most a 1/4 chance of a false positive (a composite passing as prime for a specific witness). With `k = 40` rounds, the error probability is at most `4^(-40) ≈ 10^(-24)`.

**Why not Fermat test?** The Fermat test (`a^(n-1) ≡ 1 mod n`) can be fooled by **Carmichael numbers** — composites that pass the Fermat test for every base coprime to them. Miller-Rabin is not fooled by Carmichael numbers because it checks not just `a^(n-1) ≡ 1` but also the intermediate square roots.

---

#### `carmichael_demo() -> dict`

**Input:** none (hardcoded to `n = 561 = 3 × 11 × 17`).

**Output:** Dict with:
- `n` — 561.
- `fermat_passes` — `True` (561 passes Fermat for all tested coprime bases).
- `miller_rabin` — `"COMPOSITE"` (Miller-Rabin correctly identifies it).
- `is_carmichael` — `True`.

**What it demonstrates:** Carmichael numbers are the reason we need Miller-Rabin over the simpler Fermat test. 561 passes `a^560 ≡ 1 mod 561` for all `a` coprime to 561, but Miller-Rabin catches it by analyzing the structure of the square roots of 1.

---

#### `is_prime(n: int, k: int = 40) -> bool`

**Input:** `n`, `k` (rounds).

**Output:** `True` if Miller-Rabin says `"PROBABLY_PRIME"`, `False` otherwise.

**What it does:** A convenience boolean wrapper around `miller_rabin`.

---

#### `gen_prime(bits: int) -> int`

**Input:** `bits` — desired bit length of the prime.

**Output:** A probable prime of exactly `bits` bits.

**What it does:**
1. Sample `bits/8` random bytes via `os.urandom`.
2. Set the high bit (`n |= 1 << (bits - 1)`) to ensure the number has exactly `bits` bits.
3. Set the low bit (`n |= 1`) to ensure odd.
4. Run `miller_rabin(n, 40)`. If `"PROBABLY_PRIME"`, run again with 20 rounds as a double-check.
5. Repeat until a probable prime is found.

**Why two rounds?** The double Miller-Rabin check (60 total rounds) gives error probability below `4^(-60) ≈ 10^(-36)`, well within the acceptable range for cryptographic use.

**Expected iterations:** By the prime number theorem, a random `b`-bit integer is prime with probability `≈ 1 / (b * ln 2)`. For 512-bit numbers, roughly 355 candidates need to be tested on average.

---

#### `gen_safe_prime(bits: int) -> tuple`

**Input:** `bits` — bit length of `p`.

**Output:** `(p, q)` where `p = 2q + 1` is a safe prime and `q` is a Sophie Germain prime.

**What it does:**
1. Generate a `(bits - 1)`-bit prime `q` using `gen_prime`.
2. Compute `p = 2q + 1`.
3. Test `p` with `is_prime`. If not prime, restart.

**Why safe primes are slow:** You must find a prime `q` such that `2q + 1` is also prime. These are rarer than ordinary primes. For 64-bit safe primes, this typically takes a few hundred iterations; for 2048-bit, it can take millions.

**Used by:** PA11 DiffieHellman for its group setup.

---

## PA12 — Textbook RSA and PKCS#1 v1.5

### What it achieves

RSA is the most widely deployed public-key encryption algorithm. It achieves **asymmetric encryption**: a sender can encrypt with a public key, but only the holder of the corresponding private key can decrypt. The security rests on the **integer factorization problem**: given `N = p * q`, recovering `p` and `q` is believed hard for large `N`.

PA12 implements two versions:
1. **Textbook RSA** — the raw mathematical operation, insecure for direct use.
2. **PKCS#1 v1.5** — textbook RSA with structured randomized padding, making it semantically secure under a CPA-like model (though still vulnerable to padding oracle attacks).

### Source: `src/pa12_rsa/rsa.py`

**Module-level constant:** `RSA_E = 65537` — the standard public exponent. It is a Fermat prime (`2^16 + 1`), chosen because its binary representation `10000000000000001` has only two set bits, making modular exponentiation fast.

#### Class: `RSA`

---

#### `keygen(self, bits: int = 512) -> dict`

**Input:** `bits` — total bit length of the RSA modulus `N` (default 512).

**Output:** A dict:
```
{
    "pk": (N, e),                                # public key
    "sk": {"N": N, "d": d, "p": p, "q": q,      # private key
            "dp": dp, "dq": dq, "q_inv": q_inv}
}
```

**What it does:**

1. **Generate two distinct primes:** Calls `gen_prime(bits // 2)` twice to get `p` and `q`. Retries if `p == q` (astronomically rare but checked for correctness).

2. **Compute modulus:** `N = p * q`. The factorization of `N` is the secret.

3. **Compute Euler's totient:** `phi(N) = (p-1)(q-1)`. This is the order of the multiplicative group `Z_N*`.

4. **Check invertibility:** Ensures `gcd(e, phi) == 1` by verifying `phi % e != 0` and `mod_inverse(e, phi)` succeeds. If not, regenerate.

5. **Compute private exponent:** `d = e^(-1) mod phi(N)` using `mod_inverse`. By definition, `e * d ≡ 1 mod phi(N)`, so `(m^e)^d = m^(ed) = m^(1 + k*phi) = m mod N` for any `m` coprime to `N`.

6. **CRT precomputation (for fast decryption):**
   - `dp = d mod (p-1)` — by Fermat's little theorem, `c^d mod p = c^(d mod (p-1)) mod p`.
   - `dq = d mod (q-1)` — similarly for `q`.
   - `q_inv = q^(-1) mod p` — used in Garner's CRT recombination.

**Security note:** Textbook RSA is deterministic and homomorphic. It must not be used without padding for real messages.

---

#### `rsa_enc(self, pk: tuple, m: int) -> int`

**Input:** Public key `(N, e)`, plaintext integer `m` in `(0, N)`.

**Output:** Ciphertext `C = m^e mod N`.

**What it does:** Computes textbook RSA encryption in a single modular exponentiation. Asserts `0 < m < N`.

**Why textbook RSA is insecure:**
- **Deterministic:** same message always produces same ciphertext — fails CPA security.
- **Multiplicatively homomorphic:** `Enc(m1) * Enc(m2) = Enc(m1 * m2 mod N)`.
- **Small message attacks:** if `m` is small and `e = 3`, then `m^3 < N`, and the ciphertext `C = m^3` can be decrypted by taking the integer cube root with no modular reduction needed.

---

#### `rsa_dec(self, sk: dict, c: int) -> int`

**Input:** Private key dict (needs `d`, `N`), ciphertext `c`.

**Output:** Plaintext `m = c^d mod N`.

**What it does:** Computes `pow(c, d, N)` — straightforward textbook RSA decryption. For 512-bit keys, `d` is ~512 bits so this requires ~512 squarings.

---

#### `rsa_dec_crt(self, sk: dict, c: int) -> int`

**Input:** Private key dict (needs `p`, `q`, `dp`, `dq`, `q_inv`), ciphertext `c`.

**Output:** Plaintext `m`.

**What it does — Garner's Algorithm:**

1. `mp = c^dp mod p` — exponentiation mod `p` using the shorter exponent `dp = d mod (p-1)`. By Fermat's little theorem, `c^d ≡ c^(d mod (p-1)) mod p`.

2. `mq = c^dq mod q` — similarly mod `q`.

3. **CRT recombination:**
   ```
   h = q_inv * (mp - mq) mod p
   m = mq + h * q
   ```
   This reconstructs a value that satisfies `m ≡ mp mod p` and `m ≡ mq mod q`, which by CRT is the unique solution in `[0, N)`.

**Why ~4x faster:** Instead of one exponentiation with ~`bits`-bit exponent mod `N`, we do two exponentiations with ~`bits/2`-bit exponents mod half-size moduli. Since exponentiation cost scales as `O(len(exp) * len(mod)^2)`, the total work is roughly `2 * (b/2) * (b/2)^2 = b^3/4` versus `b * b^2 = b^3` — a 4x speedup. This is significant in practice (SSL handshakes, signing).

---

#### `pkcs15_enc(self, pk: tuple, m: bytes) -> int`

**Input:** Public key `(N, e)`, message `m` as bytes.

**Output:** Ciphertext integer (RSA encryption of the padded message).

**What it does:**

Constructs the PKCS#1 v1.5 **Encoded Message (EM):**
```
EM = 0x00 || 0x02 || PS || 0x00 || M
```
Where:
- `0x00 0x02` — padding type indicator (type 2 = encryption).
- `PS` — random padding string of at least 8 non-zero bytes, filling up to `k - len(M) - 3` bytes (where `k` is the byte length of `N`).
- `0x00` — separator.
- `M` — the actual message.

Non-zero bytes in `PS` are generated by rejection sampling: calls `os.urandom(1)` and discards `0x00` bytes until enough non-zero bytes are accumulated.

Then: `C = EM_int^e mod N` where `EM_int = int.from_bytes(EM, 'big')`.

**Why PKCS#1 v1.5?** The random `PS` makes encryption probabilistic — same message gives different ciphertexts. The minimum 8-byte padding prevents the exhaustive search of small message spaces.

**Vulnerability:** PKCS#1 v1.5 is vulnerable to **Bleichenbacher's 1998 padding oracle attack**. An attacker who can ask whether a decrypted ciphertext has valid padding (0x00 0x02 prefix) can decrypt arbitrary ciphertexts using ~1 million adaptive queries. This is why OAEP (Optimal Asymmetric Encryption Padding) replaced it.

---

#### `pkcs15_dec(self, sk: dict, c: int) -> bytes`

**Input:** Private key dict, ciphertext integer `c`.

**Output:** Plaintext `bytes`, or `None` if padding is invalid.

**What it does:**

1. Decrypt: `m_int = c^d mod N` using standard RSA decrypt.
2. Convert to bytes of length `k` (zero-padded on the left).
3. **Validate padding structure:**
   - `em[0] == 0x00` — leading zero byte.
   - `em[1] == 0x02` — type-2 padding indicator.
   - Search for the `0x00` separator starting at `em[2]`.
   - Verify `PS` length is at least 8 bytes (separator at index ≥ 10).
4. Return `em[sep+1:]` — everything after the separator is the message.

Returns `None` for any invalid padding — this is the padding oracle. Real-world systems should make the failure branch constant-time and indistinguishable from success to resist timing attacks.

---

## PA14 — Chinese Remainder Theorem and Håstad's Broadcast Attack

### What it achieves

PA14 has two components:

1. **The Chinese Remainder Theorem (CRT):** A classical number theory result that allows reconstructing a unique integer from its residues modulo pairwise coprime moduli. Beyond its mathematical elegance, CRT is a practical speed optimization for RSA decryption (as seen in PA12).

2. **Håstad's Broadcast Attack:** A devastating real-world attack on textbook RSA when the same message is sent to multiple recipients using a small public exponent. CRT is the key tool that enables the attack.

### Source: `src/pa14_crt/crt.py`

---

#### `crt(residues: list, moduli: list) -> int`

**Input:**
- `residues` — list of integers `[a_0, a_1, ..., a_{k-1}]`.
- `moduli` — list of pairwise coprime integers `[n_0, n_1, ..., n_{k-1}]`.

**Output:** The unique integer `x` in `[0, N)` where `N = n_0 * n_1 * ... * n_{k-1}` such that `x ≡ a_i mod n_i` for all `i`.

**What it does — CRT Construction:**

```
N = product of all n_i
For each i:
    M_i = N / n_i          (product of all moduli except n_i)
    y_i = M_i^(-1) mod n_i (modular inverse)
    contribution_i = a_i * M_i * y_i

x = sum(contribution_i) mod N
```

Each term `a_i * M_i * y_i` satisfies:
- Mod `n_i`: `M_i * y_i ≡ 1 mod n_i`, so the term is `a_i`.
- Mod `n_j` for `j ≠ i`: `M_i ≡ 0 mod n_j` (since `n_j | M_i`), so the term vanishes.

Summing all contributions gives a value that simultaneously satisfies all residue conditions.

**Example from tests:** `crt([2, 3, 2], [3, 5, 7]) == 23`.
- `x ≡ 2 mod 3`, `x ≡ 3 mod 5`, `x ≡ 2 mod 7`.
- Unique solution in `[0, 105)` is 23: `23 = 7*3 + 2`, `23 = 4*5 + 3`, `23 = 3*7 + 2`.

---

#### `integer_nth_root(n: int, e: int) -> int`

**Input:** Integer `n`, root degree `e`.

**Output:** `floor(n^(1/e))` — the integer part of the `e`-th root of `n`.

**What it does:**

Uses Newton's method for integer roots:
- Start with initial guess `x ≈ n^(1/e) + 2` (floating-point estimate, padded to avoid under-shooting).
- Iterate: `x_{next} = ((e-1)*x + n // x^(e-1)) // e` — the integer analogue of Newton's update for `f(x) = x^e - n`.
- Stop when `x_{next} >= x` (converged).
- Adjust downward/upward to find the exact floor.

**Why floating-point can fail:** For very large integers (hundreds of bits), `float(n)` loses precision. Newton's method with integer arithmetic avoids precision loss and terminates with the exact floor.

**Used in:** Håstad's attack — after recovering `m^e mod (N_0 * N_1 * ... * N_{e-1})` via CRT, the attack takes the integer `e`-th root to recover `m`.

---

#### `hastad_attack(ciphertexts: list, moduli: list, e: int = 3) -> int`

**Input:**
- `ciphertexts` — list of `e` ciphertexts: `c_i = m^e mod N_i`.
- `moduli` — list of `e` RSA moduli `N_i` (all used by different recipients).
- `e` — public exponent (typically 3).

**Output:** Recovered plaintext `m`.

**What it does:**

1. **Step 1 — CRT:** Combine the `e` ciphertexts to find `x = m^e mod (N_0 * N_1 * ... * N_{e-1})`.
   - Each `c_i ≡ m^e mod N_i`, so `x ≡ c_i mod N_i` for all `i`.
   - CRT gives the unique `x` in `[0, N_0 * N_1 * ... * N_{e-1})`.

2. **Step 2 — Key insight:** If `m < N_i` for all `i` (which is the RSA assumption), then `m^e < N_i^e`, and since `x = m^e mod (product of N_i)`, and `m^e < N_i^e ≤ product of N_i` (approximately), we have `x = m^e` as a plain integer — no modular reduction occurred.

3. **Step 3 — Integer root:** Take `m = x^(1/e)` using `integer_nth_root`.

4. **Verify:** Check `m^e mod N_i == c_i` for all `i`.

**Why this works:** With `e = 3` and the same message sent to 3 different recipients, the attacker has three equations `c_i ≡ m^3 mod N_i`. CRT lifts this to one equation `x ≡ m^3 mod N_0 N_1 N_2`. Since `m` is small enough that `m^3 < N_0 N_1 N_2`, taking the cube root gives `m` directly.

**Defense:** Never use `e = 3` with the same unpadded message to multiple recipients. PKCS#1 v1.5 and OAEP padding randomize the message before encryption, making `c_i` different even for the same `m`, so CRT recombination gives garbage.

---

#### `rsa_dec_crt_garner(c: int, sk: dict) -> int`

**Input:** Ciphertext `c`, private key dict with `p`, `q`, `dp`, `dq`, `q_inv`.

**Output:** Plaintext `m`.

**What it does:** Implements Garner's CRT RSA decryption (same as `rsa_dec_crt` in PA12, duplicated here for completeness of the PA14 module):
```
mp = c^dp mod p
mq = c^dq mod q
h  = q_inv * (mp - mq) mod p
m  = mq + h * q
```

---

## PA15 — Digital Signatures (RSA Hash-then-Sign)

### What it achieves

PA15 implements **digital signatures** — a mechanism for proving **authenticity and integrity** of messages. A signature scheme allows a signer with a private key to produce a signature on a message such that anyone with the corresponding public (verification) key can check the signature. It provides:

- **Unforgeability:** An adversary without the private key cannot produce a valid signature on any new message.
- **Non-repudiation:** The signer cannot later deny having signed (the verification is deterministic and public).
- **Integrity:** Any modification to the signed message invalidates the signature.

The scheme implements **Hash-then-Sign RSA**: `sigma = H(m)^d mod N`. Hashing before signing is essential — raw RSA signatures are forgeable due to multiplicative homomorphism.

### Source: `src/pa15_signatures/signatures.py`

---

#### Class: `RSASignature`

#### `__init__(self, rsa=None, dlp_hash=None, bits=512)`

**Input:** Optional `RSA` instance, optional `DLPHash` instance, bit size.

**What it does:**
- Stores an `RSA` instance (creates one if not provided).
- Creates a `DLPHashGroup` and `DLPHash` from PA8 for hashing messages. The DLP hash provides a collision-resistant hash function built from discrete logarithm hardness.

---

#### `_hash_to_int(self, m: bytes, N: int) -> int`

**Input:** Message bytes `m`, RSA modulus `N`.

**Output:** Integer `h` in `[0, N)`.

**What it does:**
- Calls `self.H.hash(m)` to get a hash digest in bytes.
- Converts to a big-endian integer.
- Reduces mod `N` to fit within the RSA modulus range.

**Why reduce mod N?** RSA operates on integers in `[0, N)`. The hash output may be longer or shorter than `N` depending on the hash's output size — reducing mod `N` normalizes it. (In production, PKCS#1 v1.5 or PSS padding handles this more carefully to avoid bias and ensure the hash occupies most of the modulus range.)

---

#### `sign(self, sk: dict, m: bytes) -> int`

**Input:** Private key dict (needs `d`, `N`), message `m` as bytes.

**Output:** Signature `sigma` — an integer in `[0, N)`.

**What it does:**

1. Hash: `h = _hash_to_int(m, N)` — compute `H(m) mod N`.
2. Sign: `sigma = h^d mod N` — raise the hash to the private exponent.

**Mathematical correctness:** The signature is a value such that `sigma^e ≡ h mod N`. Anyone with `(N, e)` can verify this.

**Why hash first?**
- Without hashing, RSA signing is multiplicatively homomorphic: given `sign(m1)` and `sign(m2)`, an adversary can forge `sign(m1 * m2)` as `sign(m1) * sign(m2) mod N`. This is demonstrated in `multiplicative_forgery_demo`.
- Hashing breaks this: `H(m1 * m2) ≠ H(m1) * H(m2)` for any collision-resistant hash.
- Hashing also allows signing arbitrarily long messages — the signature is always the same size as the RSA modulus regardless of message length.

---

#### `verify(self, vk: tuple, m: bytes, sigma: int) -> bool`

**Input:**
- `vk` — verification key (public key) `(N, e)`.
- `m` — message bytes.
- `sigma` — signature integer.

**Output:** `True` if signature is valid, `False` otherwise.

**What it does:**

1. `h_expected = _hash_to_int(m, N)` — recompute `H(m) mod N`.
2. `h_recovered = sigma^e mod N` — apply the public exponent to the signature.
3. Return `h_recovered == h_expected`.

**Why this works:** If `sigma = h^d mod N`, then `sigma^e = (h^d)^e = h^(de) = h^(1 + k*phi) = h mod N` (by RSA correctness). So the verifier recovers exactly the hash of the original message. Any tampered message `m'` will have `H(m') ≠ H(m)`, so verification fails. Any forged signature `sigma'` that was not computed with `d` will produce `(sigma')^e ≠ H(m)`.

---

#### `multiplicative_forgery_demo(self, vk, m1, sig1, m2, sig2) -> dict`

**Input:**
- `vk` — verification key `(N, e)`.
- `m1`, `m2` — message bytes.
- `sig1 = m1^d mod N`, `sig2 = m2^d mod N` — raw RSA signatures **without hashing**.

**Output:** Dict with:
- `m1`, `m2` — original messages (hex).
- `m1_times_m2_mod_N` — `(m1_int * m2_int) mod N` (hex).
- `forged_sig` — `(sig1 * sig2) mod N` (hex).
- `recovered` — `forged_sig^e mod N` (hex).
- `forgery_valid` — `True` if `recovered == m1 * m2 mod N`.
- `note` — explanation of why hashing prevents this.

**What it does:**

Demonstrates the multiplicative homomorphism attack on **raw (unhashed)** RSA signatures:

```
sigma_1 = m1^d mod N
sigma_2 = m2^d mod N

Forged: sigma* = sigma_1 * sigma_2 mod N
       = m1^d * m2^d mod N
       = (m1 * m2)^d mod N   ← valid signature on m1*m2
```

The forged signature `sigma*` passes verification against `m1 * m2 mod N` without the attacker ever knowing `d`.

**Why this is serious:** An attacker who can get signatures on two chosen messages can forge a signature on their product — without any cryptographic key material. In practice this lets an attacker escalate a "sign this harmless message" capability into "sign this malicious product message".

**The fix:** Hash-then-sign. The hash destroys the multiplicative structure: there is no known relationship between `H(m1)`, `H(m2)`, and `H(m1 * m2)`.

---

### Security model: EU-CMA

A digital signature scheme is secure under **Existential Unforgeability under Chosen Message Attack (EU-CMA)** if no polynomial-time adversary who can request signatures on any messages of their choice can produce a valid signature on a **new** message (one they did not query).

Hash-then-Sign RSA achieves EU-CMA security (in the Random Oracle Model) because:
1. Inverting `sigma^e mod N` without knowing `d` requires solving the RSA problem (believed hard).
2. The hash function (modeled as a random oracle) prevents algebraic attacks like the multiplicative forgery above.

---

## Dependency Graph

```
PA13 (Miller-Rabin, gen_prime, mod_pow, mod_inverse)
    ↓               ↓               ↓
PA11 (DH)      PA12 (RSA)       PA14 (CRT)
                    ↓               ↓
               PA15 (Signatures)  PA14 uses PA12 for Håstad demo
                    ↑
               PA08 (DLP Hash) — used for H() in sign/verify
```

- **PA13** is the foundation: every other PA in this group imports `mod_pow`, `mod_inverse`, `gen_prime`, or `gen_safe_prime` from it.
- **PA12** builds RSA key generation and encryption on top of PA13's prime generation.
- **PA11** builds DH key exchange using PA13's safe prime generation.
- **PA14** uses PA13's `mod_inverse` for CRT and imports PA12's RSA for the Håstad attack demonstration.
- **PA15** uses PA12's RSA for the sign/verify structure and PA08's DLPHash for the hash function.

---

## Interface Summary

| PA | Class / Function | Key Input | Key Output |
|----|-----------------|-----------|------------|
| PA11 | `DiffieHellman(bits)` | bit size | DH instance with `p`, `q`, `g` |
| PA11 | `dh_alice_step1()` | — | `(a, A)` — private exp, public value |
| PA11 | `dh_alice_step2(a, B)` | own private, other's public | shared secret `K` |
| PA11 | `mitm_attack(A, B)` | two public values | dict with Eve's two keys |
| PA11 | `full_exchange()` | — | dict with all DH values |
| PA12 | `RSA().keygen(bits)` | bit size | `{"pk": (N,e), "sk": {...}}` |
| PA12 | `rsa_enc(pk, m)` | `(N,e)`, int | ciphertext int |
| PA12 | `rsa_dec(sk, c)` | sk dict, int | plaintext int |
| PA12 | `rsa_dec_crt(sk, c)` | sk dict, int | plaintext int (4x faster) |
| PA12 | `pkcs15_enc(pk, m)` | `(N,e)`, bytes | ciphertext int |
| PA12 | `pkcs15_dec(sk, c)` | sk dict, int | plaintext bytes or `None` |
| PA13 | `miller_rabin(n, k)` | int, rounds | `"PROBABLY_PRIME"` or `"COMPOSITE"` |
| PA13 | `gen_prime(bits)` | bit size | probable prime int |
| PA13 | `gen_safe_prime(bits)` | bit size | `(p, q)` where `p=2q+1` |
| PA13 | `mod_inverse(a, n)` | int, modulus | `a^(-1) mod n` |
| PA14 | `crt(residues, moduli)` | lists of ints | unique `x` satisfying all congruences |
| PA14 | `hastad_attack(cts, mods, e)` | `e` ciphertexts, moduli | recovered plaintext int |
| PA14 | `integer_nth_root(n, e)` | int, degree | `floor(n^(1/e))` |
| PA15 | `RSASignature(rsa, dlp_hash)` | optional instances | signature scheme object |
| PA15 | `sign(sk, m)` | sk dict, bytes | signature int `sigma` |
| PA15 | `verify(vk, m, sigma)` | `(N,e)`, bytes, int | `True` / `False` |
| PA15 | `multiplicative_forgery_demo(vk, m1, s1, m2, s2)` | two (msg, sig) pairs | forgery dict |
