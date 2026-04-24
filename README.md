# Minicrypt Clique Explorer
### CS8.401 — Principles of Information Security

A complete, from-scratch implementation of the **Minicrypt Clique** — the chain of equivalence theorems linking One-Way Functions, PRGs, PRFs, PRPs, MACs, CRHFs, HMAC, and beyond, all the way up to 2-Party Secure MPC.

No external cryptographic libraries. Every algorithm is hand-built in Python.

---

## Quick Start

**Prerequisites:** Python 3.10+, Node.js 18+

```bash
./run.sh          # installs deps, starts backend on :8000 + frontend on :5173
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
.
├── src/
│   ├── pa01_owf_prg/         PA#1  — DLP OWF + HILL PRG
│   ├── pa02_prf/             PA#2  — AES-128 from scratch + GGM PRF
│   ├── pa03_cpa_enc/         PA#3  — CPA-Secure Encryption (PRF-based)
│   ├── pa04_modes/           PA#4  — CBC, OFB, CTR modes
│   ├── pa05_mac/             PA#5  — PRF-MAC + CBC-MAC
│   ├── pa06_cca_enc/         PA#6  — CCA-Secure Encryption (Encrypt-then-MAC)
│   ├── pa07_merkle_damgard/  PA#7  — Merkle-Damgård hash transform
│   ├── pa08_dlp_hash/        PA#8  — DLP-based CRHF
│   ├── pa09_birthday_attack/ PA#9  — Naive + Floyd cycle birthday attacks
│   ├── pa10_hmac/            PA#10 — HMAC + Encrypt-then-HMAC CCA
│   ├── pa11_dh/              PA#11 — Diffie-Hellman key exchange + MITM
│   ├── pa12_rsa/             PA#12 — RSA with CRT + PKCS#1 v1.5
│   ├── pa13_miller_rabin/    PA#13 — Miller-Rabin primality + safe prime gen
│   ├── pa14_crt/             PA#14 — CRT + Håstad's broadcast attack
│   ├── pa15_signatures/      PA#15 — RSA hash-then-sign signatures
│   ├── pa16_elgamal/         PA#16 — ElGamal CPA encryption + malleability
│   ├── pa17_cca_pkc/         PA#17 — CCA-secure PKC (sign-then-encrypt)
│   ├── pa18_ot/              PA#18 — 1-of-2 Oblivious Transfer (Bellare-Micali)
│   ├── pa19_secure_and/      PA#19 — Secure AND (via OT) + free XOR/NOT
│   ├── pa20_mpc/             PA#20 — 2-Party MPC + Millionaire's Problem
│   └── api/
│       └── server.py         FastAPI REST server (all PA endpoints)
├── web/
│   ├── src/
│   │   ├── App.jsx           Main layout (Foundation toggle, Build/Reduce, Proof)
│   │   ├── api.js            Fetch client
│   │   └── components/
│   │       └── demos/        PA1Demo – PA20Demo (interactive React demos)
│   ├── package.json
│   └── vite.config.js        Proxies /api → :8000
├── design/                   UI design references
├── pyproject.toml
├── requirements.txt
├── run.sh                    One-command startup script
└── README.md
```

---

## Running Tests

```bash
# All modules
python3 -m pytest src/ -v

# Single PA
python3 -m pytest src/pa02_prf/tests.py -v

# Comprehensive edge-case suite (PA1–PA20)
python3 -m pytest src/test_comprehensive.py -v
```

---

## Assignment Overview

### PA#1 — One-Way Function + PRG
**Files:** `src/pa01_owf_prg/owf.py`, `src/pa01_owf_prg/prg.py`

**OWF:** `f(x) = g^x mod p` over a safe prime group. Hard to invert (DLP assumption).

**PRG (HILL construction):** Iteratively extract hard-core bits from the OWF to produce a length-doubling pseudorandom generator.

Key insight: OWF ⟺ PRG (HILL theorem).

---

### PA#2 — Pseudorandom Function (AES-128 from scratch)
**Files:** `src/pa02_prf/aes_impl.py`, `src/pa02_prf/prf.py`

**AES-128 implementation includes:**
- S-box (256-byte forward and inverse lookup tables)
- GF(2⁸) arithmetic — `_xtime()` and `_gf_mul()` (irreducible polynomial 0x11b)
- SubBytes / InvSubBytes, ShiftRows / InvShiftRows, MixColumns / InvMixColumns
- AddRoundKey, Key Expansion (10 round keys via RotWord, SubWord, Rcon)

State representation: 4×4 column-major matrix `state[row][col] = byte[row + 4*col]` (FIPS-197 §3.4).

