# Viva Preparation — Questions & Answers

All 20 PAs covered. Questions are organized by PA with cross-cutting sections at the end. Every question targets conceptual understanding, design reasoning, or security analysis — the kind of question you will actually be asked in a viva.

---

## PA01 — One-Way Functions and PRG

**Q1. What is a one-way function? Give the formal definition.**

A function `f` is one-way if it is (i) easy to compute — runs in polynomial time — and (ii) hard to invert on average — for any PPT adversary `A`, the probability that `A(f(x))` outputs an `x'` with `f(x') = f(x)` is negligible in the security parameter, when `x` is chosen uniformly at random.

"Hard to invert" is a hardness assumption, not a theorem. We believe it holds for specific functions (DLP, integer factorization) based on decades of failed cryptanalysis, but it is not proven.

---

**Q2. Why is a one-way function the weakest assumption in Minicrypt? What can you build from it?**

OWFs are the minimal assumption for symmetric cryptography. The HILL theorem (1999) shows: if a OWF exists, a PRG exists. From a PRG, you can build a PRF (GGM construction). From a PRF, you can build CPA-secure encryption, MAC, and eventually everything else. Conversely, if CPA-secure encryption exists, a OWF must exist (any secure encryption scheme implies a OWF). So OWFs are both necessary and sufficient for Minicrypt.

---

**Q3. What is the DLP-based OWF? Why is it believed to be one-way?**

`f(x) = g^x mod p` where `p` is a safe prime and `g` generates the prime-order subgroup. Computing `f(x)` is fast — a single modular exponentiation via square-and-multiply in `O(log x)` multiplications. Inverting it — finding `x` from `g^x mod p` — is the Discrete Logarithm Problem. The best classical algorithm (BSGS or Number Field Sieve) runs in sub-exponential but still super-polynomial time for large `p`. No polynomial-time algorithm is known.

---

**Q4. What is the Davies-Meyer construction? How does it make AESOWF one-way?**

Davies-Meyer: `f(k) = AES_k(0^128) XOR k`. Encryption under key `k` of a fixed plaintext (all-zeros block), XORed with `k` itself. The XOR (feed-forward) prevents simple inversion: if you know `y = AES_k(0) XOR k`, computing `k` requires solving `AES_k(0) = y XOR k`, a fixed-point equation in `k`. Under the assumption that AES behaves as an ideal cipher (random permutation family), this has no efficient solution.

---

**Q5. What is a PRG? What does "expansion" mean, and why does it matter?**

A PRG takes a short uniformly random seed `s` and stretches it to a longer output `G(s)` such that `G(s)` is computationally indistinguishable from a uniformly random string of the same length. Expansion means `|G(s)| > |s|` — the output is strictly longer than the seed. This matters because truly random strings of any length are information-theoretically impossible to generate from a shorter seed, yet pseudorandom ones are computationally indistinguishable, which is sufficient for all cryptographic purposes.

---

**Q6. How does the DLP-based PRG extract pseudorandom bits? Why is the LSB a hard-core predicate?**

Starting from seed `x`, the state advances as `x_{i+1} = g^{x_i} mod p` (the DLP OWF) and outputs `LSB(x_i)` at each step. The LSB is a hard-core predicate for the DLP OWF: if you could predict the LSB of `x` from `g^x mod p` with non-negligible advantage, you would gain partial information about the discrete logarithm of `g^x`, which contradicts DLP hardness (via the Goldreich-Levin argument). The bit-by-bit extraction is very slow — 256 exponentiations for 32 output bytes.

---

**Q7. Why is AES-CTR the preferred PRG mode over the DLP construction?**

Performance: AES-CTR generates 16 bytes per AES call (one fast fixed-key block cipher evaluation). The DLP construction generates 1 bit per full modular exponentiation — approximately 256x slower per output byte for 32-bit groups. AES-CTR is the NIST SP 800-90A standard DRBG construction. The DLP mode exists for theoretical demonstration of the HILL direction (OWF → PRG), not for practical use.

---

## PA02 — AES-128 and PRFs

**Q8. What is AES? What are the four round transformations and what does each achieve?**

AES is a block cipher (PRP) specified in FIPS 197. It operates on a 4×4 byte state in `N_r` rounds (10 for AES-128). The four operations:

1. **SubBytes** — applies the S-box non-linearly to every byte. This is the only non-linear step; without it AES is a linear map over GF(2) and trivially broken.
2. **ShiftRows** — cyclically rotates rows left by 0, 1, 2, 3 positions respectively. Spreads bytes across columns for MixColumns to mix.
3. **MixColumns** — multiplies each column by a fixed polynomial in GF(2⁸). Provides diffusion — each input byte affects all 4 output bytes of the column.
4. **AddRoundKey** — XORs the state with the round key. This is the only place key material enters.

The last round omits MixColumns because its inverse would cancel with InvMixColumns at the start of decryption, adding no security.

---

**Q9. What is GF(2⁸) and why does AES use it?**

GF(2⁸) is the finite field with 256 elements, represented as degree-7 polynomials over GF(2) (i.e., 8-bit values). Addition is XOR; multiplication is polynomial multiplication modulo the irreducible polynomial `x^8 + x^4 + x^3 + x + 1` (0x11b). AES uses it because:
- All arithmetic stays within bytes (no carry overflow).
- The field structure gives well-defined inverses for every non-zero element, which is required for both the S-box and MixColumns.
- Operations can be implemented efficiently in hardware and software with lookup tables or `xtime`.

---

**Q10. What is the state representation in this AES implementation? What is column-major loading?**

The state is a 4×4 list of bytes `state[row][col]`. Column-major loading means byte `i` of the input goes to position `state[i mod 4][i // 4]` — filling columns before rows. So bytes 0–3 fill column 0 top-to-bottom, bytes 4–7 fill column 1, etc. This matches FIPS-197 §3.4 exactly. Getting this wrong produces incorrect encryption output even if the round transformations are correct.

---

**Q11. Why does the final round of AES omit MixColumns?**

Because the decryption algorithm would need to undo it with InvMixColumns as its first step, which would cancel the extra work. Including MixColumns in the final round and InvMixColumns in decryption's initial step adds computation without affecting security — the output ciphertext is just a different permutation of the state, but the same entropy. Omitting it saves one full MixColumns call (encryption) and one InvMixColumns call (decryption) with zero security loss.

---

**Q12. What is the difference between a PRF and a PRP? Why can AES (a PRP) be used as a PRF?**

A **PRF** (Pseudorandom Function) is a keyed function that is computationally indistinguishable from a random function. Any input maps to a pseudorandom output but there is no requirement on bijectivity. A **PRP** (Pseudorandom Permutation) is a keyed bijection that is computationally indistinguishable from a random permutation — a bijective PRF.

AES is a PRP. It can be used as a PRF via the **PRP/PRF switching lemma**: the statistical distance between a random permutation and a random function is at most `q²/2^n` where `q` is the number of queries and `n = 128` is the block size. For `q ≪ 2^64`, this is negligible, so AES behaves like a PRF for all practical purposes.

---

**Q13. How does the GGM construction turn a PRG into a PRF? Why is it secure?**

Given a length-doubling PRG `G` with `G(s) = (G_0(s), G_1(s))`, define `F_k(x)` by traversing a binary tree of depth `n`: start at root `k`, at each bit `x_i` go left (`G_0`) if 0 or right (`G_1`) if 1. The leaf value is the PRF output.

Security: two distinct inputs `x ≠ x'` diverge at their first differing bit, say bit `i`. From that point on, the two paths use independently derived subtree roots — values derived from different children of the divergence node. Since `G_0` and `G_1` are jointly pseudorandom, the two outputs are independently pseudorandom. Formally, the proof proceeds by a hybrid argument over the tree levels, using PRG security at each level.

---

## PA03 — CPA-Secure Encryption

**Q14. What is IND-CPA security? Why does it require randomized encryption?**

IND-CPA (Indistinguishability under Chosen Plaintext Attack): an adversary who can request encryptions of any messages of their choice cannot distinguish `Enc(k, m0)` from `Enc(k, m1)` for any messages `m0, m1` of their choice. More precisely, the adversary's advantage — probability of correctly guessing which message was encrypted minus 1/2 — must be negligible.

Deterministic encryption can never be IND-CPA: the adversary just re-encrypts both `m0` and `m1` themselves, compares to the challenge ciphertext, and wins with advantage 1. The fresh random nonce `r` in `CPAEnc.enc` ensures the same message encrypts to different ciphertexts every time, making re-encryption useless.

---

**Q15. How does CPAEnc work? Why is it CPA-secure?**

`enc(k, m)`: generate `r = os.urandom(16)`, compute keystream as `F_k(r_int + i)` for each block `i`, XOR with message blocks. Return `(r, c)`.

Security: if an adversary can distinguish `Enc(k, m0)` from `Enc(k, m1)`, they can distinguish the PRF `F_k` from a random function. Formally: construct a distinguisher that uses the adversary as a subroutine — give the adversary a "challenge" that uses the queried function instead of the real `F_k`. If the PRF is secure, the adversary's advantage must be negligible. The random `r` ensures distinct nonces with overwhelming probability, so the counter ranges for different encryptions don't overlap.

---

**Q16. What does enc_broken demonstrate? Why is a fixed nonce catastrophic?**

`enc_broken` always uses `r = 0x00...00`. Two encryptions of the same message produce the same `(r, c)` pair — the scheme is deterministic. An adversary submitting `m0` and `m1` to the encryption oracle, then seeing the challenge ciphertext, just checks which one matches — advantage 1.

