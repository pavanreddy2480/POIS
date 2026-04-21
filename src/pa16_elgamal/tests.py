"""Tests for PA#16: ElGamal Encryption."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa16_elgamal.elgamal import ElGamal


def test_enc_dec_roundtrip():
    eg = ElGamal(bits=32)
    keys = eg.keygen()
    pk, sk = keys["pk"], keys["sk"]
    m = 42
    c1, c2 = eg.enc(pk, m)
    assert eg.dec(sk, pk, c1, c2) == m

def test_fresh_randomness():
    eg = ElGamal(bits=32)
    keys = eg.keygen()
    pk = keys["pk"]
    m = 100
    c1a, c2a = eg.enc(pk, m)
    c1b, c2b = eg.enc(pk, m)
    # Different ephemeral keys → different ciphertexts (with overwhelming prob)
    assert (c1a, c2a) != (c1b, c2b)

def test_malleability():
    eg = ElGamal(bits=32)
    keys = eg.keygen()
    pk, sk = keys["pk"], keys["sk"]
    m = 7
    c1, c2 = eg.enc(pk, m)
    # Multiply c2 by lambda=3 → decrypts to 3m
    lam = 3
    c2_new = (lam * c2) % pk["p"]
    result = eg.dec(sk, pk, c1, c2_new)
    assert result == (lam * m) % pk["p"]

def test_malleability_demo():
    eg = ElGamal(bits=32)
    keys = eg.keygen()
    pk, sk = keys["pk"], keys["sk"]
    m = 10
    c1, c2 = eg.enc(pk, m)
    demo = eg.malleability_demo(pk, c1, c2)
    assert "modified_c2" in demo

def test_keygen_structure():
    eg = ElGamal(bits=32)
    keys = eg.keygen()
    assert "pk" in keys and "sk" in keys
    pk = keys["pk"]
    for field in ["p", "g", "q", "h"]:
        assert field in pk

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
