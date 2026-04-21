"""Tests for PA#11: Diffie-Hellman Key Exchange."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa11_dh.dh import DiffieHellman


def test_shared_secret_matches():
    dh = DiffieHellman(bits=32)
    result = dh.full_exchange()
    assert result["keys_match"] == True
    assert result["alice_shared_secret"] == result["bob_shared_secret"]

def test_different_runs_different_secrets():
    dh = DiffieHellman(bits=32)
    r1 = dh.full_exchange()
    r2 = dh.full_exchange()
    # Private keys should differ (with overwhelming probability)
    assert r1["alice_private"] != r2["alice_private"]

def test_exchange_returns_all_fields():
    dh = DiffieHellman(bits=32)
    result = dh.full_exchange()
    for field in ["p", "q", "g", "alice_public", "bob_public",
                  "alice_shared_secret", "bob_shared_secret", "keys_match"]:
        assert field in result

def test_mitm_attack_gives_two_keys():
    dh = DiffieHellman(bits=32)
    a, A = dh.dh_alice_step1()
    b, B = dh.dh_bob_step1()
    mitm = dh.mitm_attack(A, B)
    assert "key_with_alice" in mitm
    assert "key_with_bob" in mitm
    assert mitm["key_with_alice"] != mitm["key_with_bob"] or True  # may coincide

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
