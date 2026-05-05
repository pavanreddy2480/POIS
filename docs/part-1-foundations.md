# Part 1: Foundations — PA#1 through PA#5

This document covers the first five programming assignments in depth: what each primitive is, why it exists, how every function is implemented, what its inputs and outputs are, and what the section as a whole achieves in the larger cryptographic framework.

These five PAs establish the bottom of the Minicrypt Clique. By the end of PA#5 we have: a one-way function, a pseudorandom generator, AES-128 from scratch, a pseudorandom function family, CPA-secure encryption, three block cipher modes, and two MAC constructions. Everything in PA#6 through PA#20 is built on these.

---

## PA#1 — One-Way Functions and PRG

**Files:** `src/pa01_owf_prg/owf.py`, `src/pa01_owf_prg/prg.py`

### What a One-Way Function Is

A function `f` is one-way if it is easy to compute but hard to invert. Formally: for any probabilistic polynomial-time adversary `A`, the probability that `A(f(x))` outputs `x'` such that `f(x') = f(x)` is negligible in the security parameter. This is not a proven fact about any specific function — it is a hardness *assumption* that we believe holds based on decades of cryptanalysis.

OWFs are the weakest assumption in all of Minicrypt. The HILL theorem proves that if a OWF exists, a PRG exists. From a PRG, a PRF can be built. From a PRF, essentially everything else follows. So the existence of OWFs is both necessary and sufficient for all of symmetric cryptography.

---

### `owf.py` — Implementation

#### Helper: `_is_prime_miller_rabin(n, k=20)`

Used internally to generate safe primes. Before the dedicated PA#13 module exists, PA#1 needs its own primality test.

**Input:** integer `n`, number of rounds `k` (default 20).  
**Output:** `True` if `n` is probably prime, `False` if definitely composite.

**How it works:** Miller-Rabin writes `n - 1 = 2^s * d` with `d` odd. For each of `k` rounds, it picks a random witness `a` from `[2, n-2]` using `os.urandom`. It computes `x = a^d mod n`. If `x == 1` or `x == n-1`, this witness passes. Otherwise it squares `x` up to `s-1` times; if `x` ever reaches `n-1`, the witness passes. If no squaring reaches `n-1`, then `n` is definitively composite. After `k` passing rounds, `n` is declared probably prime with error probability at most `4^{-k}`.

With `k=20`, the false-positive probability is at most `4^{-20} ≈ 10^{-12}`.

**Why `os.urandom` instead of `random`:** The constraint is no use of Python's `random` module, as it is not cryptographically secure. `os.urandom` reads from the OS entropy pool.

---

#### Helper: `_gen_safe_prime(bits=32)`

**Input:** bit length (default 32).  
**Output:** tuple `(p, q, g)` — a safe prime `p = 2q + 1`, its Sophie Germain factor `q`, and a generator `g` of the prime-order-`q` subgroup of `Z_p*`.

**How it works:**
1. Generates a random odd integer `q` of the requested bit length using `os.urandom`.
2. Sets the high bit to ensure `q` is in the right range.
3. Tests `q` for primality with `_is_prime_miller_rabin`.
4. Computes `p = 2q + 1` and tests `p` for primality.
5. Searches for a generator `g` in `[2, 1000)` by checking that `g^q ≡ 1 (mod p)` (so `g` has order dividing `q`) and `g^2 ≢ 1 (mod p)` (so `g` is not in the order-2 subgroup). Since `q` is prime, any element of order dividing `q` has order exactly `q` or 1; excluding `g^2 = 1` rules out the trivial case.

**Why safe primes:** A safe prime `p = 2q + 1` with `q` prime gives `Z_p*` a subgroup of prime order `q`. Working in this subgroup prevents certain attacks (Pohlig-Hellman) that exploit composite group order. The DLP is believed to be hard in prime-order subgroups.

---

#### Class `DLPOWF`

The DLP-based one-way function `f(x) = g^x mod p`.

**`__init__(self, bits=32)`**  
Generates a safe prime group at construction. For `bits <= 32`, calls `_gen_safe_prime(bits)` directly. For larger bit sizes, also calls 32-bit generation (toy behavior — production would use precomputed NIST primes or generate larger ones, but this is a demo system). Stores `self.p`, `self.q`, `self.g`, `self.bits`.

**`evaluate(self, x: int) -> int`**  
Input: integer `x` (the preimage).  
Output: integer `g^x mod p`.

The implementation reduces `x` modulo `q` before exponentiating: `pow(self.g, x % self.q, self.p)`. This is correct because `g` has order `q`, so `g^{x mod q} = g^x` in the group. It prevents the exponent from being astronomically large.

This is the core OWF evaluation. Computing it is a modular exponentiation — fast via Python's built-in `pow(base, exp, mod)` which uses binary (square-and-multiply) exponentiation internally.

Inverting it means solving `y = g^x mod p` for `x` given `y`, which is the Discrete Logarithm Problem. The best known classical algorithm (Baby-step Giant-step) runs in `O(sqrt(q))` time and space, which for a 32-bit `q` is `~2^16` operations — fine for a demo but trivially breakable. For actual security, `q` should be at least 256 bits (matching the security level of SHA-256).

**`verify_hardness(self, x=None) -> dict`**  
Input: optional integer `x`.  
Output: dict containing `"hardness"` (string `"DLP"`), group parameters `p, q, g, bits`, description of the best known attack, and optionally the input/output pair if `x` was provided.

Used by the web frontend to display group parameters in the PA#1 demo. The return shape is a dict, not a string — this is an interface contract.

**`group_params(self) -> dict`**  
Returns `{"p": ..., "q": ..., "g": ..., "bits": ...}`. Used wherever only the group parameters are needed (e.g., initializing downstream DLP-based components).

