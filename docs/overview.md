# Project Overview — Minicrypt Clique Explorer

## What This Project Is

The Minicrypt Clique Explorer is a full-stack interactive tool for understanding how every primitive in symmetric cryptography is mathematically equivalent to every other. You pick any two cryptographic primitives — say PRG and MAC — and the app finds the formal reduction chain connecting them, shows the step-by-step proof, and lets you run live computations against a real backend.

Behind the UI is a complete cryptographic library built from scratch: 20 implemented primitives spanning One-Way Functions, AES-128, PRFs, MACs, hash functions, RSA, ElGamal, Oblivious Transfer, and 2-Party MPC. No external crypto libraries are used anywhere. Every operation down to GF(2⁸) arithmetic inside AES is hand-written Python.

---

## The Core Idea: The Minicrypt Clique

In theoretical cryptography, the **Minicrypt** is the set of symmetric-key primitives that are all equivalent under polynomial-time reductions. The key theorem is:

```
OWF ⟺ PRG ⟺ PRF ⟺ PRP ⟺ MAC ⟺ CRHF ⟺ HMAC
```

This means:
- If a One-Way Function exists, you can build a PRG (HILL theorem, 1999).
- If a PRG exists, you can build a PRF (GGM construction, 1986).
- If a PRF exists, you can build a PRP, a MAC, a CRHF — everything.
- Conversely, any of these primitives implies the existence of a OWF.

The practical consequence is that **all of modern symmetric cryptography stands or falls together**. If one-way functions don't exist (i.e., P = NP), every symmetric scheme is broken. If they do exist, all of them can be built from that single assumption.

This project makes that theorem concrete and interactive.

---

## How the Application Works

### Inputs

The web frontend takes:
- **Foundation toggle** — AES (symmetric, block-cipher based) or DLP (asymmetric, discrete-log based). This sets which mathematical hardness assumption sits at the root of all constructions.
- **Source and Target primitives** — chosen from: OWF, PRG, PRF, PRP, MAC, CRHF, HMAC.
- **Key** — a 128-bit or 256-bit hex value. Used as the cryptographic key for the selected source primitive.
- **Query** — a hex message input, used wherever a plaintext, message, or PRF input is needed.
- **Direction** — forward (build the target from the source) or backward (reduce the source to the target).

For the 20 demo tabs, each one takes inputs specific to that algorithm: plaintext/ciphertext pairs, RSA key sizes, number of Miller-Rabin rounds, bits to compare in the Millionaire's problem, etc.

### Outputs

For the **Clique Explorer**:
- **Build column** — shows the step-by-step computation from the foundation to the source primitive. Each step displays the intermediate value (as hex), the operation applied, and a description. For example: AES key → AES_k(0) → PRG(s) = F_k(0)‖F_k(1).
- **Reduce column** — shows the formal reduction from the source primitive to the target. Backed by a routing table of 27+ pre-computed reduction pairs; BFS finds multi-hop paths.
- **Proof panel** — shows the formal security theorem for the reduction: the construction, the assumption it relies on, and what security property is being transferred.

For each **PA demo tab**, the output is the raw cryptographic result: ciphertext bytes, MAC tags, hash digests, prime numbers, collision pairs, shared DH keys, OT-received messages, MPC comparison results, etc.

---

## What Each PA Implements

| PA | Primitive | Input → Output |
|---|---|---|
| 1 | OWF + PRG | exponent x → g^x mod p; seed → pseudorandom bitstring |
| 2 | AES-128 + GGM PRF | 128-bit key + block → ciphertext; key + n-bit string → PRF output |
| 3 | CPA Encryption | key + plaintext → (nonce r, ciphertext c) |
| 4 | CBC / OFB / CTR | key + plaintext + IV → multi-block ciphertext |
| 5 | PRF-MAC + CBC-MAC | key + message → authentication tag |
| 6 | CCA Encryption | two keys + plaintext → (r, c, tag); rejects on tamper |
| 7 | Merkle-Damgård | variable-length message → fixed-length hash digest |
| 8 | DLP Hash | (x, y) pair → g^x · ĥ^y mod p (collision-resistant) |
| 9 | Birthday Attack | hash function + target bits → colliding (m₁, m₂) pair |
| 10 | HMAC | key + message → HMAC tag (length-extension resistant) |
| 11 | Diffie-Hellman | each party's secret → shared key g^{ab}; MITM demo |
| 12 | RSA | prime sizes → (N, e, d, CRT params); plaintext → PKCS ciphertext |
| 13 | Miller-Rabin | integer n + rounds k → PROBABLY_PRIME or COMPOSITE |
| 14 | CRT + Håstad | three RSA ciphertexts (e=3) → recovered plaintext |
| 15 | RSA Signatures | message → σ = H(m)^d mod N; verification + forgery demo |
| 16 | ElGamal | public key + message → (c₁, c₂); malleability demo |
| 17 | CCA PKC | sign-then-encrypt; ciphertext tamper → ⊥ |
| 18 | 1-of-2 OT | sender's (m₀, m₁) + receiver's choice bit b → receiver gets m_b only |
| 19 | Secure AND | Alice's bit a + Bob's bit b → a∧b without revealing inputs |
| 20 | 2-Party MPC | Alice's integer x + Bob's integer y → (x>y, x==y) without revealing values |

