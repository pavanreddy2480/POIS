# Part 2: Integrity, Hashing, and Authenticated Encryption — PA#6 through PA#10

This document covers PA#6 through PA#10 in the same depth as Part 1. These five assignments complete the symmetric-key half of the Minicrypt Clique and establish everything needed for the public-key PAs that follow.

The arc of this part: PA#6 combines the encryption and MAC from PA#3 and PA#5 to achieve CCA security. PA#7 and PA#8 build a collision-resistant hash function from scratch — first the generic transform (MD), then a concrete collision-resistant compression function (DLP). PA#9 attacks that hash function to find real collisions, demonstrating the birthday bound. PA#10 fixes the structural weakness that plain Merkle-Damgård carries by building HMAC, and wraps the whole thing into a cleaner CCA-secure encryption scheme.

By the end of PA#10, we have all the pieces for authenticated key exchange, digital signatures, and public-key encryption — which PA#11 onward builds on top of.

---

## PA#6 — CCA-Secure Encryption via Encrypt-then-MAC

**File:** `src/pa06_cca_enc/cca_enc.py`

### Why CPA Security Is Not Enough

PA#3's `CPAEnc` achieves IND-CPA: an adversary cannot distinguish encryptions even with access to an encryption oracle. But CPA security says nothing about integrity. A CPA-secure ciphertext is *malleable* — an attacker can flip bits in the ciphertext and the receiver will decrypt without detecting any modification. The resulting plaintext will be garbled, but the decryption will succeed.

This matters in real protocols. Suppose `c` is the CPA encryption of a bank transfer amount. An attacker intercepts and flips a bit in `c`. The receiver decrypts and gets a different amount — possibly a larger one — with no indication anything went wrong. CPA security gives confidentiality, not integrity.

The stronger notion is **IND-CCA2** (Indistinguishability under Adaptive Chosen Ciphertext Attack 2). In the CCA2 game, the adversary can submit arbitrary ciphertexts to a decryption oracle, with one exception: it cannot submit the challenge ciphertext itself. The scheme must still hide which of two messages was encrypted, even when the adversary can decrypt anything else. This forces the scheme to be non-malleable: any modified ciphertext must decrypt to something recognizably wrong (or be rejected entirely).

The standard construction for CCA security from symmetric primitives is **Encrypt-then-MAC (EtM)**: encrypt the message with a CPA-secure scheme, then MAC the entire ciphertext. Any tampering with the ciphertext invalidates the MAC and the receiver rejects before decryption happens.

The ordering matters: **Encrypt-then-MAC** is provably CCA-secure. **MAC-then-Encrypt** is not: it is possible to manipulate the ciphertext in ways that the MAC doesn't cover, because the MAC was computed on the plaintext before encryption. **Encrypt-and-MAC** (computing both on the plaintext simultaneously) is also not CCA-secure in general.

---

### Class `CCAEnc`