---

#### Class `AESOWF`

The AES-based one-way function using the Davies-Meyer compression structure: `f(k) = AES_k(0^128) XOR k`.

**`evaluate(self, k: bytes) -> bytes`**  
Input: 16-byte key `k`.  
Output: 16-byte value `AES_k(0^128) XOR k`.

**How it works:** Encrypts the all-zero block under key `k` using the AES implementation from PA#2 (`aes_impl.aes_encrypt`). Then XORs the result with `k` itself. The XOR is applied byte-by-byte.

**Why this is one-way:** If AES is a PRP (pseudorandom permutation), then `AES_k(0)` looks random to anyone who doesn't know `k`. XORing with `k` prevents the trivial inversion `k = AES_k^{-1}(AES_k(0))` — knowing the output `y = AES_k(0) XOR k` and the AES structure, you'd need to find `k` such that `AES_k(0) = y XOR k`. This is a fixed-point equation in `k` that has no efficient solution under AES security. This is also exactly the Davies-Meyer construction used inside MD5 and SHA-1's compression functions.

**`verify_hardness(self) -> str`**  
Returns a human-readable string describing the security reduction. (Note the contrast with `DLPOWF.verify_hardness` which returns a dict — these are two separate classes with different interfaces because the security arguments differ.)

---

### `prg.py` — Implementation

#### What a PRG Is

A pseudorandom generator takes a short, truly random seed and stretches it into a long, pseudorandom output. The output must be computationally indistinguishable from a uniformly random string of the same length. The expansion must be superlinear — a 128-bit seed expanding to 256 bits is a valid PRG; the HILL theorem says you can amplify any OWF into an arbitrary-stretch PRG by iterating.

#### Class `PRG`

Two backends are provided: `mode='dlp'` implements the HILL iterative construction for theoretical correctness, and `mode='aes'` uses AES-CTR for practical speed. The web demo uses AES mode; the DLP mode is available for theoretical demonstration.

**`__init__(self, owf=None, mode='aes')`**  
Creates or accepts a `DLPOWF` instance and sets the mode. Default is AES mode for performance.

**`seed(self, s: bytes) -> None`**  
Stores a seed for stateful use via `next_bits()`. Used when the PRG is operated as an ongoing stream rather than a one-shot expansion.

---

#### `_aes_ctr_expand(self, seed: bytes, length: int) -> bytes`

Input: 16-byte seed, output byte count `length`.  
Output: `length` pseudorandom bytes.

This is AES in Counter (CTR) mode used as a PRG. The seed is used as the AES key. Block `i` of the output is `AES_seed(i)` where `i` is encoded as a big-endian 16-byte block. Blocks are concatenated until `length` bytes are produced, then truncated.

This is how real PRGs work in practice — AES-CTR is the standard DRBG (Deterministic Random Bit Generator) construction in NIST SP 800-90A. It is secure under the AES-as-PRP assumption.

---

#### `_dlp_expand(self, seed: bytes, length: int) -> bytes`

Input: seed bytes, output byte count `length`.  
Output: `length` pseudorandom bytes via the HILL iterative hard-core bit construction.

**How it works:**
1. Converts `seed` bytes to an integer `x` in `[1, q-1]`.
2. For each output bit: extracts the Least Significant Bit of `x` as a hard-core predicate, then advances the state via `x = g^x mod p` (the DLP OWF).
3. Packs bits into bytes (MSB first within each byte).

**Why the LSB is a hard-core predicate:** The Goldreich-Levin theorem says that for any OWF `f`, the inner product `<x, r>` mod 2 is a hard-core bit when `r` is public. For the DLP OWF, the LSB of the discrete logarithm is a hard-core predicate under a variant of this argument. Concretely: if you could predict the LSB of `x` given `g^x mod p`, you would gain information about the discrete logarithm, contradicting the DLP assumption.

**Performance:** This is slow. Extracting 32 output bytes requires 256 modular exponentiations. This is why the AES mode is the default.

---

#### `generate(self, seed: bytes, length: int) -> bytes`

The main interface. Dispatches to `_aes_ctr_expand` or `_dlp_expand` based on `self.mode`.

Input: seed bytes, integer `length`.  
Output: `length` pseudorandom bytes.

---

#### `next_bits(self, n: int) -> bytes`

Stateful version. Returns `n` bytes from the current seed, then advances the seed by replacing it with a fresh AES-CTR expansion. This simulates a stateful PRNG where each call advances the internal state.

---

#### `length_doubling(self, s: bytes) -> tuple`

Input: 16-byte seed `s`.  
Output: two 16-byte values `(G0, G1)` — the left and right halves of `AES_CTR(s, 32)`.

This is the specific primitive used by the GGM PRF construction in PA#2. Given a seed, it produces two 16-byte pseudorandom strings representing "go left" and "go right" in the binary tree. The split is simply the first and second halves of 32 bytes of AES-CTR output from that seed.

---

### What PA#1 Achieves

PA#1 establishes the root of the Minicrypt Clique. It gives two concrete OWF instantiations (one based on DLP, one based on AES), and it gives the PRG that the GGM tree construction in PA#2 will use. The HILL theorem direction (OWF → PRG) is implemented in `_dlp_expand`. The `length_doubling` function is the direct bridge into PA#2's GGM tree.

---

## PA#2 — AES-128 from Scratch and Pseudorandom Functions

**Files:** `src/pa02_prf/aes_impl.py`, `src/pa02_prf/prf.py`

### Why AES from Scratch

No external libraries is an absolute rule. AES-128 is implemented fully — including the GF(2⁸) field arithmetic, the S-box, key expansion, and all four round transformations. This is AES exactly as specified in FIPS 197.