---

## What It Actually Achieves

### It proves the reduction chain, not just implements it

Most crypto courses implement AES or RSA once and stop. This project implements every step of the reduction chain and connects them. When you select OWF → MAC, the app doesn't fake it — it actually runs: DLP OWF (PA1) → HILL PRG (PA1) → GGM PRF (PA2) → PRF-MAC (PA5), each handing its output to the next.

The routing table in `server.py` stores the formal theorem, step list, and security claim for each pair. The BFS path-finder gives multi-hop reductions across primitives not directly adjacent in the clique.

### It shows where schemes break

The attacks are not simulations. They use the actual primitives:

- **Birthday attack (PA9):** Given a hash with n-bit output, finds a real collision in ~2^(n/2) queries. With toy 16-bit hashes this runs in milliseconds and produces genuine colliding messages.
- **Håstad's broadcast attack (PA14):** Given three RSA ciphertexts of the same plaintext with e=3, applies CRT and an integer cube root to recover the plaintext exactly. It works because m³ < N₁·N₂·N₃ when m is small, making the modular reduction irrelevant.
- **ElGamal malleability (PA16):** Multiplying ciphertext component c₂ by k yields decryption k·m. The app lets you enter any k and confirms the decrypted result matches — demonstrating why CPA-secure ≠ CCA-secure.
- **DH MITM (PA11):** Eve intercepts both parties' public keys, replaces them with her own, and establishes separate shared keys with Alice and Bob. Both parties believe they share a key with each other.
- **Raw RSA determinism (PA12):** Encrypt the same plaintext twice with raw RSA — same ciphertext both times, trivially distinguishable. PKCS#1 v1.5 padding randomizes it.

### It demonstrates the non-obvious properties

- **CBC-MAC is insecure for variable-length messages.** PRF-MAC is not. PA5 implements both and the distinction matters.
- **Length-extension attacks on plain Merkle-Damgård.** PA7 shows why you can extend a hash without knowing the key. HMAC (PA10) prevents this by wrapping the inner hash in an outer one.
- **Why you hash before signing.** PA15 shows that raw RSA signatures are multiplicatively homomorphic: σ(m₁) · σ(m₂) = σ(m₁·m₂). An attacker can forge signatures for new messages without the private key. Hashing first breaks this.
- **OT receiver privacy.** In PA18, the sender sends two encryptions using two public keys. One key was generated honestly by the receiver; the other is a random group element with no secret key. To the sender, both look identical — the choice bit is statistically hidden.

---

## Real-World Significance

### The Minicrypt equivalences are why cryptography is deployable

When a security engineer picks AES-GCM for a protocol, they are implicitly relying on the entire Minicrypt chain: AES is a PRP, the PRP/PRF switching lemma gives a PRF, CTR mode uses the PRF for encryption, GHASH provides a MAC, and Encrypt-then-MAC achieves CCA security. None of these steps are obvious without the reduction theory. This project makes each step explicit and computable.

### AES from scratch has diagnostic value

Implementing AES without any library forces understanding of exactly what operations happen inside a block cipher: the S-box substitution (algebraic inverse in GF(2⁸)), ShiftRows, MixColumns (MDS matrix in GF(2⁸)), and the key schedule. When a side-channel attack targets, say, the S-box table lookup timing, understanding why requires knowing the S-box exists at all — which is non-obvious if you've only ever called `AES.encrypt()`.

### MPC is the hardest result

PA20's Millionaire's Problem is historically significant. It was posed by Yao (1982): can two parties determine who is richer without revealing their actual wealth? PA20 solves it using a boolean comparison circuit where each AND gate is an OT call (PA18), which uses ElGamal (PA16). The chain is: MPC depends on OT, OT depends on public-key crypto. This project implements the full dependency chain — PA20 literally calls PA19, which calls PA18, which calls PA16.

