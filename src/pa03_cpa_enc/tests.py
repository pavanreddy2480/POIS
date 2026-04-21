"""Tests for PA#3: CPA Encryption."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa03_cpa_enc.cpa_enc import CPAEnc


def test_enc_dec_roundtrip():
    enc = CPAEnc()
    k = os.urandom(16)
    m = b"Hello, World!!!!"
    r, c = enc.enc(k, m)
    m2 = enc.dec(k, r, c)
    assert m2 == m

def test_enc_multiblock():
    enc = CPAEnc()
    k = os.urandom(16)
    m = os.urandom(48)  # 3 blocks
    r, c = enc.enc(k, m)
    assert len(c) == 48
    m2 = enc.dec(k, r, c)
    assert m2 == m

def test_enc_randomized():
    enc = CPAEnc()
    k = os.urandom(16)
    m = b'\x42' * 16
    r1, c1 = enc.enc(k, m)
    r2, c2 = enc.enc(k, m)
    # Randomized: different nonces → different ciphertexts
    assert r1 != r2 or c1 != c2

def test_enc_broken_deterministic():
    enc = CPAEnc()
    k = os.urandom(16)
    m = b'\x99' * 16
    r1, c1 = enc.enc_broken(k, m)
    r2, c2 = enc.enc_broken(k, m)
    assert c1 == c2  # broken: same output

def test_cpa_game():
    enc = CPAEnc()
    k = os.urandom(16)
    result = enc.run_cpa_game(k, num_rounds=100)
    assert result["rounds"] == 100
    assert result["secure"] == True

def test_empty_message():
    enc = CPAEnc()
    k = os.urandom(16)
    m = b""
    r, c = enc.enc(k, m)
    assert enc.dec(k, r, c) == m

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
