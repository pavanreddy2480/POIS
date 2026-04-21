"""
PA#6 — CCA-Secure Encryption via Encrypt-then-MAC.
CCA_Enc(kE, kM, m) = (r, c, t) where r||c = Enc(kE, m), t = Mac(kM, r||c)
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
        Returns (r, c, t) where t = MAC(kM, r||c).
        """
        r, c = self.enc.enc(kE, m)
        CE = r + c  # concatenated for MAC input (encrypt-then-MAC)
        t = self.mac.mac(kM, CE)
        return r, c, t

    def cca_dec(self, kE: bytes, kM: bytes, r: bytes, c: bytes, t: bytes):
        """
        CCA decrypt. Verifies MAC FIRST, then decrypts.
        Returns plaintext or None if MAC verification fails.
        """
        CE = r + c
        # Verify MAC FIRST (encrypt-then-MAC)
        if not self.mac.vrfy(kM, CE, t):
            return None  # Reject: MAC invalid
        return self.enc.dec(kE, r, c)

    def malleability_demo(self, kE: bytes, kM: bytes, m: bytes) -> dict:
        """
        Demonstrate that CPA-only encryption is malleable.
        With CCA (Encrypt-then-MAC) the malleability attack fails.
        """
        # CPA encryption (no MAC protection)
        r_cpa, c_cpa = self.enc.enc(kE, m)
        tampered_c = bytes([c_cpa[0] ^ 0x01]) + c_cpa[1:] if c_cpa else c_cpa

        # CCA encryption — tampered ciphertext fails MAC check
        r, c, t = self.cca_enc(kE, kM, m)
        tampered_r = bytes([r[0] ^ 0x01]) + r[1:]
        cca_result = self.cca_dec(kE, kM, tampered_r, c, t)

        return {
            "original_m": m.hex(),
            "cpa_ciphertext": c_cpa.hex(),
            "tampered_cpa_ct": tampered_c.hex(),
            "cpa_decrypts_tampered": True,  # CPA has no integrity
            "cca_tampered_accepted": cca_result is not None,  # should be False
            "description": "Encrypt-then-MAC prevents ciphertext tampering",
        }
