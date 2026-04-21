"""Tests for PA#13: Miller-Rabin Primality Testing."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa13_miller_rabin.miller_rabin import miller_rabin, is_prime, gen_prime, gen_safe_prime, carmichael_demo

SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47,
                53, 59, 61, 67, 71, 73, 79, 83, 89, 97]


def test_small_primes_pass():
    for p in SMALL_PRIMES:
        assert is_prime(p, k=20), f"{p} should be prime"

def test_composites_fail():
    composites = [4, 6, 8, 9, 10, 15, 25, 49, 100, 561]
    for n in composites:
        assert not is_prime(n, k=20), f"{n} should be composite"

def test_carmichael_561():
    result = carmichael_demo()
    assert result["fermat_passes"] == True
    assert result["miller_rabin"] == "COMPOSITE"
    assert result["is_carmichael"] == True

def test_gen_prime_is_prime():
    p = gen_prime(64)
    assert is_prime(p, k=40)
    assert p.bit_length() >= 63

def test_gen_safe_prime():
    p, q = gen_safe_prime(32)
    assert is_prime(p, k=20)
    assert is_prime(q, k=20)
    assert p == 2 * q + 1

def test_miller_rabin_result_string():
    assert miller_rabin(7, 20) == "PROBABLY_PRIME"
    assert miller_rabin(9, 20) == "COMPOSITE"

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