**`__init__(self, enc_scheme=None, mac_scheme=None)`**  
Creates or accepts a `CPAEnc` (PA#3) and a `CBCMAC` (PA#5). These are the two building blocks: a CPA-secure encryption scheme and an EUF-CMA-secure MAC. The CCA security proof requires both properties.

Note that two independent keys are used — `kE` for encryption and `kM` for the MAC. Using the same key for both would break the security argument, because an adversary might be able to correlate the PRF queries from encryption and the MAC computation.

---

**`cca_enc(self, kE: bytes, kM: bytes, m: bytes) -> tuple`**  
Input: encryption key `kE` (16 bytes), MAC key `kM` (16 bytes), plaintext `m`.  
Output: three-tuple `(r, c, t)` — nonce, ciphertext, and MAC tag.

**Step by step:**
1. `r, c = self.enc.enc(kE, m)` — CPA-encrypt the message. `r` is a fresh 16-byte random nonce; `c` is the ciphertext (same length as `m`).
2. `CE = r + c` — concatenate nonce and ciphertext into a single byte string. This is the MAC input.
3. `t = self.mac.mac(kM, CE)` — compute the CBC-MAC over the concatenated `r ‖ c`. The tag `t` is 16 bytes.
4. Return `(r, c, t)`.

The MAC covers both `r` and `c`. This is essential. If the MAC covered only `c` and not `r`, an attacker could flip bits in `r` — which changes the counter starting point — and get a different decryption without invalidating the tag. Covering `r ‖ c` as a unit closes this gap.

---

**`cca_dec(self, kE: bytes, kM: bytes, r: bytes, c: bytes, t: bytes)`**  
Input: both keys, nonce `r`, ciphertext `c`, tag `t`.  
Output: plaintext bytes, or `None` if the MAC check fails.

**Step by step:**
1. `CE = r + c` — reconstruct the MAC input.
2. `self.mac.vrfy(kM, CE, t)` — verify the tag *first*. If this fails, return `None` immediately without touching the decryption.
3. If the MAC passes: `self.enc.dec(kE, r, c)` — decrypt and return the plaintext.

**Why MAC-first is required:** If decryption ran before MAC verification, a CCA2 adversary could submit modified ciphertexts to the decryption oracle and observe partial decryption results (e.g., error messages, timing differences, or partial output). The decryption oracle would be usable for learning information about the key or the plaintext. By verifying the MAC first and returning `None` on failure, the decryption oracle becomes completely blind to invalid ciphertexts — it only ever decrypts legitimately constructed ones.

This is the root cause of the **padding oracle attack** (Vaudenay 2002) against CBC-mode encryption that checks padding after decryption: the attacker uses decryption errors as a side channel. EtM prevents this by rejecting any ciphertext that wasn't produced by a legitimate sender before decryption begins.

---

**`malleability_demo(self, kE: bytes, kM: bytes, m: bytes) -> dict`**  
Demonstrates the contrast between CPA-only (malleable) and CCA (integrity-protected) encryption.

**CPA side:** Encrypts `m` with CPA only (no MAC), then flips the first bit of `c`. The `CPAEnc.dec` call on the tampered ciphertext succeeds — it produces garbled output but raises no error. `"cpa_decrypts_tampered": True` confirms this.

**CCA side:** Encrypts with CCA (MAC included), then flips the first bit of `r`. `cca_dec` reconstructs `CE = r' ‖ c` (with the tampered `r'`), recomputes the MAC, and it doesn't match `t` (which was computed over the original `r ‖ c`). Returns `None`. `"cca_tampered_accepted": False` confirms rejection.

Return dict:
```python
{
    "original_m": m.hex(),
    "cpa_ciphertext": c_cpa.hex(),
    "tampered_cpa_ct": tampered_c.hex(),
    "cpa_decrypts_tampered": True,     # no integrity protection
    "cca_tampered_accepted": False,    # MAC rejection
    "description": "Encrypt-then-MAC prevents ciphertext tampering",
}
```

---

### Test Coverage

- `test_cca_roundtrip` — correct enc/dec produces original message.
- `test_cca_rejects_tampered_nonce` — flipping one bit in `r` → `None`.
- `test_cca_rejects_tampered_ct` — flipping one bit in `c` → `None`.
- `test_cca_rejects_tampered_tag` — flipping one bit in `t` → `None`.
- `test_cca_wrong_mac_key` — decrypting with wrong `kM` → `None`.
- `test_malleability_demo` — `cca_tampered_accepted == False`.

All five rejection tests exercise the three components of the ciphertext `(r, c, t)`. Tamper any one of them and the MAC fails.

---

### What PA#6 Achieves

PA#6 completes the first goal of the Minicrypt Clique: a CCA2-secure symmetric encryption scheme. The security theorem is: if `CPAEnc` is IND-CPA secure and `CBCMAC` is EUF-CMA secure (for fixed-length messages, which applies here since `r ‖ c` has a fixed structure), then `CCAEnc` is IND-CCA2 secure.

This is used in PA#17 as a template for the public-key CCA construction, and the Encrypt-then-MAC pattern recurs in PA#10 (`EtHEnc`) with HMAC replacing CBC-MAC.

---

## PA#7 — Merkle-Damgård Hash Transform

**File:** `src/pa07_merkle_damgard/merkle_damgard.py`

### What a Collision-Resistant Hash Function Is

A CRHF (Collision-Resistant Hash Function) maps arbitrary-length inputs to a fixed-length digest, with the property that it is computationally infeasible to find two distinct inputs `x ≠ x'` such that `H(x) = H(x')`. Unlike OWF or PRF security, CRHF security is not relative to a secret key — the function is public, and yet collisions should still be hard to find.

CRHFs are useful for:
- Digital signatures: sign `H(m)` instead of `m` directly (shorter, fixed-size input for RSA/ElGamal).
- MACs: HMAC uses a CRHF in its construction.
- Commitments: publish `H(secret)` now, reveal `secret` later.

### The Merkle-Damgård Transform

A fixed-length compression function `h: {0,1}^{n+b} → {0,1}^n` takes a chaining variable (state, `n` bits) and a message block (`b` bits) and produces a new chaining variable. Building a full hash from a compression function requires:
1. Breaking the message into `b`-bit blocks.
2. Applying `h` iteratively, starting from a fixed IV.
3. Padding the message so the final padded length is a multiple of `b`.

The Merkle-Damgård theorem proves that if the compression function `h` is collision-resistant, then the resulting hash function `H` is also collision-resistant. The proof works by showing that any collision in `H` yields a collision in `h` via a backward chaining argument.

This implementation uses 16-byte (128-bit) blocks, a 16-byte IV, and a 16-byte output — matching the AES block size throughout.

---

### `_aes_compress(state: bytes, block: bytes) -> bytes`

The default compression function used when no custom one is provided.

Input: 16-byte `state` (chaining variable), 16-byte `block` (message block).  
Output: 16-byte new state.

**Construction:** `AES_block(state) XOR state`

This is Davies-Meyer, the same structure as `AESOWF` in PA#1. The message block serves as the AES *key*, and the current state serves as the AES *plaintext*. The XOR with the original `state` at the end is the feed-forward that prevents a trivial fixed-point: without it, an attacker could find `state` such that `AES_block(state) = state` (a fixed point of AES), making the compression function invertible and losing collision resistance.

**Why this is collision-resistant:** Finding a collision `(state, block) ≠ (state', block')` with the same output means finding an AES key `block` and plaintexts `state, state'` such that `AES_block(state) XOR state = AES_block(block')(state') XOR state'`. Under the AES-as-ideal-cipher assumption, this is as hard as an ideal cipher collision, which requires approximately `2^{64}` evaluations (birthday bound on 128-bit blocks).

---

### Class `MerkleDamgard`

**`__init__(self, compress_fn=None, IV=None, block_size=16)`**  
The IV is a fixed 16-byte constant:
```
67 45 23 01 ef cd ab 89 98 ba dc fe 10 32 54 76
```
These are the fractional parts of the square roots of the first primes — the same pattern used in SHA-256's initial hash values (but 128-bit here). A fixed public IV is standard; what matters is that it is not adversarially chosen.

`compress_fn` defaults to `_aes_compress` but PA#8 will inject its DLP-based compression function here, reusing the entire Merkle-Damgård machinery.

---

**`pad(self, message: bytes) -> bytes`**  
Input: message bytes of any length.  
Output: padded message whose length is a multiple of `block_size`.

**The padding scheme (Merkle-Damgård strengthening):**
1. Append `0x80` — this represents the "1" bit that marks the end of the message (in a byte-aligned encoding).
2. Append zero bytes until `len(padded) ≡ block_size - 8 (mod block_size)` — this leaves room for the 8-byte length field in the last block.
3. Append the original message bit length as a big-endian 64-bit integer: `struct.pack('>Q', len(message) * 8)`.

For a 16-byte block, this means every padded message ends with a block whose last 8 bytes are the message length. If the message is, say, 8 bytes long: append `0x80`, then 7 zero bytes to reach 16 bytes, then the 8-byte length — total 24 bytes (2 blocks). If the message already fills a block, a full padding block is added so the length is always present.

**Why the length must be encoded:** Without length encoding, you could have `H("a" ‖ 0x80 ‖ 0x00...) = H("a" ‖ 0x80 ‖ 0x00 ‖ 0x00...)` because both pad to the same block sequence. The length field makes different-length messages produce different padded versions, eliminating a whole class of trivial collisions.

This is also what the **length-extension attack** exploits: knowing `H(m)` means knowing the MD state after processing `m ‖ pad(m)`. An attacker can continue the computation from that state and produce `H(m ‖ pad(m) ‖ suffix)` for any `suffix` — without knowing the original message `m`. The length field doesn't prevent this attack, it only makes the result a valid hash of a known string. HMAC (PA#10) is the fix.

---

**`hash(self, message: bytes) -> bytes`**  
Input: bytes of any length.  
Output: 16-byte digest.

Pads the message, then iterates the compression function:
```python
state = self.IV
for block in blocks(padded):
    state = self.compress(state, block)
return state
```
Each block updates the state. The final state is the hash digest.

---

**`hash_with_chain(self, message: bytes) -> dict`**  
Same computation, but builds and returns the full chain for visualization:
```python
{
    "message": message.hex(),
    "padded": padded.hex(),
    "chain": [
        ("IV", iv_hex),
        ("block_0", block_hex, state_hex),
        ("block_1", block_hex, state_hex),
        ...
    ],
    "digest": final_state_hex,
}
```
Used by the PA7Demo in the React frontend to show each intermediate chaining value.

---

### The Length-Extension Vulnerability

`test_length_extension_vulnerability` in the test file flags this explicitly:
```python
def test_length_extension_vulnerability():
    """Demonstrate that MD is vulnerable to length extension."""
    md = MerkleDamgard()
    m1 = b"secret||data"
    h1 = md.hash(m1)
    # An attacker knowing h1 and the padded length can extend
    assert len(h1) == 16
```
The test does not mount the full attack (that would require re-initializing the MD state with `h1` and processing a suffix), but it marks the known weakness. The `length_extension_demo` function in PA#10 makes this concrete.

---

### What PA#7 Achieves

PA#7 provides the generic hash construction. Two things are implemented here:
1. The transformation from a compression function to a full-length hash, with the padding scheme.
2. A default AES-based compression function (Davies-Meyer).

The MD machinery is reused directly by PA#8 (which injects a DLP compression function) and by PA#10 (HMAC calls `H.md.pad` to demonstrate the length-extension vulnerability). The block-chaining logic is written once here and inherited everywhere.

---

## PA#8 — DLP-Based Collision-Resistant Hash

**File:** `src/pa08_dlp_hash/dlp_hash.py`

### The Construction

The DLP hash compression function is:

```
h(x, y) = g^x · ĥ^y  mod  p
```

where:
- `p` is a safe prime, `g` is a generator of the order-`q` subgroup.
- `ĥ = g^α mod p` for a secret `α` that is chosen during setup and then **discarded**.
- `x` and `y` are derived from the compression function's state and block inputs respectively.

The key property: if you find a collision `(x₁, y₁) ≠ (x₂, y₂)` such that `g^{x₁} · ĥ^{y₁} ≡ g^{x₂} · ĥ^{y₂} (mod p)`, then:
```
g^{x₁ - x₂} ≡ ĥ^{y₂ - y₁} = g^{α(y₂ - y₁)}
```
This gives `x₁ - x₂ ≡ α(y₂ - y₁) (mod q)`, which — since `y₁ ≠ y₂` (otherwise `x₁ = x₂` contradicting the collision) — means `α ≡ (x₁ - x₂)(y₂ - y₁)^{-1} (mod q)`. The attacker has computed `α = log_g(ĥ)`, the discrete logarithm of `ĥ`.

In other words: **finding a collision in this hash function is at least as hard as solving the DLP**. The security reduction is tight and unconditional (it does not require an adversary model assumption like "AES is a PRP" — it only assumes DLP hardness).

---

### Module-Level Setup

The file uses a pre-verified small safe prime for fast demos:
```python
_P, _Q, _G = 5759, 2879, 3   # verified: 5759 = 2*2879+1, both prime
_ALPHA = 1337
_H_VAL = pow(_G, _ALPHA, _P)  # = 3^1337 mod 5759
```

`_ALPHA` is the discrete logarithm of `_H_VAL` base `_G`. In a real deployment, `α` would be generated randomly and never recorded. Here it is fixed for reproducibility in tests. The comments in the file include a long inline derivation showing the search for a suitable safe prime — the final answer `(5759, 2879, 3)` was verified by hand.

---

### Class `DLPHashGroup`

**`__init__(self, bits=16)`**  
For `bits <= 16`: uses the fixed `(_P, _Q, _G, _H_VAL)` tuple for speed — no prime generation needed.  
For `bits > 16`: generates a fresh safe prime using `_gen_safe_prime` from PA#1, picks a random `α ∈ [2, q-2]` via `os.urandom`, computes `h = g^α mod p`, and does **not** store `α`. This simulates a real setup ceremony where the trapdoor is destroyed.

**`compress_fn(self, state_bytes: bytes, block_bytes: bytes) -> bytes`**  
Input: 16-byte state, 16-byte block.  
Output: 16-byte compressed state.

**How it works:**
1. `x = int.from_bytes(state_bytes, 'big') % self.q` — interpret the state as a big-endian integer, reduce mod `q` to get a valid exponent.
2. `y = int.from_bytes(block_bytes, 'big') % self.q` — same for the block.
3. `result = (pow(g, x, p) * pow(h, y, p)) % p` — compute `g^x · ĥ^y mod p`.
4. Encode `result` as a big-endian integer of the same byte length as the input state.

The output is always the same length as the input state (16 bytes), satisfying the fixed-output requirement of the MD transform. If `result.bit_length() > 128`, it is reduced mod `2^128` — this is acceptable for a toy construction (in a production system, the prime would be large enough that this truncation does not occur).

**`params(self) -> dict`**  
Returns `{"p", "q", "g", "h", "bits"}`. Note `α` is absent — it was never stored (in the `bits > 16` case) or is intentionally exposed only for the toy fixed case.

---

### Class `DLPHash`

**`__init__(self, group=None)`**  
Creates a `DLPHashGroup` if not provided. Sets up the IV as `p mod 2^128` encoded as 16 bytes — a deterministic, reproducible IV derived from the group parameters. Instantiates `MerkleDamgard` with `compress_fn=group.compress_fn`, reusing all of PA#7's padding and chaining logic.

The IV being derived from `p` (rather than an arbitrary constant) ensures the IV changes if the group changes — two different groups produce incompatible hash functions.

**`hash(self, message: bytes) -> bytes`**  
Delegates to `self.md.hash(message)`. The full pipeline is:
```
message → MD.pad → [DLP_compress iteratively] → digest
```
The DLP compression function is called for each 16-byte block of the padded message.

**`hash_int(self, message: bytes) -> int`**  
Returns `int.from_bytes(self.hash(message), 'big')` — converts the digest to an integer. Used by PA#15 (RSA signatures) where the hash must be treated as an integer for modular exponentiation.

---

### Security vs AES Compression

PA#7's default AES-based compression is heuristically secure (assuming AES is an ideal cipher). PA#8's DLP-based compression is provably secure under an explicit mathematical assumption (DLP hardness). The trade-off:
- DLP-based: slower (requires two modular exponentiations per block), security reduction is tight.
- AES-based: fast (one AES call per block), security reduction requires an idealized assumption about AES.

In PA#10, the HMAC will use `DLPHash` as its underlying hash, giving a provably secure HMAC whose collision resistance reduces entirely to DLP hardness.

---

### What PA#8 Achieves

PA#8 provides the concrete CRHF that all downstream PAs use for hashing. The DLP hash is used by:
- PA#10 (`HMAC`) — as the hash function `H` inside `H((k ⊕ opad) ‖ H((k ⊕ ipad) ‖ m))`.
- PA#15 (`RSASignature`) — `H(m)` as the value to be signed/verified.
- PA#16 and PA#17 — indirectly through PA#15.

It also demonstrates the first reduction in the project that goes the other way through the Minicrypt Clique: CRHF security from a number-theoretic assumption (DLP), rather than building up from OWF/PRG/PRF.

---

## PA#9 — Birthday Attack (Collision Finding)

**File:** `src/pa09_birthday_attack/birthday_attack.py`

### The Birthday Paradox and Collision Complexity

For a hash function with `n`-bit output, there are `2^n` possible digest values. By the birthday paradox, after approximately `√(2^n) = 2^{n/2}` random evaluations, there is a ~50% probability that two inputs collide. This is the birthday bound and it is tight — any hash function with `n`-bit output can be broken (a collision found) in about `2^{n/2}` operations, regardless of the specific construction.

This is why SHA-256 (256-bit output) targets 128-bit collision resistance — the birthday attack halves the security level. A 16-bit toy hash can be broken in ~`2^8 = 256` evaluations, which the demos do in milliseconds.

---

### `birthday_attack_naive(hash_fn, n_bits, num_trials=None)`

The direct dictionary-based collision search.

**Input:**
- `hash_fn` — callable that takes bytes and returns an integer (the hash value truncated to `n_bits`).
- `n_bits` — the effective output size in bits (determines the search space `2^n_bits`).
- `num_trials` — maximum attempts, defaulting to `3 * 2^(n_bits/2) + 1000`.

**Output:** dict:
```python
{
    "found": True,
    "x1": hex_string,             # first colliding input
    "x2": hex_string,             # second colliding input
    "hash": hex_string,           # the common hash value
    "evaluations": int,           # how many hashes were computed
    "expected_2_to_n_over_2": int,
    "ratio": float,               # evaluations / expected — should be near 1.0
    "time_sec": float,
}
```
Or `{"found": False, "evaluations": num_trials}` if no collision is found within the trial budget.

**How it works:**
1. Maintains a dict `seen: hash_value → input_bytes`.
2. For each trial, generates `input_bytes = os.urandom(input_bytes_count)`.
3. Computes `h = hash_fn(x) & mask` where `mask = (1 << n_bits) - 1` truncates to `n_bits`.
4. If `h` is already in `seen` and the stored input differs from `x`, a genuine collision has been found (same hash, different inputs) — returns the result.
5. Otherwise records `seen[h] = x` and continues.

The `input_bytes` count is chosen as `max(2, (n_bits + 3) // 4)` — enough bytes to have far more than `2^{n_bits}` possible distinct inputs, so the search space is not the bottleneck.

**Why `seen[h] != x` is checked:** Without this guard, re-hashing the same random value would falsely report a collision. Random collisions in the input space (two calls to `os.urandom` returning the same bytes) are negligible for any reasonable input size, but the check is there for correctness.

---

### `birthday_attack_floyd(hash_fn, n_bits, max_retries=30)`

Floyd's cycle-detection algorithm (tortoise and hare), adapted for collision finding.

**The key observation:** The function `f(x) = hash_fn(x.to_bytes(...)) & mask` maps the finite set `{0, ..., 2^n_bits - 1}` to itself. Any sequence `x, f(x), f(f(x)), ...` must eventually revisit a value (the pigeonhole principle), forming a ρ (rho) shape: a tail of length `μ` leading into a cycle of length `λ`. Two elements in the tail that map to the same cycle entry are a collision for `f`.

**Memory advantage:** The naive attack stores all seen hashes — `O(2^{n/2})` memory. Floyd's algorithm uses only two variables (tortoise and hare) — `O(1)` memory. The time cost is similar.

**How `f` is defined:**
```python
def f(x: int) -> int:
    b = (x & mask).to_bytes(n_bytes, 'big')
    return hash_fn(b) & mask
```
The integer input `x` is encoded as bytes, hashed, and the result is truncated to `n_bits` again — making `f` a function from `{0..2^n-1}` to itself.

---

#### Phase 1: Finding the Meeting Point

Start with `tortoise = f(x0)` and `hare = f(f(x0))`. In each step:
- Tortoise advances by 1: `tortoise = f(tortoise)`
- Hare advances by 2: `hare = f(f(hare))`

They are guaranteed to meet at some point inside the cycle (at position `μ + r*λ` for some `r ≥ 1`). The loop terminates when `tortoise == hare`.

Each iteration of the while loop accounts for 3 hash evaluations (one for tortoise, two for hare).

---

#### Phase 2: Finding `μ` (Tail Length)

Reset tortoise to `x0`. Advance both tortoise and hare one step at a time:
```python
tortoise = x0
while tortoise != hare:
    tortoise = f(tortoise)
    hare = f(hare)
    mu += 1
```
When they meet again, tortoise is exactly at `x_μ` — the first entry of the cycle. This works because after Phase 1, hare is at position `μ` within the cycle, and advancing both at the same rate from positions 0 (tortoise) and `μ` (hare) brings them together at the cycle entry after exactly `μ` steps.

If `μ == 0`, the starting point `x0` was already in the cycle and there is no tail. In this case, the collision structure is different and the attempt is retried with a new `x0`.

---

#### Phase 3: Finding `λ` (Cycle Length)

With tortoise at the cycle entry (`x_μ`), advance hare alone until it returns:
```python
hare = f(tortoise)
lam = 1
while hare != tortoise:
    hare = f(hare)
    lam += 1
```
`lam` is now the cycle length `λ`.

---

#### Extracting the Collision

The collision comes from elements `x_{μ-1}` and `x_{μ+λ-1}` — both are pre-images of the cycle entry `x_μ`, but they are distinct (one is in the tail, one is at the end of the cycle):

```python
a = x0
for _ in range(mu - 1):
    a = f(a)          # a = x_{mu-1}

b = x0
for _ in range(mu + lam - 1):
    b = f(b)          # b = x_{mu+lam-1}
```

Check: `f(a) == f(b)` (both map to `x_μ`) and `a != b`. If both hold, a genuine collision is found.

Return dict:
```python
{
    "found": True,
    "x1": hex(a),
    "x2": hex(b),
    "hash": hex(ha),
    "evaluations": total_evals,
}
```

The `max_retries=30` outer loop handles the edge cases where `μ = 0` or the extracted `a, b` coincidentally satisfy `a == b` (a degenerate case in very small hash spaces).

---

### `run_birthday_empirical(hash_fn, n_values, trials_per_n=20)`

Runs the naive attack for multiple `n_bits` values and collects statistics.

Input: a hash function, a list of `n_bits` values to test (e.g., `[8, 10, 12, 14, 16]`), trials per value.  
Output: list of dicts:
```python
{"n": n, "avg_evaluations": avg, "expected": 2^(n/2), "ratio": avg/expected}
```
The `ratio` should be close to `1.0` across all `n`, confirming that the birthday bound is tight regardless of output length. This is the empirical demonstration of the birthday paradox.

---

### Test Hash Function

The tests use an FNV-1a hash truncated to `n_bits`:
```python
def _toy_hash(b: bytes, n_bits: int = 12) -> int:
    h = 0x811c9dc5
    for byte in b:
        h = ((h ^ byte) * 0x01000193) & 0xFFFFFFFF
    return h & ((1 << n_bits) - 1)
```
FNV-1a has good avalanche properties — single-bit input changes affect many output bits. Truncating to 12 bits gives a 4096-value codomain, expected collision after ~64 queries. The test `test_birthday_evaluations_near_expected` checks that collisions are found in under 1000 queries, which is generous for a 64-query expected cost.

---

### What PA#9 Achieves

PA#9 demonstrates the fundamental limit of all hash functions. No matter how well a hash is designed, the birthday attack always applies. It shows:
1. The birthday bound is achievable in practice — the `ratio ≈ 1.0` empirically.
2. Floyd's algorithm achieves the same collision finding with O(1) memory.
3. The practical consequence: a hash with `n`-bit output provides only `n/2` bits of collision resistance. SHA-256 provides 128-bit collision resistance. A 16-bit toy hash provides 8-bit — trivially broken.

This motivates the hash output size choices in PA#8 and explains why PA#13 (Miller-Rabin prime generation) uses primes large enough that birthday attacks on the DLP-based hash are computationally infeasible.

---

## PA#10 — HMAC and Encrypt-then-HMAC

**File:** `src/pa10_hmac/hmac_impl.py`

### The Problem: Length-Extension Attacks on Plain MD

PA#7's Merkle-Damgård construction has a structural weakness that makes naive `H(k ‖ m)` insecure as a MAC. The problem: knowing `H(k ‖ m)` means knowing the MD state after processing `k ‖ m ‖ pad(k ‖ m)`. An attacker can resume the compression chain from that state and compute `H(k ‖ m ‖ pad(k ‖ m) ‖ suffix)` for any `suffix` — all without knowing `k`.

So given a valid MAC tag `t = H(k ‖ m)`, the attacker can forge a valid tag for the longer message `m ‖ pad(k ‖ m) ‖ suffix` (for any suffix they choose) — just by continuing the hash computation from `t`. This is the length-extension attack, and it breaks any MAC scheme of the form `H(k ‖ m)` using a plain MD hash.

The `length_extension_demo` function in `hmac_impl.py` makes this concrete:
- Computes `naive_tag = H.hash(k + m)`.
- Reconstructs the padded message `H.md.pad(k + m)`.
- Shows that hashing `padded + suffix` from scratch produces a tag the attacker could compute without `k` (by resuming from `naive_tag`).
- Returns `"attack_succeeds": True`.

**HMAC's fix:** Nest the hash twice so the outer hash re-randomizes the output. The inner hash processes the data; the outer hash ensures that even knowing the inner hash output reveals nothing useful about the outer computation.

---

### Constants

```python
IPAD_BYTE = 0x36
OPAD_BYTE = 0x5C
```

These constants are specified in RFC 2104 (the HMAC standard). Their values (`0x36 = 0011 0110` and `0x5C = 0101 1100`) were chosen so that `ipad XOR opad = 0x6A` (a value with roughly half its bits set), ensuring the two padded keys differ significantly. They are XORed with every byte of the padded key to derive two distinct keys from one.

---

### Class `HMAC`

**`__init__(self, dlp_hash=None, block_size=64)`**  
The `block_size` is 64 bytes — the standard HMAC block size matching SHA-1/SHA-256's 512-bit (64-byte) block. Even though the underlying DLP hash uses 16-byte blocks internally, the HMAC key padding uses 64 bytes, matching the convention.

If no `DLPHash` is provided, constructs one with a 32-bit group. The 32-bit group is faster than the default 16-bit for repeated HMAC calls (the 16-bit group has a very small prime, giving hash outputs with low entropy; 32-bit gives a more realistic demonstration).

---

**`_pad_key(self, k: bytes) -> bytes`**  
Input: key bytes of any length.  
Output: exactly `block_size` bytes (default 64).

- If `len(k) > block_size`: compute `k = H.hash(k)` to shorten it. This handles long keys — hashing them first ensures they fit in the block.
- Pad to `block_size` with zero bytes on the right (`k.ljust(block_size, b'\x00')`).

This normalization means HMAC accepts keys of any length consistently: very long keys are hashed to a short digest first, short keys are zero-extended. The zero extension does not weaken security because the key contributes only through XOR with `ipad`/`opad` — zeros don't cancel the original key bits.

---

**`mac(self, k: bytes, m: bytes) -> bytes`**  
Input: key `k`, message `m`.  
Output: HMAC tag (bytes, same length as `H.hash` output — 16 bytes for the default DLP hash).

**Full computation:**
```python
k_padded = _pad_key(k)                          # 64 bytes
ipad = bytes(b ^ IPAD_BYTE for b in k_padded)  # 64 bytes, XOR with 0x36
opad = bytes(b ^ OPAD_BYTE for b in k_padded)  # 64 bytes, XOR with 0x5C

inner = H.hash(ipad + m)                        # hash of 64+len(m) bytes
outer = H.hash(opad + inner)                    # hash of 64+len(inner) bytes
return outer
```

**Why this resists length extension:** After computing `inner = H(ipad ‖ m)`, an attacker knows `inner` (it's the MAC tag from the inner call). But to extend, they would need to continue the outer hash `H(opad ‖ ...)` from `inner`. The outer hash takes `opad ‖ inner` as a single message — it starts from the IV, not from `inner`. The attacker cannot "resume" the outer hash from `inner` because `inner` is not the MD state after processing `opad ‖ inner`; it is just the input to the outer hash.

Formally: for the attacker to forge a tag `outer'` for a new message `m'`, they would need to find `inner' = H(ipad ‖ m')` and `outer' = H(opad ‖ inner')`. The first requires finding `inner'` without knowing the inner key `ipad` — a MAC forgery on the inner HMAC. The second requires forging the outer HMAC given `inner'`. Both reductions show HMAC is EUF-CMA secure if the hash is collision-resistant (or even pseudorandom, for a stronger result).

---

**`verify(self, k: bytes, m: bytes, t: bytes) -> bool`**  
Recomputes the expected tag and compares with `t` in constant time via XOR accumulation:
```python
diff = 0
for a, b in zip(expected, t):
    diff |= a ^ b
return diff == 0
```
Same pattern as PA#5's `PRFMAC.vrfy`. If any byte differs, `diff` becomes non-zero, and the result is `False` — without short-circuiting that would leak information about how many bytes matched.

---

### Class `EtHEnc` — Encrypt-then-HMAC

`EtHEnc` is a cleaner version of PA#6's `CCAEnc` that replaces `CBCMAC` with `HMAC`. This removes the length-restriction limitation of CBC-MAC and provides a stronger security guarantee.

**`__init__(self, enc_scheme=None, hmac_scheme=None)`**  
Constructs a `CPAEnc` (PA#3) and an `HMAC` (this file). The `CPAEnc` uses `AESPRF` from PA#2 as its underlying PRF.

---

**`eth_enc(self, kE: bytes, kM: bytes, m: bytes) -> tuple`**  
Input: encryption key `kE`, HMAC key `kM`, plaintext `m`.  
Output: `(r, c, t)`.

1. `r, c = self.enc.enc(kE, m)` — CPA-encrypt.
2. `blob = r + c` — concatenate nonce and ciphertext.
3. `t = self.hmac.mac(kM, blob)` — HMAC over the full blob.
4. Return `(r, c, t)`.

Identical structure to `CCAEnc.cca_enc`, but using HMAC instead of CBC-MAC.

---

**`eth_dec(self, kE: bytes, kM: bytes, r: bytes, c: bytes, t: bytes)`**  
Input: both keys, `r`, `c`, `t`.  
Output: plaintext, or `None` on HMAC failure.

1. `blob = r + c`.
2. `self.hmac.verify(kM, blob, t)` — verify HMAC first.
3. If failure: return `None`.
4. If success: `self.enc.dec(kE, r, c)` — decrypt.

Same MAC-first pattern as PA#6. Any modification to `r`, `c`, or `t` causes HMAC failure and rejection.

---

### `length_extension_demo(H, k, m, suffix)`

Demonstrates the length-extension attack concretely.

**What it shows:**
1. Compute `naive_tag = H.hash(k + m)` — naive MAC of `m` using key prefix.
2. Compute the padded version of `k + m` — this is what the MD chain actually processes.
3. Show that hashing `k + extended_input` (where `extended_input = pad(k+m) + suffix`) gives a valid hash that the attacker could derive just from knowing `naive_tag` and the message length.

Return dict:
```python
{
    "naive_tag": naive_tag_hex,
    "extended_input": extended_input_hex,
    "extended_tag_from_scratch": full_tag_hex,
    "attack_succeeds": True,
    "note": "Attacker can compute valid tag for extended message without key k",
}
```
The `attack_succeeds: True` is hardcoded — the attack always works against plain `H(k ‖ m)` for any Merkle-Damgård hash. HMAC is immune because neither `H(ipad ‖ m)` nor `H(opad ‖ inner)` is a prefix-keyed MAC.

---

### Frontend: HMAC Interactive Demo

The PA#10 demo (`PA10Demo.jsx`) has five panels:

1. **Length Extension Panel** — side-by-side comparison: left column shows `H(k ‖ m)` (naive MAC, vulnerable) and right shows `HMAC_k(m)` (secure). For the naive MAC, the panel shows the naive tag, the padded message the attacker reconstructs from the tag alone, the forged tag for the extended message, and `attack_succeeds: true`. For HMAC, the same extension attempt fails.

2. **EUF-CMA Panel** — 50-query HMAC oracle game. User requests signed messages, then tries to submit a forgery `(m*, t*)` for a new message. Success requires knowing the hidden key — computationally infeasible.

3. **MAC → CRHF Panel** — demonstrates the backward direction: if HMAC is EUF-CMA secure, it implies a CRHF. Defines `h'(cv, block) = HMAC_k(cv ‖ block)` and shows distinct compression outputs for multiple distinct inputs, confirming collision resistance.

4. **Encrypt-then-HMAC Panel** — runs the `eth_enc`/`eth_dec` roundtrip and shows tamper results: modifying `r`, `c`, or `t` all produce `None` (HMAC rejection).

5. **Timing Demo Panel** — compares naive byte-comparison (early exit on first mismatch) vs constant-time XOR accumulation. Shows that naive comparison's timing varies with the number of matching prefix bytes; constant-time comparison always takes the same number of steps regardless.

**SHA-256 toggle absent by design:** The PDF spec mentions a toggle between the DLP hash and SHA-256 for comparison. This toggle is intentionally absent. `import hashlib` is explicitly forbidden by CLAUDE.md ("No external crypto libraries. No `hashlib`..."). The length-extension demo runs entirely on the custom DLP hash from PA#8, which is sufficient to demonstrate the vulnerability.

### Test Coverage

- `test_hmac_verify_correct` — HMAC verifies its own tags.
- `test_hmac_rejects_tampered_message` — changing `m` invalidates the tag.
- `test_hmac_rejects_tampered_tag` — flipping a bit in `t` causes rejection.
- `test_hmac_rejects_wrong_key` — different key produces different tag.
- `test_hmac_deterministic` — same inputs always produce the same tag.
- `test_hmac_uses_dlp_hash` — explicitly constructs a `DLPHash` and passes it in, confirming no stdlib hashlib is used.
- `test_hmac_double_hash_structure` — manually computes the HMAC step-by-step (pad key, XOR with ipad/opad, inner hash, outer hash) and confirms the result matches `h.mac(k, m)`. This verifies the internal structure is exactly right, not just that the output is consistent.
- `test_eth_enc_roundtrip` — `eth_dec(eth_enc(m)) == m`.
- `test_eth_rejects_tampered` — tampered `r` causes HMAC failure → `None`.

---

### What PA#10 Achieves

PA#10 closes the hash function arc: PA#7 built the MD transform, PA#8 built a collision-resistant compression function, PA#9 showed the birthday limit, and PA#10 builds HMAC on top of the DLP hash to produce a MAC that is both:
1. **Length-extension resistant** — unlike plain `H(k ‖ m)`.
2. **Provably EUF-CMA secure** — the security reduces to the collision resistance of the underlying hash.

It also provides `EtHEnc`, a second Encrypt-then-MAC construction that improves on PA#6 by using HMAC (secure for all message lengths) instead of CBC-MAC (secure only for fixed-length). Both `CCAEnc` and `EtHEnc` are CCA2-secure; the difference is in the MAC's range of security applicability.

PA#10 is the last purely symmetric PA. Everything built so far — OWF, PRG, PRF, AES, CPA Enc, block cipher modes, MAC, CRHF, HMAC — forms the complete Minicrypt Clique. PA#11 onward enters the public-key world.

---

## Summary: What Parts 6–10 Establish

| PA | Primitive | Built From | Security Notion |
|---|---|---|---|
| PA#6 | CCA Encryption (EtM) | CPAEnc (PA#3) + CBC-MAC (PA#5) | IND-CCA2 |
| PA#7 | Merkle-Damgård Hash | AES compression (PA#2) + MD transform | CRHF (under AES-ideal-cipher) |
| PA#8 | DLP-based CRHF | DLP group (PA#1) + MD (PA#7) | CRHF (reduces to DLP hardness) |
| PA#9 | Birthday Attack | Any hash function | Demonstrates `2^{n/2}` collision bound |
| PA#10 | HMAC | DLPHash (PA#8) + ipad/opad nesting | EUF-CMA, length-extension resistant |
| PA#10 | EtHEnc | CPAEnc (PA#3) + HMAC | IND-CCA2 (stronger MAC than PA#6) |

### The Dependency Chain Through This Block

```
PA#10 (HMAC / EtHEnc)
 ├── PA#8 (DLPHash)
 │    └── PA#7 (MerkleDamgard)
 │         └── PA#2 (AES — default compress)
 └── PA#3 (CPAEnc) ← EtHEnc
      └── PA#2 (AESPRF)

PA#9 (Birthday Attack)
 └── any hash_fn (tests use FNV-1a; API uses DLPHash from PA#8)

PA#6 (CCAEnc)
 ├── PA#3 (CPAEnc)
 └── PA#5 (CBCMAC)
```

### The Transition to Public-Key Cryptography

Up to PA#10, all security rests on shared secret keys. Both parties must have `k` (or `kE` and `kM`) before communication can begin. PA#11 (Diffie-Hellman) solves the key distribution problem: two parties who have never met can establish a shared secret over a public channel, with an eavesdropper learning nothing. PA#12–PA#20 use the DLP and factoring assumptions to build RSA, signatures, ElGamal, and MPC — but they all use the hash functions and MAC structures built in PA#7–PA#10 as their underlying primitives.
