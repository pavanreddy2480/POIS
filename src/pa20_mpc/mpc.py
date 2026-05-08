"""
PA#20 — All 2-Party Secure Computation (Yao/GMW approach).
Uses PA#19 Secure AND gate (via PA#18 OT via PA#16 ElGamal).

Lineage: PA#20 → PA#19 AND → PA#18 OT → PA#16 ElGamal → PA#13 Miller-Rabin
"""
import os
import sys
import time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa19_secure_and.secure_and import SecureGates
from src.pa18_ot.ot import OT_1of2
from src.pa20_mpc.circuit import (
    Circuit, build_comparison_circuit,
    build_equality_circuit, build_addition_circuit,
)


class SecureEval:
    """
    Secure 2-party circuit evaluation using PA#19 gates.
    Alice has x (first half of inputs), Bob has y (second half).
    Each AND gate triggers one PA#18 OT call, which uses PA#16 ElGamal PKC.
    XOR and NOT are free (no OT).
    """

    def __init__(self, gates: SecureGates = None):
        self.gates = gates or SecureGates()
        self.ot_calls = 0

    def evaluate(self, circuit: Circuit, x_Alice: list, y_Bob: list) -> list:
        """
        Evaluate circuit securely in topological order.
        For each AND gate: call PA#19 Secure AND (triggers OT).
        For each XOR/NOT: call free PA#19 gate.
        """
        assert len(x_Alice) + len(y_Bob) == circuit.n_inputs
        inputs = x_Alice + y_Bob
        wires = list(inputs) + [0] * (circuit.n_wires - circuit.n_inputs)

        for gate in circuit.gates:
            if gate.gate_type == 'AND':
                a, b = wires[gate.inputs[0]], wires[gate.inputs[1]]
                wires[gate.output] = self.gates.AND(a, b)
                self.ot_calls += 1
            elif gate.gate_type == 'XOR':
                wires[gate.output] = self.gates.XOR(wires[gate.inputs[0]], wires[gate.inputs[1]])
            elif gate.gate_type == 'NOT':
                wires[gate.output] = self.gates.NOT(wires[gate.inputs[0]])

        return wires[-circuit.n_outputs:]

    def evaluate_verbose(self, circuit: Circuit, x_Alice: list, y_Bob: list):
        """
        Like evaluate() but returns a gate-by-gate trace for demo visualization.
        Each trace entry includes input wire INDICES (not their values, which are private)
        and the computed output wire value.
        Privacy: input wire values (wires 0..n_inputs-1) are never included in the trace.
        Only output wire values (intermediate and final results) are shown.
        Returns: (result_bits, gate_trace)
        """
        assert len(x_Alice) + len(y_Bob) == circuit.n_inputs
        n_alice = len(x_Alice)
        n_inputs = circuit.n_inputs
        inputs = x_Alice + y_Bob
        wires = list(inputs) + [0] * (circuit.n_wires - circuit.n_inputs)
        trace = []
        and_index = 0

        def wire_label(w):
            # Label wire origin for trace display; values of input wires are hidden
            if w < n_alice:
                return f"w{w}(Alice x[{w}])"
            elif w < n_inputs:
                return f"w{w}(Bob y[{w - n_alice}])"
            return f"w{w}"

        for gate in circuit.gates:
            in_labels = [wire_label(w) for w in gate.inputs]
            if gate.gate_type == 'AND':
                a, b = wires[gate.inputs[0]], wires[gate.inputs[1]]
                out = self.gates.AND(a, b)
                self.ot_calls += 1
                and_index += 1
                trace.append({
                    "gate_type": "AND",
                    "input_wires": list(gate.inputs),
                    "input_labels": in_labels,
                    "output_wire": gate.output,
                    "output_val": out,
                    "uses_ot": True,
                    "ot_call_index": and_index,
                })
            elif gate.gate_type == 'XOR':
                out = self.gates.XOR(wires[gate.inputs[0]], wires[gate.inputs[1]])
                trace.append({
                    "gate_type": "XOR",
                    "input_wires": list(gate.inputs),
                    "input_labels": in_labels,
                    "output_wire": gate.output,
                    "output_val": out,
                    "uses_ot": False,
                })
            elif gate.gate_type == 'NOT':
                out = self.gates.NOT(wires[gate.inputs[0]])
                trace.append({
                    "gate_type": "NOT",
                    "input_wires": list(gate.inputs),
                    "input_labels": in_labels,
                    "output_wire": gate.output,
                    "output_val": out,
                    "uses_ot": False,
                })
            else:
                continue
            wires[gate.output] = out

        return wires[-circuit.n_outputs:], trace


def int_to_bits(n: int, nbits: int, msb_first: bool = True) -> list:
    bits = [(n >> i) & 1 for i in range(nbits)]
    if msb_first:
        bits = bits[::-1]
    return bits


def bits_to_int(bits: list, msb_first: bool = True) -> int:
    if msb_first:
        bits = bits[::-1]
    return sum(b << i for i, b in enumerate(bits))


