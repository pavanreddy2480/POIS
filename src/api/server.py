"""
CS8.401 POIS — FastAPI Backend Server
Exposes all PA implementations (PA#1–PA#20) as REST endpoints.
"""
import os
import sys
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any
from src.pa02_prf.prf import GGMPRF, AESPRF

app = FastAPI(title="CS8.401 POIS — Minicrypt Clique API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Lazy-loaded singletons ────────────────────────────────────────────────────
_singletons = {}

def get_aes_prf():
    if "aes_prf" not in _singletons:
        from src.pa02_prf.prf import AESPRF
        _singletons["aes_prf"] = AESPRF()
    return _singletons["aes_prf"]

def get_dlp_owf():
    if "dlp_owf" not in _singletons:
        from src.pa01_owf_prg.owf import DLPOWF
        _singletons["dlp_owf"] = DLPOWF(bits=32)
    return _singletons["dlp_owf"]

def get_prg():
    if "prg" not in _singletons:
        from src.pa01_owf_prg.prg import PRG
        _singletons["prg"] = PRG(get_dlp_owf())
    return _singletons["prg"]

def get_ggm_prf():
    if "ggm_prf" not in _singletons:
        from src.pa02_prf.prf import GGMPRF
        _singletons["ggm_prf"] = GGMPRF(depth=8)
    return _singletons["ggm_prf"]

def get_cpa_enc():
    if "cpa_enc" not in _singletons:
        from src.pa03_cpa_enc.cpa_enc import CPAEnc
        _singletons["cpa_enc"] = CPAEnc(get_aes_prf())
    return _singletons["cpa_enc"]

def get_dlp_hash():
    if "dlp_hash" not in _singletons:
        from src.pa08_dlp_hash.dlp_hash import DLPHash, DLPHashGroup
        group = DLPHashGroup(bits=32)
        _singletons["dlp_hash"] = DLPHash(group)
    return _singletons["dlp_hash"]

def get_hmac():
    if "hmac" not in _singletons:
        from src.pa10_hmac.hmac_impl import HMAC
        _singletons["hmac"] = HMAC(get_dlp_hash())
    return _singletons["hmac"]

def get_elgamal():
    if "elgamal" not in _singletons:
        from src.pa16_elgamal.elgamal import ElGamal
        _singletons["elgamal"] = ElGamal(bits=32)
    return _singletons["elgamal"]

def get_ot():
    if "ot" not in _singletons:
        from src.pa18_ot.ot import OT_1of2
        _singletons["ot"] = OT_1of2(get_elgamal())
    return _singletons["ot"]

def get_secure_gates():
    if "gates" not in _singletons:
        from src.pa19_secure_and.secure_and import SecureGates
        _singletons["gates"] = SecureGates(get_ot())
    return _singletons["gates"]


# ── Models ────────────────────────────────────────────────────────────────────

class HexInput(BaseModel):
    value: str  # hex string

class PRGRequest(BaseModel):
    seed_hex: str
    length: int = 32

class PRFRequest(BaseModel):
    key_hex: str
    input_hex: str
    depth: int = 8
    prf_type: str = "GGM"

class EncRequest(BaseModel):
    key_hex: str
    message_hex: str
    broken_nonce: bool = False

class DecRequest(BaseModel):
    key_hex: str
    r_hex: str
    c_hex: str

class ModeEncRequest(BaseModel):
    mode: str
    key_hex: str
    message_hex: str
    iv_hex: Optional[str] = None

class ModeBlocksRequest(BaseModel):
    mode: str
    key_hex: str
    message_hex: str
    iv_hex: Optional[str] = None

class FlipBitRequest(BaseModel):
    mode: str
    key_hex: str
    iv_hex: str
    ciphertext_hex: str
    block_index: int

class MACRequest(BaseModel):
    key_hex: str
    message_hex: str
    mac_type: str = "PRF"

class MACVerifyRequest(BaseModel):
    key_hex: str
    message_hex: str
    tag_hex: str
    mac_type: str = "PRF"

class CCAEncRequest(BaseModel):
    ke_hex: str
    km_hex: str
    message_hex: str

class CCADecRequest(BaseModel):
    ke_hex: str
    km_hex: str
    r_hex: str
    ciphertext_hex: str
    tag_hex: str

class HashRequest(BaseModel):
    message_hex: str

class BirthdayRequest(BaseModel):
    n_bits: int = 12

class HMACRequest(BaseModel):
    key_hex: str
    message_hex: str

class LengthExtRequest(BaseModel):
    key_hex: str
    message_hex: str
    suffix_hex: str = 'deadbeef'

class DHRequest(BaseModel):
    bits: int = 32

class DHCustomRequest(BaseModel):
    bits: int = 32
    alice_priv_hex: Optional[str] = None
    bob_priv_hex: Optional[str] = None

class RSAKeygenRequest(BaseModel):
    bits: int = 128

class RSAEncRequest(BaseModel):
    N_hex: str
    e: int
    m: int

class RSADecRequest(BaseModel):
    N_hex: str
    d_hex: str
    c: int

class MillerRabinRequest(BaseModel):
    n: int
    k: int = 20

class MillerRabinVerboseRequest(BaseModel):
    n_str: str   # decimal string — avoids JS integer precision loss for large primes
    k: int = 20

class CRTRequest(BaseModel):
    residues: List[int]
    moduli: List[int]

class OTRequest(BaseModel):
    b: int
    m0: int
    m1: int

class SecureANDRequest(BaseModel):
    a: int
    b: int

class MillionaireRequest(BaseModel):
    x: int
    y: int
    n_bits: int = 4

class AdditionRequest(BaseModel):
    x: int
    y: int
    n_bits: int = 4

class ReduceRequest(BaseModel):
    source: str
    target: str
    foundation: str = "AES"

class RSADemoRequest(BaseModel):
    message_hex: str
    use_pkcs: bool = False

class HastadDemoRequest(BaseModel):
    message: int
    use_pkcs: bool = False

class SigDemoRequest(BaseModel):
    message: str
    tamper: bool = False
    show_forgery: bool = False

class ElGamalDemoRequest(BaseModel):
    message: int
    multiplier: int = 2

class CCADemoRequest(BaseModel):
    message: str
    tamper_ciphertext: bool = False


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "CS8.401 POIS API", "status": "running"}


# ── PA#1 OWF + PRG ────────────────────────────────────────────────────────────

@app.post("/api/owf/evaluate")
def owf_evaluate(req: HexInput):
    try:
        x = int(req.value, 16)
        owf = get_dlp_owf()
        result = owf.evaluate(x)
        return {"input": hex(x), "output": hex(result)}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/prg/generate")
