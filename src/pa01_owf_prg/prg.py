"""
PA#1 — Pseudorandom Generator (PRG).
G(x0) = b(x0) || b(x1) || ... || b(x_ℓ)
where x_{i+1} = f(x_i) and b(x) = LSB(x) (hard-core predicate under DLP).
Also supports AES-CTR based PRG for speed.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa01_owf_prg.owf import DLPOWF
from src.pa02_prf.aes_impl import aes_encrypt


def _xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))


class PRG:
    """
    PRG from OWF via HILL/iterative hard-core bit construction.
    G(seed) outputs `length` pseudo-random bytes.

    Two backends:
      mode='dlp'  — uses DLPOWF iterated, hard-core predicate = LSB
      mode='aes'  — uses AES-CTR (much faster, used for block-cipher modes)
    """

    def __init__(self, owf: DLPOWF = None, mode: str = 'aes'):
        self.owf  = owf or DLPOWF(bits=32)
        self.mode = mode

    def seed(self, s: bytes) -> None:
        self._seed = s

    def _aes_ctr_expand(self, seed: bytes, length: int) -> bytes:
        """AES-CTR: expand seed to `length` bytes."""
        key = seed[:16].ljust(16, b'\x00')
        out = b''
        ctr = 0
        while len(out) < length:
            block = aes_encrypt(key, ctr.to_bytes(16, 'big'))
            out += block
            ctr += 1
        return out[:length]

    def _dlp_expand(self, seed: bytes, length: int) -> bytes:
        """DLP hard-core bit PRG: outputs one bit per iteration."""
        # Convert seed bytes to an integer in [1, q-1]
        x = int.from_bytes(seed, 'big') % (self.owf.q - 1) + 1
        bits = []
        for _ in range(length * 8):
            bits.append(x & 1)  # hard-core predicate: LSB
            x = self.owf.evaluate(x)  # x_{i+1} = g^{x_i} mod p
        # Pack bits into bytes
        out = bytearray()
        for i in range(0, len(bits), 8):
            byte = 0
            for j, b in enumerate(bits[i:i+8]):
                byte |= (b << (7 - j))
            out.append(byte)
        return bytes(out[:length])

    def next_bits(self, n: int) -> bytes:
        """Generate n bytes from current seed state."""
        out = self.generate(self._seed, n)
        # Advance seed
        self._seed = self._aes_ctr_expand(self._seed, 16)
        return out

    def generate(self, seed: bytes, length: int) -> bytes:
        """Generate `length` pseudo-random bytes from `seed`."""
        if self.mode == 'aes':
            return self._aes_ctr_expand(seed, length)
        else:
            return self._dlp_expand(seed, length)

    def length_doubling(self, s: bytes) -> tuple:
        """G(s) → (G0, G1) each half the output. Used in GGM construction."""
        expanded = self._aes_ctr_expand(s, 32)
        return expanded[:16], expanded[16:]
