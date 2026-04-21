"""Tests for PA#9: Birthday Attack."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa09_birthday_attack.birthday_attack import birthday_attack_naive, birthday_attack_floyd


def _toy_hash(b: bytes, n_bits: int = 12) -> int:
    """FNV-1a hash truncated to n_bits — good mixing, no trivial fixed points."""
    h = 0x811c9dc5
    for byte in b:
        h = ((h ^ byte) * 0x01000193) & 0xFFFFFFFF
    return h & ((1 << n_bits) - 1)


def test_birthday_naive_finds_collision():
    result = birthday_attack_naive(lambda b: _toy_hash(b, 12), 12)
    assert result["found"] == True
    assert "x1" in result and "x2" in result
    assert result["x1"] != result["x2"]

def test_birthday_collision_is_genuine():
    result = birthday_attack_naive(lambda b: _toy_hash(b, 12), 12)
    assert result["found"] == True
    x1 = bytes.fromhex(result["x1"])
    x2 = bytes.fromhex(result["x2"])
    assert x1 != x2
    h1 = _toy_hash(x1, 12)
    h2 = _toy_hash(x2, 12)
    assert h1 == h2

def test_birthday_evaluations_near_expected():
    """Expected evaluations ≈ 2^(n/2) = 64 for n=12."""
    result = birthday_attack_naive(lambda b: _toy_hash(b, 12), 12)
    assert result["found"] == True
    # Generous bounds: should find collision in fewer than 1000 attempts
    assert result["evaluations"] < 1000

def test_birthday_larger_space_needs_more():
    """Larger n means more evaluations."""
    r12 = birthday_attack_naive(lambda b: _toy_hash(b, 12), 12)
    r16 = birthday_attack_naive(lambda b: _toy_hash(b, 16), 16)
    assert r12.get("evaluations", 9999) < r16.get("evaluations", 0)

def test_birthday_floyd():
    # n=12: FNV maps 4096 inputs to 3072 distinct values — plenty of collisions
    result = birthday_attack_floyd(lambda b: _toy_hash(b, 12), 12)
    assert result["found"] == True

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
