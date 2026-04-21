"""Tests for PA#14: CRT and Hastad's Attack."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa14_crt.crt import crt, hastad_attack, integer_nth_root
from src.pa13_miller_rabin.miller_rabin import mod_pow


def test_crt_textbook():
    assert crt([2, 3, 2], [3, 5, 7]) == 23

def test_crt_single():
    assert crt([5], [7]) == 5

def test_crt_two_moduli():
    x = crt([1, 2], [3, 5])
    assert x % 3 == 1
    assert x % 5 == 2

def test_integer_cube_root():
    assert integer_nth_root(27, 3) == 3
    assert integer_nth_root(64, 3) == 4
    assert integer_nth_root(125, 3) == 5

def test_hastad_attack():
    from src.pa12_rsa.rsa import RSA
    rsa = RSA()
    e = 3
    m = 42
    keys = [rsa.keygen(128) for _ in range(3)]
    moduli = [k["pk"][0] for k in keys]
    ciphertexts = [mod_pow(m, e, N) for N in moduli]
    recovered = hastad_attack(ciphertexts, moduli, e=3)
    assert recovered == m

def test_hastad_larger_message():
    from src.pa12_rsa.rsa import RSA
    rsa = RSA()
    e = 3
    m = 1234
    keys = [rsa.keygen(128) for _ in range(3)]
    moduli = [k["pk"][0] for k in keys]
    ciphertexts = [mod_pow(m, e, N) for N in moduli]
    recovered = hastad_attack(ciphertexts, moduli, e=3)
    assert recovered == m

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
