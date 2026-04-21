"""
PA#4 — Block Cipher Modes of Operation.
Implements CBC, OFB, CTR using PA#2 AES as the underlying block cipher.
All modes handle arbitrary-length messages via padding (CBC) or stream (OFB/CTR).
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa02_prf.prf import AESPRF
from src.pa02_prf.aes_impl import aes_encrypt, aes_decrypt

BLOCK_SIZE = 16


def _xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))


def _pkcs7_pad(data: bytes, block_size: int = BLOCK_SIZE) -> bytes:
    pad_len = block_size - (len(data) % block_size)
    return data + bytes([pad_len] * pad_len)


def _pkcs7_unpad(data: bytes) -> bytes:
    if not data:
        return data
    pad_len = data[-1]
    if pad_len < 1 or pad_len > BLOCK_SIZE:
        raise ValueError("Invalid padding")
    if data[-pad_len:] != bytes([pad_len] * pad_len):
        raise ValueError("Invalid padding bytes")
    return data[:-pad_len]


class CBCMode:
    """
    Cipher Block Chaining mode.
    Enc: C_i = E_k(M_i XOR C_{i-1}), C_0 = IV
    Dec: M_i = D_k(C_i) XOR C_{i-1}
    """

    def __init__(self, prf=None):
        # CBC uses the block cipher directly (AES), not just PRF
        self.prf = prf

    def encrypt(self, k: bytes, IV: bytes, M: bytes) -> bytes:
        padded = _pkcs7_pad(M)
        prev = IV
        ct = b''
        for i in range(0, len(padded), BLOCK_SIZE):
            block = padded[i:i+BLOCK_SIZE]
            enc_in = _xor_bytes(block, prev)
            ci = aes_encrypt(k, enc_in)
            ct += ci
            prev = ci
        return ct

    def decrypt(self, k: bytes, IV: bytes, C: bytes) -> bytes:
        if len(C) % BLOCK_SIZE != 0:
            raise ValueError("Ciphertext length must be multiple of block size")
        prev = IV
        pt = b''
        for i in range(0, len(C), BLOCK_SIZE):
            block = C[i:i+BLOCK_SIZE]
            dec_out = aes_decrypt(k, block)
            pt += _xor_bytes(dec_out, prev)
            prev = block
        return _pkcs7_unpad(pt)


class OFBMode:
    """
    Output Feedback mode.
    Keystream: O_i = E_k(O_{i-1}), O_0 = IV
    C_i = M_i XOR O_i  (stream cipher — no padding needed)
    """

    def __init__(self, prf=None):
        self.prf = prf

    def _keystream(self, k: bytes, IV: bytes, length: int) -> bytes:
        stream = b''
        state = IV
        while len(stream) < length:
            state = aes_encrypt(k, state)
            stream += state
        return stream[:length]

    def encrypt(self, k: bytes, IV: bytes, M: bytes) -> bytes:
        ks = self._keystream(k, IV, len(M))
        return _xor_bytes(M, ks)

    def decrypt(self, k: bytes, IV: bytes, C: bytes) -> bytes:
        # OFB is symmetric: decrypt = encrypt
        return self.encrypt(k, IV, C)


class CTRMode:
    """
    Counter mode.
    C_i = M_i XOR E_k(r || ctr_i)
    r is a random nonce.
    """

    def __init__(self, prf=None):
        self.prf = prf or AESPRF()

    def _keystream(self, k: bytes, r: bytes, length: int) -> bytes:
        r_int = int.from_bytes(r, 'big')
        stream = b''
        ctr = 0
        while len(stream) < length:
            ctr_val = (r_int + ctr) % (2**128)
            stream += aes_encrypt(k, ctr_val.to_bytes(16, 'big'))
            ctr += 1
        return stream[:length]

    def encrypt(self, k: bytes, M: bytes) -> tuple:
        """Returns (r, C) where r is the random nonce."""
        r = os.urandom(BLOCK_SIZE)
        ks = self._keystream(k, r, len(M))
        C = _xor_bytes(M, ks)
        return r, C

    def decrypt(self, k: bytes, r: bytes, C: bytes) -> bytes:
        ks = self._keystream(k, r, len(C))
        return _xor_bytes(C, ks)


# ── Unified interface ────────────────────────────────────────────────────────
_cbc = CBCMode()
_ofb = OFBMode()
_ctr = CTRMode()


def Encrypt(mode: str, k: bytes, M: bytes, IV: bytes = None) -> bytes:
    """
    Encrypt M under key k using the specified mode.
    Returns ciphertext. For CTR, prepends the nonce.
    """
    m = mode.upper()
    if m == 'CBC':
        iv = IV or os.urandom(BLOCK_SIZE)
        return iv + _cbc.encrypt(k, iv, M)
    elif m == 'OFB':
        iv = IV or os.urandom(BLOCK_SIZE)
        return iv + _ofb.encrypt(k, iv, M)
    elif m == 'CTR':
        r, C = _ctr.encrypt(k, M)
        return r + C
    else:
        raise ValueError(f"Unknown mode: {mode}")


def Decrypt(mode: str, k: bytes, C: bytes, IV: bytes = None) -> bytes:
    """Decrypt ciphertext (IV/nonce prepended) under key k."""
    m = mode.upper()
    if m == 'CBC':
        iv = C[:BLOCK_SIZE]
        return _cbc.decrypt(k, iv, C[BLOCK_SIZE:])
    elif m == 'OFB':
        iv = C[:BLOCK_SIZE]
        return _ofb.decrypt(k, iv, C[BLOCK_SIZE:])
    elif m == 'CTR':
        r = C[:BLOCK_SIZE]
        return _ctr.decrypt(k, r, C[BLOCK_SIZE:])
    else:
        raise ValueError(f"Unknown mode: {mode}")
