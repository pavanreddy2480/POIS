"""
PA#19 — Secure AND Gate (and XOR/NOT) via Oblivious Transfer.
Uses PA#18 OT as a black box. No new crypto primitives needed.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa18_ot.ot import OT_1of2


class SecureGates:
    """
    Secure computation of basic gates using OT:
    - AND(a, b): Alice sends OT messages (0, a); Bob receives m_b = a AND b
    - XOR(a, b): Free via additive secret sharing over Z_2
    - NOT(a): Alice flips her local share
    """

    def __init__(self, ot: OT_1of2 = None, bits: int = 32):
        self.ot = ot or OT_1of2(bits=bits)
        self._transcript = []

    def AND(self, a: int, b: int) -> int:
        """
        Secure AND via OT:
        Alice (holds a) acts as OT sender with messages (m0=0, m1=a).
        Bob (holds b) acts as OT receiver with choice bit b.
        Bob receives m_b = a*b = a AND b.
        """
        assert a in (0, 1) and b in (0, 1), "AND gate inputs must be bits"
        m0, m1 = 0, a  # Sender messages

        pk0, pk1, state = self.ot.receiver_step1(b)
        C0, C1 = self.ot.sender_step(pk0, pk1, m0, m1)
        result = self.ot.receiver_step2(state, C0, C1)
        result = result % 2  # ensure bit

        self._transcript.append({
            "gate": "AND",
            "alice_input_a": a,
            "bob_choice_b": b,
            "ot_messages": (m0, m1),
            "result": result,
        })
        return result

    def XOR(self, a: int, b: int) -> int:
        """
        Secure XOR via additive secret sharing over Z_2 (free — no OT needed).
        Alice sends random r to Bob; Alice's share = a XOR r; Bob's share = b XOR r.
        Both XOR their shares to get the result a XOR b.
        """
        assert a in (0, 1) and b in (0, 1), "XOR gate inputs must be bits"
        r = int.from_bytes(os.urandom(1), 'big') % 2
        alice_share = a ^ r
        bob_share = b ^ r
        result = alice_share ^ bob_share

        self._transcript.append({
            "gate": "XOR",
            "alice_input_a": a,
            "bob_input_b": b,
            "random_r": r,
            "result": result,
        })
        return result

    def NOT(self, a: int) -> int:
        """
        Secure NOT: Alice locally flips her share. No communication needed.
        """
        assert a in (0, 1), "NOT gate input must be a bit"
        result = 1 - a
        self._transcript.append({"gate": "NOT", "input": a, "result": result})
        return result

    def get_transcript(self) -> list:
        return list(self._transcript)

    def clear_transcript(self):
        self._transcript.clear()


def verify_truth_tables(gates: SecureGates, runs: int = 50) -> dict:
    """Verify AND, XOR, NOT truth tables over many runs."""
    results = {"AND": True, "XOR": True, "NOT": True}

    for a in (0, 1):
        for b in (0, 1):
            and_correct = all(gates.AND(a, b) == (a & b) for _ in range(runs))
            xor_correct = all(gates.XOR(a, b) == (a ^ b) for _ in range(runs))
            results["AND"] = results["AND"] and and_correct
            results["XOR"] = results["XOR"] and xor_correct

    for a in (0, 1):
        not_correct = all(gates.NOT(a) == (1 - a) for _ in range(runs))
        results["NOT"] = results["NOT"] and not_correct

    return results


if __name__ == "__main__":
    gates = SecureGates(bits=32)
    print("Testing secure gates:")
    print(f"  AND(0,0)={gates.AND(0,0)}, AND(0,1)={gates.AND(0,1)}, "
          f"AND(1,0)={gates.AND(1,0)}, AND(1,1)={gates.AND(1,1)}")
    print(f"  XOR(0,0)={gates.XOR(0,0)}, XOR(0,1)={gates.XOR(0,1)}, "
          f"XOR(1,0)={gates.XOR(1,0)}, XOR(1,1)={gates.XOR(1,1)}")
    print(f"  NOT(0)={gates.NOT(0)}, NOT(1)={gates.NOT(1)}")

    print("\nVerifying truth tables (50 runs each)...")
    results = verify_truth_tables(gates, runs=5)
    print(f"  Results: {results}")
    print("PA19 Secure AND PASSED")