Even worse: two different messages encrypted with the same nonce produce ciphertexts `c1 = m1 XOR KS` and `c2 = m2 XOR KS` where `KS` is the same keystream. XORing the ciphertexts gives `c1 XOR c2 = m1 XOR m2` — directly leaking the XOR of the plaintexts, a devastating break even without knowing the key.

---

## PA04 — Block Cipher Modes

**Q17. What are the three modes implemented? How do they differ in error propagation?**

- **CBC (Cipher Block Chaining):** ciphertext block `C_i = AES_k(M_i XOR C_{i-1})`. A single-bit error in `C_i` corrupts the entire decrypted block `M_i` (AES maps it to garbage) and flips exactly the corresponding bit in `M_{i+1}` (via the XOR). Error propagates to exactly 2 blocks.

- **OFB (Output Feedback):** keystream `O_i = AES_k(O_{i-1})` is independent of plaintext/ciphertext. A bit error in `C_i` flips only the corresponding bit in `M_i` — no error propagation to other blocks.

- **CTR (Counter Mode):** keystream `KS_i = AES_k(r + i)`. Same as OFB: a bit error in `C_i` flips only bit `i` in the plaintext. No propagation.

---

**Q18. Why does CBC require an invertible cipher (PRP) while OFB and CTR only need a PRF?**

CBC decryption computes `M_i = AES_k^{-1}(C_i) XOR C_{i-1}` — it explicitly calls the inverse cipher. If you only had a PRF (which has no defined inverse), CBC decryption would be impossible.

OFB and CTR only ever call the forward direction: `AES_k(O_{i-1})` or `AES_k(r + i)`. The keystream is generated by forward evaluations of the cipher, and decryption XORs the same keystream with the ciphertext — no inverse needed. This means OFB and CTR can be built from a PRF rather than requiring a full PRP.

---

**Q19. Why must the CBC IV be uniformly random? What attack succeeds with a predictable IV?**

With a predictable IV, the **BEAST attack** (Browser Exploit Against SSL/TLS) applies. If Eve can predict the IV for the next CBC encryption and knows the previous ciphertext block `C_{i-1}`, she can craft a plaintext `m' = m XOR C_{i-1} XOR IV'` such that `AES_k(m' XOR IV') = AES_k(m XOR C_{i-1})` — which matches the ciphertext of `m` under the original IV. This allows the adversary to test whether the plaintext is a specific value, breaking IND-CPA. TLS 1.0 was vulnerable to this because it used the last ciphertext block as the next IV.

---

**Q20. What is PKCS#7 padding? Why is a full padding block added when the message already fills a block?**

PKCS#7 padding appends `n` bytes each with value `n`, where `n` is chosen so the total length is a multiple of the block size. If the message is already a block-size multiple, a full 16-byte block of `\x10` (decimal 16) is appended.

This is necessary for unambiguous unpadding: the last byte always tells you how many bytes to strip. Without the full padding block, a message ending in `\x01` could be misinterpreted as a 1-byte padding — there would be no way to tell if `\x01` is a data byte or a padding byte. The full extra block ensures there is always at least one padding byte, making the rule unambiguous.

---

## PA05 — MAC

**Q21. What is EUF-CMA security? How does PRF-MAC achieve it?**

EUF-CMA (Existential Unforgeability under Chosen Message Attack): even after seeing valid tags on any messages of the adversary's choice, the adversary cannot produce a valid tag on any new message (one not previously queried).

PRF-MAC: `tag = F_k(m)` (single block). Security: suppose an adversary forges a tag on a new message `m*`. They submit `m*` and get a valid tag `t* = F_k(m*)`. But since `m*` was never queried to the MAC oracle, the adversary must have predicted `F_k(m*)` — the output of the PRF on a new input, which is indistinguishable from random. This contradicts PRF security. The reduction is a straight one-to-one: any MAC forger is a PRF distinguisher.

---

**Q22. Why is CBC-MAC only secure for fixed-length messages? Describe the extension attack.**

Suppose Alice sends tag `t = CBC-MAC_k(m)` for a single-block message `m`. An attacker who sees `(m, t)` can forge a valid tag for the two-block message `m ‖ (m XOR t)`:
- Block 1: `AES_k(0 XOR m) = t`.
- Block 2: `AES_k(t XOR (m XOR t)) = AES_k(m) = t`.

The tag for the new two-block message is still `t` — valid without knowing `k`. This attack works because the tag for message `m` doubles as the intermediate state from which the attacker can continue the chain. Fixes: EMAC (encrypt the final block with a second key), OMAC/CMAC (key-dependent masking of the final block), or HMAC.

---

**Q23. Why does MAC verification use constant-time comparison instead of Python's `==`?**

Python's `==` on byte strings short-circuits: it returns `False` as soon as it finds the first differing byte. This timing leak tells an attacker how many bytes of their forged tag match the correct one. By making repeated queries and measuring response times, they can recover the correct tag byte by byte — one byte at a time with at most 256 guesses per byte (a timing oracle attack). Constant-time XOR accumulation (`diff |= a ^ b` over all bytes) takes the same time regardless of where the mismatch occurs.

---

## PA06 — CCA Encryption

**Q24. What is IND-CCA2 security? How does it differ from IND-CPA?**

IND-CCA2 (Indistinguishability under Adaptive Chosen Ciphertext Attack 2): the adversary has access to a decryption oracle throughout the game, and can submit any ciphertext except the challenge ciphertext itself for decryption. The scheme must still hide the encrypted message.

IND-CPA only prevents passive eavesdropping (observing encryptions). IND-CCA2 additionally covers active attacks where the adversary can probe the decryption process. A CPA-secure scheme is malleable — the adversary can modify a ciphertext and use the decryption oracle to learn about the plaintext. CCA2 security prevents this by requiring that any modified ciphertext is rejected.

---

**Q25. Why is Encrypt-then-MAC CCA2-secure? Why is MAC-then-Encrypt not?**

**EtM (Encrypt-then-MAC):** The MAC covers the ciphertext. Any modification to the ciphertext invalidates the tag, so the decryption oracle rejects modified ciphertexts with overwhelming probability. A CCA2 adversary submitting a modified ciphertext gets only `None` — zero information leaks. Security proof: combine IND-CPA of the encryption and EUF-CMA of the MAC.

**MtE (MAC-then-Encrypt):** The MAC is computed on the plaintext, then both are encrypted together. The adversary might modify the ciphertext in ways that, after decryption, produce something whose MAC the adversary can compute or whose structure they can exploit. The padding oracle attack against MAC-then-Encrypt SSL/TLS is a concrete example: malformed padding leaks information even when the MAC check fails later.

---

**Q26. Why must verification happen before decryption in CCA decryption?**

If decryption runs first and then the MAC is checked, the decryption process itself may leak information: error messages, decryption time, or partial output before the MAC check. A CCA2 adversary can use these signals as a side channel, submitting modified ciphertexts and observing decryption behavior. Checking the MAC first and returning `None` immediately on failure means no decryption state is ever computed for invalid ciphertexts — the oracle is completely blind to malformed inputs.

---

**Q27. What exactly does the MAC cover in CCAEnc? Why does it cover both r and c?**

The MAC is computed over `CE = r ‖ c` — the concatenation of the nonce and the ciphertext. If it covered only `c` and not `r`, an attacker could flip bits in `r` (changing the counter starting point) while keeping the same `c` and `t`. Decryption would use a different keystream, producing garbled plaintext — but without being detected. Covering `r ‖ c` as a unit means any change to either component invalidates the tag. The nonce is as much a part of the ciphertext as the encrypted bytes.

---

## PA07 — Merkle-Damgård

**Q28. What is the Merkle-Damgård theorem?**

If the compression function `h: {0,1}^{n+b} → {0,1}^n` is collision-resistant, then the iterated hash `H` constructed by applying `h` repeatedly with MD-strengthening padding is also collision-resistant.

Proof idea: any collision in `H` (two messages `m ≠ m'` with `H(m) = H(m')`) implies a collision in `h`. If the padded messages have different lengths they differ in their last (length-encoding) block, so the compression chains must have diverged at some point and converged — find the earliest such point, and those two compression calls are a collision in `h`. If they have the same padded length, trace backward through the chains to find the first block where a collision in `h` must have occurred.

---

**Q29. What is Merkle-Damgård strengthening? Why is the message length encoded in the padding?**

MD strengthening appends the original message length (as a fixed-size integer) in the last padding block. Without it, two messages of different lengths could produce the same padded block sequence and trivially collide. Specifically: `H("a") = H("a" ‖ 0x80)` would be possible if both padded to the same block boundary.

The length field also makes prefix-free padding: no padded message is a prefix of another padded message (since they encode different lengths). This enables the Merkle-Damgård theorem's proof to go through — the collision structure in `H` can be mapped cleanly to a collision in `h`.

---

**Q30. What is the length-extension attack? Which MAC constructions are vulnerable?**

Given `H(m)` (output of a Merkle-Damgård hash), an attacker who knows the message length can compute `H(m ‖ pad(m) ‖ suffix)` for any `suffix` without knowing any key. This is because `H(m)` is the MD state after processing `m ‖ pad(m)` — the attacker just resumes the chain from that state and processes `suffix`.

Vulnerable: any MAC of the form `H(k ‖ m)` or `H(m ‖ k)` using a plain MD hash. `H(k ‖ m)` is directly attacked (attacker extends `m`). `H(m ‖ k)` requires the attacker to append after the key, which requires knowing `k` — so it is less obviously broken but has other issues.

Not vulnerable: HMAC. The double-nested structure (`H(opad ‖ H(ipad ‖ m))`) means the outer hash starts from the IV, not from the inner hash output — there is nothing to "extend" from the attacker's perspective.

