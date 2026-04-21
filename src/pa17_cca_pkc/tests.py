"""Tests for PA#17: CCA-Secure PKC."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa17_cca_pkc.cca_pkc import CCA_PKC
from src.pa16_elgamal.elgamal import ElGamal
from src.pa15_signatures.signatures import RSASignature
from src.pa12_rsa.rsa import RSA


def setup():
    eg = ElGamal(bits=32)
    rsa = RSA()
    sig = RSASignature(rsa)
    eg_keys = eg.keygen()
    rsa_keys = rsa.keygen(128)
    cca = CCA_PKC(eg, sig)
    return cca, eg_keys, rsa_keys


def test_enc_dec_roundtrip():
    cca, eg_keys, rsa_keys = setup()
    m = 100
    payload = cca.enc(eg_keys["pk"], rsa_keys["sk"], rsa_keys["pk"], m)
    result = cca.dec(eg_keys["sk"], eg_keys["pk"], rsa_keys["pk"], payload)
    assert result == m

def test_tampered_c2_rejected():
    cca, eg_keys, rsa_keys = setup()
    m = 50
    payload = cca.enc(eg_keys["pk"], rsa_keys["sk"], rsa_keys["pk"], m)
    tampered = dict(payload)
    tampered["c2"] = (payload["c2"] + 1) % eg_keys["pk"]["p"]
    tampered["ce_bytes"] = (hex(tampered["c1"]) + "|" + hex(tampered["c2"])).encode()
    result = cca.dec(eg_keys["sk"], eg_keys["pk"], rsa_keys["pk"], tampered)
    assert result is None

def test_malleability_blocked():
    cca, eg_keys, rsa_keys = setup()
    m = 42
    demo = cca.malleability_blocked_demo(
        eg_keys["pk"], eg_keys["sk"],
        rsa_keys["pk"], rsa_keys["sk"], m
    )
    assert demo["cca_blocked"] == True

def test_wrong_verification_key_rejected():
    cca, eg_keys, rsa_keys = setup()
    rsa2 = RSA()
    keys2 = rsa2.keygen(128)
    m = 77
    payload = cca.enc(eg_keys["pk"], rsa_keys["sk"], rsa_keys["pk"], m)
    result = cca.dec(eg_keys["sk"], eg_keys["pk"], keys2["pk"], payload)
    assert result is None

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
