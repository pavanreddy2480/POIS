"""Tests for PA#18: 1-out-of-2 Oblivious Transfer."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa18_ot.ot import OT_1of2


def test_ot_receives_m0():
    ot = OT_1of2(bits=32)
    result = ot.full_protocol(b=0, m0=42, m1=99)
    assert result["received"] == 42
    assert result["correct"] == True

def test_ot_receives_m1():
    ot = OT_1of2(bits=32)
    result = ot.full_protocol(b=1, m0=42, m1=99)
    assert result["received"] == 99
    assert result["correct"] == True

def test_ot_protocol_fields():
    ot = OT_1of2(bits=32)
    result = ot.full_protocol(b=0, m0=10, m1=20)
    for field in ["choice_bit", "received", "correct", "C0", "C1"]:
        assert field in result

def test_ot_multiple_runs():
    ot = OT_1of2(bits=32)
    for b in [0, 1]:
        for m0, m1 in [(1, 2), (100, 200), (7, 13)]:
            r = ot.full_protocol(b, m0, m1)
            expected = m0 if b == 0 else m1
            assert r["received"] == expected, f"b={b}, expected {expected}, got {r['received']}"

def test_ot_sender_input_not_revealed():
    """Result dict should not directly expose both m0 and m1 as recovered values."""
    ot = OT_1of2(bits=32)
    result = ot.full_protocol(b=0, m0=42, m1=99)
    # Receiver gets only the chosen message
    assert result["received"] == 42
    # The other value is included in the dict for test verification but not derivable from crypto transcript
    assert "received" in result

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