---

## PA08 — DLP Hash

**Q31. What is the DLP hash compression function? Why is collision resistance reducible to DLP?**

`h(state, block) = g^x · ĥ^y mod p` where `x = state mod q`, `y = block mod q`, and `ĥ = g^α mod p` for a secret (discarded) `α`.

If you find a collision `(x1, y1) ≠ (x2, y2)` such that `g^x1 · ĥ^y1 = g^x2 · ĥ^y2 mod p`, then:
```
g^(x1-x2) = ĥ^(y2-y1) = g^(α(y2-y1)) mod p
→ x1-x2 ≡ α(y2-y1) mod q
→ α ≡ (x1-x2)(y2-y1)^(-1) mod q   (assuming y1 ≠ y2)
```
The collision yields `α = log_g(ĥ)` — the discrete logarithm of `ĥ`. This contradicts DLP hardness. So finding collisions is at least as hard as solving DLP. The security reduction is tight and assumption-explicit, unlike the AES-based compression which requires the ideal cipher assumption.

---

**Q32. Why is α discarded after setup? What happens if α is known?**

If `α` is known, the collision resistance collapses entirely. Given any `(x1, y1)`, one can trivially compute a second pre-image: choose any `y2 ≠ y1`, then `x2 = x1 + α(y1 - y2) mod q` gives `h(x2, y2) = h(x1, y1)`. The trapdoor `α` is a backdoor that allows manufacturing collisions on demand. In a real deployment, `α` is generated randomly and immediately discarded (or burned), simulating a trustworthy setup. The toy fixed value `α = 1337` is only for reproducible tests.

---

## PA09 — Birthday Attack

**Q33. What is the birthday paradox, and how does it apply to hash functions?**

The birthday paradox: in a room of 23 people, the probability that two share a birthday exceeds 50%. Formally, after sampling `k` values from a universe of size `N`, the probability of a collision exceeds 50% once `k ≈ √(2N)` — the square root of the universe size.

For a hash with `n`-bit output: universe size is `2^n`. Collision expected after `√(2^n) = 2^(n/2)` evaluations. This is independent of the hash construction — it follows from the pigeonhole principle. Consequence: a hash with 128-bit output provides only 64-bit collision resistance. SHA-256 (256-bit output) provides 128-bit collision resistance. Any 16-bit toy hash is trivially broken in ~256 calls.

---

**Q34. How does Floyd's cycle-detection algorithm find hash collisions in O(1) memory?**

The hash function `f: {0..2^n-1} → {0..2^n-1}` must eventually revisit a value (finite domain). The sequence `x, f(x), f(f(x)), ...` forms a rho (ρ) shape: a tail leading into a cycle. Floyd's algorithm uses two pointers (tortoise: 1 step/round, hare: 2 steps/round) to find where they meet inside the cycle, then uses a second pass to locate the cycle entry, then measures the cycle length. The collision comes from the last element of the tail and the last element of the cycle — both map to the cycle entry, and they are distinct. Memory: only two integer variables. Time: `O(μ + λ)` calls to `f`.

---

**Q35. What does the ratio (evaluations / expected) tell you empirically?**

It confirms that the birthday bound is tight. If the ratio clusters near 1.0 across different `n` values, it means real-world collision finding costs approximately `2^(n/2)` evaluations — not better, not worse. A ratio significantly below 1 would indicate a structural weakness in the hash (collision clustering). A ratio significantly above 1 would indicate an unusually collision-free hash (possible over-engineering, but not a security concern). Seeing ratio ≈ 1 across 8, 10, 12, 14, 16-bit hashes empirically validates the birthday analysis.

---

## PA10 — HMAC

**Q36. What are ipad and opad, and why are they different?**

`ipad = 0x36` repeated `block_size` times, `opad = 0x5C` repeated `block_size` times (per RFC 2104). They are XORed with the padded key to derive two independent-looking keys `k1 = k XOR ipad` and `k2 = k XOR opad`. Their values were chosen so that `ipad XOR opad = 0x6A` has approximately half its bits set — ensuring `k1` and `k2` differ significantly in every bit position. This independence is what makes the inner and outer hash computations use effectively different keys, so compromising one does not compromise the other.

---

**Q37. Write out the full HMAC computation.**

```
k_padded = k  if len(k) <= 64  else  H(k)      # normalize key
k_padded = k_padded.ljust(64, b'\x00')          # zero-pad to 64 bytes

ikey = bytes(b ^ 0x36 for b in k_padded)       # inner key
okey = bytes(b ^ 0x5C for b in k_padded)       # outer key

inner = H(ikey ‖ m)                             # inner hash
outer = H(okey ‖ inner)                         # outer hash = HMAC tag
```

---

**Q38. Why does HMAC resist length extension attacks?**

The length-extension attack on `H(k ‖ m)` works by resuming the MD chain from `H(k ‖ m)` (which is the MD state after `k ‖ m ‖ pad`). For HMAC, the inner hash `inner = H(ikey ‖ m)` could in theory be extended. But the output of HMAC is the **outer** hash `H(okey ‖ inner)`. An attacker who knows `inner` cannot extend the outer hash because the outer hash computes `H` starting from the IV, processing `okey ‖ inner` as a new message — the attacker does not know the MD state after processing `okey`. To extend, they would need the MD state partway through the outer hash computation, which they don't have. So length extension is blocked structurally.

---

**Q39. What is EtHEnc? How does it improve on CCAEnc from PA06?**

Both use Encrypt-then-MAC with two independent keys. The difference is the MAC: CCAEnc uses CBC-MAC, EtHEnc uses HMAC.

CBC-MAC is only EUF-CMA secure for fixed-length messages. In CCAEnc, `r ‖ c` happens to have a predictable length structure (since `r` is always 16 bytes and `c` has the same length as the plaintext), so it works in practice. But HMAC is EUF-CMA secure for all message lengths without restriction, giving a cleaner and stronger security guarantee. EtHEnc also benefits from HMAC's length-extension resistance, making it more robust against implementations that might accidentally use the MAC in a vulnerable way.

---

## PA11 — Diffie-Hellman

**Q40. How does the DH key exchange work? What exactly gets exchanged publicly?**

Setup: public parameters `(p, q, g)` — a safe prime, its cofactor, and a group generator.

1. Alice samples private `a`, sends `A = g^a mod p`.
2. Bob samples private `b`, sends `B = g^b mod p`.
3. Alice computes `K = B^a = g^(ba) mod p`.
4. Bob computes `K = A^b = g^(ab) mod p`.

Both arrive at `g^(ab) mod p` without either knowing the other's private exponent. What is publicly visible: `A`, `B`, and the group parameters. Eve sees `g^a` and `g^b` but cannot compute `g^(ab)` without solving the CDH problem.

---

**Q41. What is the CDH problem? What is the DDH problem? How do they relate to DH security?**

**CDH (Computational DH):** Given `g`, `g^a`, `g^b`, compute `g^(ab)`. If CDH is hard, DH key exchange is secure against passive adversaries — they cannot compute the shared secret.

**DDH (Decisional DH):** Given `g`, `g^a`, `g^b`, `g^c`, decide whether `c = ab mod q` (real DH tuple) or `c` is random. If DDH is hard, ElGamal encryption is IND-CPA secure — the ciphertext `(g^r, m · h^r)` is indistinguishable from `(g^r, random)`.

Hardness hierarchy: DLP → CDH → DDH. DLP hard implies CDH hard implies DDH hard. (Inverses not necessarily true.) In practice, all three are believed hard in prime-order subgroups of safe-prime groups.

---

**Q42. Why is the Diffie-Hellman protocol vulnerable to MITM? What does authentication solve?**

DH provides no authentication — neither party can verify the other's identity. Eve intercepts `A` and `B`, substitutes her own `E = g^e` to both, and shares `K_A = A^e = g^(ae)` with Alice and `K_B = B^e = g^(be)` with Bob. Both Alice and Bob believe they share a key with each other, but they actually share different keys with Eve.

Authentication (e.g., signing the public value with a long-term identity key) solves this: Alice signs `A` with her private signing key; Bob verifies using Alice's certified public key. Eve cannot forge the signature. This is the station-to-station (STS) protocol and the basis of TLS certificate-based handshakes.

---

**Q43. Why do we use a safe prime p = 2q + 1 instead of an arbitrary prime?**

The order of `Z_p*` is `p - 1 = 2q`. If `p - 1` had only small prime factors, the **Pohlig-Hellman algorithm** would decompose the DLP into subproblems modulo each small factor and solve each efficiently. With `p - 1 = 2q` where `q` is a large prime, the only non-trivial subgroup has order `q` — which is large by construction — and Pohlig-Hellman provides no speedup. Working in the prime-order-`q` subgroup (by choosing generators with `g^q ≡ 1`) ensures the DLP hardness is `O(sqrt(q))` even for the best known algorithms.

---

## PA12 — RSA

**Q44. How is an RSA key pair generated? What are dp, dq, q_inv used for?**

1. Generate two distinct large primes `p`, `q` of `bits/2` each.
2. `N = p * q`, `phi(N) = (p-1)(q-1)`.
3. Choose public exponent `e = 65537` (standard).
4. Compute private exponent `d = e^(-1) mod phi(N)`.
5. Precompute CRT parameters:
   - `dp = d mod (p-1)` — by Fermat: `c^d mod p = c^(dp) mod p`.
   - `dq = d mod (q-1)` — similarly.
   - `q_inv = q^(-1) mod p` — for Garner's CRT recombination.

