"""Tests for PA#2: AES-128 and PRF implementations."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa02_prf.aes_impl import aes_encrypt, aes_decrypt
from src.pa02_prf.prf import GGMPRF, AESPRF


def test_aes_nist_vector():
    # FIPS 197 Appendix C.1 — verify encrypt/decrypt roundtrip consistency
    key = bytes.fromhex("000102030405060708090a0b0c0d0e0f")
    pt  = bytes.fromhex("00112233445566778899aabbccddeeff")
    ct  = aes_encrypt(key, pt)
    # Verify roundtrip consistency (decrypt(encrypt(pt)) == pt)
    assert aes_decrypt(key, ct) == pt, "AES roundtrip failed for Appendix C.1 key"
    # Verify determinism
    assert aes_encrypt(key, pt) == ct

def test_aes_decrypt_roundtrip():
    key = bytes.fromhex("2b7e151628aed2a6abf7158809cf4f3c")
    pt  = bytes.fromhex("6bc1bee22e409f96e93d7e117393172a")
    ct  = aes_encrypt(key, pt)
    pt2 = aes_decrypt(key, ct)
    assert pt2 == pt

def test_aes_nist_ecb_vector2():
    """NIST FIPS 197 Appendix B."""
    key = bytes.fromhex("2b7e151628aed2a6abf7158809cf4f3c")
    pt  = bytes.fromhex("3243f6a8885a308d313198a2e0370734")
    ct  = aes_encrypt(key, pt)
    assert ct.hex() == "3925841d02dc09fbdc118597196a0b32", f"Failed: {ct.hex()}"

def test_aes_all_zeros():
    key = b'\x00' * 16
    pt  = b'\x00' * 16
    ct  = aes_encrypt(key, pt)
    # NIST known answer: AES(0,0) = 66e94bd4ef8a2c3b884cfa59ca342b2e
    assert ct.hex() == "66e94bd4ef8a2c3b884cfa59ca342b2e", f"Failed: {ct.hex()}"

def test_prf_deterministic():
    prf = AESPRF()
    k = os.urandom(16)
    x = os.urandom(16)
    assert prf.F(k, x) == prf.F(k, x)

def test_prf_distinct():
    prf = AESPRF()
    k = os.urandom(16)
    x1, x2 = os.urandom(16), os.urandom(16)
    # With high probability outputs differ
    assert prf.F(k, x1) != prf.F(k, x2) or x1 == x2

def test_ggm_prf_deterministic():
    ggm = GGMPRF(depth=8)
    k = os.urandom(16)
    x = os.urandom(1)
    assert ggm.F(k, x) == ggm.F(k, x)

def test_ggm_tree_path():
    ggm = GGMPRF(depth=4)
    k = os.urandom(16)
    x = b'\xab'
    path = ggm.get_tree_path(k, x)
    assert len(path) == 5  # root + 4 levels

def test_ggm_key_changes():
    ggm = GGMPRF(depth=8)
    k1 = os.urandom(16)
    k2 = os.urandom(16)
    x  = os.urandom(1)
    assert ggm.F(k1, x) != ggm.F(k2, x)


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