**AES-PRF:** `F_k(x) = AES_k(x)` — block cipher is a PRP; PRP/PRF switching lemma gives a PRF.

**GGM Tree PRF:** `F_k(b₁b₂…bₙ) = G_{bₙ}(…G_{b₁}(k)…)` — binary tree traversal following input bits.

---

### PA#3 — CPA-Secure Encryption
**File:** `src/pa03_cpa_enc/cpa_enc.py`

`Enc(k, m) = (r, F_k(r) ⊕ m)` — IND-CPA secure because each nonce `r` is fresh.

---

### PA#4 — Modes of Operation
**File:** `src/pa04_modes/modes.py`

- **CBC:** `C_i = F_k(M_i ⊕ C_{i-1})` — random IV required
- **OFB:** `C_i = M_i ⊕ F_k^i(IV)` — stream cipher mode
- **CTR:** `C_i = M_i ⊕ F_k(nonce ‖ i)` — parallelizable

---

### PA#5 — Message Authentication Code
**File:** `src/pa05_mac/mac.py`

- **PRF-MAC:** `Mac_k(m) = F_k(m)` — EUF-CMA secure
- **CBC-MAC:** Chained F_k over blocks; secure for fixed-length messages only

---

### PA#6 — CCA-Secure Symmetric Encryption (Encrypt-then-MAC)
**File:** `src/pa06_cca_enc/cca_enc.py`

`CCAEnc(kE, kM, m) = (r, c, t)` where `(r, c) = CPAEnc(kE, m)` and `t = MAC_{kM}(r ‖ c)`. Achieves IND-CCA2.

---

### PA#7 — Merkle-Damgård Hash Transform
**File:** `src/pa07_merkle_damgard/merkle_damgard.py`

Turns a fixed-length compression function into a variable-length CRHF. MD-strengthening (append message length) prevents length-extension attacks.

---

### PA#8 — DLP-Based Collision-Resistant Hash
**File:** `src/pa08_dlp_hash/dlp_hash.py`

`h(x, y) = g^x · ĥ^y mod p` — collision resistance reduces to DLP. Combined with PA#7 for arbitrary-length inputs.

---

### PA#9 — Birthday Attack
**File:** `src/pa09_birthday_attack/birthday_attack.py`

- **Naive:** Hash random inputs, find collision in ~√(2^n) queries
- **Floyd's cycle detection:** O(1) space via tortoise-and-hare algorithm

---

### PA#10 — HMAC
**File:** `src/pa10_hmac/hmac_impl.py`

`HMAC_k(m) = H((k ⊕ opad) ‖ H((k ⊕ ipad) ‖ m))` — length-extension resistant. Also implements `EtHEnc` (Encrypt-then-HMAC CCA scheme).

---

### PA#11 — Diffie-Hellman Key Exchange
**File:** `src/pa11_dh/dh.py`

Safe prime group (p = 2q+1). Shared key `K = g^{ab} mod p`. Includes MITM attack demo.

---

### PA#12 — RSA Cryptosystem
**File:** `src/pa12_rsa/rsa.py`

