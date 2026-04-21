"""
PA#20 — All 2-Party Secure Computation (Yao/GMW approach).
Uses PA#19 Secure AND gate (via PA#18 OT via PA#16 ElGamal).
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa19_secure_and.secure_and import SecureGates
from src.pa18_ot.ot import OT_1of2
from src.pa20_mpc.circuit import Circuit, build_comparison_circuit, build_equality_circuit


class SecureEval:
    """
    Secure 2-party circuit evaluation using PA#19 gates.
    Alice has x (first half of inputs), Bob has y (second half).
    """

    def __init__(self, gates: SecureGates = None):
        self.gates = gates or SecureGates()
        self.ot_calls = 0

    def evaluate(self, circuit: Circuit, x_Alice: list, y_Bob: list) -> list:
        """
        Evaluate circuit securely:
        - Traverse gates in topological order (already sorted in Circuit)
        - For each AND gate: use PA#19 SecureGates.AND (calls OT)
        - For each XOR gate: use PA#19 SecureGates.XOR (free)
        - For each NOT gate: use PA#19 SecureGates.NOT (free)
        """
        assert len(x_Alice) + len(y_Bob) == circuit.n_inputs

        inputs = x_Alice + y_Bob
        wires = list(inputs) + [0] * (circuit.n_wires - circuit.n_inputs)

        for gate in circuit.gates:
            if gate.gate_type == 'AND':
                a = wires[gate.inputs[0]]
                b = wires[gate.inputs[1]]
                wires[gate.output] = self.gates.AND(a, b)
                self.ot_calls += 1
            elif gate.gate_type == 'XOR':
                a = wires[gate.inputs[0]]
                b = wires[gate.inputs[1]]
                wires[gate.output] = self.gates.XOR(a, b)
            elif gate.gate_type == 'NOT':
                a = wires[gate.inputs[0]]
                wires[gate.output] = self.gates.NOT(a)

        return wires[-circuit.n_outputs:]


def int_to_bits(n: int, nbits: int, msb_first: bool = True) -> list:
    """Convert integer to list of bits."""
    bits = [(n >> i) & 1 for i in range(nbits)]
    if msb_first:
        bits = bits[::-1]
    return bits


def millionaires_problem(x: int, y: int, n_bits: int = 4) -> dict:
    """
    Millionaire's problem: Alice has x, Bob has y.
    Securely compute x > y without revealing x or y.
    """
    gates = SecureGates()
    evaluator = SecureEval(gates)
    circuit = build_comparison_circuit(n_bits)

    # Convert to bits (MSB first for comparison)
    x_bits = int_to_bits(x % (2**n_bits), n_bits, msb_first=True)
    y_bits = int_to_bits(y % (2**n_bits), n_bits, msb_first=True)

    # Evaluate
    result = evaluator.evaluate(circuit, x_bits, y_bits)
    x_gt_y = result[-1] if result else 0

    return {
        "x": x,
        "y": y,
        "n_bits": n_bits,
        "result": "Alice is richer" if x_gt_y else ("Equal" if x == y else "Bob is richer"),
        "x_gt_y": bool(x_gt_y),
        "ot_calls": evaluator.ot_calls,
    }


def secure_equality(x: int, y: int, n_bits: int = 4) -> dict:
    """Securely compute x == y."""
    gates = SecureGates()
    evaluator = SecureEval(gates)
    circuit = build_equality_circuit(n_bits)

    x_bits = int_to_bits(x % (2**n_bits), n_bits, msb_first=True)
    y_bits = int_to_bits(y % (2**n_bits), n_bits, msb_first=True)

    result = evaluator.evaluate(circuit, x_bits, y_bits)
    equal = result[-1] if result else 0

    return {
        "x": x, "y": y,
        "equal": bool(equal),
        "correct": bool(equal) == (x == y),
        "ot_calls": evaluator.ot_calls,
    }


if __name__ == "__main__":
    print("Millionaire's problem (x=7, y=12, n=4-bit):")
    r = millionaires_problem(7, 12, n_bits=4)
    print(f"  Result: {r['result']} (correct: Bob is richer)")
    print(f"  OT calls: {r['ot_calls']}")

    print("\nSecure equality (x=5, y=5):")
    r2 = secure_equality(5, 5, n_bits=4)
    print(f"  Equal: {r2['equal']} (correct: {r2['correct']})")
