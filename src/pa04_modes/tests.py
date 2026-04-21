"""Tests for PA#4: Block Cipher Modes."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa04_modes.modes import CBCMode, OFBMode, CTRMode, Encrypt, Decrypt


def test_cbc_roundtrip():
    cbc = CBCMode()
    k = os.urandom(16)
    iv = os.urandom(16)
    m = b"This is a test message for CBC!!"
    ct = cbc.encrypt(k, iv, m)
    pt = cbc.decrypt(k, iv, ct)
    assert pt == m

def test_cbc_padding():
    cbc = CBCMode()
    k = os.urandom(16)
    iv = os.urandom(16)
    m = b"Short"
    ct = cbc.encrypt(k, iv, m)
    pt = cbc.decrypt(k, iv, ct)
    assert pt == m

def test_ofb_roundtrip():
    ofb = OFBMode()
    k = os.urandom(16)
    iv = os.urandom(16)
    m = b"OFB mode test message here!!"
    ct = ofb.encrypt(k, iv, m)
    pt = ofb.decrypt(k, iv, ct)
    assert pt == m

def test_ofb_symmetric():
    """OFB encrypt == decrypt."""
    ofb = OFBMode()
    k = os.urandom(16)
    iv = os.urandom(16)
    data = os.urandom(33)
    assert ofb.encrypt(k, iv, ofb.encrypt(k, iv, data)) == data

def test_ctr_roundtrip():
    ctr = CTRMode()
    k = os.urandom(16)
    m = os.urandom(50)
    r, ct = ctr.encrypt(k, m)
    pt = ctr.decrypt(k, r, ct)
    assert pt == m

def test_encrypt_decrypt_cbc():
    k = os.urandom(16)
    m = b"Hello CBC world!"
    ct = Encrypt('CBC', k, m)
    pt = Decrypt('CBC', k, ct)
    assert pt == m

def test_encrypt_decrypt_ofb():
    k = os.urandom(16)
    m = b"Hello OFB world!"
    ct = Encrypt('OFB', k, m)
    pt = Decrypt('OFB', k, ct)
    assert pt == m

def test_encrypt_decrypt_ctr():
    k = os.urandom(16)
    m = b"Hello CTR world!"
    ct = Encrypt('CTR', k, m)
    pt = Decrypt('CTR', k, ct)
    assert pt == m

def test_cbc_iv_changes_ciphertext():
    k = os.urandom(16)
    m = b"Same message here"
    ct1 = Encrypt('CBC', k, m)
    ct2 = Encrypt('CBC', k, m)
    # Different IVs → different ciphertexts
    assert ct1 != ct2

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
