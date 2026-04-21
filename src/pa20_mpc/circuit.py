"""
PA#20 — Boolean Circuit for 2-Party Secure Computation.
Circuit is a DAG of AND/XOR/NOT gates.
"""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Gate:
    gate_type: str   # 'AND', 'XOR', 'NOT', 'INPUT'
    inputs: List[int] = field(default_factory=list)  # wire indices
    output: int = 0  # wire index

    def __repr__(self):
        return f"Gate({self.gate_type}, in={self.inputs}, out={self.output})"


class Circuit:
    """Directed Acyclic Graph of boolean gates."""

    def __init__(self, n_inputs: int, n_outputs: int = 1):
        self.n_inputs = n_inputs
        self.n_outputs = n_outputs
        self.gates: List[Gate] = []
        self.n_wires = n_inputs

    def add_gate(self, gate_type: str, input_wires: list) -> int:
        """Add a gate and return its output wire index."""
        out_wire = self.n_wires
        self.n_wires += 1
        self.gates.append(Gate(gate_type, list(input_wires), out_wire))
        return out_wire

    def evaluate(self, inputs: list) -> list:
        """Evaluate circuit on given input bits."""
        assert len(inputs) == self.n_inputs
        wires = list(inputs) + [0] * (self.n_wires - self.n_inputs)

        for gate in self.gates:
            if gate.gate_type == 'AND':
                wires[gate.output] = wires[gate.inputs[0]] & wires[gate.inputs[1]]
            elif gate.gate_type == 'XOR':
                wires[gate.output] = wires[gate.inputs[0]] ^ wires[gate.inputs[1]]
            elif gate.gate_type == 'NOT':
                wires[gate.output] = 1 - wires[gate.inputs[0]]
            else:
                raise ValueError(f"Unknown gate type: {gate.gate_type}")

        return wires[-self.n_outputs:]


def _or_gate(c: 'Circuit', a: int, b: int) -> int:
    """Compute OR(a,b) = a XOR b XOR (a AND b) using 3 gates."""
    xp = c.add_gate('XOR', [a, b])
    ap = c.add_gate('AND', [a, b])
    return c.add_gate('XOR', [xp, ap])


def build_comparison_circuit(n_bits: int) -> Circuit:
    """
    MSB-first ripple comparator tracking (GT, EQ) state.
    Transition per bit:
      new_GT = (EQ AND xi AND NOT yi) OR GT
      new_EQ = EQ AND NOT(xi XOR yi)
    Output: final GT.
    """
    c = Circuit(2 * n_bits, 1)
    # Initial state: GT=0, EQ=1
    wire_gt = c.add_gate('XOR', [0, 0])   # constant 0
    wire_eq = c.add_gate('NOT', [wire_gt]) # constant 1 via NOT(0)

    for i in range(n_bits):
        xi = i
        yi = n_bits + i

        # x[i] > y[i]: xi AND NOT yi
        not_yi  = c.add_gate('NOT', [yi])
        xi_gt_yi = c.add_gate('AND', [xi, not_yi])

        # x[i] == y[i]: NOT (xi XOR yi)
        xi_xor_yi = c.add_gate('XOR', [xi, yi])
        xi_eq_yi  = c.add_gate('NOT', [xi_xor_yi])

        # new_GT = OR(GT, EQ AND xi_gt_yi)
        eq_and_gtbit = c.add_gate('AND', [wire_eq, xi_gt_yi])
        new_gt = _or_gate(c, wire_gt, eq_and_gtbit)

        # new_EQ = EQ AND xi_eq_yi
        new_eq = c.add_gate('AND', [wire_eq, xi_eq_yi])

        wire_eq = new_eq
        wire_gt = new_gt

    # Append final output as last wire: XOR(GT, constant_0) = GT
    const0 = c.gates[0].output   # wire index of the constant-0 gate
    c.add_gate('XOR', [wire_gt, const0])   # this is now wires[-1]
    c.n_outputs = 1
    return c


def build_equality_circuit(n_bits: int) -> Circuit:
    """
    Build a circuit that computes x == y for n-bit integers.
    Output: 1 if x == y, 0 otherwise.
    """
    c = Circuit(2 * n_bits, 1)
    # All bits must be equal: AND of (NOT (x[i] XOR y[i]))
    prev = None
    for i in range(n_bits):
        xi, yi = i, n_bits + i
        xor_out = c.add_gate('XOR', [xi, yi])
        bit_eq = c.add_gate('NOT', [xor_out])
        if prev is None:
            prev = bit_eq
        else:
            prev = c.add_gate('AND', [prev, bit_eq])
    c.n_outputs = 1
    return c


def build_addition_circuit(n_bits: int) -> Circuit:
    """
    Build a ripple-carry adder circuit for x + y mod 2^n.
    Inputs: x[0..n-1] (LSB first), y[0..n-1] (LSB first).
    Outputs: sum[0..n-1] (LSB first).
    """
    c = Circuit(2 * n_bits, n_bits)

    carry = c.add_gate('XOR', [0, 0])  # carry = 0 initially
    sum_wires = []

    for i in range(n_bits):
        xi, yi = i, n_bits + i

        # sum_i = x_i XOR y_i XOR carry
        xor1 = c.add_gate('XOR', [xi, yi])
        sum_i = c.add_gate('XOR', [xor1, carry])
        sum_wires.append(sum_i)

        # carry_new = (x_i AND y_i) OR ((x_i XOR y_i) AND carry)
        and1 = c.add_gate('AND', [xi, yi])
        and2 = c.add_gate('AND', [xor1, carry])
        new_carry = c.add_gate('XOR', [and1, and2])  # OR via carry logic
        carry = new_carry

    c.n_outputs = n_bits
    return c, sum_wires
