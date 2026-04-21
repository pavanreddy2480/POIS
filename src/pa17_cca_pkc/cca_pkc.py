"""
PA#17 — CCA-Secure Public-Key Cryptography (Sign-then-Encrypt).
Combines PA#15 (Digital Signatures) + PA#16 (ElGamal).
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa16_elgamal.elgamal import ElGamal
from src.pa15_signatures.signatures import RSASignature
from src.pa12_rsa.rsa import RSA


class CCA_PKC:
    """
    CCA-Secure PKC via Encrypt-then-Sign (Signcryption).
    Encrypt: CE = ElGamal_Enc(pk_enc, m);  sigma = Sign(sk_sign, CE)
    Decrypt: Verify(vk_sign, CE, sigma) first; then ElGamal_Dec(sk_enc, CE)
    """

    def __init__(self, elgamal: ElGamal = None, sig_scheme: RSASignature = None):
        self.elgamal = elgamal or ElGamal(bits=32)
        self.sig = sig_scheme or RSASignature(bits=128)

    def enc(self, pk_enc: dict, sk_sign: dict, vk_sign: tuple, m: int) -> dict:
        """
        Signcrypt m:
        1. CE = ElGamal_Enc(pk_enc, m)
        2. sigma = Sign(sk_sign, serialize(CE))
        3. Return (CE, sigma)
        """
        c1, c2 = self.elgamal.enc(pk_enc, m)
        ce_bytes = (hex(c1) + "|" + hex(c2)).encode()
        sigma = self.sig.sign(sk_sign, ce_bytes)
        return {"c1": c1, "c2": c2, "sigma": sigma, "ce_bytes": ce_bytes}

    def dec(self, sk_enc: int, pk_enc: dict, vk_sign: tuple, payload: dict):
        """
        Verify-then-Decrypt:
        1. Verify sigma on CE; reject (return None) if invalid
        2. Decrypt CE with sk_enc
        """
        c1 = payload["c1"]
        c2 = payload["c2"]
        sigma = payload["sigma"]
        ce_bytes = payload["ce_bytes"]

        if not self.sig.verify(vk_sign, ce_bytes, sigma):
            return None  # Signature check failed — reject

        return self.elgamal.dec(sk_enc, pk_enc, c1, c2)

    def malleability_blocked_demo(self, pk_enc: dict, sk_enc: int, pk_sign: tuple,
                                    sk_sign: dict, m: int) -> dict:
        """
        Shows that modifying ciphertext causes signature failure (CCA security).
        Contrast with plain ElGamal where modification decrypts to 2m.
        """
        # Legitimate encryption
        payload = self.enc(pk_enc, sk_sign, pk_sign, m)
        c1_orig, c2_orig = payload["c1"], payload["c2"]

        # Attacker modifies c2 (ElGamal malleability attempt)
        tampered = dict(payload)
        tampered["c2"] = (2 * c2_orig) % pk_enc["p"]
        tampered["ce_bytes"] = (hex(c1_orig) + "|" + hex(tampered["c2"])).encode()
        # sigma stays the same but covers the old ce_bytes

        # Try to decrypt tampered ciphertext
        result = self.dec(sk_enc, pk_enc, pk_sign, tampered)

        return {
            "original_m": m,
            "tampered_c2": hex(tampered["c2"]),
            "decryption_result": result,
            "cca_blocked": result is None,
            "note": "Signature on CE is invalid after tampering — decryption rejected",
        }


if __name__ == "__main__":
    eg = ElGamal(bits=32)
    rsa = RSA()
    sig = RSASignature(rsa, bits=128)

    eg_keys = eg.keygen()
    rsa_keys = rsa.keygen(128)

    cca = CCA_PKC(eg, sig)
    m = 100
    payload = cca.enc(eg_keys["pk"], rsa_keys["sk"], rsa_keys["pk"], m)
    dec = cca.dec(eg_keys["sk"], eg_keys["pk"], rsa_keys["pk"], payload)
    print(f"Decrypt: {dec} (expected {m})")
    assert dec == m

    demo = cca.malleability_blocked_demo(
        eg_keys["pk"], eg_keys["sk"], rsa_keys["pk"], rsa_keys["sk"], m
    )
    print(f"CCA blocked: {demo['cca_blocked']}")
    assert demo["cca_blocked"]
    print("PA17 CCA-PKC PASSED")
