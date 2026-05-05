"""
PA#7 — Merkle-Damgård Hash Construction.
Generic MD transform: takes any compression function h: {0,1}^(n+b) → {0,1}^n
Padding (MD-strengthening): M || 1 || 0* || <64-bit big-endian message-length>
Padded length is always a multiple of block_size.

Public interface:
  hash(message, compress_fn=None) -> bytes        ← standalone function
  MerkleDamgard(compress_fn, IV, block_size)      ← class interface
  toy_compress(state, block) -> bytes             ← XOR-based toy for testing

Depends on: PA#2 AES (for default AES-Davies-Meyer compression function).
"""
import struct
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa02_prf.aes_impl import aes_encrypt

BLOCK_SIZE = 16  # bytes — default block size for AES-based compress
TOY_BLOCK_SIZE = 8   # bytes — toy params from the spec
TOY_STATE_SIZE = 4   # bytes — toy params from the spec


# ── Default (AES Davies-Meyer) compression ────────────────────────────────────

def _aes_compress(state: bytes, block: bytes) -> bytes:
    """
    Default compression function using Davies-Meyer construction:
        h(state, block) = AES_block(state) XOR state
    state = 16 bytes (chaining value), block = 16 bytes (message block).
    Output = 16 bytes.
    """
    assert len(state) == BLOCK_SIZE, f"state must be {BLOCK_SIZE}B, got {len(state)}"
    assert len(block) == BLOCK_SIZE, f"block must be {BLOCK_SIZE}B, got {len(block)}"
    aes_out = aes_encrypt(block, state)
    return bytes(a ^ b for a, b in zip(aes_out, state))


# ── Toy XOR compression (for isolated PA#7 testing) ──────────────────────────

def toy_compress(state: bytes, block: bytes) -> bytes:
    """
    Toy XOR compression function.
    h(state, block) = state XOR block[0:len(state)]

    Block size = 8 bytes, state size = 4 bytes (spec toy params).
    Bytes 4-7 of the block are IGNORED — this deliberate weakness is used
    to demonstrate collision propagation in PA#7's collision demo.

    Any two blocks sharing the same first 4 bytes always produce the same
    compression output, illustrating how a compression-function collision
    immediately yields a full-hash collision via the MD reduction.
    """
    n = len(state)
    out = bytes(a ^ b for a, b in zip(state, block[:n]))
    return out


# ── MerkleDamgard class ───────────────────────────────────────────────────────

