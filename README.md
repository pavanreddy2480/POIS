# CS8.401 — Principles of Information Security
## The Minicrypt Clique Explorer

A complete, from-scratch implementation of the **Minicrypt Clique** — the equivalence theorem linking One-Way Functions, PRGs, PRFs, PRPs, MACs, CRHFs, HMAC, and beyond, all the way up to 2-Party MPC.

No external cryptographic libraries. Every algorithm is hand-built in Python.

---

## Quick Start

```bash
cd cs8401-pois
./run.sh          # starts backend on :8000 + frontend on :5173
```

Then open **http://localhost:5173** in your browser.

Or start manually:
```bash
# Terminal 1 — Python backend
pip install -r requirements.txt
python3 -m uvicorn src.api.server:app --reload --port 8000

# Terminal 2 — React frontend
cd web && npm install && npm run dev
```

---

## Project Structure

```
cs8401-pois/
├── src/
│   ├── pa01_owf_prg/       PA#1  — DLP OWF + HILL PRG
│   ├── pa02_prf/           PA#2  — AES-128 from scratch + GGM PRF
│   ├── pa03_cpa_enc/       PA#3  — CPA-Secure Encryption (PRF-based)
│   ├── pa04_modes/         PA#4  — CBC, OFB, CTR modes
│   ├── pa05_mac/           PA#5  — PRF-MAC + CBC-MAC
│   ├── pa06_cca_enc/       PA#6  — CCA-Secure Encryption (Encrypt-then-MAC)
│   ├── pa07_merkle_damgard/ PA#7 — Merkle-Damgård hash transform
│   ├── pa08_dlp_hash/      PA#8  — DLP-based CRHF (h(x,y) = g^x · h^y mod p)
│   ├── pa09_birthday_attack/ PA#9 — Naive + Floyd cycle birthday attacks
│   ├── pa10_hmac/          PA#10 — HMAC + Encrypt-then-HMAC CCA
│   ├── pa11_dh/            PA#11 — Diffie-Hellman key exchange + MITM
│   ├── pa12_rsa/           PA#12 — RSA keygen + PKCS#1 v1.5
│   ├── pa13_miller_rabin/  PA#13 — Miller-Rabin primality + safe prime gen
│   ├── pa14_crt/           PA#14 — CRT + Håstad's broadcast attack
│   ├── pa15_signatures/    PA#15 — RSA hash-then-sign signatures
│   ├── pa16_elgamal/       PA#16 — ElGamal CPA encryption + malleability
│   ├── pa17_cca_pkc/       PA#17 — CCA-secure PKC (sign-then-encrypt)
│   ├── pa18_ot/            PA#18 — 1-of-2 Oblivious Transfer (Bellare-Micali)
│   ├── pa19_secure_and/    PA#19 — Secure AND (via OT) + free XOR/NOT
│   ├── pa20_mpc/           PA#20 — 2-Party MPC + Millionaire's Problem
│   └── api/
│       └── server.py       FastAPI REST server (all PA endpoints)
├── web/
│   ├── src/
│   │   ├── App.jsx          Main layout (Foundation toggle, Build/Reduce, Proof)
│   │   ├── api.js           Fetch client
│   │   └── components/
│   │       └── demos/       PA1Demo – PA20Demo (interactive React demos)
│   ├── package.json
│   └── vite.config.js       Proxies /api → :8000
├── requirements.txt
├── run.sh                   One-command startup script
└── README.md
```

---

## Assignment Overview: PA#0 – PA#20

### PA#0 — Web Application (React + FastAPI)
The Minicrypt Clique Explorer:
- **Foundation Toggle** — switch between AES (symmetric) and DLP (asymmetric) foundation
- **Build / Reduce Columns** — step-by-step chain: Foundation → Source primitive → Target primitive
- **Proof Panel** — displays the formal reduction theorem for each pair
- **20 Demo Tabs** — one per PA, interactive with live backend calls

---

### PA#1 — One-Way Function + PRG
**File:** `src/pa01_owf_prg/`

**OWF:** `f(x) = g^x mod p` over a safe prime group. Hard to invert (DLP assumption).

**PRG (HILL construction):** Iteratively extract hard-core bits from the OWF to produce a length-doubling pseudorandom generator.

Key insight: OWF ⟺ PRG (HILL theorem). Given an OWF, we can construct a PRG; if a PRG exists, it implies an OWF.

---

### PA#2 — Pseudorandom Function (AES-128 from scratch)
**Files:** `src/pa02_prf/aes_impl.py`, `src/pa02_prf/prf.py`

