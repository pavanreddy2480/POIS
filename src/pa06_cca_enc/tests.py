"""Tests for PA#6: CCA Encryption."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa06_cca_enc.cca_enc import CCAEnc


def test_cca_roundtrip():
    cca = CCAEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"Secret message!!"
    r, c, t = cca.cca_enc(kE, kM, m)
    pt = cca.cca_dec(kE, kM, r, c, t)
    assert pt == m

def test_cca_rejects_tampered_nonce():
    cca = CCAEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"Integrity test!!"
    r, c, t = cca.cca_enc(kE, kM, m)
    tampered_r = bytes([r[0] ^ 0x01]) + r[1:]
    result = cca.cca_dec(kE, kM, tampered_r, c, t)
    assert result is None

def test_cca_rejects_tampered_ct():
    cca = CCAEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"Ciphertext test!"
    r, c, t = cca.cca_enc(kE, kM, m)
    tampered_c = bytes([c[0] ^ 0x01]) + c[1:] if c else b'\x00'
    result = cca.cca_dec(kE, kM, r, tampered_c, t)
    assert result is None

def test_cca_rejects_tampered_tag():
    cca = CCAEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"Tag integrity!!!"
    r, c, t = cca.cca_enc(kE, kM, m)
    bad_t = bytes([t[0] ^ 0x01]) + t[1:]
    result = cca.cca_dec(kE, kM, r, c, bad_t)
    assert result is None

def test_cca_wrong_mac_key():
    cca = CCAEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"Key test message"
    r, c, t = cca.cca_enc(kE, kM, m)
    result = cca.cca_dec(kE, os.urandom(16), r, c, t)
    assert result is None

def test_malleability_demo():
    cca = CCAEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"Malleability test"
    result = cca.malleability_demo(kE, kM, m)
    assert result["cca_tampered_accepted"] == False

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
