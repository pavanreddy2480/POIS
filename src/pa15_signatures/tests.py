"""Tests for PA#15: Digital Signatures."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa15_signatures.signatures import RSASignature
from src.pa12_rsa.rsa import RSA


def setup():
    rsa = RSA()
    keys = rsa.keygen(512)
    sig = RSASignature(rsa)
    return sig, keys


def test_sign_verify():
    sig, keys = setup()
    m = b"Vote: Yes"
    sigma = sig.sign(keys["sk"], m)
    assert sig.verify(keys["pk"], m, sigma)

def test_tampered_message_fails():
    sig, keys = setup()
    m = b"Vote: Yes"
    sigma = sig.sign(keys["sk"], m)
    assert not sig.verify(keys["pk"], b"Vote: No", sigma)

def test_tampered_signature_fails():
    sig, keys = setup()
    m = b"Hello"
    sigma = sig.sign(keys["sk"], m)
    bad_sigma = (sigma + 1) % keys["pk"][0]
    assert not sig.verify(keys["pk"], m, bad_sigma)

def test_multiplicative_forgery():
    from src.pa13_miller_rabin.miller_rabin import mod_pow
    rsa = RSA()
    keys = rsa.keygen(512)
    sig = RSASignature(rsa)
    N, e = keys["pk"]
    # Use raw RSA (no hash) for the forgery — sign m1 and m2 directly
    m1_int = 42
    m2_int = 13
    s1 = mod_pow(m1_int, keys["sk"]["d"], N)  # raw sign
    s2 = mod_pow(m2_int, keys["sk"]["d"], N)
    # Forged sig for m1*m2: s1*s2 mod N
    forged = (s1 * s2) % N
    # Verify: forged^e mod N should equal m1*m2 mod N
    m12 = (m1_int * m2_int) % N
    recovered = mod_pow(forged, e, N)
    assert recovered == m12, f"Multiplicative forgery failed: {recovered} != {m12}"
    # Verify the demo function itself works correctly
    result = sig.multiplicative_forgery_demo(
        keys["pk"],
        m1_int.to_bytes(4, 'big'), s1,
        m2_int.to_bytes(4, 'big'), s2,
    )
    assert result["forgery_valid"] == True

def test_different_messages_different_sigs():
    sig, keys = setup()
    s1 = sig.sign(keys["sk"], b"msg1")
    s2 = sig.sign(keys["sk"], b"msg2")
    assert s1 != s2

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
