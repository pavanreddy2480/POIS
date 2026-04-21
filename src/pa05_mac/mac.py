"""
PA#5 — Message Authentication Codes.
Implements PRF-MAC and CBC-MAC.
Depends on: PA#2 PRF (AESPRF), PA#2 AES-128.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa02_prf.prf import AESPRF
from src.pa02_prf.aes_impl import aes_encrypt

BLOCK_SIZE = 16


def _xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))


def _pkcs7_pad(data: bytes, block_size: int = BLOCK_SIZE) -> bytes:
    pad_len = block_size - (len(data) % block_size)
    return data + bytes([pad_len] * pad_len)


class PRFMAC:
    """
    PRF-based MAC: T = F_k(m).
    Secure for fixed-length messages; extend via HMAC for variable length.
    """

    def __init__(self, prf=None):
        self.prf = prf or AESPRF()

    def mac(self, k: bytes, m: bytes) -> bytes:
        """Compute MAC tag for message m under key k."""
        # For multi-block: hash m first using a simple Merkle-Damgard-like chain
        if len(m) <= BLOCK_SIZE:
            padded = m.ljust(BLOCK_SIZE, b'\x00')
            return self.prf.F(k, padded)
        else:
            # Chain blocks
            state = b'\x00' * BLOCK_SIZE
            for i in range(0, len(m), BLOCK_SIZE):
                block = m[i:i+BLOCK_SIZE].ljust(BLOCK_SIZE, b'\x00')
                combined = _xor_bytes(state, block)
                state = self.prf.F(k, combined)
            return state

    def vrfy(self, k: bytes, m: bytes, t: bytes) -> bool:
        """Verify MAC tag t for message m under key k (constant-time)."""
        expected = self.mac(k, m)
        # Constant-time comparison
        if len(expected) != len(t):
            return False
        result = 0
        for a, b in zip(expected, t):
            result |= a ^ b
        return result == 0


class CBCMAC:
    """
    CBC-MAC: T = E_k(M_n XOR E_k(... XOR E_k(M_1) ...))
    Only secure for fixed-length messages without padding modification.
    """

    def __init__(self, prf=None):
        self.prf = prf

    def mac(self, k: bytes, m: bytes) -> bytes:
        """Compute CBC-MAC tag for message m."""
        padded = _pkcs7_pad(m)
        state = b'\x00' * BLOCK_SIZE
        for i in range(0, len(padded), BLOCK_SIZE):
            block = padded[i:i+BLOCK_SIZE]
            state = aes_encrypt(k, _xor_bytes(state, block))
        return state

    def vrfy(self, k: bytes, m: bytes, t: bytes) -> bool:
        """Verify CBC-MAC tag (constant-time)."""
        expected = self.mac(k, m)
        if len(expected) != len(t):
            return False
        result = 0
        for a, b in zip(expected, t):
            result |= a ^ b
        return result == 0


def hmac_stub(k: bytes, m: bytes):
    raise NotImplementedError("HMAC not implemented yet (due: PA#10)")
