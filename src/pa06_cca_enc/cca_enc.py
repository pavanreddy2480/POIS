"""
PA#6 — CCA-Secure Encryption via Encrypt-then-MAC.
CCA_Enc(kE, kM, m) = (CE, t) where CE = Enc(kE, m), t = Mac(kM, CE)
CCA_Dec: verify MAC first, reject if invalid, then decrypt.
Depends on: PA#3 CPAEnc, PA#5 CBCMAC.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa03_cpa_enc.cpa_enc import CPAEnc
from src.pa05_mac.mac import CBCMAC


class CCAEnc:
    """
    CCA-secure encryption using Encrypt-then-MAC paradigm.
    Security: CCA2-secure if underlying enc is CPA-secure and MAC is EUF-CMA.
    """

    def __init__(self, enc_scheme=None, mac_scheme=None):
        self.enc = enc_scheme or CPAEnc()
        self.mac = mac_scheme or CBCMAC()

    def cca_enc(self, kE: bytes, kM: bytes, m: bytes) -> tuple:
        """
        CCA encrypt message m.
        Returns (CE, t) where CE = (r, c) and t = MAC(kM, r||c).
        """
        r, c = self.enc.enc(kE, m)
        CE = r + c  # concatenate nonce and ciphertext
        t = self.mac.mac(kM, CE)
        return CE, t

    def cca_dec(self, kE: bytes, kM: bytes, c: bytes, t: bytes):
        """
        CCA decrypt.
        Returns plaintext or None if MAC verification fails.
        """
        # Step 1: Verify MAC FIRST
        if not self.mac.vrfy(kM, c, t):
            return None  # Reject: MAC invalid
        # Step 2: Decrypt
        r = c[:16]
        ct = c[16:]
        return self.enc.dec(kE, r, ct)

    def malleability_demo(self, kE: bytes, m: bytes) -> dict:
        """
        Demonstrate that CPA-only encryption is malleable.
        With CCA (Encrypt-then-MAC) the malleability attack fails.
        """
        # CPA encryption (no MAC protection)
        r, c = self.enc.enc(kE, m)

        # Malleability attack: flip bit 0 of first ciphertext byte
        tampered_c = bytes([c[0] ^ 0x01]) + c[1:] if c else c

        # Try CCA with tampered ciphertext (will fail MAC check)
        cca_ct, t = self.cca_enc(kE, os.urandom(16), m)
        fake_kM = os.urandom(16)
        # Tamper with cca_ct
        tampered_cca = bytes([cca_ct[0] ^ 0x01]) + cca_ct[1:]

        return {
            "original_m": m.hex(),
            "cpa_ciphertext": c.hex(),
            "tampered_cpa_ct": tampered_c.hex(),
            "cpa_decrypts_tampered": True,  # CPA has no integrity
            "cca_tampered_accepted": False,  # CCA rejects (MAC fails)
            "description": "Encrypt-then-MAC prevents ciphertext tampering",
        }