**AES-128 implementation includes:**
- **S-box** (256-byte forward and inverse lookup tables)
- **GF(2⁸) arithmetic** — `_xtime()` (multiply by x) and `_gf_mul()` (general field multiplication using irreducible polynomial 0x11b)
- **SubBytes / InvSubBytes** — non-linear S-box substitution
- **ShiftRows / InvShiftRows** — cyclic row shifts (row r shifts left by r positions)
- **MixColumns / InvMixColumns** — MDS matrix multiplication in GF(2⁸)
- **AddRoundKey** — XOR with round key
- **Key Expansion** — 10 round keys generated from 128-bit master key via RotWord, SubWord, XOR with Rcon

State representation: 4×4 column-major matrix `state[row][col] = byte[row + 4*col]`.

**AES-PRF:** `F_k(x) = AES_k(x)` — a block cipher is a PRP; the PRP/PRF switching lemma gives a PRF.

**GGM Tree PRF:** `F_k(b₁b₂…bₙ) = G_{bₙ}(…G_{b₁}(k)…)` where G is a length-doubling PRG.
- Given a key `k` and n-bit input, traverse the binary tree following bits b₁…bₙ.
- G₀(s) = left half of PRG(s), G₁(s) = right half.

---

### PA#3 — CPA-Secure Encryption
**File:** `src/pa03_cpa_enc/cpa_enc.py`

`Enc(k, m) = (r, F_k(r) ⊕ m)` where r is a fresh random nonce.

IND-CPA security: adversary cannot distinguish encryptions because each r is fresh and F_k is pseudorandom.

---

### PA#4 — Modes of Operation
**File:** `src/pa04_modes/modes.py`

- **CBC** (Cipher Block Chaining): `C_i = F_k(M_i ⊕ C_{i-1})`. IV must be random.
- **OFB** (Output Feedback): `C_i = M_i ⊕ F_k^i(IV)`. Turns block cipher into stream cipher.
- **CTR** (Counter Mode): `C_i = M_i ⊕ F_k(nonce ‖ i)`. Parallelizable.

All three achieve IND-CPA security with random IV/nonce.

---

### PA#5 — Message Authentication Code (MAC)
**File:** `src/pa05_mac/mac.py`

- **PRF-MAC:** `Mac_k(m) = F_k(m)`. Security follows from PRF security (EUF-CMA).
- **CBC-MAC:** Chain F_k over message blocks; only secure for fixed-length messages.

---

### PA#6 — CCA-Secure Symmetric Encryption (Encrypt-then-MAC)
**File:** `src/pa06_cca_enc/cca_enc.py`