def prg_generate(req: PRGRequest):
    try:
        seed = bytes.fromhex(req.seed_hex)
        prg = get_prg()
        output = prg.generate(seed, req.length)
        # Randomness tests
        ones = sum(bin(b).count('1') for b in output)
        total_bits = len(output) * 8
        ratio = ones / total_bits
        return {
            "seed": req.seed_hex,
            "length_bytes": req.length,
            "output_hex": output.hex(),
            "ones_ratio": round(ratio, 4),
            "frequency_pass": abs(ratio - 0.5) < 0.1,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#2 PRF ─────────────────────────────────────────────────────────────────

@app.post("/api/prf/evaluate")
def prf_evaluate(req: PRFRequest):
    try:
        k = bytes.fromhex(req.key_hex)
        x = bytes.fromhex(req.input_hex)
        if req.prf_type.upper() == "AES":
            prf = get_aes_prf()
        else:
            prf = GGMPRF(depth=req.depth)
        out = prf.F(k, x)
        return {"key": req.key_hex, "input": req.input_hex, "output": out.hex()}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/prf/ggm_tree")
def prf_ggm_tree(req: PRFRequest):
    try:
        k = bytes.fromhex(req.key_hex)
        x = bytes.fromhex(req.input_hex)
        prf = GGMPRF(depth=req.depth)
        path = prf.get_tree_path(k, x)
        return {
            "key": req.key_hex,
            "query": req.input_hex,
            "path": [{"level": p["level"], "bit": p["bit"], "node": p["node"]} for p in path],
            "output": path[-1]["node"] if path else k.hex(),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#3 CPA Encryption ───────────────────────────────────────────────────────

@app.post("/api/enc/cpa")
def cpa_encrypt(req: EncRequest):
    try:
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        enc = get_cpa_enc()
        if req.broken_nonce:
            r, c = enc.enc_broken(k, m)
        else:
            r, c = enc.enc(k, m)
        return {"key": req.key_hex, "message": req.message_hex,
                "r": r.hex(), "ciphertext": c.hex()}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/enc/dec")
def cpa_decrypt(req: DecRequest):
    try:
        k = bytes.fromhex(req.key_hex)
        r = bytes.fromhex(req.r_hex)
        c = bytes.fromhex(req.c_hex)
        enc = get_cpa_enc()
        m = enc.dec(k, r, c)
        return {"plaintext": m.hex()}
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#4 Modes ────────────────────────────────────────────────────────────────

@app.post("/api/modes/{mode}/encrypt")
def modes_encrypt(mode: str, req: ModeEncRequest):
    try:
        from src.pa04_modes.modes import CBCMode, OFBMode, CTRMode
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        prf = get_aes_prf()

        if mode.upper() == "CBC":
            iv = bytes.fromhex(req.iv_hex) if req.iv_hex else os.urandom(16)
            c = CBCMode(prf).encrypt(k, iv, m)
            return {"mode": "CBC", "ciphertext": c.hex(), "iv": iv.hex()}
        elif mode.upper() == "OFB":
            iv = bytes.fromhex(req.iv_hex) if req.iv_hex else os.urandom(16)
            c = OFBMode(prf).encrypt(k, iv, m)
            return {"mode": "OFB", "ciphertext": c.hex(), "iv": iv.hex()}
        elif mode.upper() == "CTR":
            r, c = CTRMode(prf).encrypt(k, m)
            return {"mode": "CTR", "ciphertext": c.hex(), "nonce": r.hex()}
        else:
            raise HTTPException(400, f"Unknown mode: {mode}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/modes/encrypt_blocks")
def modes_encrypt_blocks(req: ModeBlocksRequest):
    try:
        from src.pa02_prf.aes_impl import aes_encrypt
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        BLOCK = 16
        mode = req.mode.upper()

        if mode == "CBC":
            iv = bytes.fromhex(req.iv_hex) if req.iv_hex else os.urandom(BLOCK)
            pad_len = BLOCK - (len(m) % BLOCK)
            padded = m + bytes([pad_len] * pad_len)
            blocks = []
            prev = iv
            full_ct = b''
            for i in range(0, len(padded), BLOCK):
                pt_block = padded[i:i+BLOCK]
                xor_in = bytes(a ^ b for a, b in zip(pt_block, prev))
                ct_block = aes_encrypt(k, xor_in)
                blocks.append({"idx": i//BLOCK, "plaintext": pt_block.hex(),
                               "prev": prev.hex(), "xor_input": xor_in.hex(),
                               "ciphertext": ct_block.hex()})
                full_ct += ct_block
                prev = ct_block
            return {"mode": "CBC", "iv": iv.hex(), "ciphertext": full_ct.hex(), "blocks": blocks}

        elif mode == "OFB":
            iv = bytes.fromhex(req.iv_hex) if req.iv_hex else os.urandom(BLOCK)
            blocks = []
            state = iv
            full_ct = b''
            for i in range(0, len(m), BLOCK):
                state = aes_encrypt(k, state)
                pt_block = m[i:i+BLOCK]
                ct_block = bytes(a ^ b for a, b in zip(pt_block, state))
                blocks.append({"idx": i//BLOCK, "keystream_state": state.hex(),
                               "plaintext": pt_block.hex(), "ciphertext": ct_block.hex()})
                full_ct += ct_block
            return {"mode": "OFB", "iv": iv.hex(), "ciphertext": full_ct.hex(), "blocks": blocks}

        elif mode == "CTR":
            r = bytes.fromhex(req.iv_hex) if req.iv_hex else os.urandom(BLOCK)
            r_int = int.from_bytes(r, 'big')
            blocks = []
            full_ct = b''
            for i in range(0, len(m), BLOCK):
                ctr_val = (r_int + i//BLOCK) % (2**128)
                ctr_bytes = ctr_val.to_bytes(BLOCK, 'big')
                ks_block = aes_encrypt(k, ctr_bytes)
                pt_block = m[i:i+BLOCK]
                ct_block = bytes(a ^ b for a, b in zip(pt_block, ks_block))
                blocks.append({"idx": i//BLOCK, "counter": ctr_bytes.hex(),
                               "keystream": ks_block.hex(), "plaintext": pt_block.hex(),
                               "ciphertext": ct_block.hex()})
                full_ct += ct_block
            return {"mode": "CTR", "nonce": r.hex(), "ciphertext": full_ct.hex(), "blocks": blocks}

        else:
            raise HTTPException(400, f"Unknown mode: {mode}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/modes/flip_and_decrypt")
def modes_flip_and_decrypt(req: FlipBitRequest):
    try:
        from src.pa04_modes.modes import CBCMode, OFBMode, CTRMode
        k = bytes.fromhex(req.key_hex)
        ct = bytearray(bytes.fromhex(req.ciphertext_hex))
        BLOCK = 16
        mode = req.mode.upper()
        n_blocks = len(ct) // BLOCK

        flip_pos = req.block_index * BLOCK
        if flip_pos >= len(ct):
            raise HTTPException(400, "Block index out of range")
        ct[flip_pos] ^= 0x80

        prf = get_aes_prf()
        iv = bytes.fromhex(req.iv_hex)

        if mode == "CBC":
            try:
                pt = CBCMode(prf).decrypt(k, iv, bytes(ct))
                decrypted = pt.hex()
            except Exception:
                decrypted = None
            corrupted = [req.block_index]
            if req.block_index + 1 < n_blocks:
                corrupted.append(req.block_index + 1)
        elif mode == "OFB":
            pt = OFBMode(prf).decrypt(k, iv, bytes(ct))
            decrypted = pt.hex()
            corrupted = [req.block_index]
        elif mode == "CTR":
            pt = CTRMode(prf).decrypt(k, iv, bytes(ct))
            decrypted = pt.hex()
            corrupted = [req.block_index]
        else:
            raise HTTPException(400, f"Unknown mode: {mode}")

        return {"decrypted": decrypted, "corrupted_blocks": corrupted, "mode": mode}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#5 MAC ──────────────────────────────────────────────────────────────────

@app.post("/api/mac/sign")
def mac_sign(req: MACRequest):
    try:
        from src.pa05_mac.mac import PRFMAC, CBCMAC
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        mac = CBCMAC() if req.mac_type.upper() == "CBC" else PRFMAC(get_aes_prf())
        t = mac.mac(k, m)
        return {"tag": t.hex(), "mac_type": req.mac_type.upper()}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/mac/verify")
def mac_verify(req: MACVerifyRequest):
    try:
        from src.pa05_mac.mac import PRFMAC, CBCMAC
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        t = bytes.fromhex(req.tag_hex)
        mac = CBCMAC() if req.mac_type.upper() == "CBC" else PRFMAC(get_aes_prf())
        valid = mac.vrfy(k, m, t)
        return {"valid": valid}
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#6 CCA Encryption ───────────────────────────────────────────────────────

@app.post("/api/cca/encrypt")
def cca_encrypt(req: CCAEncRequest):
    try:
        from src.pa06_cca_enc.cca_enc import CCAEnc
        from src.pa05_mac.mac import PRFMAC
        kE = bytes.fromhex(req.ke_hex)
        kM = bytes.fromhex(req.km_hex)
        m  = bytes.fromhex(req.message_hex)
        cca = CCAEnc(get_cpa_enc(), PRFMAC(get_aes_prf()))
        r, c, t = cca.cca_enc(kE, kM, m)
        return {"r": r.hex(), "ciphertext": c.hex(), "tag": t.hex()}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/cca/decrypt")
def cca_decrypt(req: CCADecRequest):
    try:
        from src.pa06_cca_enc.cca_enc import CCAEnc
        from src.pa05_mac.mac import PRFMAC
        kE = bytes.fromhex(req.ke_hex)
        kM = bytes.fromhex(req.km_hex)
        r = bytes.fromhex(req.r_hex)
        c = bytes.fromhex(req.ciphertext_hex)
        t = bytes.fromhex(req.tag_hex)
        cca = CCAEnc(get_cpa_enc(), PRFMAC(get_aes_prf()))
        pt = cca.cca_dec(kE, kM, r, c, t)
        if pt is None:
            return {"valid": False, "plaintext": None}
        return {"valid": True, "plaintext": pt.hex()}
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#7 Merkle-Damgård ───────────────────────────────────────────────────────

@app.post("/api/hash/merkle_damgard")
def md_hash(req: HashRequest):
    """Hash a message using the toy XOR compression + MD construction."""
    try:
        from src.pa07_merkle_damgard.merkle_damgard import MerkleDamgard, toy_compress
        msg = bytes.fromhex(req.message_hex)
        md = MerkleDamgard(toy_compress, b'\x00' * 4, 8)
        result = md.hash_with_chain(msg)
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hash/md_boundary")
def md_boundary():
    """
    Run boundary-case tests: empty message, short, single-block, multi-block.
    Verifies MD framework produces correct-length outputs for all edge cases.
    """
    try:
        from src.pa07_merkle_damgard.merkle_damgard import MerkleDamgard, toy_compress
        md = MerkleDamgard(toy_compress, b'\x00' * 4, 8)
        results = md.boundary_tests()
        return {"results": results, "block_size": md.block_size, "state_size": len(md.IV)}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hash/collision_demo")
def md_collision_demo():
    """
    Demonstrate collision propagation in Merkle-Damgård.
    toy_compress(state, block) = state XOR block[:4] — ignores block[4:8].
    Two blocks sharing the same first 4 bytes always collide in h, and that
    collision propagates through the full MD chain (illustrates the reduction).
    """
    try:
        from src.pa07_merkle_damgard.merkle_damgard import (
            MerkleDamgard, toy_compress, toy_collision_pair,
        )
        md = MerkleDamgard(toy_compress, b'\x00' * 4, 8)
        IV = md.IV

        # Get colliding pair with full chains
        cp = toy_collision_pair()

        # Single-block compression demo
        single_A = bytes([0xCA, 0xFE, 0xBA, 0xBE, 0x00, 0x00, 0x00, 0x00])
        single_B = bytes([0xCA, 0xFE, 0xBA, 0xBE, 0xFF, 0xFF, 0xFF, 0xFF])
        compress_A = toy_compress(IV, single_A)
        compress_B = toy_compress(IV, single_B)

        return {
            "iv": IV.hex(),
            "msg_A": cp["msg_A"],
            "msg_B": cp["msg_B"],
            "chain_A": cp["chain_A"],
            "chain_B": cp["chain_B"],
            "digest_A": cp["digest_A"],
            "digest_B": cp["digest_B"],
            "collision": cp["collision"],
            "single_block_A": single_A.hex(),
            "single_block_B": single_B.hex(),
            "compress_A": compress_A.hex(),
            "compress_B": compress_B.hex(),
            "single_collision": compress_A == compress_B,
            "explanation": (
                "toy_compress(state, block) = state XOR block[0:4] — "
                "it ignores block[4:8]. Any two blocks with the same first 4 bytes "
                "produce the same output. This compression-function collision propagates "
                "through the entire MD chain, yielding equal final digests."
            ),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#8 DLP Hash ─────────────────────────────────────────────────────────────

@app.post("/api/hash/dlp")
def dlp_hash(req: HashRequest):
    try:
        msg = bytes.fromhex(req.message_hex)
        H = get_dlp_hash()
        digest = H.hash(msg)
        grp = H.group.params()
        return {
            "message": req.message_hex,
            "digest": digest.hex(),
            "group": grp,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hash/dlp_params")
def dlp_params():
    """Return the DLP group parameters used by the hash function."""
    try:
        H = get_dlp_hash()
        grp = H.group.params()
        grp["iv"] = H.IV.hex()
        grp["block_size"] = H.block_size
        grp["description"] = (
            "Safe-prime subgroup of Z*_p.  p = 2q+1 (Sophie Germain prime). "
            "g is a generator of the order-q subgroup.  "
            "h = g^alpha mod p where alpha was randomly chosen then discarded. "
            "DLP compression: f(x,y) = g^x * h^y mod p."
        )
        return grp
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hash/dlp_integration")
def dlp_integration():
    """Hash five messages of different lengths and verify distinct digests."""
    try:
        H = get_dlp_hash()
        test_messages = [
            ("empty",          b""),
            ("1 byte",         b"a"),
            ("5 bytes",        b"Hello"),
            ("15 bytes",       b"Hello DLP Hash!"),
            ("44 bytes",       b"The quick brown fox jumps over the lazy dog"),
        ]
        results = []
        seen = set()
        for label, msg in test_messages:
            digest = H.hash(msg)
            d_hex = digest.hex()
            results.append({
                "label": label,
                "message": msg.decode("ascii", errors="replace"),
                "message_hex": msg.hex(),
                "length_bytes": len(msg),
                "digest": d_hex,
                "duplicate": d_hex in seen,
            })
            seen.add(d_hex)
        all_distinct = len(seen) == len(test_messages)
        return {
            "results": results,
            "all_distinct": all_distinct,
            "test_count": len(test_messages),
            "pass": all_distinct,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hash/dlp_collision_demo")
def dlp_collision_demo():
    """
    Demonstrate collision resistance via DLP hardness.
    Shows:
    1) How to produce a collision when alpha IS known (setup knowledge).
    2) The algebraic argument that any collision finder solves DLP.
    3) Brute-force collision finder on tiny toy group (q≈2^16).
    """
    try:
        from src.pa08_dlp_hash.dlp_hash import collision_resistance_demo
        demo = collision_resistance_demo()
        return demo
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#9 Birthday Attack ──────────────────────────────────────────────────────

@app.post("/api/birthday/attack")
def birthday_attack_endpoint(req: BirthdayRequest):
    """Naive birthday attack on the DLP hash truncated to n bits."""
    try:
        from src.pa09_birthday_attack.birthday_attack import birthday_attack_naive
        H = get_dlp_hash()
        def hash_fn(b: bytes) -> int:
            d = H.hash(b)
            return int.from_bytes(d, 'big')
        return birthday_attack_naive(hash_fn, req.n_bits)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/birthday/floyd")
def birthday_floyd_endpoint(req: BirthdayRequest):
    """Floyd cycle-detection attack on the DLP hash (space-efficient, O(1) memory)."""
    try:
        from src.pa09_birthday_attack.birthday_attack import birthday_attack_floyd
        H = get_dlp_hash()
        def hash_fn(b: bytes) -> int:
            return int.from_bytes(H.hash(b), 'big')
        return birthday_attack_floyd(hash_fn, req.n_bits)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/birthday/toy_hash")
def birthday_toy_hash(req: BirthdayRequest):
    """
    Run both naive and Floyd attacks on the deliberately weak toy hash.
    n_bits ∈ {8,12,16}. Shows evaluations vs 2^(n/2) birthday bound.
    """
    try:
        from src.pa09_birthday_attack.birthday_attack import toy_hash_attack
        n = max(8, min(16, req.n_bits))
        return toy_hash_attack(n)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/birthday/empirical")
def birthday_empirical():
    """
    100 independent trials for each n ∈ {8,10,12,14,16}.
    Returns empirical CDF + theoretical 1-e^(-k(k-1)/2^(n+1)) for each n.
    """
    try:
        from src.pa09_birthday_attack.birthday_attack import empirical_birthday_curve
        return {"curves": empirical_birthday_curve([8, 10, 12, 14, 16], trials_per_n=100)}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/birthday/dlp_truncated")
def birthday_dlp_truncated(req: BirthdayRequest):
    """
    Attack the DLP hash truncated to n bits.
    Confirms: even a provably-secure hash breaks at 2^(n/2) birthday bound.
    """
    try:
        from src.pa09_birthday_attack.birthday_attack import attack_dlp_truncated
        H = get_dlp_hash()
        def dlp_fn(b: bytes) -> int:
            return int.from_bytes(H.hash(b), 'big')
        n = max(8, min(16, req.n_bits))
        return attack_dlp_truncated(n, dlp_fn)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/birthday/md5_sha1_context")
def birthday_md5_sha1():
    """Compute 2^(n/2) birthday cost for MD5, SHA-1, SHA-256 at 10^9 hashes/s."""
    try:
        from src.pa09_birthday_attack.birthday_attack import md5_sha1_context
        return md5_sha1_context(hashes_per_second=1e9)
    except Exception as e:
        raise HTTPException(400, str(e))



# ── PA#10 HMAC ────────────────────────────────────────────────────────────────

@app.post("/api/hmac/sign")
def hmac_sign(req: HMACRequest):
    """Compute HMAC_k(m) using PA#8 DLP hash."""
    try:
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        tag = get_hmac().mac(k, m)
        return {"tag": tag.hex()}
    except Exception as e:
        raise HTTPException(400, str(e))



@app.post("/api/hmac/verify")
def hmac_verify(req: MACVerifyRequest):
    """Constant-time HMAC verification."""
    try:
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        t = bytes.fromhex(req.tag_hex)
        valid = get_hmac().verify(k, m, t)
        return {"valid": valid}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hmac/length_extension")
def hmac_length_extension(req: LengthExtRequest):
    """
    Full length-extension demo: shows attack succeeds on H(k||m),
    and simultaneously shows it fails on HMAC.
    """
    try:
        from src.pa10_hmac.hmac_impl import length_extension_demo
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        suffix = bytes.fromhex(req.suffix_hex)
        H = get_dlp_hash()
        return length_extension_demo(H, k, m, suffix)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hmac/euf_cma")
def hmac_euf_cma():
    """Run EUF-CMA security game: 50 oracle queries, adversary tries to forge."""
    try:
        from src.pa10_hmac.hmac_impl import euf_cma_game
        k = bytes.fromhex("0123456789abcdef0123456789abcdef")
        return euf_cma_game(get_hmac(), k, n_queries=50)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hmac/mac_hash")
def hmac_mac_hash():
    """MAC→CRHF: build MAC_Hash = MD(h') where h'(cv,b)=HMAC_k(cv‖b)."""
    try:
        from src.pa10_hmac.hmac_impl import mac_hash_demo
        k = bytes.fromhex("0123456789abcdef0123456789abcdef")
        return mac_hash_demo(get_hmac(), k)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hmac/eth_enc")
def hmac_eth_enc(req: HMACRequest):
    """Encrypt-then-HMAC: returns (r_hex, c_hex, t_hex)."""
    try:
        from src.pa10_hmac.hmac_impl import EtHEnc
        kE = bytes.fromhex(req.key_hex)
        m  = bytes.fromhex(req.message_hex)
        kM = bytes.fromhex(req.key_hex)  # use same key for demo; distinct in production
        eth = EtHEnc(hmac_scheme=get_hmac())
        r, c, t = eth.eth_enc(kE, kM, m)
        return {"r": r.hex(), "c": c.hex(), "t": t.hex(),
                "ciphertext_blob": (r+c).hex()}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hmac/cca2_game")
def hmac_cca2():
    """IND-CCA2 game for Encrypt-then-HMAC."""
    try:
        from src.pa10_hmac.hmac_impl import cca2_game
        return cca2_game(n_queries=20)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/hmac/timing_demo")
def hmac_timing():
    """Demonstrate constant-time vs naive comparison timing difference."""
    try:
        from src.pa10_hmac.hmac_impl import timing_side_channel_demo
        k = bytes.fromhex("0123456789abcdef0123456789abcdef")
        m = b"timing demo message"
        tag = get_hmac().mac(k, m)
        return timing_side_channel_demo(tag)
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#11 DH Key Exchange ─────────────────────────────────────────────────────

@app.post("/api/dh/exchange")
def dh_exchange(req: DHRequest):
    try:
        from src.pa11_dh.dh import DiffieHellman
        dh = DiffieHellman(bits=req.bits)
        result = dh.full_exchange()
        return result
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/dh/exchange_custom")
def dh_exchange_custom(req: DHCustomRequest):
    try:
        from src.pa11_dh.dh import DiffieHellman
        from src.pa13_miller_rabin.miller_rabin import mod_pow
        dh = DiffieHellman(bits=req.bits)
        if req.alice_priv_hex:
            a = int(req.alice_priv_hex, 16) % dh.q
            if a < 2:
                a = 2
        else:
            a, _ = dh.dh_alice_step1()
        if req.bob_priv_hex:
            b = int(req.bob_priv_hex, 16) % dh.q
            if b < 2:
                b = 2
        else:
            b, _ = dh.dh_bob_step1()
        A = mod_pow(dh.g, a, dh.p)
        B = mod_pow(dh.g, b, dh.p)
        KA = dh.dh_alice_step2(a, B)
        KB = dh.dh_bob_step2(b, A)
        return {
            "p": hex(dh.p), "q": hex(dh.q), "g": hex(dh.g),
            "alice_private": hex(a), "alice_public": hex(A),
            "bob_private": hex(b), "bob_public": hex(B),
            "alice_shared_secret": hex(KA), "bob_shared_secret": hex(KB),
            "keys_match": KA == KB,
        }
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/dh/mitm")
def dh_mitm(req: DHCustomRequest):
    """Full DH exchange + Eve's MITM attack. Returns honest keys and compromised keys."""
    try:
        from src.pa11_dh.dh import DiffieHellman
        from src.pa13_miller_rabin.miller_rabin import mod_pow
        dh = DiffieHellman(bits=req.bits)
        if req.alice_priv_hex:
            a = int(req.alice_priv_hex, 16) % dh.q
            if a < 2: a = 2
        else:
            a, _ = dh.dh_alice_step1()
        if req.bob_priv_hex:
            b = int(req.bob_priv_hex, 16) % dh.q
            if b < 2: b = 2
        else:
            b, _ = dh.dh_bob_step1()
        A = mod_pow(dh.g, a, dh.p)
        B = mod_pow(dh.g, b, dh.p)
        # Eve generates her ephemeral key
        e = dh._random_exponent()
        E = mod_pow(dh.g, e, dh.p)
        # Alice computes K = E^a (she thinks E is Bob's B)
        KA_mitm = mod_pow(E, a, dh.p)
        # Bob computes K = E^b (he thinks E is Alice's A)
        KB_mitm = mod_pow(E, b, dh.p)
        # Eve holds both: A^e shared with Alice, B^e shared with Bob
        K_eve_alice = mod_pow(A, e, dh.p)  # == KA_mitm
        K_eve_bob   = mod_pow(B, e, dh.p)  # == KB_mitm
        # Honest exchange values (for reference)
        KA_honest = dh.dh_alice_step2(a, B)
        KB_honest = dh.dh_bob_step2(b, A)
        return {
            "p": hex(dh.p), "q": hex(dh.q), "g": hex(dh.g),
            "alice_private": hex(a), "alice_public": hex(A),
            "bob_private": hex(b), "bob_public": hex(B),
            "alice_shared_secret": hex(KA_honest),
            "bob_shared_secret": hex(KB_honest),
            "keys_match": KA_honest == KB_honest,
            # MITM — what Alice and Bob actually compute when Eve is active
            "alice_mitm_secret": hex(KA_mitm),
            "bob_mitm_secret": hex(KB_mitm),
            "mitm_keys_differ": KA_mitm != KB_mitm,
            # Eve's view
            "eve_private": hex(e),
            "eve_public": hex(E),
            "eve_key_with_alice": hex(K_eve_alice),
            "eve_key_with_bob": hex(K_eve_bob),
        }
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/dh/cdh_hardness")
def dh_cdh_hardness():
    """Brute-force CDH for small params (q ≈ 2^20). Reports time and evaluations."""
    import time
    try:
        from src.pa11_dh.dh import DiffieHellman
        from src.pa13_miller_rabin.miller_rabin import mod_pow
        dh = DiffieHellman(bits=22)   # q ≈ 2^20 — small enough to brute-force
        a, A = dh.dh_alice_step1()
        b, B = dh.dh_bob_step1()
        K_true = dh.dh_alice_step2(a, B)
        # Brute-force: find a by trying g^x == A
        start = time.perf_counter()
        found_a = None
        for x in range(1, int(dh.q) + 1):
            if mod_pow(dh.g, x, dh.p) == A:
                found_a = x
                break
        elapsed = round(time.perf_counter() - start, 4)
        K_found = mod_pow(B, found_a, dh.p) if found_a is not None else None
        return {
            "q_bits": dh.q.bit_length(),
            "p": hex(dh.p), "q": hex(dh.q), "g": hex(dh.g),
            "A": hex(A), "B": hex(B),
            "K_true": hex(K_true),
            "found_a": hex(found_a) if found_a is not None else None,
            "K_found": hex(K_found) if K_found is not None else None,
            "correct": K_found == K_true,
            "evaluations": found_a if found_a is not None else int(dh.q),
            "time_sec": elapsed,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#12 RSA ─────────────────────────────────────────────────────────────────

@app.post("/api/rsa/keygen")
def rsa_keygen(req: RSAKeygenRequest):
    try:
        from src.pa12_rsa.rsa import RSA
        rsa = RSA()
        keys = rsa.keygen(req.bits)
        pk, sk = keys["pk"], keys["sk"]
        return {
            "N": hex(pk[0]),
            "e": pk[1],
            "d": hex(sk["d"]),
            "p": hex(sk["p"]),
            "q": hex(sk["q"]),
        }
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/rsa/encrypt")
def rsa_encrypt(req: RSAEncRequest):
    try:
        from src.pa12_rsa.rsa import RSA
        N = int(req.N_hex, 16)
        pk = (N, req.e)
        c = RSA().rsa_enc(pk, req.m)
        return {"ciphertext": c}
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#13 Miller-Rabin ────────────────────────────────────────────────────────

@app.post("/api/miller_rabin/test")
def miller_rabin_test(req: MillerRabinRequest):
    try:
        from src.pa13_miller_rabin.miller_rabin import miller_rabin
        result = miller_rabin(req.n, req.k)
        return {"n": req.n, "result": result, "rounds": req.k}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/miller_rabin/gen_prime")
def miller_rabin_gen(req: RSAKeygenRequest):
    try:
        from src.pa13_miller_rabin.miller_rabin import gen_prime
        p = gen_prime(req.bits)
        return {"prime": hex(p), "bits": p.bit_length()}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/miller_rabin/test_verbose")
def miller_rabin_test_verbose(req: MillerRabinVerboseRequest):
    """Full Miller-Rabin with per-round witness trace and timing."""
    try:
        from src.pa13_miller_rabin.miller_rabin import miller_rabin_verbose
        n = int(req.n_str)
        return miller_rabin_verbose(n, req.k)
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/miller_rabin/carmichael_demo")
def carmichael_demo_endpoint():
    """Shows n=561 passes naive Fermat but is COMPOSITE by Miller-Rabin."""
    try:
        from src.pa13_miller_rabin.miller_rabin import carmichael_demo, miller_rabin_verbose
        demo = carmichael_demo()
        # Full verbose trace on 561 with k=5 rounds
        trace = miller_rabin_verbose(561, 5)
        # Fermat test values for several bases coprime to 561
        bases = [2, 4, 5, 7, 8, 10, 13, 14]
        fermat_values = [{"base": a, "value": pow(a, 560, 561), "passes": pow(a, 560, 561) == 1}
                         for a in bases]
        return {
            **demo,
            "fermat_values": fermat_values,
            "mr_trace": trace,
        }
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/miller_rabin/benchmark")
def miller_rabin_benchmark():
    """Benchmark: avg candidates before finding 512/1024/2048-bit primes vs O(ln n) theory."""
    import time, math
    try:
        from src.pa13_miller_rabin.miller_rabin import miller_rabin
        results = []
        config = [(512, 5), (1024, 3), (2048, 1)]
        for bits, trials in config:
            candidates_list = []
            trial_times = []
            for _ in range(trials):
                count = 0
                t0 = time.perf_counter()
                while True:
                    count += 1
                    n = int.from_bytes(os.urandom(bits // 8), 'big')
                    n |= (1 << (bits - 1))
                    n |= 1
                    if miller_rabin(n, 20) == "PROBABLY_PRIME":
                        break
                trial_times.append(round(time.perf_counter() - t0, 3))
                candidates_list.append(count)
            avg_c = round(sum(candidates_list) / len(candidates_list), 1)
            # PNT: among odd b-bit numbers, expected candidates ≈ bits*ln(2)/2
            theoretical = round(bits * math.log(2) / 2, 1)
            results.append({
                "bits": bits,
                "trials": trials,
                "avg_candidates": avg_c,
                "theoretical_pnt": theoretical,
                "ratio": round(avg_c / theoretical, 2),
                "samples": candidates_list,
                "avg_time_sec": round(sum(trial_times) / len(trial_times), 3),
            })
        return {"results": results}
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#14 CRT ─────────────────────────────────────────────────────────────────

@app.post("/api/crt/solve")
def crt_solve(req: CRTRequest):
    try:
        from src.pa14_crt.crt import crt
        x = crt(req.residues, req.moduli)
        return {"solution": x}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/hastad/attack")
def hastad(req: CRTRequest):
    try:
        from src.pa14_crt.crt import hastad_attack
        e = len(req.residues)  # number of ciphertexts equals the RSA exponent
        m = hastad_attack(req.residues, req.moduli, e)
        return {"recovered_m": m}
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#15 Signatures ──────────────────────────────────────────────────────────

@app.post("/api/sig/sign")
def sig_sign(req: MACRequest):
    try:
        from src.pa15_signatures.signatures import RSASignature
        from src.pa12_rsa.rsa import RSA
        rsa = RSA()
        keys = rsa.keygen(128)
        sig = RSASignature(rsa)
        m = bytes.fromhex(req.message_hex)
        sigma = sig.sign(keys["sk"], m)
        return {
            "message": req.message_hex,
            "signature": hex(sigma),
            "vk_N": hex(keys["pk"][0]),
            "vk_e": keys["pk"][1],
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#16 ElGamal ─────────────────────────────────────────────────────────────

@app.post("/api/elgamal/keygen")
def elgamal_keygen():
    try:
        eg = get_elgamal()
        keys = eg.keygen()
        pk = keys["pk"]
        return {
            "p": hex(pk["p"]),
            "g": pk["g"],
            "q": hex(pk["q"]),
            "h": hex(pk["h"]),
            "sk": hex(keys["sk"]),
        }
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/elgamal/encrypt")
def elgamal_encrypt(req: RSAEncRequest):
    try:
        eg = get_elgamal()
        keys = eg.keygen()
        c1, c2 = eg.enc(keys["pk"], req.m)
        return {"c1": hex(c1), "c2": hex(c2), "pk_h": hex(keys["pk"]["h"])}
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#18 OT ──────────────────────────────────────────────────────────────────

@app.post("/api/ot/run")
def ot_run(req: OTRequest):
    try:
        ot = get_ot()
        result = ot.full_protocol(req.b, req.m0, req.m1)
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/ot/demo")
def ot_demo(req: OTRequest):
    """
    Full OT demo: runs the 3-step Bellare-Micali protocol and returns:
    - Per-step trace (pk0, pk1, C0, C1, m_b)
    - Cheat attempt: receiver uses sk_b on C_{1-b} → garbage
    - 100 correctness trials
    """
    try:
        ot = get_ot()
        b = req.b % 2
        m0, m1 = req.m0, req.m1

        # ── Step 1: Receiver generates key pairs ──
        pk0, pk1, state = ot.receiver_step1(b)
        sk_b = state["sk_b"]
        pk_b = state["pk_enc"]

        # ── Step 2: Sender encrypts both messages ──
        C0, C1 = ot.sender_step(pk0, pk1, m0, m1)

        # ── Step 3: Receiver decrypts C_b ──
        m_b = ot.receiver_step2(state, C0, C1)

        # ── Cheat: use sk_b to try to decrypt C_{1-b} ──
        C_other = C1 if b == 0 else C0
        m_other = m1 if b == 0 else m0
        cheat_dec = ot.eg.dec(sk_b, pk_b, C_other[0], C_other[1])

        # ── 100 correctness trials ──
        trials, passed = 100, 0
        for _ in range(trials):
            rb = int.from_bytes(os.urandom(1), 'big') % 2
            rm0 = (int.from_bytes(os.urandom(1), 'big') % 98) + 2
            rm1 = (int.from_bytes(os.urandom(1), 'big') % 98) + 2
            pk0t, pk1t, st = ot.receiver_step1(rb)
            C0t, C1t = ot.sender_step(pk0t, pk1t, rm0, rm1)
            m_bt = ot.receiver_step2(st, C0t, C1t)
            if m_bt == (rm0 if rb == 0 else rm1):
                passed += 1

        return {
            "b": b, "m0": m0, "m1": m1,
            "m_b": m_b,
            "m_b_correct": m_b == (m0 if b == 0 else m1),
            "m_other": m_other,
            "honest_key_index": b,
            "pk0_h": str(pk0["h"]),
            "pk1_h": str(pk1["h"]),
            "C0": [str(C0[0]), str(C0[1])],
            "C1": [str(C1[0]), str(C1[1])],
            "cheat_dec": str(cheat_dec),
            "cheat_matches": cheat_dec == m_other,
            "correctness_trials": trials,
            "correctness_pass": passed,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#19 Secure AND ─────────────────────────────────────────────────────────

@app.post("/api/secure_and/compute")
def secure_and(req: SecureANDRequest):
    try:
        gates = get_secure_gates()
        a, b = req.a % 2, req.b % 2
        result_and = gates.AND(a, b)
        result_xor = gates.XOR(a, b)
        return {
            "a": a, "b": b,
            "AND": result_and,
            "XOR": result_xor,
            "NOT_a": gates.NOT(a),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/secure_and/demo")
def secure_and_demo(req: SecureANDRequest):
    """
    Full step-by-step Secure AND demo:
    - Verbose AND with OT intermediate values (pk0, pk1, C0, C1)
    - XOR detail with additive secret sharing trace (random r, shares)
    - Privacy summary: what Alice learns vs what Bob learns
    """
    try:
        gates = get_secure_gates()
        a, b = req.a % 2, req.b % 2

        # Verbose AND
        and_detail = gates.AND_verbose(a, b)

        # XOR with explicit secret-sharing trace
        r = int.from_bytes(os.urandom(1), 'big') % 2
        alice_share = a ^ r
        bob_share = b ^ r
        xor_result = alice_share ^ bob_share

        # NOT
        not_result = gates.NOT(a)

        return {
            "a": a, "b": b,
            # AND result + OT trace
            "AND": and_detail["result"],
            "AND_correct": and_detail["correct"],
            "pk0_h": and_detail["pk0_h"],
            "pk1_h": and_detail["pk1_h"],
            "honest_key_index": and_detail["honest_key_index"],
            "m0_sent": and_detail["m0_sent"],
            "m1_sent": and_detail["m1_sent"],
            "C0": and_detail["C0"],
            "C1": and_detail["C1"],
            # XOR secret-sharing trace
            "XOR": xor_result,
            "xor_r": r,
            "alice_share": alice_share,
            "bob_share": bob_share,
            # NOT
            "NOT_a": not_result,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/secure_and/run_all")
def secure_and_run_all(req: dict = None):
    """
    Run all 4 (a,b) combinations and verify AND/XOR correctness across multiple runs.
    Returns per-combo results with pass/fail for the truth table demo.
    """
    try:
        gates = get_secure_gates()
        combos = []
        for ai in (0, 1):
            for bi in (0, 1):
                runs = 10
                and_pass = sum(1 for _ in range(runs) if gates.AND(ai, bi) == (ai & bi))
                xor_pass = sum(1 for _ in range(runs) if gates.XOR(ai, bi) == (ai ^ bi))
                combos.append({
                    "a": ai, "b": bi,
                    "expected_and": ai & bi,
                    "expected_xor": ai ^ bi,
                    "and_pass": and_pass,
                    "xor_pass": xor_pass,
                    "runs": runs,
                    "and_correct": and_pass == runs,
                    "xor_correct": xor_pass == runs,
                })
        all_and_correct = all(c["and_correct"] for c in combos)
        all_xor_correct = all(c["xor_correct"] for c in combos)
        return {
            "combos": combos,
            "all_and_correct": all_and_correct,
            "all_xor_correct": all_xor_correct,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#20 MPC Millionaire ─────────────────────────────────────────────────────

@app.post("/api/mpc/millionaire")
def mpc_millionaire(req: MillionaireRequest):
    try:
        from src.pa20_mpc.mpc import millionaires_problem
        return millionaires_problem(req.x, req.y, req.n_bits)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/mpc/equality")
def mpc_equality(req: MillionaireRequest):
    try:
        from src.pa20_mpc.mpc import secure_equality
        return secure_equality(req.x, req.y, req.n_bits)
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/mpc/addition")
def mpc_addition(req: AdditionRequest):
    try:
        from src.pa20_mpc.mpc import secure_addition
        return secure_addition(req.x, req.y, req.n_bits)
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#12 RSA Demo ────────────────────────────────────────────────────────────

@app.post("/api/rsa/demo")
def rsa_demo(req: RSADemoRequest):
    try:
        from src.pa12_rsa.rsa import RSA
        rsa = RSA()
        keys = rsa.keygen(128)
        pk, sk = keys["pk"], keys["sk"]
        m_bytes = bytes.fromhex(req.message_hex)
        if req.use_pkcs:
            ct1_int = rsa.pkcs15_enc(pk, m_bytes)
            ct2_int = rsa.pkcs15_enc(pk, m_bytes)
            N = pk[0]
            k = (N.bit_length() + 7) // 8
            ct1 = ct1_int.to_bytes(k, 'big')
            ct2 = ct2_int.to_bytes(k, 'big')
            dec = rsa.pkcs15_dec(sk, ct1_int)
            def extract_ps(ct_int):
                m_int = rsa.rsa_dec(sk, ct_int)
                em = m_int.to_bytes(k, 'big')
                sep = em.index(0x00, 2)
                return em[2:sep].hex()
            ps1 = extract_ps(ct1_int)
            ps2 = extract_ps(ct2_int)
            return {
                "ct1": ct1.hex(), "ct2": ct2.hex(),
                "identical": ct1 == ct2,
                "decrypted": dec.hex() if dec else None,
                "ps1": ps1, "ps2": ps2,
            }
        else:
            m_int = int.from_bytes(m_bytes, 'big') % pk[0]
            ct1_int = rsa.rsa_enc(pk, m_int)
            ct2_int = rsa.rsa_enc(pk, m_int)
            k = (pk[0].bit_length() + 7) // 8
            ct1 = ct1_int.to_bytes(k, 'big')
            ct2 = ct2_int.to_bytes(k, 'big')
            dec_int = rsa.rsa_dec_crt(sk, ct1_int)
            dec = dec_int.to_bytes((dec_int.bit_length() + 7) // 8 or 1, 'big')
        return {
            "ct1": ct1.hex(),
            "ct2": ct2.hex(),
            "identical": ct1 == ct2,
            "decrypted": dec.hex() if dec else None,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#14 Håstad Demo ─────────────────────────────────────────────────────────

@app.post("/api/hastad/demo")
def hastad_demo(req: HastadDemoRequest):
    """
    Håstad Broadcast Attack demo.
    Without PKCS: c_i = m^3 mod N_i → CRT → cube root → recover m.
    With PKCS: each sender pads m with different random PS bytes → EM_i differ →
               CRT result ≠ any single EM^3 → cube root is garbage → attack fails.

    Critical fix: Håstad requires e=3. pkcs15_enc uses e=65537 (wrong for this demo).
    We use e=3 directly: c_i = (PKCS_EM_i)^3 mod N_i.
    """
    try:
        from src.pa14_crt.crt import crt, integer_nth_root
        from src.pa13_miller_rabin.miller_rabin import gen_prime
        from math import gcd

        m = req.message
        e = 3

        # --- Generate 3 independent moduli N_i ---
        # Without PKCS: 64-bit N (spec: "64-bit N_i for instant computation")
        # With PKCS:    96-bit N so PKCS padding fits (k=12 bytes, PS=8 bytes for 1-byte m)
        key_bits = 96 if req.use_pkcs else 64

        def _gen_modulus(bits):
            """Generate N = p*q (fresh primes, suitable for e=3 demo)."""
            while True:
                p = gen_prime(bits // 2)
                q = gen_prime(bits // 2)
                if p != q:
                    return p * q

        moduli = [_gen_modulus(key_bits) for _ in range(3)]

        if req.use_pkcs:
            # Each sender independently pads m with different random PS bytes
            m_bytes = m.to_bytes(max(1, (m.bit_length() + 7) // 8), 'big')
            padded_ems = []   # hex strings of each EM for display
            em_ints   = []    # integer values of EM
            ciphertexts = []

            for N in moduli:
                k = (N.bit_length() + 7) // 8   # byte length of N
                ps_len = k - len(m_bytes) - 3    # 0x00 | 0x02 | PS | 0x00 | m
                if ps_len < 8:
                    raise ValueError(f"N too small for PKCS ({N.bit_length()} bits)")

                # Random nonzero PS — different for every sender (key randomisation)
                ps = bytearray()
                while len(ps) < ps_len:
                    b = os.urandom(1)[0]
                    if b != 0:
                        ps.append(b)

                em = bytes([0x00, 0x02]) + bytes(ps) + bytes([0x00]) + m_bytes
                em_int = int.from_bytes(em, 'big')
                # Encrypt with e=3 (Håstad context)
                ct = pow(em_int, 3, N)

                padded_ems.append(em.hex())
                em_ints.append(str(em_int))
                ciphertexts.append(ct)

            # Attacker runs CRT then integer cube root
            x = crt(ciphertexts, moduli)
            root = integer_nth_root(x, e)
            cube_root_exact = (root ** 3 == x)   # if False → garbage, attack failed

            return {
                "moduli":      [str(N) for N in moduli],
                "ciphertexts": [str(c) for c in ciphertexts],
                "m_cubed":     str(x),
                "recovered":   str(root),
                "attack_succeeded": False,          # always fails with PKCS
                "cube_root_exact":  cube_root_exact,
                "use_pkcs":    True,
                "padded_ems":  padded_ems,          # hex EM for each sender
                "em_ints":     em_ints,
                "em_same":     (len(set(em_ints)) == 1),  # always False — different PS!
            }
        else:
            # Textbook Håstad: c_i = m^3 mod N_i  (no padding)
            ciphertexts = [pow(m, e, N) for N in moduli]
            x = crt(ciphertexts, moduli)
            root = integer_nth_root(x, e)
            return {
                "moduli":      [str(N) for N in moduli],
                "ciphertexts": [str(c) for c in ciphertexts],
                "m_cubed":     str(x),
                "recovered":   str(root),
                "attack_succeeded": (root == m),
                "cube_root_exact":  (root ** 3 == x),
                "use_pkcs":    False,
                "padded_ems":  None,
                "em_ints":     None,
                "em_same":     None,
            }
    except Exception as exc:
        raise HTTPException(400, str(exc))


# ── PA#15 Signature Demo ──────────────────────────────────────────────────────

@app.post("/api/sig/demo")
def sig_demo(req: SigDemoRequest):
    try:
        from src.pa15_signatures.signatures import RSASignature
        from src.pa12_rsa.rsa import RSA
        rsa = RSA()
        keys = rsa.keygen(128)
        sig = RSASignature(rsa)
        m_bytes = req.message.encode()
        sigma = sig.sign(keys["sk"], m_bytes)
        verify_msg = (req.message + " TAMPERED").encode() if req.tamper else m_bytes
        valid = sig.verify(keys["pk"], verify_msg, sigma)
        h_bytes = sig.H.hash(m_bytes)
        result = {
            "hash": h_bytes.hex(),
            "signature": str(sigma),
            "valid": valid,
        }
        if req.show_forgery:
            forgery_demo = sig.multiplicative_forgery_demo(
                keys["pk"], b"alpha", sig.sign(keys["sk"], b"alpha"),
                b"beta", sig.sign(keys["sk"], b"beta")
            )
            result["forgery"] = {"verifies": forgery_demo["forgery_valid"]}
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#16 ElGamal Demo ────────────────────────────────────────────────────────

@app.post("/api/elgamal/demo")
def elgamal_demo(req: ElGamalDemoRequest):
    try:
        eg = get_elgamal()
        keys = eg.keygen()
        pk, sk = keys["pk"], keys["sk"]
        p, q, g, h = pk["p"], pk["q"], pk["g"], pk["h"]
        m = max(1, req.message % q)
        k = max(1, req.multiplier % q)
        c1, c2 = eg.enc(pk, m)
        decrypted = eg.dec(sk, pk, c1, c2)
        c2_prime = (k * c2) % p
        malleable_dec = eg.dec(sk, pk, c1, c2_prime)
        expected = (k * m) % p
        return {
            "p": str(p), "g": str(g), "q": str(q), "h": str(h),
            "sk": str(sk), "m": str(m),
            "c1": str(c1), "c2": str(c2),
            "decrypted": str(decrypted),
            "multiplier": k,
            "c2_prime": str(c2_prime),
            "malleable_decrypted": str(malleable_dec),
            "expected_malleable": str(expected),
            "success": (malleable_dec == expected),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/elgamal/cpa_game")
def elgamal_cpa_game():
    """
    IND-CPA game demo:
    - Large group (32-bit): random adversary has advantage ≈ 0 (DDH hard)
    - Small group (12-bit): brute-force DLP → advantage ≈ 0.5 (DDH easy)
    - CCA oracle: submit modified ciphertext, oracle reveals 2m → CCA broken
    """
    try:
        from src.pa16_elgamal.elgamal import ElGamal
        from src.pa13_miller_rabin.miller_rabin import mod_pow, mod_inverse

        rounds = 20

        # --- Large group (32-bit): random adversary ---
        eg_large = get_elgamal()
        keys_l = eg_large.keygen()
        pk_l, sk_l = keys_l["pk"], keys_l["sk"]
        q_l, p_l = pk_l["q"], pk_l["p"]
        correct_large = 0
        for _ in range(rounds):
            m0 = eg_large.group.random_exponent() % (q_l // 2) + 1
            m1 = eg_large.group.random_exponent() % (q_l // 2) + 1
            b = int.from_bytes(os.urandom(1), 'big') % 2
            m_b = m0 if b == 0 else m1
            c1, c2 = eg_large.enc(pk_l, m_b)
            guess = int.from_bytes(os.urandom(1), 'big') % 2
            if guess == b:
                correct_large += 1
        adv_large = round(abs(correct_large / rounds - 0.5), 4)

        # --- Small group (12-bit): brute-force DLP distinguisher ---
        eg_small = ElGamal(bits=12)
        keys_s = eg_small.keygen()
        pk_s, sk_s = keys_s["pk"], keys_s["sk"]
        q_s, p_s, g_s, h_s = pk_s["q"], pk_s["p"], pk_s["g"], pk_s["h"]
        correct_small = 0
        for _ in range(rounds):
            span = max(2, q_s // 4)
            m0 = 2 + eg_small.group.random_exponent() % span
            m1 = m0 + 1
            b = int.from_bytes(os.urandom(1), 'big') % 2
            m_b = m0 if b == 0 else m1
            c1_s, c2_s = eg_small.enc(pk_s, m_b)
            # Brute-force DLP: find r s.t. g^r == c1
            guess = int.from_bytes(os.urandom(1), 'big') % 2
            for r_try in range(1, min(q_s + 1, 4096)):
                if mod_pow(g_s, r_try, p_s) == c1_s:
                    h_r = mod_pow(h_s, r_try, p_s)
                    m_dec = c2_s * mod_inverse(h_r, p_s) % p_s
                    guess = 0 if m_dec == m0 else 1
                    break
            if guess == b:
                correct_small += 1
        adv_small = round(abs(correct_small / rounds - 0.5), 4)

        # --- CCA oracle demo ---
        eg = get_elgamal()
        keys = eg.keygen()
        pk, sk = keys["pk"], keys["sk"]
        p = pk["p"]
        m_ch = 42
        c1_ch, c2_ch = eg.enc(pk, m_ch)
        c2_mod = (2 * c2_ch) % p
        oracle_out = eg.dec(sk, pk, c1_ch, c2_mod)
        equals_2m = (oracle_out == (2 * m_ch) % p)

        return {
            "large_group": {
                "q_bits": q_l.bit_length(),
                "rounds": rounds,
                "correct": correct_large,
                "advantage": adv_large,
            },
            "small_group": {
                "q_bits": q_s.bit_length(),
                "rounds": rounds,
                "correct": correct_small,
                "advantage": adv_small,
            },
            "cca_demo": {
                "m": m_ch,
                "c1": str(c1_ch),
                "c2": str(c2_ch),
                "c2_modified": str(c2_mod),
                "oracle_returned": str(oracle_out),
                "equals_2m": equals_2m,
                "recovered_m": str(oracle_out // 2),
            },
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#17 CCA Demo ────────────────────────────────────────────────────────────

@app.post("/api/cca/demo")
def cca_demo(req: CCADemoRequest):
    """
    PA#17 CCA-Secure PKC demo — Encrypt-then-Sign.
    Returns both honest and tampered results plus a plain-ElGamal contrast,
    so the frontend can reveal results step by step.
    """
    try:
        from src.pa17_cca_pkc.cca_pkc import CCA_PKC
        from src.pa12_rsa.rsa import RSA
        from src.pa15_signatures.signatures import RSASignature

        eg = get_elgamal()
        rsa = RSA()
        sig = RSASignature(rsa)
        keys_enc = eg.keygen()
        keys_sign = rsa.keygen(128)
        cca = CCA_PKC(eg, sig)
        pk_enc = keys_enc["pk"]
        sk_enc = keys_enc["sk"]
        p, q = pk_enc["p"], pk_enc["q"]

        # Encode message as integer (hash → mod q)
        m_bytes = req.message.encode()
        m_int = int.from_bytes(sig.H.hash(m_bytes), 'big') % q

        # ── Step 1: ElGamal Encrypt ──────────────────────────────────────────
        c1, c2 = eg.enc(pk_enc, m_int)

        # ── Step 2: Sign C_E ─────────────────────────────────────────────────
        ce_bytes = (hex(c1) + "|" + hex(c2)).encode()
        sigma = sig.sign(keys_sign["sk"], ce_bytes)
        payload = {"c1": c1, "c2": c2, "sigma": sigma, "ce_bytes": ce_bytes}

        # ── Honest CCA decrypt ────────────────────────────────────────────────
        cca_honest = cca.dec(sk_enc, pk_enc, keys_sign["pk"], payload)

        # ── Tampered: c2' = 2*c2 mod p ───────────────────────────────────────
        c2_tampered = (2 * c2) % p
        tampered_payload = {
            "c1": c1,
            "c2": c2_tampered,
            "sigma": sigma,               # original sigma — covers OLD ce_bytes
            "ce_bytes": (hex(c1) + "|" + hex(c2_tampered)).encode(),
        }
        # CCA: sig verification fires first → rejected
        cca_tampered = cca.dec(sk_enc, pk_enc, keys_sign["pk"], tampered_payload)
        sig_on_tampered = sig.verify(keys_sign["pk"], tampered_payload["ce_bytes"], sigma)

        # ── Plain ElGamal contrast ────────────────────────────────────────────
        eg_honest_dec = eg.dec(sk_enc, pk_enc, c1, c2)
        eg_tampered_dec = eg.dec(sk_enc, pk_enc, c1, c2_tampered)

        return {
            # Keys (display)
            "p": str(p), "g": str(pk_enc["g"]), "q": str(q), "h": str(pk_enc["h"]),
            "message": req.message,
            "m_int": str(m_int),
            # Encrypt-then-Sign output
            "c1": str(c1), "c2": str(c2),
            "sigma": str(sigma),
            # Honest CCA decrypt
            "cca_honest_dec": str(cca_honest),
            "cca_honest_success": cca_honest is not None,
            # Tampered ciphertext
            "c2_tampered": str(c2_tampered),
            "sig_on_tampered": sig_on_tampered,         # always False
            "cca_tampered_rejected": cca_tampered is None,  # always True
            # Plain ElGamal contrast
            "eg_honest_dec": str(eg_honest_dec),
            "eg_tampered_dec": str(eg_tampered_dec),
            "eg_tampered_equals_2m": (eg_tampered_dec == (2 * m_int) % p),
            # Legacy field kept for compatibility
            "success": cca_honest is not None,
            "decrypted": req.message if cca_honest is not None else None,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── Routing table (clique reduction paths) ────────────────────────────────────

ROUTING_TABLE = {
    # ── Forward reductions ────────────────────────────────────────────────
    ("OWF", "PRG"): {
        "steps": ["OWF → PRG (HILL hard-core bit construction)"],
        "theorem": "HILL Theorem",
        "pa": "PA#1",
        "direction": "forward",
        "security_claim": "If adversary breaks PRG with advantage ε, it breaks OWF with advantage ε' ≥ ε/n",
    },
    ("OWF", "OWP"): {
        "steps": ["OWF → OWP (DLP: f(x)=g^x mod p is a OWP on Z_q)"],
        "theorem": "DLP OWP",
        "pa": "PA#1",
        "direction": "forward",
        "security_claim": "f(x)=g^x mod p is both one-way and a permutation on Z_q under DLP",
    },
    ("PRG", "PRF"): {
        "steps": ["PRG → PRF (GGM tree construction)"],
        "theorem": "GGM Theorem",
        "pa": "PA#2",
        "direction": "forward",
        "security_claim": "If adversary breaks PRF with advantage ε in 2^n queries, it breaks PRG with advantage ε' ≥ ε/n",
    },
    ("PRF", "PRP"): {
        "steps": ["PRF → PRP (Luby-Rackoff 3-round Feistel)"],
        "theorem": "Luby-Rackoff",
        "pa": "PA#4",
        "direction": "forward",
        "security_claim": "3-round Feistel with PRF rounds is a PRP; 4 rounds is a strong PRP",
    },
    ("PRF", "CPA_ENC"): {
        "steps": ["PRF → CPA-secure Enc (nonce-based: C = F_k(r) XOR m)"],
        "theorem": "PRF → CPA Security",
        "pa": "PA#3",
        "direction": "forward",
        "security_claim": "If adversary breaks IND-CPA with advantage ε in q queries, it breaks PRF with advantage ε' ≥ ε - q²/2^n",
    },
    ("PRF", "MAC"): {
        "steps": ["PRF → MAC (Mac_k(m) = F_k(m))"],
        "theorem": "PRF-MAC Security",
        "pa": "PA#5",
        "direction": "forward",
        "security_claim": "If adversary forges MAC with probability ε in q queries, it distinguishes PRF with advantage ε' ≥ ε - q/2^n",
    },
    ("PRP", "MAC"): {
        "steps": ["PRP → PRF (switching lemma)", "PRF → MAC"],
        "theorem": "PRP/PRF Switching Lemma + PRF-MAC",
        "pa": "PA#5",
        "direction": "forward",
        "security_claim": "PRP is indistinguishable from PRF with advantage ≤ q²/2^n+1; combined with PRF-MAC gives EUF-CMA",
    },
    ("CPA_ENC", "CCA_ENC"): {
        "steps": ["CPA_Enc + MAC → CCA (Encrypt-then-MAC)"],
        "theorem": "Encrypt-then-MAC → IND-CCA2",
        "pa": "PA#6",
        "direction": "forward",
        "security_claim": "If Enc is IND-CPA and MAC is EUF-CMA, then Encrypt-then-MAC is IND-CCA2",
    },
    ("PRF", "CRHF"): {
        "steps": ["PRF compression → Merkle-Damgård CRHF"],
        "theorem": "Merkle-Damgård Collision Resistance",
        "pa": "PA#7",
        "direction": "forward",
        "security_claim": "If compression function is collision-resistant, so is the MD hash",
    },
    ("DLP", "CRHF"): {
        "steps": ["DLP → DLP hash (h(x,y)=g^x·h^y mod p is CRHF under DLP)"],
        "theorem": "DLP-CRHF Reduction",
        "pa": "PA#8",
        "direction": "forward",
        "security_claim": "Finding collision in DLP hash solves DLP: if h(x1,y1)=h(x2,y2) then alpha=(x1-x2)/(y2-y1) mod q",
    },
    ("CRHF", "HMAC"): {
        "steps": ["CRHF → HMAC (H built on PRF compression function)"],
        "theorem": "HMAC Security Theorem",
        "pa": "PA#10",
        "direction": "forward",
        "security_claim": "HMAC is EUF-CMA if underlying hash is a PRF for secret key prefix",
    },
    ("HMAC", "MAC"): {
        "steps": ["HMAC → MAC (HMAC is EUF-CMA secure MAC)"],
        "theorem": "HMAC is a secure MAC",
        "pa": "PA#10",
        "direction": "forward",
        "security_claim": "HMAC_k(m) is EUF-CMA secure under compression-function PRF assumption",
    },
    # ── Backward reductions ───────────────────────────────────────────────
    ("PRG", "OWF"): {
        "steps": ["PRG → OWF (any PRG is a OWF by hard-core predicate argument)"],
        "theorem": "PRG implies OWF (contrapositive)",
        "pa": "PA#1",
        "direction": "backward",
        "security_claim": "If no OWF exists, no PRG exists: inverting G on random output solves OWF",
    },
    ("PRF", "PRG"): {
        "steps": ["PRF → PRG: G(s) = F_s(0^n) || F_s(1^n)"],
        "theorem": "PRF implies PRG (length-doubling)",
        "pa": "PA#2",
        "direction": "backward",
        "security_claim": "F_k is a PRF → G(k) = F_k(0)||F_k(1) is a secure PRG",
    },
    ("PRP", "PRF"): {
        "steps": ["PRP → PRF (PRP is PRF on super-poly domain by switching lemma)"],
        "theorem": "PRP/PRF Switching Lemma",
        "pa": "PA#4",
        "direction": "backward",
        "security_claim": "PRP is indistinguishable from PRF with advantage ≤ q²/2^(n+1)",
    },
    ("MAC", "PRF"): {
        "steps": ["MAC → PRF: secure EUF-CMA MAC on uniform messages is a PRF"],
        "theorem": "MAC implies PRF (uniform-message domain)",
        "pa": "PA#5",
        "direction": "backward",
        "security_claim": "A secure MAC on all-uniform messages implies PRF; contrapositive: PRF-breaker → MAC forger",
    },
    ("HMAC", "CRHF"): {
        "steps": ["HMAC → CRHF: fix key k, H'(m) = HMAC_k(m) is collision-resistant"],
        "theorem": "HMAC implies CRHF (fixed key)",
        "pa": "PA#10",
        "direction": "backward",
        "security_claim": "If HMAC is EUF-CMA secure, then H'(m)=HMAC_k(m) is collision resistant for a random k",
    },
    ("MAC", "CRHF"): {
        "steps": ["MAC compression function → Merkle-Damgård CRHF"],
        "theorem": "MAC compression → CRHF",
        "pa": "PA#10",
        "direction": "backward",
        "security_claim": "PRF-MAC's internal compression function is a CRHF",
    },
    ("MAC", "HMAC"): {
        "steps": ["MAC → HMAC: any PRF-based MAC fits HMAC double-hash structure"],
        "theorem": "PRF-MAC ≡ HMAC (for PRF compression functions)",
        "pa": "PA#10",
        "direction": "backward",
        "security_claim": "HMAC generalizes PRF-MAC for arbitrary-length messages",
    },
    ("OWP", "OWF"): {
        "steps": ["OWP → OWF: a one-way permutation is a one-way function (bijective → hard to invert)"],
        "theorem": "OWP ⊆ OWF",
        "pa": "PA#1",
        "direction": "backward",
        "security_claim": "Any OWF-inverter immediately inverts the OWP; OWP security is a special case of OWF security",
    },
    ("CPA_ENC", "PRF"): {
        "steps": ["CPA_ENC → PRF: distinguishing ciphertexts F_k(r)⊕m from uniform implies a PRF distinguisher"],
        "theorem": "IND-CPA ⇒ PRF Security (contrapositive)",
        "pa": "PA#3",
        "direction": "backward",
        "security_claim": "A PRF adversary with advantage ε gives an IND-CPA adversary with advantage ε - q²/2^n",
    },
    ("CCA_ENC", "CPA_ENC"): {
        "steps": ["CCA_ENC → CPA_ENC: IND-CCA2 is strictly stronger than IND-CPA; any CCA-secure scheme is CPA-secure"],
        "theorem": "IND-CCA2 ⇒ IND-CPA",
        "pa": "PA#6",
        "direction": "backward",
        "security_claim": "CCA adversary can simulate CPA game; breaking IND-CPA gives a CCA2 adversary with equal advantage",
    },
    ("CRHF", "PRF"): {
        "steps": ["CRHF → PRF: a CRHF collision in the MD compression function yields a PRF distinguisher"],
        "theorem": "CRHF Collision ⇒ PRF Break",
        "pa": "PA#7",
        "direction": "backward",
        "security_claim": "If compression function PRF is broken, its outputs can be distinguished from random, producing CRHF collisions via birthday attack",
    },
    ("CRHF", "DLP"): {
        "steps": ["CRHF → DLP: collision h(x1,y1)=h(x2,y2) in DLP hash g^x·h^y mod p solves discrete log α=(x1-x2)/(y2-y1) mod q"],
        "theorem": "DLP-Hash Collision ⇒ DLP Solution",
        "pa": "PA#8",
        "direction": "backward",
        "security_claim": "Any collision-finder for the DLP hash is immediately a DLP solver; CRHF security reduces to DLP hardness",
    },
    ("MAC", "PRP"): {
        "steps": ["MAC → PRP: CBC-MAC forgery implies a PRP distinguisher for the underlying block cipher"],
        "theorem": "CBC-MAC Forgery ⇒ PRP Break",
        "pa": "PA#5",
        "direction": "backward",
        "security_claim": "If the block cipher (PRP) is broken, CBC-MAC tags can be forged; EUF-CMA security of CBC-MAC reduces to PRP security",
    },
    # ── Multi-hop paths ───────────────────────────────────────────────────
    ("OWF", "PRF"): {
        "steps": ["OWF → PRG (HILL)", "PRG → PRF (GGM)"],
        "theorem": "OWF → PRG → PRF (HILL + GGM)",
        "pa": "PA#1, PA#2",
        "direction": "forward",
        "security_claim": "OWF is the minimal assumption for PRF existence",
    },
    ("OWF", "MAC"): {
        "steps": ["OWF → PRG → PRF → MAC"],
        "theorem": "OWF → MAC",
        "pa": "PA#1, PA#2, PA#5",
        "direction": "forward",
        "security_claim": "MAC can be built from any OWF",
    },
    ("OWF", "PRP"): {
        "steps": ["OWF → PRG → PRF → PRP (Luby-Rackoff)"],
        "theorem": "OWF → PRP",
        "pa": "PA#1, PA#2, PA#4",
        "direction": "forward",
        "security_claim": "Block ciphers (PRPs) exist if OWFs exist",
    },
    ("PRG", "MAC"): {
        "steps": ["PRG → PRF (GGM)", "PRF → MAC"],
        "theorem": "PRG → MAC",
        "pa": "PA#2, PA#5",
        "direction": "forward",
        "security_claim": "PRG suffices for MAC construction",
    },
    ("PRG", "PRP"): {
        "steps": ["PRG → PRF (GGM)", "PRF → PRP (Luby-Rackoff)"],
        "theorem": "PRG → PRP",
        "pa": "PA#2, PA#4",
        "direction": "forward",
        "security_claim": "PRG suffices for PRP (block cipher) construction",
    },
    ("OWP", "PRG"): {
        "steps": ["OWP → OWF (any OWP is a OWF)", "OWF → PRG (HILL)"],
        "theorem": "OWP → OWF → PRG",
        "pa": "PA#1",
        "direction": "forward",
        "security_claim": "OWP is a special case of OWF",
    },
    ("OWP", "PRF"): {
        "steps": ["OWP → OWF", "OWF → PRG (HILL)", "PRG → PRF (GGM)"],
        "theorem": "OWP → PRF",
        "pa": "PA#1, PA#2",
        "direction": "forward",
        "security_claim": "OWP implies PRF via HILL construction",
    },
    ("CRHF", "MAC"): {
        "steps": ["CRHF → HMAC (compression function)", "HMAC → MAC (EUF-CMA)"],
        "theorem": "CRHF → MAC",
        "pa": "PA#10",
        "direction": "forward",
        "security_claim": "HMAC builds a secure MAC from any CRHF",
    },
}

@app.get("/api/reduce/all")
def reduce_all():
    """Return the full routing table as JSON."""
    result = []
    for (src, tgt), entry in ROUTING_TABLE.items():
        result.append({
            "source": src,
            "target": tgt,
            **entry,
        })
    return {"reductions": result, "count": len(result)}

@app.post("/api/reduce")
def reduce_query(req: ReduceRequest):
    key = (req.source.upper(), req.target.upper())
    if key in ROUTING_TABLE:
        return ROUTING_TABLE[key]
    # Check reverse
    rev_key = (req.target.upper(), req.source.upper())
    if rev_key in ROUTING_TABLE:
        entry = dict(ROUTING_TABLE[rev_key])
        entry["direction"] = "backward"
        entry["note"] = f"Backward reduction: {req.target} ⇒ {req.source}"
        return entry
    # Try multi-hop BFS
    graph = {}
    for (s, t) in ROUTING_TABLE:
        graph.setdefault(s, []).append(t)
    src, tgt = req.source.upper(), req.target.upper()
    from collections import deque
    q = deque([(src, [src])])
    visited = {src}
    while q:
        node, path = q.popleft()
        if node == tgt:
            steps = []
            for i in range(len(path) - 1):
                k = (path[i], path[i+1])
                if k in ROUTING_TABLE:
                    steps.extend(ROUTING_TABLE[k]["steps"])
            return {"source": src, "target": tgt, "path": path, "steps": steps,
                    "direction": "multi-hop", "supported": True}
        for nxt in graph.get(node, []):
            if nxt not in visited:
                visited.add(nxt)
                q.append((nxt, path + [nxt]))
    return {
        "steps": [f"No path from {req.source} to {req.target}"],
        "note": "Try using an intermediate primitive",
        "supported": False,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
