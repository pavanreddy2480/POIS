"""Tests for PA#8: DLP-based CRHF."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa08_dlp_hash.dlp_hash import DLPHash, DLPHashGroup


def test_hash_deterministic():
    H = DLPHash()
    m = b"hello world"
    assert H.hash(m) == H.hash(m)

def test_hash_different_inputs():
    H = DLPHash()
    h1 = H.hash(b"message one")
    h2 = H.hash(b"message two")
    assert h1 != h2

def test_hash_returns_bytes():
    H = DLPHash()
    digest = H.hash(b"test")
    assert isinstance(digest, bytes)
    assert len(digest) > 0

def test_hash_empty_message():
    H = DLPHash()
    digest = H.hash(b"")
    assert isinstance(digest, bytes)

def test_hash_multiblock():
    H = DLPHash()
    short = H.hash(b"short")
    long_ = H.hash(b"x" * 100)
    assert short != long_

def test_compress_fn():
    group = DLPHashGroup(bits=16)
    state = (group.p % (2**128)).to_bytes(16, 'big')
    block = b'\xab' * 16
    out = group.compress_fn(state, block)
    assert len(out) == 16
    assert group.compress_fn(state, block) == out  # deterministic

def test_group_params():
    group = DLPHashGroup(bits=16)
    params = group.params()
    assert "p" in params and "q" in params and "g" in params
    # Verify safe prime: p = 2q+1
    assert params["p"] == 2 * params["q"] + 1

def test_hash_int():
    H = DLPHash()
    v = H.hash_int(b"test")
    assert isinstance(v, int)
    assert v >= 0

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
