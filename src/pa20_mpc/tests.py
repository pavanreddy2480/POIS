"""Tests for PA#20: Secure Multi-Party Computation."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa20_mpc.mpc import millionaires_problem, secure_equality


def test_millionaires_alice_richer():
    result = millionaires_problem(10, 5, n_bits=4)
    assert result["x_gt_y"] == True
    assert result["result"] == "Alice is richer"

def test_millionaires_bob_richer():
    result = millionaires_problem(3, 12, n_bits=4)
    assert result["x_gt_y"] == False
    assert result["result"] == "Bob is richer"

def test_millionaires_equal():
    result = millionaires_problem(7, 7, n_bits=4)
    assert result["x_gt_y"] == False
    assert result["result"] == "Equal"

def test_millionaires_boundary():
    result = millionaires_problem(15, 0, n_bits=4)
    assert result["x_gt_y"] == True

def test_secure_equality_equal():
    result = secure_equality(5, 5, n_bits=4)
    assert result["equal"] == True
    assert result["correct"] == True

def test_secure_equality_not_equal():
    result = secure_equality(3, 7, n_bits=4)
    assert result["equal"] == False
    assert result["correct"] == True

def test_millionaires_has_ot_calls():
    result = millionaires_problem(5, 3, n_bits=4)
    assert result["ot_calls"] > 0

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