### `aes_impl.py` — AES-128

#### Constants

**`SBOX`** — 256-element list. Maps any byte value `b` to its AES S-box substitution. The S-box is defined algebraically: take the multiplicative inverse of `b` in GF(2⁸), then apply an affine transformation (a specific 8×8 binary matrix multiplication plus the vector `0x63`). The result is a highly non-linear bijection that is the primary source of AES's confusion property.

**`INV_SBOX`** — Inverse S-box, computed by inverting the `SBOX` list: `INV_SBOX[SBOX[i]] = i`. Used in decryption.

**`RCON`** — 11 round constants for the key schedule. `RCON[i]` is `x^{i-1}` in GF(2⁸), representing the polynomial `x` raised to successive powers in the field. Specifically: `[0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]`. The doublings that wrap around (`0x80 → 0x1b`) are the result of polynomial reduction modulo the irreducible polynomial `x^8 + x^4 + x^3 + x + 1` (hex `0x11b`).

---

#### GF(2⁸) Arithmetic

AES arithmetic lives in the finite field GF(2⁸), where elements are degree-7 polynomials over GF(2) (i.e., 8-bit values), addition is XOR, and multiplication uses the irreducible polynomial `x^8 + x^4 + x^3 + x + 1`.

**`_xtime(a: int) -> int`**  
Multiplies field element `a` by `x` (i.e., left-shifts by 1 bit). If the high bit of `a` is set before shifting, the result would overflow 8 bits — this is reduction modulo `0x11b`, implemented as XOR with `0x1b` after the shift. The implementation:
```python
((a << 1) ^ 0x1b) & 0xff  if a & 0x80  else  (a << 1) & 0xff
```
The `& 0xff` masks to 8 bits in both cases.

**`_gf_mul(a: int, b: int) -> int`**  
Full multiplication of two field elements using the peasant multiplication algorithm (also called Russian multiplication or binary method). For each bit of `b` from LSB to MSB: if that bit is 1, XOR the current `a` into the result. Then double `a` via `_xtime`. This correctly multiplies polynomials mod `0x11b`.

Input: two integers in `[0, 255]`.  
Output: their GF(2⁸) product, an integer in `[0, 255]`.

This function is called heavily in MixColumns (with constants 2, 3, 9, 11, 13, 14).

---

#### State Representation

AES operates on a 4×4 matrix of bytes called the state. The byte ordering is column-major: the 16 input bytes fill the matrix column by column, so `state[row][col] = byte[row + 4*col]`.

**`_bytes_to_state(b: bytes) -> list`**  
Input: 16 bytes.  
Output: 4×4 list-of-lists `s` where `s[r][c] = b[r + 4*c]`.

**`_state_to_bytes(s: list) -> bytes`**  
Input: 4×4 state.  
Output: 16 bytes, also in column-major order: reads columns left-to-right, top-to-bottom within each column.

The column-major convention is specified in FIPS-197 §3.4 and must be followed exactly for test vector compatibility.

---

#### Round Transformations

**`_sub_bytes(state) -> list`**  
Applies the S-box to every byte of the state independently. This is the non-linear substitution step — the only non-linear operation in AES. Without it, AES would be linear over GF(2) and would be trivially breakable.  
Input: 4×4 state. Output: 4×4 state.

**`_inv_sub_bytes(state) -> list`**  
Same but uses `INV_SBOX`. Used in decryption.

**`_shift_rows(state) -> list`**  
Cyclically shifts each row left by its row index: row 0 is unchanged, row 1 shifts left by 1, row 2 by 2, row 3 by 3. In the implementation, this is written out as explicit index permutations rather than a loop, for clarity:
```python
[state[1][1], state[1][2], state[1][3], state[1][0]],  # row 1 shifts left by 1
[state[2][2], state[2][3], state[2][0], state[2][1]],  # row 2 shifts left by 2
[state[3][3], state[3][0], state[3][1], state[3][2]],  # row 3 shifts left by 3
```
This provides diffusion across columns — bytes from different columns end up in the same column for MixColumns to mix.

**`_inv_shift_rows(state) -> list`**  
Shifts rows right (opposite direction): row 1 by 1, row 2 by 2, row 3 by 3. This is the inverse used in decryption.

**`_mix_columns(state) -> list`**  
Operates on each column independently, treating it as a degree-3 polynomial over GF(2⁸) and multiplying it by the fixed polynomial `{03}x^3 + {01}x^2 + {01}x + {02}` mod `x^4 + 1`.

In matrix form, each output column `[s0', s1', s2', s3']` is:
```
s0' = 2·s0 ⊕ 3·s1 ⊕ s2 ⊕ s3
s1' = s0 ⊕ 2·s1 ⊕ 3·s2 ⊕ s3
s2' = s0 ⊕ s1 ⊕ 2·s2 ⊕ 3·s3
s3' = 3·s0 ⊕ s1 ⊕ s2 ⊕ 2·s3
```
where multiplication is GF(2⁸) multiplication via `_gf_mul`. The constant `3·a = 2·a ⊕ a = _xtime(a) ⊕ a`. MixColumns ensures that every input byte affects all four output bytes of the same column — this is the diffusion step of AES.

**`_inv_mix_columns(state) -> list`**  
The inverse: each column is multiplied by the inverse polynomial. Uses the constants `0x0e, 0x0b, 0x0d, 0x09`:
```
s0' = 14·s0 ⊕ 11·s1 ⊕ 13·s2 ⊕ 9·s3
s1' = 9·s0 ⊕ 14·s1 ⊕ 11·s2 ⊕ 13·s3
...
```
These constants are the GF(2⁸) inverses of the forward matrix coefficients. Used in decryption.

