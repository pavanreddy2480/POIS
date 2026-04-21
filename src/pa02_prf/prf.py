"""
PA#2 — Pseudorandom Functions (PRF).
GGM Tree PRF and AES-based PRF.
Depends on: PA#1 PRG, PA#2 AES-128.
"""
import os
from .aes_impl import aes_encrypt


def _xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))


class GGMPRF:
    """
    GGM Tree PRF.
    F_k(x) where x is interpreted bit-by-bit to traverse a binary tree.
    G0(s) = AES_s(0^16)[:16]  (left child)
    G1(s) = AES_s(1^16)[:16]  (right child)
    """
    def __init__(self, depth: int = 8):
        self.depth = depth
        self._zero_block = b'\x00' * 16
        self._one_block  = b'\x01' + b'\x00' * 15

    def _G0(self, s: bytes) -> bytes:
        return aes_encrypt(s, self._zero_block)

    def _G1(self, s: bytes) -> bytes:
        return aes_encrypt(s, self._one_block)

    def F(self, k: bytes, x: bytes) -> bytes:
        """Evaluate PRF at x. k must be 16 bytes; x used bit-by-bit."""
        assert len(k) == 16
        current = k
        for i in range(self.depth):
            byte_idx = i // 8
            bit_idx  = 7 - (i % 8)
            if byte_idx < len(x):
                bit = (x[byte_idx] >> bit_idx) & 1
            else:
                bit = 0
            current = self._G1(current) if bit else self._G0(current)
        return current

    def get_tree_path(self, k: bytes, x: bytes) -> list:
        """Return list of (node_value, bit) tuples along the tree path."""
        assert len(k) == 16
        path = [("root", k.hex(), None)]
        current = k
        for i in range(self.depth):
            byte_idx = i // 8
            bit_idx  = 7 - (i % 8)
            if byte_idx < len(x):
                bit = (x[byte_idx] >> bit_idx) & 1
            else:
                bit = 0
            current = self._G1(current) if bit else self._G0(current)
            path.append((f"level_{i+1}", current.hex(), bit))
        return path


class AESPRF:
    """
    AES-based PRF: F_k(x) = AES_k(x).
    Requires k and x both 16 bytes.
    """
    def F(self, k: bytes, x: bytes) -> bytes:
        assert len(k) == 16, "Key must be 16 bytes"
        # Pad or truncate x to 16 bytes
        if len(x) < 16:
            x = x.ljust(16, b'\x00')
        elif len(x) > 16:
            x = x[:16]
        return aes_encrypt(k, x)

    def F_counter(self, k: bytes, ctr: int) -> bytes:
        """Evaluate PRF at integer counter (for CTR mode etc)."""
        x = ctr.to_bytes(16, 'big')
        return self.F(k, x)
