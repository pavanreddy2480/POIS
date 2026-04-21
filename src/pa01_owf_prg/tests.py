"""Tests for PA#1: OWF and PRG."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa01_owf_prg.owf import DLPOWF, AESOWF
from src.pa01_owf_prg.prg import PRG


def test_dlp_owf_evaluate():
    owf = DLPOWF(bits=16)
    x = 42
    y = owf.evaluate(x)
    assert y == pow(owf.g, x % owf.q, owf.p)

def test_dlp_owf_deterministic():
    owf = DLPOWF(bits=16)
    assert owf.evaluate(100) == owf.evaluate(100)

def test_dlp_owf_different_inputs():
    owf = DLPOWF(bits=16)
    # Different inputs should (usually) give different outputs
    results = {owf.evaluate(i) for i in range(20)}
    assert len(results) > 10

def test_aes_owf_evaluate():
    owf = AESOWF()
    k = b'\x01' * 16
    y = owf.evaluate(k)
    assert len(y) == 16
    assert y != k  # Should be different

def test_aes_owf_deterministic():
    owf = AESOWF()
    k = os.urandom(16)
    assert owf.evaluate(k) == owf.evaluate(k)

def test_prg_length():
    prg = PRG(mode='aes')
    out = prg.generate(b'\x00'*16, 100)
    assert len(out) == 100

def test_prg_different_seeds():
    prg = PRG(mode='aes')
    s1, s2 = b'\x00'*16, b'\x01'*16
    assert prg.generate(s1, 32) != prg.generate(s2, 32)

def test_prg_deterministic():
    prg = PRG(mode='aes')
    s = b'\xde\xad\xbe\xef' * 4
    assert prg.generate(s, 64) == prg.generate(s, 64)

def test_prg_dlp_mode():
    owf = DLPOWF(bits=16)
    prg = PRG(owf=owf, mode='dlp')
    out = prg.generate(b'\x01\x02', 4)
    assert len(out) == 4

def test_prg_length_doubling():
    prg = PRG(mode='aes')
    s = os.urandom(16)
    g0, g1 = prg.length_doubling(s)
    assert len(g0) == 16 and len(g1) == 16
    assert g0 != g1

def test_dlp_verify_hardness():
    owf = DLPOWF(bits=16)
    result = owf.verify_hardness()
    assert "DLP" in result["hardness"]
    assert "p" in result and "q" in result

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
