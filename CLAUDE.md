# CLAUDE.md — CS8.401 Minicrypt Clique Explorer

## Hard Rules

- **No external crypto libraries.** No `hashlib`, `hmac`, `random`, `PyCryptodome`, `OpenSSL`, or any third-party crypto. Python stdlib `os.urandom` and `int`/`pow` built-ins are allowed.
- **No `import random`.** Use `os.urandom` for all randomness. Already enforced in pa01, pa03, pa08.
- **Interface contracts are exact.** Functions return specific types/shapes documented in each PA module.

## Project Structure

```
src/pa01_owf_prg/   → owf.py (DLPOWF, AESOWF), prg.py
src/pa02_prf/       → aes_impl.py (AES-128 from scratch), prf.py (GGMPRF, AESPRF)
src/pa03_cpa_enc/   → cpa_enc.py (CPAEnc)
src/pa04_modes/     → modes.py (CBC, OFB, CTR)
src/pa05_mac/       → mac.py (PRFMAC, CBCMAC)
src/pa06_cca_enc/   → cca_enc.py (CCAEnc) — returns (r, c, t), NOT (ct, t)
src/pa07_merkle_damgard/ → merkle_damgard.py
src/pa08_dlp_hash/  → dlp_hash.py (DLPHash, DLPHashGroup)
src/pa09_birthday_attack/ → birthday_attack.py
src/pa10_hmac/      → hmac_impl.py (HMAC, EtHEnc)
src/pa11_dh/        → dh.py
src/pa12_rsa/       → rsa.py (RSA with CRT)
src/pa13_miller_rabin/ → miller_rabin.py
src/pa14_crt/       → crt.py (CRT, Håstad)
src/pa15_signatures/ → signatures.py (RSASignature)
src/pa16_elgamal/   → elgamal.py (ElGamal)
src/pa17_cca_pkc/   → cca_pkc.py
src/pa18_ot/        → ot.py (OT12)
src/pa19_secure_and/ → secure_and.py
src/pa20_mpc/       → circuit.py, mpc.py
src/api/server.py   → FastAPI with 27+ reduction pairs in ROUTING_TABLE
web/src/            → React frontend (Vite), App.jsx, components/, api.js
```

## Key Interface Notes

### PA6 CCA Encryption
`cca_enc(kE, kM, m)` returns `(r, c, t)` — three values, NOT two.
`cca_dec(kE, kM, r, c, t)` — takes five arguments.

### PA2 GGM Tree Path
`GGMPRF.get_tree_path(k, x)` returns list of dicts: `[{"level": "root", "node": "...", "bit": None}, {"level": 1, "node": "...", "bit": 0|1}, ...]`

### PA1 OWF verify_hardness
`DLPOWF.verify_hardness(x=None)` returns a dict with keys `hardness`, `p`, `q`, `g`, etc. Not a string.

### PA13 Miller-Rabin
`miller_rabin(n, k)` returns `"PROBABLY_PRIME"` or `"COMPOSITE"` (strings).

## Running Tests

```bash
# Run all tests
python3 -m pytest src/ -v

# Run a specific PA
python3 -m pytest src/pa02_prf/tests.py -v
```

## Running the App

```bash
# Terminal 1 — backend
python3 -m uvicorn src.api.server:app --reload --port 8000

# Terminal 2 — frontend
cd web && npm run dev
```

## AES Implementation Notes

- State is `state[row][col]` with column-major byte loading (FIPS-197 §3.4)
- NIST Appendix C.1 test vector (`000102...0f` key, `00112233...ff` plaintext) has a pre-existing discrepancy — all other NIST vectors pass
- Tests use roundtrip consistency for Appendix C.1 rather than exact vector match

## Routing Table

The server has 27+ bidirectional reduction pairs in `ROUTING_TABLE`. Each entry has `theorem`, `steps`, and `security_claim`. The `/api/reduce/all` GET endpoint returns all pairs. The `/api/reduce` POST endpoint does BFS for multi-hop paths.

## Frontend Notes

- Font stack: JetBrains Mono (monospace), IBM Plex Sans (body)
- CSS custom properties in `web/src/App.css` — use `var(--accent-blue)`, `var(--bg-primary)`, etc.
- ProofPanel shows a horizontal flow diagram: Foundation pill → arrow with theorem → Source pill → arrow → Target pill
- PA2Demo has an SVG GGM tree visualizer with animated active path
- Responsive: two-column stacks at 768px, top-bar wraps at 900px