def millionaires_problem(x: int, y: int, n_bits: int = 4) -> dict:
    """Millionaire's problem: securely compute x > y without revealing x or y."""
    gates = SecureGates()
    evaluator = SecureEval(gates)
    circuit = build_comparison_circuit(n_bits)

    x_bits = int_to_bits(x % (2**n_bits), n_bits, msb_first=True)
    y_bits = int_to_bits(y % (2**n_bits), n_bits, msb_first=True)

    t0 = time.time()
    result, trace = evaluator.evaluate_verbose(circuit, x_bits, y_bits)
    elapsed_ms = int((time.time() - t0) * 1000)

    x_gt_y = bool(result[-1]) if result else False
    x_mod = x % (2**n_bits)
    y_mod = y % (2**n_bits)
    if x_mod > y_mod:
        verdict = "Alice is richer"
    elif x_mod < y_mod:
        verdict = "Bob is richer"
    else:
        verdict = "Equal"

    and_gates = sum(1 for g in trace if g["gate_type"] == "AND")
    xor_gates = sum(1 for g in trace if g["gate_type"] == "XOR")
    not_gates = sum(1 for g in trace if g["gate_type"] == "NOT")

    return {
        "x": x, "y": y, "n_bits": n_bits,
        "result": verdict,
        "x_gt_y": x_gt_y,
        "x_eq_y": x_mod == y_mod,
        "ot_calls": evaluator.ot_calls,
        "and_gates": and_gates,
        "xor_gates": xor_gates,
        "not_gates": not_gates,
        "total_gates": len(trace),
        "elapsed_ms": elapsed_ms,
        "gate_trace": trace,
        # Legacy compat fields
        "gate_count": and_gates,
        "xor_count": xor_gates,
    }


def secure_equality(x: int, y: int, n_bits: int = 4) -> dict:
    """Securely compute x == y without revealing x or y."""
    gates = SecureGates()
    evaluator = SecureEval(gates)
    circuit = build_equality_circuit(n_bits)

    x_bits = int_to_bits(x % (2**n_bits), n_bits, msb_first=True)
    y_bits = int_to_bits(y % (2**n_bits), n_bits, msb_first=True)

    t0 = time.time()
    result, trace = evaluator.evaluate_verbose(circuit, x_bits, y_bits)
    elapsed_ms = int((time.time() - t0) * 1000)

    equal = bool(result[-1]) if result else False
    and_gates = sum(1 for g in trace if g["gate_type"] == "AND")
    xor_gates = sum(1 for g in trace if g["gate_type"] == "XOR")
    not_gates  = sum(1 for g in trace if g["gate_type"] == "NOT")

    return {
        "x": x, "y": y, "n_bits": n_bits,
        "equal": equal,
        "correct": equal == ((x % (2**n_bits)) == (y % (2**n_bits))),
        "ot_calls": evaluator.ot_calls,
        "and_gates": and_gates,
        "xor_gates": xor_gates,
        "not_gates": not_gates,
        "total_gates": len(trace),
        "elapsed_ms": elapsed_ms,
        "gate_trace": trace,
    }


def secure_addition(x: int, y: int, n_bits: int = 4) -> dict:
    """Securely compute x + y mod 2^n without revealing x or y."""
    gates = SecureGates()
    evaluator = SecureEval(gates)
    circuit = build_addition_circuit(n_bits)

    # Addition uses LSB-first
    x_bits = int_to_bits(x % (2**n_bits), n_bits, msb_first=False)
    y_bits = int_to_bits(y % (2**n_bits), n_bits, msb_first=False)

    t0 = time.time()
    result, trace = evaluator.evaluate_verbose(circuit, x_bits, y_bits)
    elapsed_ms = int((time.time() - t0) * 1000)

    sum_val = bits_to_int(result, msb_first=False) % (2**n_bits)
    expected = (x + y) % (2**n_bits)

    and_gates = sum(1 for g in trace if g["gate_type"] == "AND")
    xor_gates = sum(1 for g in trace if g["gate_type"] == "XOR")
    not_gates  = sum(1 for g in trace if g["gate_type"] == "NOT")

    return {
        "x": x, "y": y, "n_bits": n_bits,
        "sum": sum_val,
        "expected": expected,
        "correct": sum_val == expected,
        "sum_bits": list(result),
        "ot_calls": evaluator.ot_calls,
        "and_gates": and_gates,
        "xor_gates": xor_gates,
        "not_gates": not_gates,
        "total_gates": len(trace),
        "elapsed_ms": elapsed_ms,
        "gate_trace": trace,
    }


if __name__ == "__main__":
    print("Millionaire's problem (x=7, y=12, n=4-bit):")
    r = millionaires_problem(7, 12, n_bits=4)
    print(f"  Result: {r['result']}  (correct: Bob is richer)")
    print(f"  OT calls (AND gates): {r['ot_calls']}  XOR gates: {r['xor_gates']}  NOT: {r['not_gates']}")
    print(f"  Total gates: {r['total_gates']}  Time: {r['elapsed_ms']}ms")

    print("\nSecure equality (x=5, y=5):")
    r2 = secure_equality(5, 5, n_bits=4)
    print(f"  Equal: {r2['equal']}  OT calls: {r2['ot_calls']}  Time: {r2['elapsed_ms']}ms")

    print("\nSecure addition (x=7, y=12, n=4-bit):")
    r3 = secure_addition(7, 12, n_bits=4)
    print(f"  7+12 mod 16 = {r3['sum']} (expected {r3['expected']})  correct: {r3['correct']}")
    print(f"  OT calls: {r3['ot_calls']}  Time: {r3['elapsed_ms']}ms")