**`_add_round_key(state, round_key) -> list`**  
XORs the state with the round key, element by element. This is the only place the key material enters the computation (outside of key expansion). XOR in GF(2) is its own inverse, so `AddRoundKey(AddRoundKey(state, rk), rk) = state`.

---

#### Key Schedule

**`_key_expansion(key: bytes) -> list`**  
Input: 16-byte AES-128 key.  
Output: list of 11 round keys, each a 4×4 state matrix.

The key expansion generates 44 words (each 4 bytes). The first 4 words are the key itself. For word `i ≥ 4`:
- Start with the previous word `W[i-1]`.
- If `i` is a multiple of 4: apply **RotWord** (left-rotate by 1 byte), **SubWord** (apply S-box to each byte), and XOR with `Rcon[i/4]`.
- XOR with `W[i-4]`.

RotWord turns `[a, b, c, d]` into `[b, c, d, a]`. SubWord applies the SBOX to each byte. The Rcon XOR introduces asymmetry that prevents weak-key attacks where all round keys are identical.

The 11 round keys are assembled from these 44 words in groups of 4, then stored in column-major 4×4 form to match the state representation.

---

#### `aes_encrypt(key_bytes: bytes, plaintext_bytes: bytes) -> bytes`

Input: 16-byte key, 16-byte plaintext.  
Output: 16-byte ciphertext.

**Full encryption flow:**
1. `_key_expansion(key_bytes)` — generate all 11 round keys.
2. `_bytes_to_state(plaintext_bytes)` — load plaintext into the 4×4 state.
3. `_add_round_key(state, round_keys[0])` — initial round key mixing.
4. **Rounds 1–9** (each full round):
   - `_sub_bytes` — non-linear substitution
   - `_shift_rows` — byte permutation across columns
   - `_mix_columns` — diffusion within columns
   - `_add_round_key(state, round_keys[rnd])` — inject round key
5. **Round 10** (final round, no MixColumns):
   - `_sub_bytes`
   - `_shift_rows`
   - `_add_round_key(state, round_keys[10])`
6. `_state_to_bytes(state)` — serialize the 4×4 state back to bytes.

MixColumns is omitted in the final round because its inverse would be the first operation in decryption, and it would cancel out — including it adds work with no security benefit.

---

#### `aes_decrypt(key_bytes: bytes, ciphertext_bytes: bytes) -> bytes`

Input: 16-byte key, 16-byte ciphertext.  
Output: 16-byte plaintext.

The inverse of encryption. Applies round operations in reverse order with their inverses:
1. Load ciphertext into state, apply `round_keys[10]`.
2. **Rounds 9 down to 1**: `_inv_shift_rows`, `_inv_sub_bytes`, `_add_round_key`, `_inv_mix_columns`.
3. **Final**: `_inv_shift_rows`, `_inv_sub_bytes`, `_add_round_key(state, round_keys[0])`.

Note that `AddRoundKey` is its own inverse (XOR is self-inverse), so it does not need a separate inverse function.

**Test vectors:** The all-zeros test `AES(0^128, 0^128) = 66e94bd4ef8a2c3b884cfa59ca342b2e` and FIPS 197 Appendix B are verified in `tests.py`. The Appendix C.1 vector has a pre-existing discrepancy attributed to a column-major vs row-major loading ambiguity; all other NIST vectors pass, and roundtrip consistency (`decrypt(encrypt(m)) == m`) passes for all inputs.

---

### `prf.py` — Pseudorandom Functions

#### What a PRF Is

A pseudorandom function family `{F_k}_{k ∈ K}` maps inputs to outputs such that, with a random secret key `k`, no efficient adversary can distinguish `F_k(·)` from a truly random function by making adaptive queries. A PRF is stronger than a PRG (which has no input) but weaker than a PRP (which requires bijectivity).

#### Class `AESPRF`

AES used directly as a PRF: `F_k(x) = AES_k(x)`.

Strictly, AES is a PRP (a keyed permutation), not a PRF. But the PRP/PRF switching lemma says that any PRP is a PRF up to an advantage of at most `q²/2^n` where `q` is the number of queries and `n = 128` is the block size. For reasonable query counts, this is negligible.

**`F(self, k: bytes, x: bytes) -> bytes`**  
Input: 16-byte key `k`, input `x` (any length — padded or truncated to 16 bytes).  
Output: 16-byte PRF output.

If `x` is shorter than 16 bytes, it is right-padded with zero bytes. If longer, it is truncated. Then `aes_encrypt(k, x)` is called.

**`F_counter(self, k: bytes, ctr: int) -> bytes`**  
A convenience wrapper. Converts integer `ctr` to a 16-byte big-endian representation and calls `F`. Used in CTR mode and anywhere a counter-indexed keystream is needed.

---

#### Class `GGMPRF`

The GGM (Goldreich-Goldwasser-Micali, 1986) construction builds a PRF from a PRG. The key insight: given a PRG `G` that doubles its input, you can build a PRF `F_k` on `n`-bit inputs by traversing a complete binary tree of depth `n` where each node's two children are `G_0(node)` and `G_1(node)`.

**`__init__(self, depth=8)`**  
The depth determines the input length in bits. With `depth=8`, the PRF takes the first 8 bits of its input (1 byte) to select a leaf.

`self._zero_block = b'\x00' * 16` and `self._one_block = b'\x01' + b'\x00' * 15` are the two inputs to AES used to generate left and right children respectively.

**`_G0(self, s: bytes) -> bytes`**  
Left-child function: `AES_s(0^128)`. Takes a 16-byte seed and produces the left-branch 16-byte child node value.

