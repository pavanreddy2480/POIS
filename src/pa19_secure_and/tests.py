"""Tests for PA#19: Secure AND/XOR/NOT Gates."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa19_secure_and.secure_and import SecureGates


def test_and_truth_table():
    gates = SecureGates(bits=32)
    assert gates.AND(0, 0) == 0
    assert gates.AND(0, 1) == 0
    assert gates.AND(1, 0) == 0
    assert gates.AND(1, 1) == 1

def test_xor_truth_table():
    gates = SecureGates(bits=32)
    assert gates.XOR(0, 0) == 0
    assert gates.XOR(0, 1) == 1
    assert gates.XOR(1, 0) == 1
    assert gates.XOR(1, 1) == 0

def test_not_truth_table():
    gates = SecureGates(bits=32)
    assert gates.NOT(0) == 1
    assert gates.NOT(1) == 0

def test_and_multiple_runs():
    gates = SecureGates(bits=32)
    for _ in range(5):
        assert gates.AND(1, 1) == 1
        assert gates.AND(1, 0) == 0

def test_xor_is_free():
    """XOR should not use OT (transcript should differ from AND)."""
    gates = SecureGates(bits=32)
    gates.clear_transcript()
    gates.XOR(1, 0)
    t = gates.get_transcript()
    assert t[-1]["gate"] == "XOR"

def test_transcript_recorded():
    gates = SecureGates(bits=32)
    gates.clear_transcript()
    gates.AND(1, 1)
    t = gates.get_transcript()
    assert len(t) == 1
    assert t[0]["gate"] == "AND"
    assert t[0]["result"] == 1

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
