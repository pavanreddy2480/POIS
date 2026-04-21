"""
PA#3 — CPA-Secure Encryption.
Enc(k, m) = (r, F_k(r) XOR m) where r is a fresh random nonce.
Multi-block: F_k(r), F_k(r+1), F_k(r+2), ...
Depends on: PA#2 PRF (AESPRF).
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa02_prf.prf import AESPRF

BLOCK_SIZE = 16


def _xor_bytes(a: bytes, b: bytes) -> bytes:
    length = min(len(a), len(b))
    return bytes(x ^ y for x, y in zip(a[:length], b[:length]))


def _int_to_bytes(n: int, length: int = 16) -> bytes:
    return n.to_bytes(length, 'big')


class CPAEnc:
    """
    CPA-secure symmetric encryption based on PRF.
    """

    def __init__(self, prf=None):
        self.prf = prf or AESPRF()

    def enc(self, k: bytes, m: bytes) -> tuple:
        """
        Encrypt message m under key k.
        Returns (r, c) where r is random nonce, c = F_k(r||ctr) XOR m.
        """
        r = os.urandom(BLOCK_SIZE)
        r_int = int.from_bytes(r, 'big')
        c_blocks = []
        for i in range(0, len(m), BLOCK_SIZE):
            block = m[i:i+BLOCK_SIZE].ljust(BLOCK_SIZE, b'\x00')
            ctr_val = (r_int + i // BLOCK_SIZE) % (2**128)
            keystream = self.prf.F(k, _int_to_bytes(ctr_val))
            c_blocks.append(_xor_bytes(keystream, m[i:i+BLOCK_SIZE]))
        return r, b''.join(c_blocks)[:len(m)]

    def dec(self, k: bytes, r: bytes, c: bytes) -> bytes:
        """Decrypt ciphertext c given nonce r."""
        r_int = int.from_bytes(r, 'big')
        m_blocks = []
        for i in range(0, len(c), BLOCK_SIZE):
            ctr_val = (r_int + i // BLOCK_SIZE) % (2**128)
            keystream = self.prf.F(k, _int_to_bytes(ctr_val))
            m_blocks.append(_xor_bytes(keystream, c[i:i+BLOCK_SIZE]))
        return b''.join(m_blocks)[:len(c)]

    def enc_broken(self, k: bytes, m: bytes) -> tuple:
        """
        BROKEN deterministic variant: always uses r=0.
        NOT CPA-secure: same message encrypts to same ciphertext.
        """
        r = b'\x00' * BLOCK_SIZE
        r_int = 0
        c_blocks = []
        for i in range(0, len(m), BLOCK_SIZE):
            ctr_val = (r_int + i // BLOCK_SIZE) % (2**128)
            keystream = self.prf.F(k, _int_to_bytes(ctr_val))
            c_blocks.append(_xor_bytes(keystream, m[i:i+BLOCK_SIZE]))
        return r, b''.join(c_blocks)[:len(m)]

    def run_cpa_game(self, k: bytes, num_rounds: int = 20) -> dict:
        """
        Simulate IND-CPA security game.
        Returns statistics showing the scheme is secure (advantage ~0).
        """
        correct = 0
        for _ in range(num_rounds):
            m0 = os.urandom(BLOCK_SIZE)
            m1 = os.urandom(BLOCK_SIZE)
            b  = int.from_bytes(os.urandom(1), 'big') % 2
            m_challenge = m0 if b == 0 else m1
            r, c = self.enc(k, m_challenge)
            # Adversary strategy: random guess (can't do better)
            b_guess = int.from_bytes(os.urandom(1), 'big') % 2
            if b_guess == b:
                correct += 1
        advantage = abs(correct / num_rounds - 0.5)
        return {
            "rounds": num_rounds,
            "correct_guesses": correct,
            "advantage": round(advantage, 4),
            "secure": advantage < 0.2,
            "scheme": "CPA-secure (nonce-based PRF encryption)",
        }
