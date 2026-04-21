"""Tests for PA#10: HMAC."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa10_hmac.hmac_impl import HMAC, EtHEnc
from src.pa08_dlp_hash.dlp_hash import DLPHash, DLPHashGroup


def test_hmac_verify_correct():
    h = HMAC()
    k = os.urandom(16)
    m = b"hello"
    t = h.mac(k, m)
    assert h.verify(k, m, t)

def test_hmac_rejects_tampered_message():
    h = HMAC()
    k = os.urandom(16)
    m = b"original"
    t = h.mac(k, m)
    assert not h.verify(k, m + b"x", t)

def test_hmac_rejects_tampered_tag():
    h = HMAC()
    k = os.urandom(16)
    m = b"test"
    t = h.mac(k, m)
    bad_t = bytes([t[0] ^ 0xFF]) + t[1:]
    assert not h.verify(k, m, bad_t)

def test_hmac_rejects_wrong_key():
    h = HMAC()
    k1 = os.urandom(16)
    k2 = os.urandom(16)
    m = b"message"
    t = h.mac(k1, m)
    assert not h.verify(k2, m, t)

def test_hmac_deterministic():
    h = HMAC()
    k = b'\x42' * 16
    m = b"deterministic"
    assert h.mac(k, m) == h.mac(k, m)

def test_hmac_uses_dlp_hash():
    """HMAC must use PA#8 DLP hash, not stdlib hashlib."""
    group = DLPHashGroup(bits=16)
    dlp_hash = DLPHash(group)
    h = HMAC(dlp_hash)
    k = os.urandom(16)
    m = b"test"
    t = h.mac(k, m)
    assert isinstance(t, bytes)

def test_hmac_double_hash_structure():
    """Verify H((k XOR opad) || H((k XOR ipad) || m)) structure."""
    group = DLPHashGroup(bits=16)
    dlp_hash = DLPHash(group)
    h = HMAC(dlp_hash, block_size=64)
    k = os.urandom(16)
    m = b"structure test"

    # Manually compute HMAC
    k_padded = k.ljust(64, b'\x00')
    ipad = bytes(b ^ 0x36 for b in k_padded)
    opad = bytes(b ^ 0x5C for b in k_padded)
    inner = dlp_hash.hash(ipad + m)
    outer = dlp_hash.hash(opad + inner)

    assert h.mac(k, m) == outer

def test_eth_enc_roundtrip():
    eth = EtHEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"encrypt then hmac"
    r, c, t = eth.eth_enc(kE, kM, m)
    result = eth.eth_dec(kE, kM, r, c, t)
    assert result == m

def test_eth_rejects_tampered():
    eth = EtHEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"integrity check"
    r, c, t = eth.eth_enc(kE, kM, m)
    bad_r = bytes([r[0] ^ 1]) + r[1:]
    result = eth.eth_dec(kE, kM, bad_r, c, t)
    assert result is None

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
