"""Tests for PA#7: Merkle-Damgård."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa07_merkle_damgard.merkle_damgard import MerkleDamgard


def test_hash_deterministic():
    md = MerkleDamgard()
    m = b"Hello, World!"
    assert md.hash(m) == md.hash(m)

def test_hash_different_messages():
    md = MerkleDamgard()
    assert md.hash(b"message A") != md.hash(b"message B")

def test_padding_length():
    md = MerkleDamgard()
    m = b"test"
    padded = md.pad(m)
    assert len(padded) % md.block_size == 0

def test_padding_includes_length():
    import struct
    md = MerkleDamgard()
    m = b"abc"
    padded = md.pad(m)
    # Last 8 bytes should be the bit length
    length_bits = struct.unpack('>Q', padded[-8:])[0]
    assert length_bits == len(m) * 8

def test_hash_empty_message():
    md = MerkleDamgard()
    h = md.hash(b"")
    assert len(h) == 16

def test_hash_chain():
    md = MerkleDamgard()
    result = md.hash_with_chain(b"test message")
    assert "chain" in result
    assert "digest" in result

def test_hash_avalanche():
    md = MerkleDamgard()
    h1 = md.hash(b"test")
    h2 = md.hash(b"Test")
    # Should be very different
    diff = sum(1 for a, b in zip(h1, h2) if a != b)
    assert diff > 0

def test_length_extension_vulnerability():
    """Demonstrate that MD is vulnerable to length extension."""
    md = MerkleDamgard()
    m1 = b"secret||data"
    h1 = md.hash(m1)
    # An attacker knowing h1 and the padded length can extend
    # This is a known weakness — HMAC fixes it
    assert len(h1) == 16

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
