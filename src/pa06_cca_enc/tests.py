"""Tests for PA#6: CCA Encryption."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa06_cca_enc.cca_enc import CCAEnc


def test_cca_roundtrip():
    cca = CCAEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"Secret message!!"
    ct, t = cca.cca_enc(kE, kM, m)
    pt = cca.cca_dec(kE, kM, ct, t)
    assert pt == m

def test_cca_rejects_tampered_ct():
    cca = CCAEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"Integrity test!!"
    ct, t = cca.cca_enc(kE, kM, m)
    tampered = bytes([ct[0] ^ 0x01]) + ct[1:]
    result = cca.cca_dec(kE, kM, tampered, t)
    assert result is None

def test_cca_rejects_tampered_tag():
    cca = CCAEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"Tag integrity!!!"
    ct, t = cca.cca_enc(kE, kM, m)
    bad_t = bytes([t[0] ^ 0x01]) + t[1:]
    result = cca.cca_dec(kE, kM, ct, bad_t)
    assert result is None

def test_cca_wrong_keys():
    cca = CCAEnc()
    kE = os.urandom(16)
    kM = os.urandom(16)
    m = b"Key test message"
    ct, t = cca.cca_enc(kE, kM, m)
    result = cca.cca_dec(os.urandom(16), kM, ct, t)
    assert result is None

def test_malleability_demo():
    cca = CCAEnc()
    kE = os.urandom(16)
    m = b"Malleability test"
    result = cca.malleability_demo(kE, m)
    assert result["cca_tampered_accepted"] == False

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