In practice, MPC is used for private set intersection (e.g., finding common contacts without sharing contact lists), privacy-preserving machine learning (training on encrypted data), and threshold signature schemes in distributed systems.

### RSA CRT decryption is not academic

Garner's algorithm (PA12) is how RSA decryption actually runs in production — including in OpenSSL and mbedTLS. Rather than computing c^d mod N (one huge exponentiation), you compute two smaller ones mod p and mod q, then combine via CRT. This gives a ~4× speedup and is the reason RSA private keys include five values (N, e, d, dp, dq, qInv) rather than three.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Crypto implementations | Python 3.10+, zero external crypto deps |
| Backend API | FastAPI + Pydantic, 30+ REST endpoints across 20 PA categories |
| Frontend | React 18 + Vite, dark/light theme; 20 interactive PA demo tabs |
| Randomness | `os.urandom` only (no `random`, no `secrets`, no `hashlib`) |
| Tests | pytest, one `tests.py` per PA + `test_comprehensive.py` |

The constraint of no external libraries is not just a course rule. It means every byte of cryptographic output in this project is traceable to a specific operation in the source code. There is no black box.

### Frontend Demo Status (PA#1–PA#10, fully audited against PDF spec)

All 10 symmetric-key PA demos have been verified against the CS8.401 PDF spec's "Interactive Demo Deliverable" requirements:

| PA | Demo Feature | Status |
|---|---|---|
| PA#1 | PRG output viewer with NIST SP 800-22 tests (frequency, block freq, runs, serial) | ✅ |
| PA#2 | GGM tree SVG visualizer with animated active path; PRF distinguishing game | ✅ |
| PA#3 | IND-CPA game; broken nonce-reuse mode auto-wins via reference encryption comparison | ✅ |
| PA#4 | CBC/OFB/CTR block chain animator; CBC IV-reuse attack (matching red blocks); OFB keystream-reuse attack (C₁⊕C₂=M₁⊕M₂); auto-runs on mount | ✅ |
| PA#5 | EUF-CMA forge game with PRF-MAC / CBC-MAC toggle; length-extension demo; MAC→PRF test | ✅ |
| PA#6 | Malleability attack comparison; key-separation attack; IND-CCA2 game with decryption oracle | ✅ |
| PA#7 | Editable MD chain with live avalanche; MD padding display; boundary cases; collision propagation | ✅ |
| PA#8 | DLP hash panel; group params viewer; birthday hunt with progress bar; collision-resistance demo | ✅ |
| PA#9 | Live naive + Floyd attacks with shared slider; empirical CDF; toy hash table; DLP truncated; MD5/SHA-1 context | ✅ |
| PA#10 | Length-extension vs HMAC side-by-side; EUF-CMA HMAC oracle game; MAC→CRHF; Encrypt-then-HMAC CCA2; constant-time comparison | ✅ (SHA-256 toggle absent: `hashlib` forbidden by CLAUDE.md) |

**Notable implementation decisions:**
- PA#4 "Reuse IV" checkbox label is dynamic: shows "(CBC — broken)", "(OFB — keystream reuse)", or "(CTR — broken)" depending on the selected mode.
- PA#5 API endpoints (`/api/mac/sign`, `/api/mac/verify`) accept an optional `mac_type` parameter (`"PRF"` or `"CBC"`) to route between `PRFMAC` and `CBCMAC`.
- PA#10 omits the SHA-256 comparison toggle intentionally — `hashlib` is forbidden. The length-extension demo runs entirely on the custom DLP hash from PA#8.

---

## Dependency Chain

The 20 PAs are not independent — each builds on the previous ones. The final MPC implementation has this dependency graph at runtime:

```
PA20 (MPC)
 └── PA19 (Secure AND)
      └── PA18 (OT)
           └── PA16 (ElGamal)
                └── PA13 (Miller-Rabin)  ← used in keygen for safe primes
PA17 (CCA PKC)
 ├── PA15 (RSA Signatures)
 │    └── PA08 (DLP Hash)
 │         └── PA07 (Merkle-Damgård)
 └── PA16 (ElGamal)
PA06 (CCA Enc)
 ├── PA03 (CPA Enc)
 │    └── PA02 (AES PRF)
 └── PA05 (MAC)
          └── PA02 (AES PRF)
```

This means running a single MPC computation in the browser exercises most of the codebase.
