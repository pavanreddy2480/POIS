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

class MACVerifyRequest(BaseModel):
    key_hex: str
    message_hex: str
    tag_hex: str

class CCAEncRequest(BaseModel):
    ke_hex: str
    km_hex: str
    message_hex: str

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
        from src.pa05_mac.mac import PRFMAC
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        mac = PRFMAC(get_aes_prf())
        t = mac.mac(k, m)
        return {"tag": t.hex()}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/mac/verify")
def mac_verify(req: MACVerifyRequest):
    try:
        from src.pa05_mac.mac import PRFMAC
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        t = bytes.fromhex(req.tag_hex)
        mac = PRFMAC(get_aes_prf())
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


# ── PA#7 Merkle-Damgård ───────────────────────────────────────────────────────

@app.post("/api/hash/merkle_damgard")
def md_hash(req: HashRequest):
    try:
        from src.pa07_merkle_damgard.merkle_damgard import MerkleDamgard
        msg = bytes.fromhex(req.message_hex)
        def toy_compress(state: bytes, block: bytes) -> bytes:
            return bytes(a ^ b for a, b in zip(state, block[:len(state)]))
        md = MerkleDamgard(toy_compress, b'\x00'*4, 8)
        result = md.hash_with_chain(msg)
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#8 DLP Hash ─────────────────────────────────────────────────────────────

@app.post("/api/hash/dlp")
def dlp_hash(req: HashRequest):
    try:
        msg = bytes.fromhex(req.message_hex)
        H = get_dlp_hash()
        digest = H.hash(msg)
        return {"message": req.message_hex, "digest": digest.hex()}
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#9 Birthday Attack ──────────────────────────────────────────────────────

@app.post("/api/birthday/attack")
def birthday_attack(req: BirthdayRequest):
    try:
        from src.pa09_birthday_attack.birthday_attack import birthday_attack_naive
        H = get_dlp_hash()
        def hash_fn(b: bytes) -> int:
            d = H.hash(b)
            return int.from_bytes(d, 'big')
        result = birthday_attack_naive(hash_fn, req.n_bits)
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#10 HMAC ────────────────────────────────────────────────────────────────

@app.post("/api/hmac/sign")
def hmac_sign(req: HMACRequest):
    try:
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        tag = get_hmac().mac(k, m)
        return {"tag": tag.hex()}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/hmac/length_extension")
def hmac_length_extension(req: LengthExtRequest):
    try:
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        suffix = bytes.fromhex(req.suffix_hex)
        H = get_dlp_hash()

        # Naive MAC: t = H(k || m) — what the server issues
        naive_tag = H.hash(k + m)

        # Padding of k||m (attacker knows this if they know len(k) and m)
        pad_k_m = H.md.pad(k + m)
        full_len = len(pad_k_m)

        # Attacker's forged tag: start MD from state=naive_tag, process suffix
        # The padding for the suffix must account for the length offset (full_len bytes before it)
        suffix_blocks = H.md.pad(b'\x00' * full_len + suffix)[full_len:]
        state = naive_tag
        for i in range(0, len(suffix_blocks), H.md.block_size):
            state = H.group.compress_fn(state, suffix_blocks[i:i + H.md.block_size])
        attacker_tag = state

        # Ground truth: H(pad(k||m) || suffix) computed from scratch — should match attacker_tag
        ground_truth = H.hash(pad_k_m + suffix)
        attack_succeeds = attacker_tag == ground_truth

        return {
            "naive_tag": naive_tag.hex(),
            "pad_k_m_hex": pad_k_m.hex(),
            "suffix_hex": suffix.hex(),
            "attacker_tag": attacker_tag.hex(),
            "ground_truth_tag": ground_truth.hex(),
            "attack_succeeds": attack_succeeds,
        }
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/hmac/verify")
def hmac_verify(req: MACVerifyRequest):
    try:
        k = bytes.fromhex(req.key_hex)
        m = bytes.fromhex(req.message_hex)
        t = bytes.fromhex(req.tag_hex)
        valid = get_hmac().verify(k, m, t)
        return {"valid": valid}
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


# ── PA#20 MPC Millionaire ─────────────────────────────────────────────────────

@app.post("/api/mpc/millionaire")
def mpc_millionaire(req: MillionaireRequest):
    try:
        from src.pa20_mpc.mpc import millionaires_problem, secure_equality
        result = millionaires_problem(req.x, req.y, req.n_bits)
        eq_result = secure_equality(req.x, req.y, req.n_bits)
        result["x_eq_y"] = eq_result["equal"]
        result["gate_count"] = result.get("ot_calls", req.n_bits)
        result["xor_count"] = req.n_bits
        return result
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
    try:
        from src.pa12_rsa.rsa import RSA
        from src.pa14_crt.crt import crt, integer_nth_root
        m = req.message
        e = 3
        rsa_inst = RSA()
        keys_list = [rsa_inst.keygen(128) for _ in range(3)]
        moduli = [k["pk"][0] for k in keys_list]

        if req.use_pkcs:
            m_bytes = m.to_bytes((m.bit_length() + 7) // 8 or 1, 'big')
            ciphertexts = [rsa_inst.pkcs15_enc(k["pk"], m_bytes) for k in keys_list]
        else:
            ciphertexts = [pow(m, e, N) for N in moduli]

        m_cubed_big = crt(ciphertexts, moduli)
        root = integer_nth_root(m_cubed_big, e)
        attack_succeeded = (root == m)

        return {
            "moduli": [str(N) for N in moduli],
            "ciphertexts": [str(c) for c in ciphertexts],
            "m_cubed": str(m_cubed_big),
            "recovered": str(root),
            "attack_succeeded": attack_succeeded,
            "use_pkcs": req.use_pkcs,
        }
    except Exception as e:
        raise HTTPException(400, str(e))


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
        m = req.message % pk["q"]
        c1, c2 = eg.enc(pk, m)
        decrypted = eg.dec(sk, pk, c1, c2)
        # Malleability: c2' = multiplier * c2 mod p
        c2_prime = (req.multiplier * c2) % pk["p"]
        malleable_dec = eg.dec(sk, pk, c1, c2_prime)
        return {
            "c1": str(c1),
            "c2": str(c2),
            "decrypted": str(decrypted),
            "malleable_decrypted": str(malleable_dec),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


# ── PA#17 CCA Demo ────────────────────────────────────────────────────────────

@app.post("/api/cca/demo")
def cca_demo(req: CCADemoRequest):
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
        # Encode message as integer (hash of string, reduced mod q)
        m_bytes = req.message.encode()
        m_int = int.from_bytes(sig.H.hash(m_bytes), 'big') % keys_enc["pk"]["q"]
        payload = cca.enc(keys_enc["pk"], keys_sign["sk"], keys_sign["pk"], m_int)
        if req.tamper_ciphertext:
            payload = dict(payload)
            payload["c2"] = (payload["c2"] + 1) % keys_enc["pk"]["p"]
            # ce_bytes now doesn't match sigma → verify will fail
            payload["ce_bytes"] = (hex(payload["c1"]) + "|" + hex(payload["c2"])).encode()
        result = cca.dec(keys_enc["sk"], keys_enc["pk"], keys_sign["pk"], payload)
        return {
            "c1": str(payload.get("c1", "")),
            "c2": str(payload.get("c2", "")),
            "sigma": str(payload.get("sigma", "")),
            "success": result is not None,
            "decrypted": req.message if result is not None else None,
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