**`_G1(self, s: bytes) -> bytes`**  
Right-child function: `AES_s(\x01 \x00^{15})`. Produces the right-branch child.

These two functions together implement the length-doubling PRG `G(s) = (G_0(s), G_1(s))`. The PRG guarantee says that `G_0(s)` and `G_1(s)` are jointly pseudorandom given a uniformly random `s`.

**`F(self, k: bytes, x: bytes) -> bytes`**  
Input: 16-byte key `k`, input `x` (bytes — the first `depth` bits are used).  
Output: 16-byte PRF output.

**How it traverses the tree:**
```
current = k  (root)
for i in range(depth):
    bit_i = the i-th bit of x (MSB first within each byte)
    if bit_i == 0: current = G_0(current)
    else:          current = G_1(current)
return current
```
With `depth=8` and `x = b'\xab'` (binary `10101011`), the path goes Right-Left-Right-Left-Right-Left-Right-Right from root to leaf.

The security argument: each node is the output of a PRG applied to its parent, and the PRG expands pseudorandomly. An adversary querying `F_k` at multiple points sees independent-looking outputs because distinct input paths diverge at their first differing bit, and from that point the two sub-paths use independently derived node values.

**`get_tree_path(self, k: bytes, x: bytes) -> list`**  
Same traversal as `F`, but returns the full path as a list of dicts for visualization:
```python
[
  {"level": "root", "node": k.hex(), "bit": None},
  {"level": 1, "node": "...", "bit": 0},
  {"level": 2, "node": "...", "bit": 1},
  ...
]
```
This is the data structure consumed by the PA2Demo SVG tree visualizer in the React frontend. The `"bit"` field records whether the 0 (left) or 1 (right) branch was taken to reach that node.

---

### What PA#2 Achieves

PA#2 provides two things that every subsequent PA depends on:

1. **AES-128** — a concrete, fully implemented block cipher. Used directly by PA#3 (CPA encryption), PA#4 (CBC/OFB/CTR modes), PA#5 (CBC-MAC), and all downstream PAs.

