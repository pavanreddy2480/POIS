"""
PA#7 — Merkle-Damgård Hash Construction.
Generic MD transform: takes any compression function h: {0,1}^(n+b) → {0,1}^n
Padding: M || 1 || 0* || <64-bit big-endian length>
Depends on: PA#2 AES (for default compression function).
"""
import struct
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa02_prf.aes_impl import aes_encrypt

BLOCK_SIZE = 16  # bytes


def _aes_compress(state: bytes, block: bytes) -> bytes:
    """
    Default compression function using Davies-Meyer:
    h(state, block) = AES_block(state) XOR state
    state and block each 16 bytes → output 16 bytes.
    """
    assert len(state) == 16
    assert len(block) == 16
    aes_out = aes_encrypt(block, state)
    return bytes(a ^ b for a, b in zip(aes_out, state))


class MerkleDamgard:
    """
    Merkle-Damgård hash construction.
    hash(M) = IV → h(IV, M_1) → h(·, M_2) → ... → h(·, M_n)
    with length-padding for collision resistance.
    """

    def __init__(self, compress_fn=None, IV: bytes = None, block_size: int = BLOCK_SIZE):
        self.compress = compress_fn or _aes_compress
        self.IV = IV or (b'\x67\x45\x23\x01\xef\xcd\xab\x89'
                         b'\x98\xba\xdc\xfe\x10\x32\x54\x76')  # default IV
        self.block_size = block_size

    def pad(self, message: bytes) -> bytes:
        """
        Apply MD padding: message || 1-bit || 0-bits || 64-bit length.
        Ensures padded length is multiple of block_size.
        """
        msg_len_bits = len(message) * 8
        # Append 0x80 (1-bit followed by zeros)
        padded = message + b'\x80'
        # Pad with zeros until length ≡ block_size - 8 (mod block_size)
        while len(padded) % self.block_size != self.block_size - 8:
            padded += b'\x00'
        # Append 64-bit big-endian length
        padded += struct.pack('>Q', msg_len_bits)
        assert len(padded) % self.block_size == 0
        return padded

    def hash(self, message: bytes) -> bytes:
        """Compute Merkle-Damgård hash of message."""
        padded = self.pad(message)
        state = self.IV
        chain = []  # for visualization
        for i in range(0, len(padded), self.block_size):
            block = padded[i:i+self.block_size]
            state = self.compress(state, block)
            chain.append(state.hex())
        return state

    def hash_with_chain(self, message: bytes) -> dict:
        """Hash and return the full compression chain for visualization."""
        padded = self.pad(message)
        state = self.IV
        chain = [("IV", state.hex())]
        for i in range(0, len(padded), self.block_size):
            block = padded[i:i+self.block_size]
            state = self.compress(state, block)
            chain.append((f"block_{i//self.block_size}", block.hex(), state.hex()))
        return {
            "message": message.hex(),
            "padded": padded.hex(),
            "chain": chain,
            "digest": state.hex(),
        }