`CCAEnc(kE, kM, m) = (r, c, t)` where:
- `(r, c) = CPAEnc(kE, m)` (PA#3)
- `t = MAC_{kM}(r ‖ c)` (PA#5)

Decryption verifies t first. Any tampering → reject. This achieves IND-CCA2.

---

### PA#7 — Merkle-Damgård Hash Transform
**File:** `src/pa07_merkle_damgard/merkle_damgard.py`

Turns a fixed-length collision-resistant compression function into a variable-length CRHF.

MD-strengthening: append message length before final block to prevent length-extension attacks.

`H(m) = compress(compress(IV, m₁), m₂) … compress(…, len(m))`

---

### PA#8 — DLP-Based Collision-Resistant Hash
**File:** `src/pa08_dlp_hash/dlp_hash.py`

`h(x, y) = g^x · ĥ^y mod p`

Collision resistance reduces to the Discrete Logarithm Problem: finding a collision for h would reveal `log_g(ĥ)`. Combined with PA#7's Merkle-Damgård transform to handle arbitrary-length messages.

---

### PA#9 — Birthday Attack
**File:** `src/pa09_birthday_attack/birthday_attack.py`

- **Naive birthday attack:** Hash random inputs, sort by digest, find collision. Finds collision in ~√(2^n) queries.
- **Floyd's cycle detection (tortoise-and-hare):** O(1) space collision finder using the cyclic function property.

For an n-bit hash, expected collisions after ~2^(n/2) queries (birthday paradox).

---

### PA#10 — HMAC
**File:** `src/pa10_hmac/hmac_impl.py`

`HMAC_k(m) = H((k ⊕ opad) ‖ H((k ⊕ ipad) ‖ m))`

- **ipad** = `0x36` repeated, **opad** = `0x5c` repeated (64-byte blocks)
- Uses PA#8 DLP hash as H
- **Length-extension resistance**: unlike plain Merkle-Damgård, HMAC prevents length-extension attacks because the outer hash re-wraps the inner hash.

Also implements `EtHEnc`: Encrypt-then-HMAC CCA-secure scheme (replaces PA#6 MAC with HMAC).

---

### PA#11 — Diffie-Hellman Key Exchange
**File:** `src/pa11_dh/dh.py`

Over a safe prime group (p = 2q+1, both p and q prime):
- Alice: pick secret `a`, send `A = g^a mod p`
- Bob: pick secret `b`, send `B = g^b mod p`
- Shared key: `K = B^a = A^b = g^{ab} mod p`

CDH hardness: given (g, g^a, g^b), cannot compute g^{ab}.

**MITM attack demo:** Eve intercepts and substitutes g^e for both parties, establishing separate keys with each.

---

### PA#12 — RSA Cryptosystem
**File:** `src/pa12_rsa/rsa.py`

**Key generation (128-bit minimum, 512-bit for production):**
1. Generate primes p, q using Miller-Rabin (PA#13)
2. N = pq, φ(N) = (p-1)(q-1)
3. e = 65537, d = e⁻¹ mod φ(N)
4. CRT params: dp = d mod (p-1), dq = d mod (q-1), q_inv = q⁻¹ mod p

**CRT Decryption (Garner's algorithm):** ~4× faster than naive c^d mod N.

**PKCS#1 v1.5 Padding:** `EM = 0x00 ‖ 0x02 ‖ PS ‖ 0x00 ‖ M` where PS is random nonzero bytes (≥8). Prevents determinism attacks — encrypting the same message twice gives different ciphertexts.

**Determinism demo:** Raw RSA is deterministic (same m → same c); PKCS randomizes each encryption.

---

### PA#13 — Miller-Rabin Primality Test
**File:** `src/pa13_miller_rabin/miller_rabin.py`

**Algorithm:** Write n-1 = 2^s · d. For k rounds, pick random a, check if:
- `a^d ≡ 1 (mod n)`, OR
- `a^{2^r·d} ≡ -1 (mod n)` for some r in [0, s-1]

If neither holds, n is definitely composite. After k rounds: Pr[error] ≤ 4^{-k}.

**Carmichael numbers:** 561 = 3·11·17 passes Fermat's test (a^{560} ≡ 1 for all gcd(a,561)=1) but Miller-Rabin correctly identifies it as COMPOSITE.

**Safe prime generation:** `gen_safe_prime(bits)` returns (p, q) where p = 2q+1 and both are prime — required for DLP-based cryptography.

---

### PA#14 — Chinese Remainder Theorem + Håstad's Attack
**File:** `src/pa14_crt/crt.py`

**CRT:** Given `x ≡ rᵢ (mod nᵢ)` with pairwise coprime moduli, unique solution mod ∏nᵢ via Garner's formula.

**Håstad's Broadcast Attack:**
If m^e < N₁·N₂·N₃ (e.g., e=3 and m is small):
1. Collect c₁ = m³ mod N₁, c₂ = m³ mod N₂, c₃ = m³ mod N₃
2. Apply CRT: recover x = m³ mod (N₁N₂N₃)
3. Since m³ < N₁N₂N₃, x = m³ exactly (not modular!)
4. Compute ∛x using Newton's method → m

This breaks RSA with e=3 when the same small plaintext is sent to 3 recipients.

---

### PA#15 — Digital Signatures
**File:** `src/pa15_signatures/signatures.py`

**Hash-then-sign RSA:**
- Sign: `σ = H(m)^d mod N`
- Verify: `σ^e mod N == H(m)`

Using PA#8 DLP hash as H.

**Why hash is necessary:** Raw RSA signatures (no hash) are multiplicatively homomorphic: `sign(m₁) · sign(m₂) = sign(m₁·m₂) mod N`. This allows forgery of new valid signatures without the secret key.

---

### PA#16 — ElGamal Encryption
**File:** `src/pa16_elgamal/elgamal.py`

**CPA-secure public-key encryption over DLP group:**
- KeyGen: sk = x ∈ Z_q, pk = (p, g, q, h = g^x mod p)
- Enc(pk, m): pick r ← Z_q; return (c₁ = g^r, c₂ = m · h^r mod p)
- Dec(sk, c₁, c₂): return c₂ · (c₁^x)^{-1} = m · (g^{rx}) · (g^{rx})^{-1} = m

**Malleability:** Multiplying c₂ by k gives Dec(c₁, k·c₂) = k·m. This means CPA-secure ElGamal is NOT CCA-secure.

---

### PA#17 — CCA-Secure Public-Key Cryptography
**File:** `src/pa17_cca_pkc/cca_pkc.py`

**Signcryption (Sign-then-Encrypt):**
1. Sign: `σ = RSASign(sk_sign, m)` (PA#15)
2. Encrypt: `CE = ElGamal_Enc(pk_enc, m ‖ σ)` (PA#16)
3. Decrypt: Verify σ first; if invalid → ⊥ (reject)

Any ciphertext tampering changes CE, invalidating σ, so the oracle always returns ⊥ on modified ciphertexts — achieving IND-CCA2.

---

### PA#18 — 1-out-of-2 Oblivious Transfer (Bellare-Micali)
**File:** `src/pa18_ot/ot.py`

Receiver has choice bit b ∈ {0,1}, sender has messages (m₀, m₁).

**Protocol:**
1. Receiver generates honest ElGamal key pair (sk_b, pk_b) for index b.
   For index 1-b, receiver sends a random group element (no secret key).
2. Sender encrypts: C₀ = ElGamal_Enc(pk₀, m₀), C₁ = ElGamal_Enc(pk₁, m₁).
3. Receiver decrypts C_b using sk_b; cannot decrypt C_{1-b} (no trapdoor).

Security:
- **Receiver privacy:** Both public keys look uniform to the sender; b is statistically hidden.
- **Sender privacy:** Receiver can only decrypt C_b (no key for the other).

---

### PA#19 — Secure AND Gate
**File:** `src/pa19_secure_and/secure_and.py`

**Secure AND via OT:**
- Alice holds bit a, Bob holds bit b.
- Alice acts as OT sender with messages (0, a).
- Bob acts as OT receiver with choice bit b.
- Bob receives m_b = a∧b (since m₀=0 and m₁=a).

**Free XOR:** a ⊕ b requires no interaction — each party locally XORs their private shares. (Additive secret sharing over Z₂.)

**Free NOT:** locally flip the bit (no interaction needed).

---

### PA#20 — 2-Party Secure MPC (Millionaire's Problem)
**Files:** `src/pa20_mpc/circuit.py`, `src/pa20_mpc/mpc.py`

**Boolean circuit evaluation:**
- Circuits are DAGs of AND/XOR/NOT gates over wire indices.
- Inputs: x_Alice (first n_bits wires) + y_Bob (next n_bits wires).
- Each AND gate calls PA#19 secure AND (costs 1 OT).
- Each XOR gate is free (no OT needed).

**Comparison circuit (MSB-first ripple comparator):**
Tracks (GT, EQ) state per bit:
```
new_GT = (EQ ∧ x[i] ∧ ¬y[i]) ∨ GT
new_EQ = EQ ∧ (x[i] ⊕ y[i] = 0)
```
OR gates implemented as: `a ∨ b = a ⊕ b ⊕ (a ∧ b)`.

**Millionaire's problem:** Alice has x, Bob has y. They securely compute x > y and x == y using the comparison circuit, revealing only the comparison result — not the actual values.

---

## REST API Reference

The FastAPI server runs at `http://localhost:8000`. Interactive docs at `/docs`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/owf/evaluate` | POST | Evaluate DLP OWF |
| `/api/prg/generate` | POST | Generate PRG output from seed |
| `/api/prf/evaluate` | POST | AES-PRF evaluation |
| `/api/prf/ggm_tree` | POST | GGM tree path tracing |
| `/api/enc/cpa` | POST | CPA encrypt |
| `/api/enc/dec` | POST | CPA decrypt |
| `/api/modes/{mode}/encrypt` | POST | CBC/OFB/CTR encryption |
| `/api/mac/sign` | POST | PRF-MAC sign |
| `/api/mac/verify` | POST | PRF-MAC verify |
| `/api/cca/encrypt` | POST | Encrypt-then-MAC |
| `/api/hash/dlp` | POST | DLP-based hash |
| `/api/hash/merkle_damgard` | POST | MD hash |
| `/api/birthday/attack` | POST | Birthday collision search |
| `/api/hmac/sign` | POST | HMAC |
| `/api/dh/exchange` | POST | Full DH exchange |
| `/api/rsa/keygen` | POST | RSA key generation |
| `/api/rsa/demo` | POST | Determinism / PKCS demo |
| `/api/miller_rabin/test` | POST | Primality test |
| `/api/miller_rabin/gen_prime` | POST | Generate prime |
| `/api/hastad/demo` | POST | Håstad broadcast attack |
| `/api/sig/demo` | POST | Sign + verify + forgery demo |
| `/api/elgamal/demo` | POST | ElGamal + malleability demo |
| `/api/cca/demo` | POST | CCA sign-then-encrypt demo |
| `/api/ot/run` | POST | 1-of-2 OT protocol |
| `/api/secure_and/compute` | POST | Secure AND/XOR/NOT |
| `/api/mpc/millionaire` | POST | Millionaire's problem |
| `/api/reduce` | POST | Reduction path lookup |
| `/api/reduce/all` | GET | All 27+ reduction pairs in routing table |

---

## The Minicrypt Clique Theorem

All primitives in the **Minicrypt** (symmetric-key world) are equivalent:

```
OWF ⟺ PRG ⟺ PRF ⟺ OWP ⟺ PRP ⟺ MAC ⟺ CRHF ⟺ HMAC
```

**Forward reductions:**
- OWF → PRG: HILL hard-core bit construction
- PRG → PRF: GGM binary tree construction (PA#2)
- PRF → PRP: Luby-Rackoff 3-round Feistel (PA#4)
- PRF → MAC: F_k(m) is a secure MAC (PA#5)
- CRHF → HMAC: double-hash construction (PA#10)
- PRF → CRHF: MD construction with PRF compression function

**Backward reductions (each primitive implies the weakest):**
- PRG → OWF: If we have a PRG, any injective function computable from it is a OWF
- MAC → PRF: A secure MAC can be used as a PRF
- PRP → PRF: PRP/PRF switching lemma (distinguishing advantage ≤ q²/2^n)

---

## Security Properties Demonstrated

| Property | Demonstrated In |
|----------|----------------|
| IND-CPA security | PA#3, PA#4 |
| IND-CCA2 security | PA#6, PA#17 |
| EUF-CMA (MAC security) | PA#5, PA#10 |
| Collision resistance | PA#8, PA#9 |
| Length-extension resistance | PA#10 (HMAC vs MD) |
| CDH / DLP hardness | PA#1, PA#8, PA#11 |
| RSA security (integer factoring) | PA#12, PA#14 |
| Receiver/sender privacy in OT | PA#18 |
| Information-theoretic privacy in MPC | PA#19, PA#20 |

---

## Testing Individual Modules

Each PA module has a `__main__` block with self-tests:

```bash
python3 src/pa02_prf/aes_impl.py     # AES self-test
python3 src/pa12_rsa/rsa.py           # RSA keygen + encrypt/decrypt
python3 src/pa13_miller_rabin/miller_rabin.py  # Primality tests
python3 src/pa14_crt/crt.py           # CRT + Håstad
python3 src/pa15_signatures/signatures.py      # Sign + verify
python3 src/pa16_elgamal/elgamal.py   # ElGamal + malleability
python3 src/pa17_cca_pkc/cca_pkc.py   # CCA sign-then-encrypt
python3 src/pa18_ot/ot.py             # OT protocol
python3 src/pa19_secure_and/secure_and.py     # Secure AND truth table
python3 src/pa20_mpc/mpc.py           # Millionaire's problem
```

---

## Design Decisions

### No External Crypto Libraries
Per assignment spec: no `hashlib` (for hashes), no `PyCryptodome`, no `OpenSSL`. Only Python built-ins (`os.urandom`, `int`) are used. AES-128 is implemented fully from scratch including the GF(2⁸) arithmetic.

### Toy Parameters for Interactive Demos
Safe prime generation uses 32-bit primes for sub-second demo performance. In a production deployment, 2048-bit+ keys would be used. The algorithms are identical; only parameter sizes differ.

### State Representation in AES
The AES state is stored as `state[row][col]` where `state[r][c] = byte[r + 4*c]` (column-major byte loading, matching FIPS-197 section 3.4). The `_state_to_bytes` function outputs in the same column-major order.

### GGM PRF Key Length
The GGM tree PRF uses the PRG to double key length at each node. For n-bit inputs, the tree has n levels and processes n bits of the query.

### MPC Circuit Correctness
The comparison circuit uses a 2-state (GT, EQ) ripple comparator scanning from MSB to LSB. OR gates are implemented as `a ∨ b = a ⊕ b ⊕ (a ∧ b)` since boolean circuits only have AND, XOR, NOT.

---

## Acknowledgements

- FIPS-197 (AES specification) — NIST
- Bellare & Rogaway — Foundations of Cryptography
- Goldreich — Foundations of Cryptography Vols. I & II
- Boneh & Shoup — A Graduate Course in Applied Cryptography
- HILL Theorem: Håstad, Impagliazzo, Levin, Luby (1999)
- GGM PRF: Goldreich, Goldwasser, Micali (1986)
- Håstad Broadcast Attack: Håstad (1988)
- Bellare-Micali OT: Bellare & Micali (1989)