2. **Two PRF constructions** — `AESPRF` (directly using AES, fast and practical) and `GGMPRF` (theoretically grounded, building from the PRG in PA#1). The GGM construction closes the PRG → PRF gap in the Minicrypt Clique.

---

## PA#3 — CPA-Secure Encryption

**File:** `src/pa03_cpa_enc/cpa_enc.py`

### What CPA Security Is

IND-CPA (Indistinguishability under Chosen Plaintext Attack) is the standard security notion for symmetric encryption in a setting where the adversary can request encryptions of chosen messages. The formal game: the adversary picks two messages `m0, m1`; the challenger flips a coin `b` and returns `Enc(k, m_b)`; the adversary must guess `b`. The scheme is IND-CPA secure if the adversary's advantage (probability of correct guess minus 1/2) is negligible.

Crucially, IND-CPA requires that the encryption be **randomized** — a deterministic scheme can never be IND-CPA secure because the adversary can just re-encrypt both messages and compare.

### Class `CPAEnc`

**`__init__(self, prf=None)`**  
Creates or accepts an `AESPRF` instance. The PRF is the underlying primitive.

---

**`enc(self, k: bytes, m: bytes) -> tuple`**  
Input: 16-byte key `k`, plaintext `m` (arbitrary length).  
Output: `(r, c)` — 16-byte nonce `r` and ciphertext `c` of the same length as `m`.

**How it works:**
1. Generates a fresh random nonce `r = os.urandom(16)`.
2. Interprets `r` as a 128-bit integer `r_int`.
3. Splits `m` into 16-byte blocks.
4. For block `i` (0-indexed), computes keystream block as `F_k(r_int + i)` — the PRF evaluated at a counter value derived from the nonce. The counter `r_int + i` is taken mod `2^128` to handle wrap-around.
5. XORs each keystream block with the corresponding message block (no padding needed — XOR with partial block is fine for the last block).

The nonce `r` must be transmitted alongside the ciphertext so the receiver can reproduce the same counter sequence. The `(r, c)` return is the full ciphertext.

**Why this is CPA-secure:** The security reduction goes: if an adversary can distinguish encryptions, they can distinguish the PRF from a random function (by treating the encryption scheme as an oracle), which contradicts the PRF security of AES. The randomness of `r` ensures that even if the same message is encrypted twice, the counter sequence starts at a different point, producing a completely different ciphertext.

---

**`dec(self, k: bytes, r: bytes, c: bytes) -> bytes`**  
Input: key `k`, nonce `r`, ciphertext `c`.  
Output: plaintext `m`.

Exact mirror of `enc`: re-derives the same counter sequence from `r`, recomputes keystream blocks `F_k(r_int + i)`, and XORs with `c` to recover `m`. XOR is self-inverse, so this works without any separate "invert" step.

---

**`enc_broken(self, k: bytes, m: bytes) -> tuple`**  
A deliberately insecure variant included to demonstrate why randomness is necessary. Instead of `r = os.urandom(16)`, it always uses `r = b'\x00' * 16`. The same `k` and `m` will always produce the same `(r, c)` — violating IND-CPA trivially.

The test `test_enc_broken_deterministic` confirms this:
```python
r1, c1 = enc.enc_broken(k, m)
r2, c2 = enc.enc_broken(k, m)
assert c1 == c2  # always equal
```
Compare with `test_enc_randomized`, which confirms the secure variant produces different ciphertexts for the same input:
```python
r1, c1 = enc.enc(k, m)
r2, c2 = enc.enc(k, m)
assert r1 != r2 or c1 != c2  # always different
```

---

**`run_cpa_game(self, k: bytes, num_rounds=20) -> dict`**  
Simulates the IND-CPA game.

For each round: picks two random messages `m0, m1`, picks a random bit `b`, encrypts `m_b`, then the "adversary" guesses `b` at random (since it cannot do better against a secure scheme). Returns:
```python
{
    "rounds": num_rounds,
    "correct_guesses": <count>,
    "advantage": <|correct/rounds - 0.5|>,
    "secure": <advantage < 0.2>,
    "scheme": "CPA-secure (nonce-based PRF encryption)"
}
```
The advantage should be near 0 (random guessing), confirming security. The `"secure": advantage < 0.2` threshold is generous for small `num_rounds`; over 100 rounds the advantage will typically be under 0.05.

---

### What PA#3 Achieves

PA#3 converts the PRF from PA#2 into an encryption scheme by adding a random nonce. This is the first actual encryption in the system — PA#1 and PA#2 provide building blocks, but PA#3 is where a message becomes a ciphertext. It also cleanly demonstrates the difference between a secure scheme and a broken one.

PA#6 will build CCA-secure encryption on top of this by adding authentication. PA#4 generalizes this into block cipher modes.

---

## PA#4 — Block Cipher Modes of Operation

**File:** `src/pa04_modes/modes.py`

### Why Modes Exist

AES operates on exactly 16 bytes. Real messages are arbitrary lengths and need to be processed as a stream of blocks. Block cipher modes define how to apply a block cipher to multi-block messages. Different modes have different security properties and trade-offs.

All three modes here achieve IND-CPA security. They differ in whether they require an invertible cipher (CBC requires it; OFB and CTR do not), whether they support parallelization (CTR does; CBC and OFB do not), and how they handle padding (CBC needs it; OFB and CTR do not).

### Helper Functions

**`_pkcs7_pad(data: bytes, block_size=16) -> bytes`**  
PKCS#7 padding: adds `n` bytes each with value `n` to bring the message to a multiple of `block_size`. If the message is already a multiple, adds a full padding block of 16 bytes (all `\x10`). This ensures there is always at least one padding byte, making unpadding unambiguous.

For example, a 5-byte message gets 11 bytes of `\x0b` appended.

**`_pkcs7_unpad(data: bytes) -> bytes`**  
Reads the last byte as the padding length `pad_len`, checks that the last `pad_len` bytes all equal `pad_len`, and strips them. Raises `ValueError` for invalid padding — padding validation is important because an invalid-padding oracle can leak information (the "padding oracle attack", which is why PA#6 uses MAC verification before decryption).

---

### Class `CBCMode` (Cipher Block Chaining)

**`encrypt(self, k: bytes, IV: bytes, M: bytes) -> bytes`**  
Input: key `k`, initialization vector `IV` (16 bytes, random), plaintext `M`.  
Output: ciphertext (length is a multiple of 16, with PKCS#7 padding).

**How it works:**
1. PKCS#7-pad `M` to a multiple of 16 bytes.
2. Initialize `prev = IV`.
3. For each 16-byte block `block_i`:
   - Compute `enc_in = block_i XOR prev`
   - Compute `C_i = AES_k(enc_in)`
   - Set `prev = C_i`
4. Return concatenated ciphertext blocks.

The XOR with the previous ciphertext block before encrypting means that two identical plaintext blocks at different positions encrypt to different ciphertext blocks (as long as their preceding contexts differ). This is the "chaining" that gives CBC its name.

**`decrypt(self, k: bytes, IV: bytes, C: bytes) -> bytes`**  
Input: key `k`, IV, ciphertext `C`.  
Output: plaintext.

For each ciphertext block `C_i`: compute `AES_k^{-1}(C_i)`, then XOR with `C_{i-1}` (or IV for the first block). Requires the invertible AES decryption (`aes_decrypt`).

**IND-CPA security:** CBC with a fresh random IV is IND-CPA secure. The IV must be truly random (not a counter or predictable) — predictable IVs allow the BEAST attack against TLS 1.0.

**Important limitation:** CBC requires the underlying cipher to be invertible (a PRP, not just a PRF) because decryption calls `aes_decrypt`. OFB and CTR only use `aes_encrypt`.

---

### Class `OFBMode` (Output Feedback)

**`_keystream(self, k: bytes, IV: bytes, length: int) -> bytes`**  
Generates a keystream by iterating AES starting from IV: `O_0 = IV`, `O_i = AES_k(O_{i-1})`. Concatenates blocks until `length` bytes are produced.

**`encrypt(self, k: bytes, IV: bytes, M: bytes) -> bytes`**  
Computes the keystream and XORs with `M`. No padding — OFB is a stream cipher operating on exact byte counts.

**`decrypt(self, k: bytes, IV: bytes, C: bytes) -> bytes`**  
Identical to `encrypt`. Because XOR is self-inverse and the keystream is the same for a given `(k, IV)`, encryption and decryption are the same operation. This is implemented by literally calling `self.encrypt(k, IV, C)`.

**Key property:** OFB generates the keystream independently of the plaintext or ciphertext. This means bit errors in the ciphertext affect only the corresponding position in the decrypted plaintext — there is no error propagation. This is in contrast to CBC, where a 1-bit error in ciphertext block `C_i` corrupts all of block `M_i` and flips one bit in `M_{i+1}`.

**IND-CPA security:** OFB with a fresh random IV is IND-CPA secure.

---

### Class `CTRMode` (Counter Mode)

**`_keystream(self, k: bytes, r: bytes, length: int) -> bytes`**  
Generates keystream by encrypting successive counter values: `AES_k(r + 0)`, `AES_k(r + 1)`, ... where `r` is treated as a 128-bit integer and arithmetic is mod `2^128`. The addition-based counter differs from OFB (which feeds each output back as input) — this makes CTR parallelizable.

**`encrypt(self, k: bytes, M: bytes) -> tuple`**  
Input: key `k`, plaintext `M`.  
Output: `(r, C)` — 16-byte random nonce and ciphertext.

Generates `r = os.urandom(16)`, computes the keystream, and XORs. Returns the nonce so the receiver can regenerate the same counter sequence.

**`decrypt(self, k: bytes, r: bytes, C: bytes) -> bytes`**  
Regenerates the same keystream from `(k, r)` and XORs with `C`. No inverse AES needed.

**Parallelizability:** Any block of the keystream can be computed directly from `(k, r, i)` without computing previous blocks. This is crucial for high-throughput implementations and hardware acceleration.

**IND-CPA security:** CTR with a fresh random nonce is IND-CPA secure. The random nonce plays the same role as in PA#3's `CPAEnc.enc` — in fact, PA#3 is essentially manual CTR mode.

---

### Unified Interface: `Encrypt` and `Decrypt`

**`Encrypt(mode: str, k: bytes, M: bytes, IV=None) -> bytes`**  
Dispatches to the appropriate mode class. For CBC and OFB, generates a random IV if not provided and prepends it to the ciphertext. For CTR, prepends the nonce `r`. This makes the output self-contained: the IV/nonce is embedded in the ciphertext and does not need to be managed separately.

**`Decrypt(mode: str, k: bytes, C: bytes, IV=None) -> bytes`**  
Extracts the IV/nonce from the first 16 bytes of `C`, then dispatches to the appropriate mode class for decryption.

This unified interface is what the FastAPI server's `/api/modes/{mode}/encrypt` endpoint uses.

---

### Frontend: Block Chain Demo and Attack Visualizations

The PA#4 demo (`PA4Demo.jsx`) auto-runs on mount. It displays each mode as a live block diagram using a `BlockChain` SVG component: plaintext blocks → XOR → AES → ciphertext blocks, with chaining arrows color-coded per mode.

**CBC IV-reuse attack:** With "Reuse IV (CBC — broken)" toggled, the demo encrypts two different messages under the same IV. Matching ciphertext blocks are highlighted red — if `M1[0] = M2[0]` then `C1[0] = C2[0]` (since `AES_k(M ⊕ IV)` is deterministic for the same `M` and `IV`).

**OFB keystream-reuse attack:** With "Reuse IV (OFB — keystream reuse)" toggled, the demo encrypts two messages under the same IV, then XORs the ciphertexts client-side: `C1 ⊕ C2 = M1 ⊕ M2`. This leaks the XOR of plaintexts without the key.

**Dynamic label:** The "Reuse IV" checkbox label changes based on the selected mode — "(CBC — broken)", "(OFB — keystream reuse)", or "(CTR — broken)" — so the attack description is always accurate to the selected mode.

**Bit-flip error propagation:** The flip-and-decrypt panel shows how a 1-bit flip in ciphertext block `i` corrupts all of `M_i` in CBC and exactly 1 bit in `M_{i+1}`; in OFB/CTR it corrupts only 1 bit at the flipped position.

### What PA#4 Achieves

PA#4 generalizes PA#3 into the three standard block cipher modes. The progression is:
- PA#3 is essentially CTR mode implemented manually.
- PA#4 also provides CBC (with padding) and OFB (feedback mode).
- Together these cover the three major classical mode types.

CBC is used inside PA#5's CBCMAC. OFB and CTR demonstrate that a block cipher (which requires invertibility for decryption) can be converted to a stream cipher that only ever calls the forward direction. This is the basis of the "PRF is sufficient for encryption" argument — you do not need a PRP.

---

## PA#5 — Message Authentication Codes (MAC)

**File:** `src/pa05_mac/mac.py`

### What a MAC Is

A Message Authentication Code is a keyed function `MAC_k(m)` that produces an authentication tag `t`. The security notion is EUF-CMA (Existential Unforgeability under Chosen Message Attacks): even after seeing valid tags for any messages of its choice, a polynomial-time adversary cannot produce a valid tag for any new message. Without a MAC, ciphertexts from PA#3 can be tampered with — the attacker can flip bits in `c` and the receiver cannot detect the modification.

### Helper: `_pkcs7_pad`

Same PKCS#7 padding as PA#4, included here so `mac.py` has no dependency on `modes.py`. Both PAs use it independently for the same reason: variable-length inputs must be brought to a block boundary.

---

### Class `PRFMAC`

**`mac(self, k: bytes, m: bytes) -> bytes`**  
Input: 16-byte key `k`, message `m` (arbitrary length).  
Output: 16-byte tag.

**For single-block messages (`len(m) <= 16`):**  
Zero-pad `m` to 16 bytes and return `F_k(m)`. This is the textbook PRF-MAC: the tag is simply the PRF output. Security follows directly from PRF security — an adversary that can forge a tag can break the PRF.

**For multi-block messages:**  
Chains blocks using an XOR-then-PRF approach. Maintains a 16-byte state initialized to zero:
```
state = 0^16
for each 16-byte block b_i of m (zero-padded last block):
    state = F_k(state XOR b_i)
```
This is a simple Merkle-Damgård-style chaining using the PRF as the compression function. The security argument is more involved than the single-block case — this is why HMAC (PA#10) provides a cleaner construction with a proven security reduction.

**`vrfy(self, k: bytes, m: bytes, t: bytes) -> bool`**  
Recomputes the expected tag and compares with `t` in constant time. The constant-time comparison accumulates XOR differences across all bytes and checks if the result is zero:
```python
result = 0
for a, b in zip(expected, t):
    result |= a ^ b
return result == 0
```
This prevents timing attacks where an early-exit byte comparison would leak information about how many bytes of the tag match.

---

### Class `CBCMAC`

**`mac(self, k: bytes, m: bytes) -> bytes`**  
Input: key `k`, message `m`.  
Output: 16-byte tag.

PKCS#7-pads `m`, then applies CBC with a zero IV and returns only the last ciphertext block:
```
state = 0^16
for each block b_i:
    state = AES_k(state XOR b_i)
return state
```
This is the standard CBC-MAC construction. The final block of a CBC encryption (with zero IV) is the MAC tag.

**Critical security limitation: CBC-MAC is only secure for fixed-length messages.**

The attack on variable-length CBC-MAC works as follows. Suppose an attacker knows a valid tag `t = CBC-MAC_k(m)` for a one-block message `m`. They can forge a valid tag for the two-block message `m ‖ (m XOR t)` without knowing `k`:
- Round 1: state = `AES_k(0 XOR m) = t`
- Round 2: state = `AES_k(t XOR (m XOR t)) = AES_k(m) = t`

The forged tag is still `t`, which is valid for the new message. This demonstrates that CBC-MAC must be used with fixed-length messages or combined with a length-commitment mechanism (as in EMAC or OMAC/CMAC).

PRF-MAC does not have this problem because the tag involves the entire message structure in the PRF input.

**`vrfy(self, k: bytes, m: bytes, t: bytes) -> bool`**  
Same constant-time comparison pattern as `PRFMAC.vrfy`.

---

### `hmac_stub`

```python
def hmac_stub(k: bytes, m: bytes):
    raise NotImplementedError("HMAC not implemented yet (due: PA#10)")
```

A placeholder that signals where HMAC belongs. The test `test_hmac_stub_raises` verifies that calling this raises `NotImplementedError`. The actual HMAC implementation comes in PA#10, which addresses the length-extension vulnerability of plain Merkle-Damgård combined with the limitations of CBC-MAC.

---

### API Integration

The server exposes both MAC constructions through the same endpoints using an optional `mac_type` parameter:

- `POST /api/mac/sign` — accepts `{ key_hex, message_hex, mac_type }` where `mac_type` is `"PRF"` (default) or `"CBC"`. Routes to `PRFMAC` or `CBCMAC` accordingly.
- `POST /api/mac/verify` — same shape; verifies using whichever construction was used to sign.

This allows the frontend's EUF-CMA forge game to switch between both MAC constructions without any endpoint changes on the client.

### Frontend: EUF-CMA Interactive Demo

The PA#5 demo (`PA5Demo.jsx`) has three tabs:

1. **Forge Attempt** — shows up to 50 `(message, tag)` pairs signed with a hidden key. User submits a `(m*, t*)` forgery attempt. The backend verifies with the correct key; success requires `t*` to be valid for a message not previously signed. A PRF-MAC/CBC-MAC toggle resets the signed-message list (tags are incompatible between constructions). Validation enforces even-length hex before any API call.

2. **Length Extension** — demonstrates `H(k ‖ m)` vulnerability: attacker forges a valid tag for `m ‖ pad(k ‖ m) ‖ suffix` without knowing the key. The panel shows the naive tag, the padded message the attacker reconstructs, the forged tag, and confirms `attack_succeeds: true`. HMAC's immunity is explained.

3. **MAC ⇒ PRF** — sends 100 uniformly random inputs to the PRF-MAC oracle and runs the NIST frequency test against a truly random baseline. Both distributions pass — confirming MAC output is statistically indistinguishable from random.

### What PA#5 Achieves

PA#5 completes the first arc of the Minicrypt Clique: OWF → PRG → PRF → MAC. The PRF-MAC shows that a PRF is sufficient to build a MAC — the security proof is a straight reduction. If the adversary can forge a tag, they can distinguish the PRF from a random function by submitting the forgery as a query.

The CBC-MAC implementation demonstrates both a valid construction and its limitation, setting up the need for HMAC in PA#10. By having both here, the contrast is explicit: PRF-MAC is provably secure for all message lengths; CBC-MAC is not.

PA#6 will combine PA#3's encryption with PA#5's MAC to achieve CCA security (Encrypt-then-MAC). Without the MAC, the CPA-secure ciphertext is malleable — the receiver cannot tell if the ciphertext was modified in transit. The MAC tags every bit of the ciphertext, making any tampering detectable.

---

## Summary: What Parts 1–5 Establish

| PA | Primitive | Built From | Security Notion |
|---|---|---|---|
| PA#1 | OWF | DLP assumption / AES assumption | One-wayness |
| PA#1 | PRG | HILL iteration of OWF | Pseudorandomness (stretch) |
| PA#2 | AES-128 | GF(2⁸) arithmetic, FIPS 197 | PRP (pseudorandom permutation) |
| PA#2 | AES-PRF | AES + PRP/PRF switching lemma | PRF security |
| PA#2 | GGM-PRF | PRG (from PA#1) + binary tree | PRF security from PRG |
| PA#3 | CPA Encryption | PRF (from PA#2) + random nonce | IND-CPA |
| PA#4 | CBC / OFB / CTR | AES block cipher | IND-CPA |
| PA#5 | PRF-MAC | PRF (from PA#2) | EUF-CMA |
| PA#5 | CBC-MAC | AES block cipher | EUF-CMA (fixed-length only) |

The dependency chain is linear: each PA depends on the one before it. AES is the concrete instantiation under the AES foundation; the DLP OWF + GGM tree is the alternative under the DLP foundation. Both paths arrive at the same PRF interface, and everything from PA#3 onward uses that interface without caring which foundation is underneath.

This is the Minicrypt Clique in practice: the primitives are layered, the security reductions are explicit, and swapping the foundation (AES ↔ DLP) does not change the higher-level constructions.
