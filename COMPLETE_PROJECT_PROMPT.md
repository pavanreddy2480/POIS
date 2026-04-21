# CS8.401 POIS — Complete Project Finish Prompt

Paste this entire prompt into a new Claude Code session to finish the project end-to-end.

---

## Context

You are completing **CS8.401: Principles of Information Security — The Minicrypt Clique Explorer**.

**What already exists:**
- All 20 PA Python modules in `src/pa01_owf_prg/` through `src/pa20_mpc/`
- FastAPI backend at `src/api/server.py` with endpoints for all PAs
- React frontend at `web/` — dark theme, two-column layout (BuildPanel + ReducePanel), ProofPanel, DemoSection with 20 demo tabs
- `run.sh` that starts both servers; Vite proxies `/api` → `localhost:8000`
- Agent files in `.github/agents/` (orchestrator, coder, tester, security-auditor, reviewer, frontend-design, architect, etc.)

**What is missing or broken:**
- Tests missing for PA#8, PA#10–PA#20; PA#9 tests.py is empty
- Backward reductions unverified across all PAs (bidirectionality is required for full credit)
- Backend routing table incomplete (only 8 of the needed ~30+ reduction pairs)
- Some PA implementations may be stubs or incorrect (verify each)
- UI demo components (PA1Demo–PA20Demo) are present but varying quality — needs consistent polish
- GGM tree in PA#2 demo is text-only; needs actual visual tree diagram
- No import scan to verify no external crypto libraries are used
- `web/vite.config.js` proxy may not be configured

**Hard rules — never violate:**
1. **No external crypto libraries.** Allowed only: Python `int`, `os.urandom`, `secrets`, FastAPI, uvicorn, pydantic, pytest, ruff. No PyCryptodome, cryptography, hashlib (as dep), OpenSSL. In React: no crypto-js, forge, tweetnacl, sjcl.
2. **Both directions** (forward A→B AND backward B→A) must be implemented and tested for every adjacent Minicrypt Clique pair.
3. **Interface contracts** must be exact — each PA's public API must match the spec so downstream PAs work as black boxes.

---

## Instructions for the Orchestrator

Use the agents in `.github/agents/` to coordinate all work. Dispatch them in the order below. Track completion status after each phase.

---

## Phase 0 — Environment Verification

Before doing anything else:

1. Run `./run.sh` in the background, verify both servers start without errors
2. Check `web/vite.config.js` — if there is no proxy config pointing `/api` → `http://localhost:8000`, add it:
   ```js
   server: { proxy: { '/api': 'http://localhost:8000' } }
   ```
3. Verify `pip install -r requirements.txt` succeeds cleanly
4. Run `cd web && npm install` and confirm zero errors
5. Scan all Python files for forbidden imports — run:
   ```bash
   grep -r "pycryptodome\|from cryptography\|import hashlib\|import hmac\|from Crypto" src/
   ```
   Fix any violations immediately — this is the most critical rule.

---

## Phase 1 — Backend Completeness Audit (code-explorer + security-auditor)

**Dispatch code-explorer agent** to audit every PA module:

For each PA (PA#1–PA#20), verify:
- [ ] Core algorithm is correctly implemented (not a stub returning fixed values)
- [ ] Forward reduction implemented
- [ ] Backward reduction implemented
- [ ] Public interface matches the spec contracts below
- [ ] `os.urandom` used for all randomness (no `random.random()`)

**Required interface contracts:**
```
PA#1  owf.evaluate(x: int) -> int
      owf.verify_hardness(x: int) -> dict
      prg.generate(seed: bytes, length: int) -> bytes
      prg.seed(s: bytes); prg.next_bits(n: int) -> bytes

PA#2  prf.F(k: bytes, x: bytes) -> bytes
      prf.get_tree_path(k: bytes, x: bytes) -> list[dict]  # for GGM visualizer
      Backward: G(s) = F_s(0^n) || F_s(1^n)

PA#3  enc.enc(k: bytes, m: bytes) -> (r: bytes, c: bytes)
      enc.dec(k: bytes, r: bytes, c: bytes) -> bytes
      Backward: deterministic enc (nonce reuse demo) must be implemented

PA#4  CBCMode(prf).encrypt(k, iv, m) -> bytes
      OFBMode(prf).encrypt(k, iv, m) -> bytes
      CTRMode(prf).encrypt(k, m) -> (nonce, ciphertext)
      All three have matching decrypt methods

PA#5  mac.mac(k: bytes, m: bytes) -> bytes
      mac.vrfy(k: bytes, m: bytes, tag: bytes) -> bool
      Backward: EUF-CMA forgery attempt must be demonstrated

PA#6  cca.cca_enc(kE, kM, m) -> (r, c, tag)
      cca.cca_dec(kE, kM, r, c, tag) -> bytes | None  (None if tag invalid)

PA#7  md.hash(msg: bytes) -> bytes  (Merkle-Damgård)

PA#8  dlp_hash.hash(msg: bytes) -> bytes  (DLP-based CRHF)

PA#9  birthday_attack(hash_fn, n_bits) -> dict with {m1, m2, attempts, collision_found}

PA#10 hmac.mac(k: bytes, m: bytes) -> bytes
      hmac.verify(k: bytes, m: bytes, tag: bytes) -> bool
      Structure: H((k⊕opad) || H((k⊕ipad) || m)) — must use PA#8 DLP hash, not stdlib

PA#11 dh.full_exchange() -> dict with {p, g, alice_pub, bob_pub, shared_secret}

PA#12 rsa.keygen(bits) -> {pk: (N, e), sk: {d, p, q}}
      rsa.rsa_enc(pk, m: int) -> int
      rsa.rsa_dec_crt(sk, c: int) -> int
      rsa.pkcs15_enc/pkcs15_dec must exist

PA#13 miller_rabin(n: int, k: int) -> bool
      gen_prime(bits: int) -> int

PA#14 crt(residues, moduli) -> int
      hastad_attack(ciphertexts, moduli, e=3) -> int  (recovered m)

PA#15 sig.sign(sk, m: bytes) -> int
      sig.verify(pk, m: bytes, sigma: int) -> bool
      sig.multiplicative_forgery_demo(pk, m1, s1, m2, s2) -> dict

PA#16 elgamal.keygen() -> {pk: {p,g,q,h}, sk: int}
      elgamal.enc(pk, m: int) -> (c1: int, c2: int)
      elgamal.dec(sk, pk, c1, c2) -> int

PA#17 cca_pkc.enc(pk_enc, sk_sign, pk_sign, m) -> payload dict
      cca_pkc.dec(sk_enc, pk_enc, pk_sign, payload) -> int | None

PA#18 ot.full_protocol(b: int, m0: int, m1: int) -> dict
      Receiver learns m_b, sender learns nothing

PA#19 gates.AND(a, b) -> int
      gates.XOR(a, b) -> int  (must be free/local)
      gates.NOT(a) -> int

PA#20 millionaires_problem(x, y, n_bits) -> dict with {winner, x_gt_y}
      secure_equality(x, y, n_bits) -> dict with {equal}
```

**Fix any incorrect, stub, or missing implementations.** Use the coder agent for all fixes.

---

## Phase 2 — Tests (tester agent)

Write and run tests for every PA that is missing them. Priority order:

**PA#8** — add `tests.py`:
- Hash is deterministic (same input → same output)
- Hash is collision-resistant at the DLP group size
- Compression function is PRF-secure (distinguishing game)

**PA#9** — fill in `tests.py`:
- Birthday attack finds collision in O(2^(n/2)) attempts for n=12
- Collision is genuine (hash(m1) == hash(m2), m1 != m2)
- Expected attempts ≈ 2^6 = 64

**PA#10–PA#20** — add `tests.py` to each:
- HMAC: double-hash structure verified; uses PA#8 hash not stdlib
- DH: both parties compute identical shared secret
- RSA: encrypt(decrypt(m)) == m; CRT decryption matches standard decryption
- Miller-Rabin: all primes ≤ 1000 pass; composites fail with k=20
- CRT: solve([2,3,2], [3,5,7]) == 23
- Signatures: valid sig verifies; tampered message fails; multiplicative forgery demo works
- ElGamal: enc/dec roundtrip; malleability demo (c2' = λ·c2 → dec = λ·m)
- CCA-PKC: decrypt succeeds with valid ciphertext; fails with tampered c2
- OT: receiver gets m_b; protocol dict contains only result (sender inputs hidden from output)
- SecureAND: AND(1,1)=1, AND(1,0)=0, AND(0,0)=0; XOR works
- MPC: millionaires gives correct winner for x>y, x<y, x==y

**Security game simulations (add to relevant test files):**
- IND-CPA game (PA#3): run 50 rounds, confirm advantage ≤ 0.1
- IND-CPA broken variant (nonce reuse): confirm advantage = 1.0
- EUF-CMA game (PA#5): confirm forgery attempt fails without querying MAC oracle for same message
- IND-CCA game (PA#6): tampered ciphertext must be rejected

Run `pytest src/ -v` — all tests must pass before proceeding.

---

## Phase 3 — Backend Routing Table Completion (api-agent)

Expand `src/api/server.py` `ROUTING_TABLE` to include ALL supported reduction paths. Add these missing entries:

```python
# Backward reductions (B→A)
("PRG", "OWF"): backward PRG→OWF
("PRF", "PRG"): G(s) = F_s(0^n) || F_s(1^n)
("PRP", "PRF"): PRP is PRF on super-poly domain (switching lemma)
("MAC", "PRF"): secure EUF-CMA MAC on uniform messages is a PRF
("HMAC", "CRHF"): fix key k, H'(m) = HMAC_k(m) is collision-resistant
("MAC", "CRHF"): MAC compression function → Merkle-Damgård CRHF
("MAC", "HMAC"): any PRF-based MAC fits HMAC double-hash structure

# Multi-hop paths (compose existing steps)
("OWF", "PRF"):  OWF→PRG→PRF
("OWF", "MAC"):  OWF→PRG→PRF→MAC
("OWF", "PRP"):  OWF→PRG→PRF→PRP
("PRG", "MAC"):  PRG→PRF→MAC
("PRG", "PRP"):  PRG→PRF→PRP
("OWP", "PRG"):  OWP→OWF→PRG (OWP is a OWF)
("OWP", "PRF"):  OWP→PRG→PRF
("CRHF", "MAC"): CRHF→HMAC→MAC
```

Each entry must have: `steps` (list of reduction step descriptions), `theorem` (theorem name), `pa` (PA number), `direction`, and `security_claim` (formal statement like "if adversary breaks B with advantage ε, it breaks A with advantage ε' ≥ ε/q").

Also add a `/api/reduce/all` GET endpoint that returns the full routing table as JSON — the React frontend's proof summary panel will use this.

---

## Phase 4 — UI Overhaul (frontend-design agent)

The existing UI has a solid foundation (dark theme, Fira Code mono, gold/blue accents) but needs these specific improvements:

### 4a. GGM Tree Visualizer (PA#2 demo — `web/src/components/demos/PA2Demo.jsx`)

Replace the text-based path display with a **visual binary tree**:
- Render the GGM tree as an SVG or CSS grid tree (depth 4–6 levels)
- Each node shows its hex value (first 6 chars + "…")
- Active path (root-to-leaf for the current query x) glows in blue
- Inactive nodes are greyed out
- When any bit of x changes, re-highlight the path with a smooth transition
- The leaf node shows `F_k(x) = [hex]` in a prominent green box
- Bit selector: show each bit of x as a clickable toggle that re-routes the path

### 4b. Advantage Counter (PA#3 and PA#6 demos)

- Add an animated progress bar showing the adversary's running advantage over N rounds
- Secure mode: bar stays near 0.5 (grey/neutral), convergence label "≈0 (indistinguishable)"
- Broken mode (nonce reuse toggle): bar snaps to 1.0 (red), label "= 1.0 (trivially broken)"
- Show round-by-round log in a scrollable monospace box

### 4c. Reduction Chain Arrow Diagram (ProofPanel)

Replace the flat list in `ProofPanel.jsx` with a horizontal flow diagram:
```
[Foundation] ──theorem──▶ [Source A] ──theorem──▶ [Target B]
```
- Each box is a styled pill with the primitive name
- Each arrow shows the theorem name above and security reduction below
- The currently selected path is highlighted; other paths fade to 60% opacity
- Animate the data flow: a glowing dot travels along the arrow when a computation runs

### 4d. Demo Tab Polish

For every PA demo tab, ensure consistent layout:
```
┌─────────────────────────────────────────────────────┐
│ PA#N — [Name]                              [badge]  │
├─────────────────────────────────────────────────────┤
│  Inputs (left)          │  Output (right)           │
│  - labelled hex fields  │  - hex display boxes      │
│  - Run button           │  - security verdict badge │
└─────────────────────────────────────────────────────┘
```
- Every demo must have a **"Run"** button and **live output** (no hardcoded placeholder text)
- Every demo must call the actual backend API
- Security verdict badges: green `SECURE`, red `BROKEN`, gold `ATTACK DEMO`
- For demos with broken variants (PA#3 nonce reuse, PA#5 length extension, PA#12 Håstad, PA#15 forgery, PA#16 malleability, PA#17 CCA tamper), add a toggle that switches between secure and broken mode

### 4e. Typography and Spacing

- Import `JetBrains Mono` from Google Fonts (better than Fira Code for this use case)
- Use `IBM Plex Sans` as the UI font (replaces system-ui)
- Increase step-chain readability: each step row should be 36px tall with the label, arrow, function, and value in distinct columns with proper alignment
- Add subtle `box-shadow: 0 0 0 1px var(--border)` to all card components on hover

### 4f. Responsive Layout

- Add a horizontal scrollbar to the demo tab bar (already there but ensure it works on mobile)
- On screens < 900px, stack the two columns vertically

---

## Phase 5 — Security Audit (security-auditor agent)

Run the security-auditor agent on all PA implementations. Specifically check:

1. **Timing attacks**: MAC verification in PA#5, PA#6, PA#10 must use constant-time comparison (`hmac.compare_digest` equivalent — implement it manually, not from stdlib)
2. **Nonce reuse**: PA#3 `enc()` must sample fresh `os.urandom` every call
3. **CCA order**: PA#6 must verify MAC tag BEFORE decrypting (encrypt-then-MAC)
4. **HMAC structure**: PA#10 must be `H((k⊕opad) || H((k⊕ipad) || m))` exactly — not a concatenation shortcut
5. **DLP parameters**: PA#1 and PA#8 must use a safe prime `p = 2q+1` where `q` is prime
6. **Miller-Rabin rounds**: PA#13 must use ≥ 40 rounds for 128-bit security
7. **RSA**: `rsa_dec_crt` must verify `m_p` and `m_q` before returning (Bellcore attack prevention)
8. **ElGamal**: fresh ephemeral key per encryption — never reuse `y`
9. **OT**: receiver's choice bit `b` must not be recoverable from any protocol message sent to sender
10. **No `random` module**: run `grep -r "import random\|from random" src/` — any match is a critical bug

Fix all findings. The security-auditor reports; the coder fixes.

---

## Phase 6 — Final Review (reviewer + qa-lead agents)

**Reviewer checklist (run on all PAs):**
- [ ] Both forward AND backward reductions implemented and tested
- [ ] Interface contracts exactly match the spec in Phase 1
- [ ] No external crypto library imports (`grep -r "pycryptodome\|from cryptography\|import hashlib" src/`)
- [ ] `pytest src/ -v` passes with zero failures
- [ ] Security game advantages within bounds (≤ 0.1 secure, = 1.0 broken)
- [ ] Web app: open `http://localhost:5173` in browser
  - Foundation toggle switches without errors
  - Both columns render with dropdowns and live hex values
  - GGM tree highlights path when query bits change
  - All 20 demo tabs load and respond to Run button
  - ProofPanel opens/closes and shows correct reduction chain
  - No console errors in browser devtools

**QA quality gates (all must pass before done):**
1. `pytest src/ -v` — zero failures, zero empty test files
2. `grep -r "pycryptodome\|from cryptography\|import hashlib\|import hmac\b" src/` — zero matches
3. All 20 backend endpoints return valid JSON (spot-check with `curl localhost:8000/api/prg/generate -d '{"seed_hex":"deadbeef","length":32}' -H "Content-Type: application/json"`)
4. Web app loads at `localhost:5173` with no console errors
5. GGM tree visual renders and path updates on query change
6. Advantage counter animates correctly in PA#3 demo
7. All demo tabs show live data (not hardcoded strings)

---

## Phase 7 — Documentation (documenter agent)

Update `README.md` to reflect the final state:
- PA completion table (all 20 with both directions checked)
- API endpoint reference (concise — 1 line per endpoint)
- Quick start instructions (verify `./run.sh` works)

Update `CLAUDE.md` (create if missing) with:
- No-library rule prominently
- PA status table
- Interface contracts summary
- How to run tests

---

## Execution Order for Orchestrator

```
Phase 0: Environment verification (you, directly)
Phase 1: code-explorer audit → coder fixes (parallel per PA batch)
Phase 2: tester writes tests → pytest → coder fixes failures (iterate)
Phase 3: api-agent expands routing table
Phase 4: frontend-design agent overhauls UI
Phase 5: security-auditor audit → coder fixes
Phase 6: reviewer + qa-lead final check
Phase 7: documenter updates README + CLAUDE.md
```

Phases 1, 2, 3, 4 can run in parallel (they touch different parts of the codebase). Phase 5 depends on Phase 1 being complete. Phase 6 depends on all others.

**Start now. Begin with Phase 0 — verify the environment runs, then dispatch code-explorer to audit Phase 1.**
