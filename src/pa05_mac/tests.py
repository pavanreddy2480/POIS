"""Tests for PA#5: MAC implementations."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.pa05_mac.mac import PRFMAC, CBCMAC, hmac_stub
import pytest


def test_prf_mac_verify():
    mac = PRFMAC()
    k = os.urandom(16)
    m = b"test message"
    t = mac.mac(k, m)
    assert mac.vrfy(k, m, t)

def test_prf_mac_wrong_key():
    mac = PRFMAC()
    k1 = os.urandom(16)
    k2 = os.urandom(16)
    m = b"test message"
    t = mac.mac(k1, m)
    assert not mac.vrfy(k2, m, t)

def test_prf_mac_wrong_message():
    mac = PRFMAC()
    k = os.urandom(16)
    t = mac.mac(k, b"message A")
    assert not mac.vrfy(k, b"message B", t)

def test_prf_mac_multiblock():
    mac = PRFMAC()
    k = os.urandom(16)
    m = os.urandom(48)  # 3 blocks
    t = mac.mac(k, m)
    assert mac.vrfy(k, m, t)

def test_cbc_mac_verify():
    mac = CBCMAC()
    k = os.urandom(16)
    m = b"CBC-MAC test!!"
    t = mac.mac(k, m)
    assert mac.vrfy(k, m, t)

def test_cbc_mac_different_keys():
    mac = CBCMAC()
    k1, k2 = os.urandom(16), os.urandom(16)
    m = b"test"
    assert mac.mac(k1, m) != mac.mac(k2, m)

def test_hmac_stub_raises():
    with pytest.raises(NotImplementedError):
        hmac_stub(b'k'*16, b'message')

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