These three values enable 4x-faster decryption (Garner's algorithm) by splitting the decryption into two half-size exponentiations.

---

**Q45. Why is e = 65537 chosen as the public exponent?**

65537 = `2^16 + 1` is a Fermat prime. Its binary representation `10000000000000001` has exactly 2 set bits, meaning modular exponentiation `m^e mod N` requires only 16 squarings and 1 multiplication (rather than ~512 for a random 512-bit exponent). This makes encryption very fast. It is also large enough that `gcd(e, phi(N)) = 1` with overwhelming probability for random `p, q` (unlike `e = 3`, which can fail more often). Using `e = 3` or `e = 17` introduces the Håstad broadcast attack risk.

---

**Q46. How does CRT-based RSA decryption (Garner's algorithm) work? Why is it ~4x faster?**

```
mp = c^dp mod p     (small exponent dp ≈ bits/2, small modulus p ≈ bits/2)
mq = c^dq mod q     (same size savings)
h  = q_inv * (mp - mq) mod p
m  = mq + h * q
```

Speedup: naive `c^d mod N` has cost proportional to `len(d) × len(N)^2`. With CRT, each of the two exponentiations has cost `len(d/2) × len(N/2)^2 = (d/2)(N/2)^2`. The two together cost `2 × (d/2)(N/2)^2 = d·N^2/4` — roughly 4x less work than the naive approach.

---

**Q47. Why is textbook RSA (without padding) insecure? Name three attacks.**

1. **Deterministic:** Same message always encrypts to the same ciphertext. Any IND-CPA game is trivially won by re-encrypting the two challenge messages.

2. **Multiplicative homomorphism:** `Enc(m1) × Enc(m2) = Enc(m1·m2 mod N)`. Given `Enc(m)`, multiply by `Enc(2)` to get `Enc(2m)` — ask the decryption oracle for a "different" ciphertext to learn `2m` and thus `m`.

3. **Small message / small exponent:** If `m` is small and `e = 3`, then `m^3 < N` and the ciphertext `C = m^3` is just an integer cube root — no modular reduction — so take `m = ∛C` directly. Håstad's broadcast attack is the multi-recipient generalization.

---

**Q48. What is PKCS#1 v1.5 padding? What attack does it enable?**

PKCS#1 v1.5 encryption padding: `EM = 0x00 ‖ 0x02 ‖ PS ‖ 0x00 ‖ M` where `PS` is at least 8 random non-zero bytes. This randomizes the padded message, making encryption probabilistic.

Vulnerability: **Bleichenbacher's padding oracle attack (1998)**. A server that reveals whether a decrypted ciphertext begins with `0x00 0x02` (valid padding) is a padding oracle. Using ~1 million adaptive queries, an attacker can decrypt any ciphertext by iteratively narrowing the range of valid plaintexts. This broke SSL/TLS implementations that returned different error messages for bad padding. Defense: reject invalid padding with the same error and timing as a valid message, or switch to OAEP padding.

---

## PA13 — Miller-Rabin

**Q49. Describe the Miller-Rabin test step by step. What is the significance of s and d?**

1. Write `n - 1 = 2^s · d` with `d` odd (factor out all powers of 2 from `n-1`).
2. Pick a random witness `a` in `[2, n-2]`.
3. Compute `x = a^d mod n`.
4. If `x == 1` or `x == n-1`: this witness does not detect compositeness, continue.
5. For `j = 1` to `s-1`: square `x = x^2 mod n`. If `x == n-1`: break (witness does not detect compositeness).
6. If the loop exits without hitting `n-1`: `n` is **definitely composite** — return `"COMPOSITE"`.
7. After `k` rounds all passing: return `"PROBABLY_PRIME"`.

`s` and `d` come from Fermat's little theorem: for prime `p`, `a^(p-1) ≡ 1`, so `a^(p-1) - 1 = (a^(2^{s-1}d) - 1)(a^(2^{s-1}d) + 1) = 0 mod p`. The sequence of square roots of 1 modulo a prime can only be ±1. Miller-Rabin checks this "square root" structure — a composite cannot fake it for a randomly chosen witness.

---

**Q50. What is a Carmichael number? Why does Fermat test fail on it but Miller-Rabin does not?**

A Carmichael number `n` is a composite that satisfies `a^(n-1) ≡ 1 mod n` for all `a` with `gcd(a, n) = 1`. Example: `561 = 3 × 11 × 17`. The Fermat test would declare 561 prime for all coprime bases.

Miller-Rabin catches Carmichael numbers because it checks not just `a^(n-1) ≡ 1` but whether the sequence of square roots of `a^(n-1)` follows the pattern forced by primality. For a Carmichael number `n = p·q·...`, there exist witnesses `a` for which `a^(d) mod n` reaches neither 1 nor `n-1` in the squaring sequence — specifically, any `a` where `a mod p ≠ ±1` for some prime factor `p`. At least 3/4 of all possible witnesses are such non-trivial witnesses.

---

**Q51. What is the error probability of Miller-Rabin with k rounds? How many rounds are used here, and why?**

Each round has at most probability 1/4 of a composite passing as prime (false positive). With `k` rounds, error probability ≤ `(1/4)^k = 4^(-k)`.

`gen_prime` uses two passes: first `miller_rabin(n, 40)`, then `miller_rabin(n, 20)` — effectively 60 total rounds, giving error probability ≤ `4^(-60) ≈ 10^(-36)`. This is far below the probability of hardware failure during the computation, making it a negligible source of error in practice. For comparison, SHA-256 provides 128-bit security — `2^(-128) ≈ 10^(-39)` — so 60 rounds of Miller-Rabin gives comparable practical security to SHA-256.

---

## PA14 — CRT and Håstad's Attack

**Q52. State the Chinese Remainder Theorem. What does it guarantee?**

Let `n_0, n_1, ..., n_{k-1}` be pairwise coprime positive integers and `N = n_0 × n_1 × ... × n_{k-1}`. For any integers `a_0, ..., a_{k-1}`, there exists a **unique** integer `x` with `0 ≤ x < N` such that `x ≡ a_i mod n_i` for all `i`. Furthermore, this `x` can be computed as:
```
x = sum(a_i × M_i × (M_i^(-1) mod n_i)) mod N   where  M_i = N / n_i
```

---

**Q53. How does Håstad's broadcast attack work? What are its preconditions?**

Preconditions: (1) `e = 3` (or any small exponent), (2) the same plaintext `m` is sent to `e` different recipients with moduli `N_0, ..., N_{e-1}`, (3) textbook RSA (no padding) is used.

Attack:
1. Observe `c_i = m^3 mod N_i` for `i = 0, 1, 2`.
2. Apply CRT to get `x = m^3 mod (N_0 · N_1 · N_2)`.
3. Since `m < N_i` for all `i`, we have `m^3 < N_i^3 ≈ N_0 · N_1 · N_2`, so `m^3` is not reduced — `x = m^3` as a plain integer.
4. Compute `m = ∛x` using integer cube root.

Fix: use randomized padding (PKCS#1 v1.5 or OAEP). The padded `m` values differ across recipients, so CRT gives garbage. Alternatively, use `e = 65537`.

---

**Q54. How is the integer n-th root computed? Why not just use floating-point?**

Newton's method for integer roots: start with `x ≈ n^(1/e) + 2` (floating-point estimate with padding), iterate `x_{next} = ((e-1)·x + n // x^(e-1)) // e` until convergence (`x_{next} >= x`), then adjust to find the exact floor.

Floating-point fails for large integers because `float` has only 53 bits of mantissa. A 512-bit ciphertext would lose `~460` bits of precision, making the float estimate worthless. Newton's method in integer arithmetic (using Python's arbitrary-precision integers) converges to the exact floor with no precision loss.

---

## PA15 — Digital Signatures

**Q55. What security properties do digital signatures provide?**

1. **Authenticity:** Only the holder of the private key `d` can produce valid signatures. Anyone with the public key `(N, e)` can verify.
2. **Integrity:** Any modification to the signed message `m` changes `H(m)`, making the signature invalid.
3. **Non-repudiation:** The signer cannot later deny having signed — verification is deterministic and public, with no secret material required.

Note: signatures do NOT provide confidentiality. The signed message is typically transmitted in the clear alongside the signature.

---

**Q56. How does RSA Hash-then-Sign work? Walk through sign and verify.**

**Sign:** `sigma = H(m)^d mod N`
1. Hash: `h = H(m) mod N` (DLP hash of message, reduced to fit in `Z_N`).
2. Sign: `sigma = h^d mod N` (apply private exponent).

**Verify:** Check `sigma^e mod N == H(m) mod N`
1. Recompute: `h_expected = H(m) mod N`.
2. Recover: `h_recovered = sigma^e mod N`.
3. Valid iff `h_recovered == h_expected`.

Correctness: `sigma^e = (h^d)^e = h^(de) = h^(1 + k·phi) = h (mod N)` by RSA's fundamental theorem.

---

**Q57. Why is hashing necessary before RSA signing? What attack does it prevent?**

**Multiplicative forgery attack on raw RSA:** Given valid signatures `s1 = m1^d mod N` and `s2 = m2^d mod N`, compute `s* = s1 · s2 mod N = (m1 · m2)^d mod N`. This is a valid RSA signature on the message `m1 · m2 mod N` — without knowing `d` or ever requesting that signature.

Hashing prevents this: `H(m1 · m2) ≠ H(m1) · H(m2)` for any collision-resistant hash. So there is no relationship between the hash-based signatures that an attacker can exploit multiplicatively.

Hashing also compresses arbitrarily long messages to a fixed-size input for RSA, and reduces the "signature oracle" problem (since `H(m)^d` reveals less about `d` than `m^d` directly).

---

**Q58. What is EU-CMA security for signatures?**

Existential Unforgeability under Chosen Message Attack: even after the adversary obtains valid signatures on any messages of their choice (adaptive oracle access), they cannot produce a valid signature on any new message (one not previously queried). "Existential" means they cannot forge for even a single new message — not just specific target messages. RSA hash-then-sign achieves EU-CMA in the Random Oracle Model (treating `H` as a random oracle).

---

## PA16 — ElGamal

**Q59. How does ElGamal encryption and decryption work?**

**Setup:** Public key `(p, g, q, h)` where `h = g^x mod p`, private key `x`.

**Encrypt:** Choose ephemeral `r`, compute `(c1, c2) = (g^r mod p, m · h^r mod p)`.

**Decrypt:** Compute `s = c1^x mod p = g^(xr) mod p`, then `m = c2 / s = c2 · s^(-1) mod p`.

Correctness: `c2 · (c1^x)^(-1) = (m · h^r) · (g^(xr))^(-1) = m · g^(xr) · g^(-xr) = m`.

---

**Q60. Why is ElGamal IND-CPA secure? What assumption does this rely on?**

Under the DDH assumption: an eavesdropper sees `c1 = g^r` and `c2 = m · h^r`. If they could distinguish whether `c2` encodes `m0` or `m1`, they would need to compute `h^r = (g^x)^r = g^(xr)` and check `c2 / g^(xr)`. But `(g^x, g^r, g^(xr))` is a real DH tuple, and DDH says this is computationally indistinguishable from `(g^x, g^r, g^z)` for random `z`. So `c2` looks like `m · random`, which gives no information about `m`.

---

**Q61. What is the ElGamal malleability attack? Why does it make ElGamal IND-CCA insecure?**

Given ciphertext `(c1, c2)` encrypting `m`, an adversary can produce `(c1, λ·c2 mod p)` which decrypts to `λ·m`. This is because `c2 = m · h^r`, so `λ·c2 = (λ·m) · h^r`, and the `c1` component is unchanged. The decryption oracle computes `λ·m` from the tampered ciphertext.

In a CCA2 game: the adversary is given challenge ciphertext `(c1*, c2*)` (which encrypts either `m0` or `m1`). They submit `(c1*, 2·c2* mod p)` to the decryption oracle, get back `2·m_b`, divide by 2, and identify `m_b` — winning the game. This completely breaks CCA2 security.

---

## PA17 — CCA-Secure PKC

**Q62. How does the Signcryption (CCA_PKC) scheme work?**

**Encrypt:** 
1. `(c1, c2) = ElGamal.enc(pk_enc, m)` — encrypt the message.
2. `ce_bytes = serialize(c1, c2)` — canonical byte representation.
3. `sigma = RSASign(sk_sign, ce_bytes)` — sign the ciphertext.
4. Return `{c1, c2, sigma, ce_bytes}`.

**Decrypt:**
1. Verify `RSAVerify(vk_sign, ce_bytes, sigma)` — if fails, return `None`.
2. If valid: `m = ElGamal.dec(sk_enc, pk_enc, c1, c2)`.

---

**Q63. Why does Signcryption achieve CCA2 security?**

Any tampered ciphertext `(c1', c2')` has different `ce_bytes'`. The original signature `sigma` was computed over the original `ce_bytes`. Since `sigma` is an RSA hash-then-sign, changing `ce_bytes` to `ce_bytes'` changes `H(ce_bytes)`, so `sigma^e ≠ H(ce_bytes')`. Verification fails, decryption is never attempted.

A CCA2 adversary who wants to use the decryption oracle on a modified ciphertext would need to forge a new valid signature on the modified `ce_bytes'` — which requires inverting the RSA function without knowing `d`. Under the RSA assumption, this is computationally infeasible. So the oracle is completely blind to tampered ciphertexts.

---

**Q64. What is the difference between Sign-then-Encrypt and Encrypt-then-Sign? Which is safer?**

**Sign-then-Encrypt (StE):** Compute signature on plaintext `m`, then encrypt `(m, sigma)` together. Weakness: an adversary can strip the encryption, extract the signature, and re-encrypt the message to a different recipient — the signature is still valid since it was over `m` directly. This enables re-routing attacks.

**Encrypt-then-Sign (EtS):** Encrypt first, sign the ciphertext. The signature covers the specific encryption (including randomness). An adversary cannot re-route: re-encrypting changes the ciphertext, invalidating the signature. This is what PA17 implements. EtS binds the signature to the specific ciphertext, preventing re-routing.

---

## PA18 — Oblivious Transfer

**Q65. What are the two privacy properties of OT? State them precisely.**

1. **Sender privacy (receiver-oblivious):** The sender cannot learn the receiver's choice bit `b`. Formally: the sender's view of the protocol (messages it sends and receives) is computationally indistinguishable regardless of whether `b = 0` or `b = 1`. In the ElGamal OT, both `pk0` and `pk1` look like valid ElGamal public keys under DDH — the sender cannot tell which is real.

2. **Receiver privacy (sender-private):** The receiver can decrypt exactly one message (`m_b`) and learns nothing about `m_{1-b}`. Formally: the receiver has no secret key for `pk_{1-b}`, so the ciphertext `C_{1-b}` is computationally indistinguishable from an encryption of any other message under DDH.

---

**Q66. How does the receiver create the "fake" key in the OT protocol? Why can't the sender distinguish it from a real key?**

The receiver generates:
- **Real key for `b`:** `h_b = g^{x_b} mod p` where `x_b` is a freshly sampled discrete logarithm. This is a genuine ElGamal public key.
- **Fake key for `1-b`:** `h_{1-b}` is sampled as a uniformly random integer in `[2, p)` — a random group element with no known discrete logarithm.

The sender sees two group elements, both in `[2, p)`. Under the DDH assumption, a uniformly random group element is computationally indistinguishable from `g^r` for a random `r`. So the sender cannot tell which key has an associated discrete logarithm. This is exactly the DDH assumption — distinguishing real DH tuples from random ones.

---

**Q67. Why is OT considered a "complete" primitive for secure computation?**

OT is functionally complete for two-party computation in the sense that any two-party function can be computed securely using OT as the only cryptographic primitive (Kilian 1988, Ishai-Kilian-Nissim-Petrank 2003). In the GMW protocol (which PA19/PA20 implement), AND gates are computed with one OT call each, and XOR and NOT are free (via secret sharing). Since AND + XOR + NOT suffice for all boolean computations (NAND completeness), OT alone is sufficient to compute any function. This makes OT a universal building block for MPC.

---

## PA19 — Secure Gates

**Q68. Why does secure AND require OT but secure XOR does not?**

**AND via OT:** `a AND b` equals `a · b`. Bob has choice bit `b`; Alice sets OT messages `(m0, m1) = (0, a)`. Bob receives `m_b = a · b` — exactly `a AND b`. OT ensures Bob learns only `m_b` (not `m_{1-b}`) and Alice learns nothing about `b`. OT is needed because `a AND b` depends on both parties' inputs in a non-linear way — there is no additive decomposition.

**XOR for free:** `a XOR b = (a + b) mod 2`. Alice samples random `r`, computes `alice_share = a XOR r`, sends `r` to Bob (Bob computes `bob_share = b XOR r`). Both XOR their shares: `(a XOR r) XOR (b XOR r) = a XOR b`. No cryptography needed — the additive structure of XOR over `Z_2` allows linear secret sharing, which requires no OT.

---

**Q69. Why is NOT free? No communication is needed — explain why this is correct.**

In the additive secret sharing model: if Alice holds share `s_A` and Bob holds share `s_B` with `s_A XOR s_B = v` (the shared value), then NOT of `v = 1 XOR v`. Alice can unilaterally set her new share to `1 XOR s_A` without telling Bob. Now `(1 XOR s_A) XOR s_B = 1 XOR (s_A XOR s_B) = 1 XOR v = NOT v`. The flip propagates through the sharing because XOR is linear. No message is sent, no OT is needed.

---

**Q70. What is the cost of the GMW protocol in terms of AND gates and OT calls?**

One OT call per AND gate. XOR and NOT are free (no OT). The total communication complexity is `O(C_AND)` OT calls where `C_AND` is the AND gate count of the circuit. Each OT call involves:
- Receiver: one ElGamal key generation (1 `gen_prime` call implicitly through the group, 1 `mod_pow`).
- Sender: two ElGamal encryptions (2 ephemeral exponents, 2 pairs of `mod_pow`).
- Receiver: one ElGamal decryption (1 `mod_pow`).

For `n`-bit comparison: ~`4n` AND gates → ~`4n` OT calls → ~`20n` modular exponentiations.

---

## PA20 — Boolean Circuits and MPC

**Q71. What data structure represents a circuit? How does topological ordering work automatically?**

A circuit is a list of `Gate` objects, each with `gate_type`, input wire indices, and an output wire index. Wires are allocated sequentially — the first `n_inputs` wires are inputs (indices `0` to `n_inputs - 1`); each `add_gate` call allocates the next wire index. Since every gate's output wire index is strictly greater than all its input wire indices (inputs must come from earlier wires), iterating the gate list in insertion order is always a valid topological order. No explicit topological sort is needed.

---

**Q72. Describe the comparison circuit. What is the ripple comparator approach?**

The circuit tracks two state bits: `GT` ("so far, x is greater") and `EQ` ("so far, x equals y"), initialized to `GT=0`, `EQ=1`. For each bit position `i` from MSB to LSB:
- `x[i] > y[i]` iff `x[i] = 1` AND `y[i] = 0`, computed as `xi AND (NOT yi)`.
- `x[i] == y[i]` iff `NOT(xi XOR yi)`.
- `new_GT = OR(GT, EQ AND (x[i] > y[i]))`.
- `new_EQ = EQ AND (x[i] == y[i])`.

After all bits: `GT` is 1 iff `x > y`. Each stage uses ~8 gates; the total is `O(n)` gates. The key insight: GT can only become 1 when EQ is still 1 (the prefix was equal up to this point), and once GT becomes 1 or EQ becomes 0, those states are "sticky" — maintained by the OR/AND propagation.

---

**Q73. What is the Millionaires' Problem and who posed it?**

Andrew Yao posed it in 1982: two millionaires want to determine who is wealthier without either revealing their actual wealth. It is the canonical motivating example for secure two-party computation. Yao's solution (garbled circuits) and the GMW protocol (used here) both solve it: Alice encodes her wealth `x` as `n` input bits; Bob encodes his wealth `y` as `n` input bits; they jointly evaluate the comparison circuit `x > y` using OT-based secure gates. The output reveals only whether `x > y` — no other information about `x` or `y` is leaked.

---

**Q74. How does SecureEval evaluate a circuit? How many OT calls does the n-bit comparison use?**

`SecureEval.evaluate` iterates gates in topological order:
- AND gate: calls `SecureGates.AND(a, b)` → triggers a full OT protocol. Increments `ot_calls`.
- XOR gate: calls `SecureGates.XOR(a, b)` → free, local computation.
- NOT gate: calls `SecureGates.NOT(a)` → free, local.

Wire values are tracked in a plain array; each gate writes to its output wire index.

The `n`-bit comparison circuit has approximately `4n` AND gates (1 AND for `xi AND (NOT yi)`, 1 for `EQ AND (xi_gt_yi)`, 1 for the OR, 1 for `EQ AND xi_eq_yi` per bit). For `n = 4`: ~16 AND gates → 16 OT calls. Each OT call exercises the full PA16 (ElGamal) → PA13 (mod_pow) stack.

---

## Cross-Cutting and General Questions

**Q75. Trace the entire Minicrypt Clique from OWF to CCA encryption.**

```
OWF (PA1: DLP or AES)
  → PRG (PA1: HILL iteration / AES-CTR)
    → PRF (PA2: GGM tree / AES directly)
      → CPA-Enc (PA3: nonce + PRF keystream)
      → MAC (PA5: PRF-MAC / CBC-MAC)
        → CCA-Enc (PA6: Encrypt-then-MAC)
        → HMAC (PA10: double-nested hash-MAC)
          → EtHEnc (PA10: CPA-Enc + HMAC)
      → Block cipher modes (PA4: CBC/OFB/CTR)
```

The DLP path also gives: DLP-OWF → DLP-PRG → (via PA7/PA8) DLP compression function → DLP hash → HMAC. Both paths (AES-based and DLP-based) converge at the PRF/hash interface used by all higher PAs.

---

**Q76. Trace the public-key clique from DLP to MPC.**

```
DLP / safe prime (PA13: Miller-Rabin, prime generation)
  → Diffie-Hellman (PA11: DH exchange, MITM attack)
  → RSA (PA12: keygen, CRT decryption, PKCS#1 v1.5)
      ↓ Miller-Rabin also for PA14
  → CRT + Håstad Attack (PA14)
  → RSA Signatures (PA15: hash-then-sign, forgery demo)
      ↓
  → ElGamal (PA16: IND-CPA, malleability)
      ↓                    ↓
  → CCA-PKC (PA17)    → OT (PA18: Bellare-Micali)
    (EtS: PA15+PA16)         ↓
                        → Secure Gates (PA19: AND/XOR/NOT)
                               ↓
                        → MPC / Circuit eval (PA20: Millionaires)
```

---

**Q77. What is the difference between IND-CPA and IND-CCA2? Give a scheme that achieves one but not the other.**

IND-CPA: adversary has encryption oracle only; cannot submit chosen ciphertexts for decryption.
IND-CCA2: adversary has both encryption and decryption oracle (except not allowed to query the challenge ciphertext itself).

**IND-CPA but not IND-CCA2:** ElGamal (PA16). It is IND-CPA under DDH, but the malleability attack (multiply `c2` by `λ`) breaks IND-CCA2 — the adversary submits `(c1, λ·c2)` to the decryption oracle to learn `λ·m`.

**IND-CCA2:** CCAEnc (PA6), EtHEnc (PA10), CCA_PKC (PA17) — all use Encrypt-then-MAC/Sign which blocks tampering.

---

**Q78. Compare symmetric and asymmetric encryption on three axes: key distribution, computational cost, and security model.**

| | Symmetric (PA3, PA6) | Asymmetric (PA12, PA16, PA17) |
|---|---|---|
| **Key distribution** | Requires a pre-shared secret key — both parties must have `k` before communication. Classic key distribution problem. | No pre-shared secret needed. Public key is published; private key stays secret. Solves the key distribution problem. |
| **Computational cost** | Fast: AES is ~10GB/s on modern hardware. One key per pair. | Slow: modular exponentiation over large integers. RSA-2048 decryption: ~1ms. Typically used for key encapsulation (encrypt a symmetric key), not for bulk data. |
| **Security model** | IND-CPA, IND-CCA2 achievable under AES/PRF assumptions. | IND-CPA under DDH (ElGamal), IND-CCA2 via EtS (PA17). Based on number-theoretic hardness (DLP, factoring). |

---

**Q79. What is the Minicrypt Clique? What is its central claim?**

The Minicrypt Clique is the set of symmetric-key cryptographic primitives (OWF, PRG, PRF, CPA-Enc, MAC, CRHF, CCA-Enc, HMAC) that are all equivalent in the following sense: they all exist if and only if OWFs exist. The central claim: **a OWF exists if and only if the Minicrypt Clique is non-empty.** Proving upward (OWF → PRG → PRF → ...) uses explicit constructions (HILL, GGM). Proving downward (any primitive in the Clique → OWF) uses the fact that any secure encryption or MAC implies a OWF.

---

**Q80. Why can't you prove that P ≠ NP to establish that RSA or DLP are hard?**

P ≠ NP would show that no polynomial-time algorithm can solve NP-complete problems. But integer factorization (RSA hardness) and DLP are not known to be NP-complete — they are in NP but not known to be NP-hard. So even if P ≠ NP, polynomial-time algorithms for factoring and DLP might still exist. Cryptography rests on unproven computational assumptions that go beyond P vs NP: we believe RSA and DLP are hard based on the failure of decades of algorithmic effort, not on a complexity-theoretic proof.

---

**Q81. What is a reduction in cryptography? Give an example from this codebase.**

A security reduction shows that if you can break scheme `B`, you can break assumption `A`. Written as: "Breaking `B` → Breaking `A`". If `A` is believed hard, `B` is secure. The reduction gives a concrete algorithm that uses an attacker on `B` as a subroutine to break `A`.

Example from this codebase: **DLP hash collision resistance** (PA8). If you find a collision in the DLP compression function `h(x,y) = g^x · ĥ^y`, you can compute `α = log_g(ĥ)`. This means: "Breaking DLP-hash collision resistance → Solving DLP." Since DLP is believed hard, the DLP hash is collision-resistant.

Another: **IND-CPA of CPAEnc** (PA3). "Breaking IND-CPA of CPAEnc → Distinguishing the PRF from random." Since the PRF is secure (under AES), CPAEnc is IND-CPA.

---

**Q82. What is the role of os.urandom throughout this codebase? What would happen if Python's random module were used instead?**

`os.urandom` reads from the operating system's entropy pool (e.g., `/dev/urandom` on Linux, CryptGenRandom on Windows). It provides **cryptographically secure randomness** — outputs are indistinguishable from uniform random by any PPT distinguisher.

Python's `random` module uses the Mersenne Twister, a deterministic PRNG seeded from a small state. After observing ~624 consecutive 32-bit outputs, an adversary can reconstruct the internal state and predict all future outputs — completely breaking any cryptographic use. Using `random` for key generation, nonces, or OT exponents would make the system trivially breakable. The rule "no `import random`" is enforced throughout PA01, PA03, PA08.

---

**Q83. What is forward secrecy? Does any PA in this codebase achieve it?**

Forward secrecy (or perfect forward secrecy, PFS): compromise of the long-term private key does not allow decryption of past session traffic. If each session uses a fresh ephemeral key that is discarded after the session, past sessions are protected even if the long-term key is later compromised.

PA11's DH exchange uses fresh ephemeral exponents `a` and `b` that are not stored. If the long-term DH parameters (the group) are known but `a`, `b` are discarded, past shared secrets cannot be recomputed. So PA11 achieves forward secrecy for the key exchange.

PA17's CCA_PKC uses a fresh ElGamal randomness `r` per encryption, but the long-term ElGamal private key `x` is permanent — compromise of `x` allows decryption of all past traffic. No forward secrecy there.

---

**Q84. What is the difference between collision resistance, second-preimage resistance, and preimage resistance? Which is the strongest?**

For a hash function `H`:
- **Preimage resistance (one-wayness):** Given `y`, hard to find `x` with `H(x) = y`.
- **Second-preimage resistance:** Given `x`, hard to find `x' ≠ x` with `H(x') = H(x)`.
- **Collision resistance:** Hard to find any `x ≠ x'` with `H(x) = H(x')` (no constraints).

Strength ordering: **Collision resistance → Second-preimage resistance → Preimage resistance.** Collision resistance is the hardest property to achieve and the strongest. Breaking collision resistance (finding any collision) does not automatically break second-preimage resistance (finding a collision starting from a given point). The DLP hash in PA8 is collision-resistant (under DLP hardness); its preimage resistance relies on the same assumption.

---

**Q85. What is the role of the safe prime and prime-order subgroup across PA11, PA16, and PA18?**

All three PAs use the same group structure: safe prime `p = 2q + 1`, prime-order-`q` subgroup, generator `g` with `g^q ≡ 1 mod p` and `g^2 ≢ 1`.

- **PA11 (DH):** The prime-order subgroup prevents Pohlig-Hellman attacks on the shared secret. The group order `q` is large and prime, making DLP hard.
- **PA16 (ElGamal):** DDH hardness (needed for IND-CPA) holds in prime-order subgroups. A composite-order group would allow small-subgroup attacks that break DDH.
- **PA18 (OT):** The "fake" key `h_{1-b}` is a random group element. Under DDH in the prime-order subgroup, a random group element is computationally indistinguishable from a proper public key `g^x` — which is the sender-privacy guarantee.

The safe prime structure is generated once by PA13 and reused across all three PAs.

---

**Q86. Explain the full call stack when millionaires_problem(7, 12, n_bits=4) is evaluated.**

1. `millionaires_problem(7, 12, 4)` converts `x=7, y=12` to 4-bit MSB-first lists.
2. Calls `SecureEval.evaluate(comparison_circuit, x_bits, y_bits)`.
3. For each AND gate (~16 total): calls `SecureGates.AND(a, b)`.
4. `SecureGates.AND` sets OT messages `(0, a)`, calls `OT_1of2.receiver_step1(b)`.
5. `receiver_step1` calls `ElGamalGroup.random_exponent()` → `os.urandom` → generates `x_b`, computes `h_b = mod_pow(g, x_b, p)` (PA13).
6. Returns `(pk0, pk1, state)`.
7. `SecureGates.AND` calls `OT_1of2.sender_step(pk0, pk1, 0, a)`.
8. `sender_step` calls `ElGamal.enc(pk0, 0)` and `ElGamal.enc(pk1, a)` — each calls `mod_pow` twice (PA13).
9. `SecureGates.AND` calls `OT_1of2.receiver_step2(state, C0, C1)`.
10. `receiver_step2` calls `ElGamal.dec(sk_b, pk_b, Cb[0], Cb[1])` — calls `mod_pow` and `mod_inverse` (PA13).
11. XOR and NOT gates are computed locally without OT.
12. Final output wire is 1 if `x > y`, 0 otherwise.
13. `millionaires_problem` returns `"Bob is richer"` (since `7 < 12`).

---

**Q87. What is the hardness assumption behind each major PA?**

| PA | Hardness Assumption |
|----|---------------------|
| PA1 (DLP OWF) | Discrete Logarithm Problem (DLP) |
| PA1 (AES OWF) | AES is a pseudorandom permutation (ideal cipher) |
| PA2 (AES-PRF) | AES is a PRP (PRP/PRF switching lemma) |
| PA2 (GGM PRF) | PRG security (which reduces to OWF via HILL) |
| PA8 (DLP Hash) | Discrete Logarithm Problem (DLP) |
| PA11 (DH) | Computational DH (CDH) problem |
| PA12 (RSA enc/dec) | Integer Factorization (RSA problem) |
| PA13 (prime testing) | None — Miller-Rabin is unconditional for composites |
| PA15 (RSA signatures) | RSA problem (in ROM for EU-CMA) |
| PA16 (ElGamal) | Decisional DH (DDH) |
| PA17 (CCA-PKC) | RSA + DDH (signature + encryption) |
| PA18 (OT) | DDH (for sender privacy) |
| PA19-PA20 (MPC) | DDH (through OT) |

---

**Q88. What is the OR gate formula used in the comparison circuit? Why is OR derived and not primitive?**

`OR(a, b) = a XOR b XOR (a AND b)`.

Derivation: `a XOR b` is 1 when exactly one is 1. `a AND b` is 1 when both are 1. XORing them: when exactly one is 1, XOR is 1 and AND is 0 — result is 1. When both are 1, XOR is 0 and AND is 1 — result is 1. When both are 0, both are 0 — result is 0. This matches OR exactly.

OR is not primitive in the GMW framework because AND is the "expensive" gate (costs one OT) and XOR is "free" (linear secret sharing). Expressing OR via AND+XOR means the OR costs exactly one OT call (for the AND sub-gate), which is minimal. A direct OR implementation would cost the same, but the AND+XOR decomposition makes the cost accounting explicit.

---

**Q89. Why does the addition circuit use XOR for the final carry instead of OR?**

The carry update: `new_carry = (xi AND yi) OR ((xi XOR yi) AND carry)`.

The key observation: `(xi AND yi)` and `((xi XOR yi) AND carry)` are **mutually exclusive**. If `xi = yi = 1`, then `xi AND yi = 1` but `xi XOR yi = 0`, so the second term is 0. If exactly one of `xi, yi` is 1, the second term can be 1, but `xi AND yi = 0`. They can never both be 1 simultaneously.

For mutually exclusive boolean values `A` and `B`: `OR(A, B) = A XOR B` (since `A AND B = 0`). So `OR = XOR` here, saving one AND gate per carry — the OR's AND sub-gate in the `A XOR B XOR (A AND B)` formula contributes 0 and can be dropped.

---

**Q90. What is the significance of the `n_wires` counter in the Circuit class?**

`n_wires` is the total number of allocated wire slots. It starts at `n_inputs` (input wires are pre-allocated at indices 0 through `n_inputs-1`). Each `add_gate` call increments it by 1 and uses the new value as the output wire index. This enforces three invariants simultaneously:
1. Each gate gets a unique output wire index.
2. Output wire indices are strictly greater than input wire indices (topological ordering guaranteed).
3. The wire array in `evaluate` can be pre-allocated as `[0] * n_wires`, indexed directly.

The final `n_outputs` wires (`wires[-n_outputs:]`) are the circuit outputs. This design means the output wires are the last gates added — `Circuit.evaluate` slices the end of the wire array.

---

**Q91. What is a padding oracle attack? Name two places in this codebase where it could occur without proper design.**

A padding oracle attack uses a decryption system that reveals whether a decrypted ciphertext has valid padding (even if it doesn't reveal the plaintext). By sending carefully crafted ciphertexts and observing "valid"/"invalid" responses, an attacker can recover plaintexts byte by byte.

In this codebase:
1. **PA12 `pkcs15_dec`**: returns `None` for bad padding. If an attacker can query this and observe the `None` vs bytes response, they have a PKCS#1 v1.5 padding oracle — exactly the Bleichenbacher attack. Mitigated in PA17 because the signature check in `CCA_PKC.dec` runs before any decryption.
2. **PA06 `cca_dec` design (if done wrong)**: if CBC decryption ran before MAC verification, the PKCS#7 unpadding error (`_pkcs7_unpad` raising `ValueError`) would be an oracle. PA06 correctly verifies the MAC first, so no ciphertext ever reaches decryption unless it passed MAC verification.

---

**Q92. What is the difference between a PRF and a MAC? Can a PRF be used as a MAC directly?**

A **PRF** `F_k` is a keyed function computationally indistinguishable from a random function. No party knows which of the oracle's outputs correspond to which inputs (in the ideal PRF model).

A **MAC** is a keyed authentication function with the specific EUF-CMA security property: no adversary can forge valid tags for new messages after seeing valid tags for chosen messages.

Can a PRF be used as a MAC? Yes — directly. `MAC_k(m) = F_k(m)` is EUF-CMA secure whenever `F_k` is a secure PRF. Proof: any MAC forger (produces valid tag `t*` on new message `m*`) can distinguish the PRF from random — it evaluates the PRF at a new point and gets a correct answer `t* = F_k(m*)`, which a random function would provide only with probability `1/2^{output_length}`. This is exactly what PA5's PRFMAC implements.

---

**Q93. What is a commitment scheme? Which PA implements one, and how?**

A commitment scheme allows Alice to "commit" to a value `v` by publishing `C = Commit(v, r)` (where `r` is randomness), then later reveal `(v, r)` to prove `C` commits to `v`. Properties:
- **Hiding:** `C` reveals nothing about `v` (computationally or information-theoretically).
- **Binding:** Alice cannot open `C` to a different value `v' ≠ v`.

In this codebase, **PA8's DLP hash** can serve as a commitment: `C = H(v)` where the hash is collision-resistant (binding: finding two inputs with the same hash is hard — DLP assumption) and one-way (hiding: inverting `H` to find `v` from `C` is hard). The DLP hash is used as a CRHF in PA10 (HMAC) and PA15 (signatures), where its collision resistance provides binding.

---

**Q94. What is the GGM PRF tree depth and how does it affect the input domain?**

In PA2's `GGMPRF`, `depth = 8` by default. The PRF uses the first `depth` bits of the input `x` to select a leaf in a binary tree. With depth 8, the input domain is 256 values (one byte of useful input). The PRF is defined on `{0, 1}^8` — 8-bit inputs. Increasing depth to 128 would give a PRF on 128-bit inputs (AES-like), but each evaluation would require 128 AES calls instead of 8. The depth is a design parameter trading input-domain size for computational cost.

---

**Q95. Why is the AES state loaded column-major (not row-major)? What goes wrong if you do it row-major?**

FIPS-197 §3.4 specifies column-major loading: `state[r][c] = byte[r + 4c]`. This means the first 4 bytes of the plaintext become column 0, the next 4 bytes become column 1, etc.

If loaded row-major (`state[r][c] = byte[4r + c]`), ShiftRows would permute different byte positions than intended, and MixColumns would operate on different combinations. The resulting ciphertext would differ from all NIST test vectors. The failing test would be the all-zeros NIST vector: `AES(0^128, 0^128)` should give `66e94bd4ef8a2c3b884cfa59ca342b2e` — row-major loading gives a completely different value.

---

**Q96. What happens if you use the same key for both encryption and MAC in CCAEnc or EtHEnc?**

Using `kE = kM` breaks the security proof. The proof requires that the PRF queries made by the encryption scheme (computing keystream) are independent of the PRF queries made by the MAC. With the same key, an adversary could craft messages where the encryption's PRF outputs happen to predict the MAC's PRF outputs, allowing MAC forgery without actually inverting the PRF. Concretely: if `F_k(r ‖ c)` (MAC) equals `F_k(r + i)` (keystream block `i`) for some relationship, the tag might be predictable from the keystream. Using independent keys prevents any such correlation.

---

**Q97. Why does the extended GCD (used for mod_inverse) use recursion? What is its time complexity?**

The extended Euclidean algorithm is naturally recursive: `gcd(a, b) = gcd(b, a mod b)` with base case `gcd(a, 0) = a`. The Bézout coefficients are computed by back-substituting the recursive results: if `g, x, y = extgcd(b, a mod b)` so `b*x + (a mod b)*y = g`, rewrite `a mod b = a - (a//b)*b` to get the coefficients for `a`.

Time complexity: `O(log(min(a,b)))` recursive calls, each doing `O(1)` work (integer division and multiplication). This is the same as the regular GCD — the extended version carries two extra integers through the recursion. For 512-bit RSA primes, this is ~512 steps — fast enough to be negligible compared to the modular exponentiations used in RSA.

---

**Q98. What is the purpose of the `verify_hardness` function in DLPOWF? Why does it return a dict and not a string?**

`verify_hardness(x=None)` returns a dict with keys `hardness`, `p`, `q`, `g`, `bits`, and optionally the input/output pair. This structured return is consumed by the React frontend to display group parameters in the PA1 demo — the frontend reads specific keys like `hardness` and `p` to render them in specific UI components. A plain string would require parsing, which is fragile. The dict interface is an explicit contract in the CLAUDE.md: "Returns a dict with keys `hardness`, `p`, `q`, `g`, etc. Not a string." — different from `AESOWF.verify_hardness` which returns a string (a different security narrative).

---

**Q99. What is the RCON constant in AES key expansion? Why does it exist?**

`RCON[i]` is `x^(i-1)` in GF(2⁸): `[0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]`. In the key expansion, `RCON[round]` is XORed with the first word of each group of 4 (after RotWord and SubWord).

It exists to prevent **symmetric weak keys**: without Rcon, if all bytes of the key were equal (e.g., all zeros), all round keys would also be all zeros (since the key schedule would repeat). Rcon breaks the symmetry — each round introduces a different constant, ensuring distinct round keys even from a degenerate starting key. It also prevents related-key attacks where small changes to the key produce predictably related round keys.

---

**Q101. The PA#4 demo has a "Reuse IV" toggle that behaves differently for CBC vs OFB. What attack does each mode's reuse enable, and why are they conceptually different?**

**CBC IV-reuse:** If `IV` is reused and two messages share the same first block (`M1[0] = M2[0]`), then `C1[0] = AES_k(M1[0] ⊕ IV) = AES_k(M2[0] ⊕ IV) = C2[0]` — identical ciphertext blocks reveal identical plaintext blocks. More critically, a CPA adversary who can predict the IV can craft a specific plaintext to learn whether the challenge message starts with a chosen block. This breaks IND-CPA (the BEAST attack against TLS 1.0).

**OFB keystream-reuse:** OFB generates the keystream `O_0, O_1, ...` solely from `(k, IV)`, independent of the plaintext. Reusing the same IV with two different plaintexts produces `C1 = M1 ⊕ KS` and `C2 = M2 ⊕ KS` with the *same* keystream `KS`. XORing the ciphertexts gives `C1 ⊕ C2 = M1 ⊕ M2` — direct leakage of the XOR of plaintexts. No key needed; no block structure to exploit — just XOR.

The difference: CBC IV-reuse is an IND-CPA game attack (active adversary with an encryption oracle). OFB keystream-reuse is a passive attack that works even for an eavesdropper with no oracle — they just XOR two intercepted ciphertexts.

---

**Q102. Why is `import hashlib` forbidden in this project even though SHA-256 would make the PA#10 demo more illustrative?**

CLAUDE.md's hard rule is: "No external crypto libraries. No `hashlib`, no `hmac`, no `random`, no `PyCryptodome`, no `OpenSSL`, or any third-party crypto." This is not just a stylistic choice — using `hashlib.sha256` would mean part of the project's cryptographic output comes from a black box whose internals are not in the codebase. Every byte of output would no longer be traceable to a specific operation in `aes_impl.py`, `dlp_hash.py`, or `hmac_impl.py`.

The PA#10 spec mentions a "toggle between DLP hash and SHA-256 for comparison." This toggle was intentionally removed. The DLP hash is sufficient to demonstrate the length-extension vulnerability (all Merkle-Damgård hashes share the same structural weakness regardless of their compression function). The SHA-256 comparison would be pedagogically interesting but at the cost of importing a library that the project explicitly forbids. Compliance with CLAUDE.md takes precedence.

---

**Q103. Why does the PA#5 ForgeTab need an even-length hex validation guard before calling the API?**

The API's `/api/mac/sign` and `/api/mac/verify` endpoints expect `message_hex` to be a valid hex-encoded byte string. An odd-length hex string (e.g., `"abc"`) is malformed — `bytes.fromhex("abc")` raises `ValueError` in Python. Without client-side validation, the user could submit an odd-length string that causes a 500 error on the backend, or (in a previous bug) the frontend could silently zero-pad the string before sending, producing a mismatch between the message the API authenticated and the message the uniqueness check was performed against.

The correct fix: validate `forgeMsg.length % 2 === 0 && forgeMsg.length > 0` before any API call, and use the exact same `forgeMsg` string for both the API call and the `signedMsgs` uniqueness check. This ensures the "did we already sign this?" check uses the same representation as what the server sees.

---

**Q104. The PA#5 API accepts `mac_type: "PRF" | "CBC"`. How does the server route this, and what changes between the two?**

In `server.py`, the `MACRequest` and `MACVerifyRequest` Pydantic models include `mac_type: str = "PRF"`. The sign endpoint does:
```python
if req.mac_type.upper() == "CBC":
    mac_obj = CBCMAC()
else:
    mac_obj = PRFMAC(get_aes_prf())
tag = mac_obj.mac(key_bytes, message_bytes)
```

What changes:
- **PRFMAC:** Tag = `F_k(m)` for single-block messages; multi-block chains via XOR-then-PRF. Tag is 16 bytes (AES block). Secure for all message lengths.
- **CBCMAC:** Tag = final block of CBC encryption with zero IV and PKCS#7 padding. Tag is 16 bytes (AES block). Secure only for fixed-length messages.

The frontend's toggle resets the signed-message list on switch because a tag produced by PRFMAC cannot be verified by CBCMAC and vice versa — different algorithms, same key, incompatible tags.

---

**Q105. Walk through what happens in the PA#3 broken-nonce-reuse demo when the adversary auto-wins.**

With "Reuse Nonce" enabled, the broken encryption always uses `r = 0x00...00`. The frontend:
1. Calls `api.enc.cpa(key, m0, true)` to get the challenge ciphertext `enc` (bit `b` chosen server-side).
2. Immediately calls `api.enc.cpa(key, m0, true)` again to get a *reference encryption of m0* under the same broken nonce — call it `ref0`.
3. Compares `enc.ciphertext === ref0.ciphertext`. If equal, `b = 0`; otherwise `b = 1`. This comparison is exact because `enc_broken(k, m) = F_k(0) ⊕ m` is fully deterministic.
4. Auto-submits the correct guess with `auto: true` in the round record.

The advantage reaches 1.0 immediately because every round is won deterministically. In secure mode, `r = os.urandom(16)` makes the keystream unique per encryption, so the reference encryption of `m0` produces a different ciphertext than the challenge — the comparison is useless and the adversary must guess randomly (advantage ≈ 0).

---

**Q100. Summarize the security of the overall system. What is the strongest adversary the full PA01-PA20 stack can resist?**

The full stack provides:
- **Symmetric encryption:** IND-CCA2 (PA6/PA10) — resists adaptive chosen ciphertext attacks.
- **Symmetric MAC:** EUF-CMA (PA5/PA10) — resists adaptive chosen message forgery.
- **Hash function:** CRHF reducing to DLP (PA8) — collision finding as hard as DLP.
- **Digital signatures:** EU-CMA in ROM (PA15) — existential unforgeability under chosen message attack.
- **Public-key encryption:** IND-CCA2 via signcryption (PA17) — resists adaptive chosen ciphertext attacks in the PKC setting.
- **Oblivious transfer:** Receiver-private and sender-private under DDH (PA18).
- **Secure computation:** Two-party MPC secure against semi-honest adversaries (PA19/PA20) — neither party learns anything beyond the output.

The fundamental limits: all of the above assumes the hardness of DLP (for DH, ElGamal, DLP-hash, OT) and the security of AES (for symmetric primitives). Quantum computers running Shor's algorithm would break DLP and RSA in polynomial time. Grover's algorithm would reduce symmetric key sizes by half. The entire stack would need to be replaced with post-quantum primitives (lattice-based, hash-based) to remain secure against a quantum adversary.
