"""
PA#18 — 1-out-of-2 Oblivious Transfer (Bellare-Micali).
Uses PA#16 ElGamal. Receiver privacy: sender can't learn b.
Sender privacy: receiver can only decrypt C_b.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa16_elgamal.elgamal import ElGamal, ElGamalGroup
from src.pa13_miller_rabin.miller_rabin import mod_pow, mod_inverse


class OT_1of2:
    """
    1-out-of-2 Oblivious Transfer using ElGamal.
    Receiver has choice bit b in {0,1}.
    Sender has messages (m0, m1).
    Result: Receiver gets m_b; Sender learns nothing about b.
    """

    def __init__(self, elgamal: ElGamal = None, bits: int = 32):
        if elgamal is None:
            self.eg = ElGamal(bits=bits)
        else:
            self.eg = elgamal
        self.group = self.eg.group

    def receiver_step1(self, b: int) -> tuple:
        """
        Receiver generates pk_b honestly (keeping sk_b) and
        pk_{1-b} as a random group element (no trapdoor).
        Returns (pk0, pk1, state) where state = {b, sk_b}.
        """
        assert b in (0, 1), "Choice bit must be 0 or 1"
        p, g, q = self.group.p, self.group.g, self.group.q

        # Generate honest key for b
        x_b = self.group.random_exponent()
        h_b = mod_pow(g, x_b, p)

        # Generate "trapdoor-free" key for 1-b: just a random group element
        h_1b = self.group.random_exponent() % (p - 2) + 2  # random in Z_p*

        pk_b  = {"p": p, "g": g, "q": q, "h": h_b}
        pk_1b = {"p": p, "g": g, "q": q, "h": h_1b}

        if b == 0:
            pk0, pk1 = pk_b, pk_1b
        else:
            pk0, pk1 = pk_1b, pk_b

        state = {"b": b, "sk_b": x_b, "pk_enc": pk_b}
        return pk0, pk1, state

    def sender_step(self, pk0: dict, pk1: dict, m0: int, m1: int) -> tuple:
        """
        Sender encrypts both messages:
        C0 = ElGamal_Enc(pk0, m0),  C1 = ElGamal_Enc(pk1, m1).
        Returns (C0, C1).
        """
        C0 = self.eg.enc(pk0, m0)
        C1 = self.eg.enc(pk1, m1)
        return C0, C1

    def receiver_step2(self, state: dict, C0: tuple, C1: tuple) -> int:
        """
        Receiver decrypts C_b using sk_b.
        Cannot decrypt C_{1-b} (no secret key for it).
        """
        b = state["b"]
        sk_b = state["sk_b"]
        pk_b = state["pk_enc"]

        Cb = C0 if b == 0 else C1
        return self.eg.dec(sk_b, pk_b, Cb[0], Cb[1])

    def full_protocol(self, b: int, m0: int, m1: int) -> dict:
        """Run complete OT protocol and return transcript."""
        pk0, pk1, state = self.receiver_step1(b)
        C0, C1 = self.sender_step(pk0, pk1, m0, m1)
        m_b = self.receiver_step2(state, C0, C1)

        return {
            "choice_bit": b,
            "m0": m0,
            "m1": m1,
            "received": m_b,
            "correct": m_b == (m0 if b == 0 else m1),
            "pk0_h": hex(pk0["h"]),
            "pk1_h": hex(pk1["h"]),
            "C0": (hex(C0[0]), hex(C0[1])),
            "C1": (hex(C1[0]), hex(C1[1])),
        }


if __name__ == "__main__":
    ot = OT_1of2(bits=32)
    print("OT protocol (b=0):")
    r0 = ot.full_protocol(0, 42, 99)
    print(f"  Received: {r0['received']} (expected m0={r0['m0']}), correct={r0['correct']}")
    assert r0["correct"]

    print("OT protocol (b=1):")
    r1 = ot.full_protocol(1, 42, 99)
    print(f"  Received: {r1['received']} (expected m1={r1['m1']}), correct={r1['correct']}")
    assert r1["correct"]
    print("PA18 OT PASSED")