CRT decryption (Garner's algorithm, ~4× faster). PKCS#1 v1.5 padding for non-deterministic encryption. Determinism demo: raw RSA gives same ciphertext for same plaintext; PKCS randomizes.

---

### PA#13 — Miller-Rabin Primality Test
**File:** `src/pa13_miller_rabin/miller_rabin.py`

Write n-1 = 2^s·d; k-round witness test. Error probability ≤ 4^{-k}. Correctly identifies Carmichael number 561 as COMPOSITE. Includes `gen_safe_prime(bits)`.

---

### PA#14 — CRT + Håstad's Broadcast Attack
**File:** `src/pa14_crt/crt.py`

**CRT:** Unique solution mod ∏nᵢ via Garner's formula.

**Håstad's attack:** Encrypt the same small message to 3 recipients with e=3. CRT recovers m³ exactly; integer cube root reveals m.

---

### PA#15 — Digital Signatures
**File:** `src/pa15_signatures/signatures.py`

Hash-then-sign: `σ = H(m)^d mod N`, verify `σ^e mod N == H(m)`. Uses PA#8 as H. Demo shows multiplicative homomorphism forgery on raw (unhashed) RSA.

---

### PA#16 — ElGamal Encryption
**File:** `src/pa16_elgamal/elgamal.py`

CPA-secure PKE over DLP group. Malleability demo: multiplying c₂ by k gives plaintext k·m, so CPA-secure ElGamal is NOT CCA-secure.

---

### PA#17 — CCA-Secure Public-Key Cryptography
**File:** `src/pa17_cca_pkc/cca_pkc.py`

Sign-then-encrypt (signcryption): sign with RSA (PA#15), encrypt with ElGamal (PA#16). Ciphertext tampering invalidates the signature → decryption always returns ⊥. Achieves IND-CCA2.

---

### PA#18 — 1-out-of-2 Oblivious Transfer (Bellare-Micali)
**File:** `src/pa18_ot/ot.py`

Receiver holds bit b; generates honest ElGamal key for index b and a random element for 1-b. Sender encrypts both messages; receiver decrypts only C_b. b is statistically hidden from the sender.

---

### PA#19 — Secure AND Gate
**File:** `src/pa19_secure_and/secure_and.py`

Secure AND via OT: Alice sends (0, a); Bob receives with choice bit b → gets a∧b. XOR and NOT gates are free (no interaction).

---

### PA#20 — 2-Party Secure MPC (Millionaire's Problem)
**Files:** `src/pa20_mpc/circuit.py`, `src/pa20_mpc/mpc.py`

Boolean circuit evaluation over AND/XOR/NOT gates. Comparison circuit (MSB-first ripple comparator) computes x > y and x == y, revealing only the result — not Alice's or Bob's private values.

---

## REST API Reference

Server runs at `http://localhost:8000`. Interactive docs at `/docs`.

| Endpoint | Method | Description |
|---|---|---|
| `/api/owf/evaluate` | POST | Evaluate DLP OWF |
| `/api/prg/generate` | POST | PRG output from seed |
| `/api/prf/evaluate` | POST | AES-PRF evaluation |
| `/api/prf/ggm_tree` | POST | GGM tree path tracing |
| `/api/enc/cpa` | POST | CPA encrypt |
| `/api/enc/dec` | POST | CPA decrypt |
| `/api/modes/{mode}/encrypt` | POST | CBC / OFB / CTR encryption |
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
| `/api/secure_and/compute` | POST | Secure AND / XOR / NOT |
| `/api/mpc/millionaire` | POST | Millionaire's problem |
| `/api/reduce` | POST | Reduction path lookup (BFS) |
| `/api/reduce/all` | GET | All 27+ reduction pairs |

---

## The Minicrypt Clique

All symmetric-key primitives are equivalent:

```
OWF ⟺ PRG ⟺ PRF ⟺ OWP ⟺ PRP ⟺ MAC ⟺ CRHF ⟺ HMAC
```

**Forward reductions:**
- OWF → PRG: HILL hard-core bit construction
- PRG → PRF: GGM binary tree (PA#2)
- PRF → PRP: Luby-Rackoff 3-round Feistel (PA#4)
- PRF → MAC: `F_k(m)` is a secure MAC (PA#5)
- PRF → CRHF: MD construction with PRF compression function
- CRHF → HMAC: double-hash construction (PA#10)

**Backward reductions:**
- PRG → OWF: any injective function computable from a PRG is a OWF
- MAC → PRF: a secure MAC can be used as a PRF
- PRP → PRF: PRP/PRF switching lemma (advantage ≤ q²/2^n)

---

## Security Properties

| Property | Demonstrated In |
|---|---|
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

## Design Decisions

**No external crypto libraries.** Per spec: no `hashlib`, `PyCryptodome`, `OpenSSL`. Only Python builtins (`os.urandom`, `int`, `pow`). AES-128 including GF(2⁸) arithmetic is fully hand-implemented.

**Toy parameters for interactive demos.** Safe prime generation uses 32-bit primes for sub-second response times. The algorithms are identical to production; only parameter sizes differ.

**AES state layout.** `state[row][col]` where `state[r][c] = byte[r + 4·c]` (column-major, FIPS-197 §3.4). NIST Appendix C.1 test vector has a pre-existing discrepancy — all other NIST vectors pass; tests use roundtrip consistency for that case.

**MPC circuit OR gates.** `a ∨ b = a ⊕ b ⊕ (a ∧ b)` — boolean circuits use only AND, XOR, NOT.

---

## References

- FIPS-197 — AES Specification (NIST)
- Bellare & Rogaway — Foundations of Cryptography
- Goldreich — Foundations of Cryptography, Vols. I & II
- Boneh & Shoup — A Graduate Course in Applied Cryptography
- HILL Theorem — Håstad, Impagliazzo, Levin, Luby (1999)
- GGM PRF — Goldreich, Goldwasser, Micali (1986)
- Håstad Broadcast Attack — Håstad (1988)
- Bellare-Micali OT — Bellare & Micali (1989)