class MerkleDamgard:
    """
    Generic Merkle-Damgård hash construction.

    Accepts any compression function  h : {0,1}^(n+b) → {0,1}^n
    as a parameter and produces a hash for arbitrary-length inputs.

    hash(M) = IV →ₕ h(IV, M₁) →ₕ h(z₁, M₂) →ₕ … →ₕ h(z_{k-1}, Mₖ)
    with MD-strengthening length-padding for collision resistance.

    Usage:
        md = MerkleDamgard(compress_fn=toy_compress, IV=b'\\x00'*4, block_size=8)
        digest = md.hash(b"Hello")
        result = md.hash_with_chain(b"Hello")  # includes full chain for UI
    """

    def __init__(
        self,
        compress_fn=None,
        IV: bytes = None,
        block_size: int = BLOCK_SIZE,
    ):
        """
        Args:
            compress_fn: h(state: bytes, block: bytes) -> bytes.
                         Default: AES Davies-Meyer (16-byte state & block).
            IV:          Initial chaining value (bytes).
                         Default: SHA-256-style constant.
            block_size:  Message block size in bytes (b in the spec).
                         The state size (n) is inferred as len(IV).
        """
        self.compress = compress_fn or _aes_compress
        self.IV = IV or (
            b'\x67\x45\x23\x01\xef\xcd\xab\x89'
            b'\x98\xba\xdc\xfe\x10\x32\x54\x76'
        )
        self.block_size = block_size

    # ── Padding ───────────────────────────────────────────────────────────────

    def pad(self, message: bytes) -> bytes:
        """
        Apply MD-strengthening padding:
            padded = message || 0x80 || 0x00* || <64-bit big-endian bit-length>

        Ensures len(padded) % block_size == 0 for any message length,
        including empty message and exactly-one-block boundary cases.

        The length field occupies the last 8 bytes of the final block,
        so we zero-pad until len(padded) ≡ block_size − 8  (mod block_size).
        """
        msg_len_bits = len(message) * 8
        # Step 1: Append the 1-bit (represented as 0x80 byte)
        padded = message + b'\x80'
        # Step 2: Append 0x00 bytes until length ≡ block_size − 8 (mod block_size)
        # Special case: if block_size <= 8, the 8-byte length field takes a whole
        # extra block — we still guarantee the result is a multiple of block_size.
        target = self.block_size - min(8, self.block_size)
        while len(padded) % self.block_size != target:
            padded += b'\x00'
        # Step 3: Append 64-bit big-endian original message length (in bits)
        padded += struct.pack('>Q', msg_len_bits)
        # Guarantee alignment (absorb length into final block if needed)
        while len(padded) % self.block_size != 0:
            padded += b'\x00'
        assert len(padded) % self.block_size == 0, (
            f"Padding bug: padded length {len(padded)} not multiple of {self.block_size}"
        )
        return padded

    # ── Core hash ─────────────────────────────────────────────────────────────

    def hash(self, message: bytes) -> bytes:
        """
        Compute the Merkle-Damgård hash of message.
        Returns the final chaining value (digest) as bytes.
        """
        padded = self.pad(message)
        state = self.IV
        for i in range(0, len(padded), self.block_size):
            block = padded[i:i + self.block_size]
            state = self.compress(state, block)
        return state

    # ── Chain with visualization data ─────────────────────────────────────────

    def hash_with_chain(self, message: bytes) -> dict:
        """
        Hash and return the full compression chain for visualization.

        Returns:
            {
                "message": hex,
                "padded":  hex,
                "iv":      hex,
                "chain":   [("IV", iv_hex),
                            ("block_0", block_hex, state_hex), ...],
                "digest":  hex,
                "block_size": int,
                "state_size": int,
                "num_blocks": int,
            }
        """
        padded = self.pad(message)
        state = self.IV
        chain = [("IV", state.hex())]
        for i in range(0, len(padded), self.block_size):
            block = padded[i:i + self.block_size]
            state = self.compress(state, block)
            chain.append((f"block_{i // self.block_size}", block.hex(), state.hex()))
        return {
            "message": message.hex(),
            "padded": padded.hex(),
            "iv": self.IV.hex(),
            "chain": chain,
            "digest": state.hex(),
            "block_size": self.block_size,
            "state_size": len(self.IV),
            "num_blocks": len(chain) - 1,
        }

    # ── Boundary-case self-test ───────────────────────────────────────────────

    def boundary_tests(self) -> list:
        """
        Run three boundary cases and return results.
        Used by the demo to verify correct-length outputs.
        """
        cases = [
            ("empty", b""),
            ("short (< 1 block)", bytes(max(1, self.block_size // 2))),
            ("exactly block_size - 8 bytes", bytes(max(0, self.block_size - 8))),
            ("multi-block", bytes(self.block_size * 2 + 1)),
        ]
        results = []
        for label, msg in cases:
            padded = self.pad(msg)
            digest = self.hash(msg)
            results.append({
                "label": label,
                "msg_len": len(msg),
                "padded_len": len(padded),
                "num_blocks": len(padded) // self.block_size,
                "digest": digest.hex(),
                "digest_len": len(digest),
                "aligned": len(padded) % self.block_size == 0,
            })
        return results


# ── Standalone functional interface (PA#8 plug-in point) ─────────────────────

def hash(message: bytes, compress_fn=None, IV: bytes = None, block_size: int = BLOCK_SIZE) -> bytes:
    """
    Standalone hash function.
    Interface: hash(message, compress_fn) -> bytes

    This is the primary plug-in point for PA#8's DLP compression function:
        from src.pa07_merkle_damgard.merkle_damgard import hash as md_hash
        digest = md_hash(message, dlp_compress_fn)

    Args:
        message:      bytes to hash
        compress_fn:  h(state, block) -> state. Default: AES Davies-Meyer.
        IV:           initial chaining value. Default: standard constant.
        block_size:   block size in bytes. Default: 16.
    Returns:
        digest bytes
    """
    md = MerkleDamgard(compress_fn, IV, block_size)
    return md.hash(message)


# ── Collision demonstration helper ────────────────────────────────────────────

def toy_collision_pair():
    """
    Return two distinct messages that collide under the toy XOR compress + MD.

    toy_compress ignores block[4:8], so any two messages that share the same
    first 4 bytes in every padded block produce the same digest.
    We craft msg_A and msg_B to differ only in bytes 4-7 of the first data block.
    """
    md = MerkleDamgard(toy_compress, b'\x00' * 4, TOY_BLOCK_SIZE)

    # First data block differs in bytes 4-7 (ignored by toy_compress)
    # Subsequent blocks are identical, so the collision propagates.
    msg_A = bytes([0xCA, 0xFE, 0xBA, 0xBE, 0x00, 0x00, 0x00, 0x00,
                   0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88])
    msg_B = bytes([0xCA, 0xFE, 0xBA, 0xBE, 0xFF, 0xFF, 0xFF, 0xFF,
                   0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88])

    d_A = md.hash(msg_A)
    d_B = md.hash(msg_B)

    return {
        "msg_A": msg_A.hex(),
        "msg_B": msg_B.hex(),
        "digest_A": d_A.hex(),
        "digest_B": d_B.hex(),
        "collision": d_A == d_B,
        "chain_A": md.hash_with_chain(msg_A)["chain"],
        "chain_B": md.hash_with_chain(msg_B)["chain"],
    }


# ── Self-test ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== PA#7 Merkle-Damgård Self-Test ===\n")

    # Toy parameters (spec: block=8B, state=4B)
    md = MerkleDamgard(toy_compress, b'\x00' * 4, TOY_BLOCK_SIZE)

    print("Boundary cases:")
    for r in md.boundary_tests():
        status = "✓" if r["aligned"] else "✗"
        print(f"  {status} {r['label']:30s} msg={r['msg_len']:3d}B "
              f"padded={r['padded_len']:3d}B ({r['num_blocks']} block{'s' if r['num_blocks'] > 1 else ''}) "
              f"digest={r['digest']}")

    print("\nCollision propagation demo:")
    cp = toy_collision_pair()
    print(f"  msg_A   = {cp['msg_A']}")
    print(f"  msg_B   = {cp['msg_B']}")
    print(f"  digest_A = {cp['digest_A']}")
    print(f"  digest_B = {cp['digest_B']}")
    print(f"  Collision: {'✓ YES' if cp['collision'] else '✗ NO'}")

    print("\nStandalone hash() function interface:")
    d = hash(b"Hello, PA8!", toy_compress, b'\x00' * 4, TOY_BLOCK_SIZE)
    print(f"  hash(b'Hello, PA8!') = {d.hex()}")
    print("  (PA#8 can plug dlp_compress in the same way)")
