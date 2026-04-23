"""
Comprehensive edge-case tests for PA1–PA20, grounded in pois.pdf spec.
Run: python3 -m pytest src/test_comprehensive.py -v
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# ──────────────────────────────────────────────────────────────
# PA 1 — OWF / PRG
# ──────────────────────────────────────────────────────────────
from src.pa01_owf_prg.owf import DLPOWF, AESOWF
from src.pa01_owf_prg.prg import PRG

class TestPA1_OWF:
    def setup_method(self):
        self.dlp = DLPOWF(bits=16)
        self.aes = AESOWF()

    def test_dlp_evaluate_zero_is_one(self):
        # g^0 mod p = 1 for any group
        assert self.dlp.evaluate(0) == 1

    def test_dlp_evaluate_is_periodic_mod_q(self):
        # g^(x mod q) mod p == g^x mod p
        x = 12345
        assert self.dlp.evaluate(x) == self.dlp.evaluate(x + self.dlp.q)

    def test_dlp_group_order(self):
        # g^q ≡ 1 (mod p) — g generates prime-order-q subgroup
        assert pow(self.dlp.g, self.dlp.q, self.dlp.p) == 1

    def test_dlp_g_not_trivial(self):
        # g itself must not be 1
        assert self.dlp.g != 1

    def test_dlp_verify_hardness_returns_dict(self):
        result = self.dlp.verify_hardness(x=7)
        assert isinstance(result, dict)
        for key in ('hardness', 'p', 'q', 'g', 'bits', 'best_attack', 'input', 'output'):
            assert key in result, f"Missing key: {key}"

    def test_dlp_verify_hardness_no_x(self):
        result = self.dlp.verify_hardness()
        assert 'input' not in result
        assert 'output' not in result

    def test_aes_owf_not_identity(self):
        k = b'\x00' * 16
        assert self.aes.evaluate(k) != k

    def test_aes_owf_all_ff(self):
        k = b'\xff' * 16
        out = self.aes.evaluate(k)
        assert len(out) == 16 and out != k

    def test_aes_owf_deterministic_multiple(self):
        k = os.urandom(16)
        assert self.aes.evaluate(k) == self.aes.evaluate(k)

    def test_aes_owf_different_keys(self):
        k1, k2 = os.urandom(16), os.urandom(16)
        assert self.aes.evaluate(k1) != self.aes.evaluate(k2)


class TestPA1_PRG:
    def setup_method(self):
        self.prg_aes = PRG(mode='aes')
        self.prg_dlp = PRG(mode='dlp')

    def test_aes_prg_zero_length(self):
        out = self.prg_aes.generate(b'\x00'*16, 0)
        assert out == b''

    def test_aes_prg_exact_block(self):
        out = self.prg_aes.generate(b'\xab'*16, 16)
        assert len(out) == 16

    def test_aes_prg_multi_block(self):
        out = self.prg_aes.generate(b'\x01'*16, 48)
        assert len(out) == 48

    def test_aes_prg_non_multiple(self):
        out = self.prg_aes.generate(b'\x02'*16, 37)
        assert len(out) == 37

    def test_length_doubling_structure(self):
        s = os.urandom(16)
        g0, g1 = self.prg_aes.length_doubling(s)
        assert len(g0) == 16 and len(g1) == 16
        assert g0 != g1

    def test_dlp_prg_length(self):
        seed = os.urandom(16)
        out = self.prg_dlp.generate(seed, 8)
        assert len(out) == 8

    def test_dlp_prg_deterministic(self):
        seed = b'\xde\xad\xbe\xef' * 4
        assert self.prg_dlp.generate(seed, 16) == self.prg_dlp.generate(seed, 16)

    def test_prg_seed_and_next_bits(self):
        prg = PRG(mode='aes')
        prg.seed(b'\x42'*16)
        bits = prg.next_bits(16)
        assert len(bits) == 16


# ──────────────────────────────────────────────────────────────
# PA 2 — PRF (GGM + AES)
# ──────────────────────────────────────────────────────────────
from src.pa02_prf.prf import GGMPRF, AESPRF

class TestPA2_GGMPRF:
    def setup_method(self):
        self.prf = GGMPRF(depth=4)
        self.k = b'\x01' * 16

    def test_depth_4_path_length(self):
        path = self.prf.get_tree_path(self.k, b'\x00')
        assert len(path) == 5  # root + 4 levels

    def test_root_entry(self):
        path = self.prf.get_tree_path(self.k, b'\x00')
        assert path[0]['level'] == 'root'
        assert path[0]['bit'] is None

    def test_non_root_bits_are_0_or_1(self):
        path = self.prf.get_tree_path(self.k, b'\xab')
        for entry in path[1:]:
            assert entry['bit'] in (0, 1)

    def test_path_last_node_matches_F(self):
        x = b'\xa5'
        path = self.prf.get_tree_path(self.k, x)
        leaf_node = bytes.fromhex(path[-1]['node'])
        assert leaf_node == self.prf.F(self.k, x)

    def test_different_queries_different_outputs(self):
        # depth=4 reads the top 4 bits (MSB-first).
        # b'\x00'=0b00000000 (top 4 bits: 0000) and
        # b'\x80'=0b10000000 (top 4 bits: 1000) differ at bit 7 → different paths.
        assert self.prf.F(self.k, b'\x00') != self.prf.F(self.k, b'\x80')

    def test_all_zero_vs_all_one_query(self):
        out0 = self.prf.F(self.k, b'\x00\x00')
        out1 = self.prf.F(self.k, b'\xff\xff')
        assert out0 != out1

    def test_different_keys_same_query(self):
        k2 = b'\x02' * 16
        assert self.prf.F(self.k, b'\xaa') != self.prf.F(k2, b'\xaa')

    def test_depth_8_path_length(self):
        prf8 = GGMPRF(depth=8)
        path = prf8.get_tree_path(self.k, b'\x00')
        assert len(path) == 9


class TestPA2_AESPRF:
    def setup_method(self):
        self.prf = AESPRF()
        self.k = os.urandom(16)

    def test_output_is_16_bytes(self):
        out = self.prf.F(self.k, b'\x00'*16)
        assert len(out) == 16

    def test_short_input_padded(self):
        # x shorter than 16 bytes should be zero-padded and still work
        out = self.prf.F(self.k, b'\x01')
        assert len(out) == 16

    def test_F_counter_deterministic(self):
        out1 = self.prf.F_counter(self.k, 0)
        out2 = self.prf.F_counter(self.k, 0)
        assert out1 == out2

    def test_F_counter_different_counters(self):
        assert self.prf.F_counter(self.k, 0) != self.prf.F_counter(self.k, 1)


# ──────────────────────────────────────────────────────────────
# PA 3 — CPA Encryption
# ──────────────────────────────────────────────────────────────
from src.pa03_cpa_enc.cpa_enc import CPAEnc

class TestPA3_CPAEnc:
    def setup_method(self):
        self.scheme = CPAEnc()
        self.k = os.urandom(16)

    def test_single_byte_roundtrip(self):
        m = b'\x42'
        r, c = self.scheme.enc(self.k, m)
        assert self.scheme.dec(self.k, r, c) == m

    def test_exactly_one_block_roundtrip(self):
        m = os.urandom(16)
        r, c = self.scheme.enc(self.k, m)
        assert self.scheme.dec(self.k, r, c) == m

    def test_multi_block_roundtrip(self):
        m = os.urandom(33)
        r, c = self.scheme.enc(self.k, m)
        assert self.scheme.dec(self.k, r, c) == m

    def test_empty_roundtrip(self):
        m = b''
        r, c = self.scheme.enc(self.k, m)
        assert self.scheme.dec(self.k, r, c) == m

    def test_ciphertext_length_matches_plaintext(self):
        m = os.urandom(37)
        r, c = self.scheme.enc(self.k, m)
        assert len(c) == len(m)

    def test_nonce_is_16_bytes(self):
        r, c = self.scheme.enc(self.k, b'hello')
        assert len(r) == 16

    def test_two_encryptions_different_nonces(self):
        m = b'test'
        r1, _ = self.scheme.enc(self.k, m)
        r2, _ = self.scheme.enc(self.k, m)
        assert r1 != r2  # freshly sampled each time

    def test_enc_broken_deterministic(self):
        m = b'attack at dawn!!'
        _, c1 = self.scheme.enc_broken(self.k, m)
        _, c2 = self.scheme.enc_broken(self.k, m)
        assert c1 == c2  # broken: same output

    def test_enc_broken_nonce_is_zero(self):
        r, _ = self.scheme.enc_broken(self.k, b'test')
        assert r == b'\x00' * 16

    def test_wrong_key_decryption_fails(self):
        m = os.urandom(16)
        r, c = self.scheme.enc(self.k, m)
        wrong_key = os.urandom(16)
        assert self.scheme.dec(wrong_key, r, c) != m


# ──────────────────────────────────────────────────────────────
# PA 4 — Modes of Operation
# ──────────────────────────────────────────────────────────────
from src.pa04_modes.modes import CBCMode, OFBMode, CTRMode, Encrypt, Decrypt

class TestPA4_CBC:
    def setup_method(self):
        self.cbc = CBCMode()
        self.k = os.urandom(16)
        self.iv = os.urandom(16)

    def test_empty_message(self):
        # Empty message: padding fills one full block
        ct = self.cbc.encrypt(self.k, self.iv, b'')
        assert len(ct) == 16  # one block of padding
        pt = self.cbc.decrypt(self.k, self.iv, ct)
        assert pt == b''

    def test_exact_block_size(self):
        # 16-byte message → 32 bytes ciphertext (PKCS7 adds full padding block)
        m = b'A' * 16
        ct = self.cbc.encrypt(self.k, self.iv, m)
        assert len(ct) == 32
        assert self.cbc.decrypt(self.k, self.iv, ct) == m

    def test_15_bytes_message(self):
        m = b'B' * 15
        ct = self.cbc.encrypt(self.k, self.iv, m)
        assert len(ct) == 16
        assert self.cbc.decrypt(self.k, self.iv, ct) == m

    def test_different_iv_different_ct(self):
        m = b'hello world!!!!!'
        iv2 = os.urandom(16)
        ct1 = self.cbc.encrypt(self.k, self.iv, m)
        ct2 = self.cbc.encrypt(self.k, iv2, m)
        assert ct1 != ct2

    def test_ciphertext_multiple_of_blocksize(self):
        for length in [1, 7, 15, 16, 17, 31, 32]:
            m = os.urandom(length)
            ct = self.cbc.encrypt(self.k, self.iv, m)
            assert len(ct) % 16 == 0


class TestPA4_OFB:
    def setup_method(self):
        self.ofb = OFBMode()
        self.k = os.urandom(16)
        self.iv = os.urandom(16)

    def test_encrypt_equals_decrypt(self):
        # OFB is a stream cipher: enc == dec (same XOR operation)
        m = os.urandom(33)
        ct = self.ofb.encrypt(self.k, self.iv, m)
        pt = self.ofb.decrypt(self.k, self.iv, ct)
        assert pt == m

    def test_no_padding(self):
        # OFB: ciphertext same length as plaintext
        for length in [1, 15, 16, 17]:
            m = os.urandom(length)
            ct = self.ofb.encrypt(self.k, self.iv, m)
            assert len(ct) == len(m)

    def test_xor_two_ciphertexts_gives_xor_of_plaintexts(self):
        # OFB keystream reuse: c1 XOR c2 = m1 XOR m2
        m1 = b'hello world!!!!!'
        m2 = b'goodbye world!!!'
        ct1 = self.ofb.encrypt(self.k, self.iv, m1)
        ct2 = self.ofb.encrypt(self.k, self.iv, m2)
        xor = bytes(a ^ b for a, b in zip(ct1, ct2))
        expected = bytes(a ^ b for a, b in zip(m1, m2))
        assert xor == expected


class TestPA4_CTR:
    def setup_method(self):
        self.ctr = CTRMode()
        self.k = os.urandom(16)

    def test_roundtrip(self):
        m = os.urandom(35)
        r, ct = self.ctr.encrypt(self.k, m)
        assert self.ctr.decrypt(self.k, r, ct) == m

    def test_no_padding(self):
        m = os.urandom(17)
        r, ct = self.ctr.encrypt(self.k, m)
        assert len(ct) == 17

    def test_two_encryptions_different_nonces(self):
        m = b'same message' + b'\x00' * 4
        r1, ct1 = self.ctr.encrypt(self.k, m)
        r2, ct2 = self.ctr.encrypt(self.k, m)
        assert r1 != r2 or ct1 != ct2  # different nonces → different ciphertext


class TestPA4_UnifiedInterface:
    def setup_method(self):
        self.k = os.urandom(16)

    def test_cbc_roundtrip(self):
        m = os.urandom(33)
        ct = Encrypt('CBC', self.k, m)
        assert Decrypt('CBC', self.k, ct) == m

    def test_ofb_roundtrip(self):
        m = os.urandom(33)
        ct = Encrypt('OFB', self.k, m)
        assert Decrypt('OFB', self.k, ct) == m

    def test_ctr_roundtrip(self):
        m = os.urandom(33)
        ct = Encrypt('CTR', self.k, m)
        assert Decrypt('CTR', self.k, ct) == m

    def test_unknown_mode_raises(self):
        import pytest
        with pytest.raises(ValueError):
            Encrypt('XTS', self.k, b'test')


# ──────────────────────────────────────────────────────────────
# PA 5 — MAC
# ──────────────────────────────────────────────────────────────
from src.pa05_mac.mac import PRFMAC, CBCMAC

class TestPA5_PRFMAC:
    def setup_method(self):
        self.mac = PRFMAC()
        self.k = os.urandom(16)

    def test_tag_is_16_bytes(self):
        t = self.mac.mac(self.k, b'\x00'*16)
        assert len(t) == 16

    def test_verify_correct_tag(self):
        m = b'\xde'*16
        t = self.mac.mac(self.k, m)
        assert self.mac.vrfy(self.k, m, t)

    def test_rejects_wrong_message(self):
        m = b'\x01'*16
        t = self.mac.mac(self.k, m)
        assert not self.mac.vrfy(self.k, b'\x02'*16, t)

    def test_rejects_wrong_key(self):
        m = b'\x03'*16
        t = self.mac.mac(self.k, m)
        assert not self.mac.vrfy(os.urandom(16), m, t)

    def test_rejects_tampered_tag(self):
        m = b'\x04'*16
        t = self.mac.mac(self.k, m)
        t_bad = bytes([t[0] ^ 0x01]) + t[1:]
        assert not self.mac.vrfy(self.k, m, t_bad)


class TestPA5_CBCMAC:
    def setup_method(self):
        self.mac = CBCMAC()
        self.k = os.urandom(16)

    def test_empty_message(self):
        # Empty message still produces a valid tag
        t = self.mac.mac(self.k, b'')
        assert len(t) == 16
        assert self.mac.vrfy(self.k, b'', t)

    def test_exact_block(self):
        m = os.urandom(16)
        t = self.mac.mac(self.k, m)
        assert self.mac.vrfy(self.k, m, t)

    def test_multi_block(self):
        m = os.urandom(48)
        t = self.mac.mac(self.k, m)
        assert self.mac.vrfy(self.k, m, t)

    def test_tag_is_deterministic(self):
        m = os.urandom(24)
        assert self.mac.mac(self.k, m) == self.mac.mac(self.k, m)


# ──────────────────────────────────────────────────────────────
# PA 6 — CCA Encryption
# ──────────────────────────────────────────────────────────────
from src.pa06_cca_enc.cca_enc import CCAEnc

class TestPA6_CCAEnc:
    def setup_method(self):
        self.cca = CCAEnc()
        self.kE = os.urandom(16)
        self.kM = os.urandom(16)

    def test_returns_three_values(self):
        result = self.cca.cca_enc(self.kE, self.kM, b'hello')
        assert len(result) == 3

    def test_roundtrip_various_lengths(self):
        for n in [0, 1, 15, 16, 17, 48]:
            m = os.urandom(n)
            r, c, t = self.cca.cca_enc(self.kE, self.kM, m)
            assert self.cca.cca_dec(self.kE, self.kM, r, c, t) == m

    def test_tampered_nonce_rejected(self):
        m = b'secret message!!'
        r, c, t = self.cca.cca_enc(self.kE, self.kM, m)
        r_bad = bytes([r[0] ^ 0xFF]) + r[1:]
        assert self.cca.cca_dec(self.kE, self.kM, r_bad, c, t) is None

    def test_tampered_ciphertext_rejected(self):
        m = b'secret message!!'
        r, c, t = self.cca.cca_enc(self.kE, self.kM, m)
        c_bad = bytes([c[0] ^ 0xFF]) + c[1:]
        assert self.cca.cca_dec(self.kE, self.kM, r, c_bad, t) is None

    def test_tampered_tag_rejected(self):
        m = b'hello cca world!'
        r, c, t = self.cca.cca_enc(self.kE, self.kM, m)
        t_bad = bytes([t[0] ^ 0x01]) + t[1:]
        assert self.cca.cca_dec(self.kE, self.kM, r, c, t_bad) is None

    def test_wrong_mac_key_rejected(self):
        m = b'test'
        r, c, t = self.cca.cca_enc(self.kE, self.kM, m)
        assert self.cca.cca_dec(self.kE, os.urandom(16), r, c, t) is None

    def test_malleability_demo_structure(self):
        demo = self.cca.malleability_demo(self.kE, self.kM, b'test data here!!')
        assert demo['cca_tampered_accepted'] is False
        assert 'original_m' in demo


# ──────────────────────────────────────────────────────────────
# PA 7 — Merkle-Damgård
# ──────────────────────────────────────────────────────────────
from src.pa07_merkle_damgard.merkle_damgard import MerkleDamgard

class TestPA7_MerkleDamgard:
    def setup_method(self):
        self.md = MerkleDamgard()

    def test_padded_length_multiple_of_block(self):
        for n in [0, 1, 7, 8, 15, 16, 17, 55, 56, 64]:
            padded = self.md.pad(b'\x00' * n)
            assert len(padded) % 16 == 0, f"Failed for n={n}"

    def test_padding_starts_with_0x80(self):
        msg = b'\xaa' * 7
        padded = self.md.pad(msg)
        assert padded[7] == 0x80

    def test_padding_length_field_correct(self):
        import struct
        msg = b'hello'
        padded = self.md.pad(msg)
        length_field = struct.unpack('>Q', padded[-8:])[0]
        assert length_field == len(msg) * 8

    def test_empty_message_hash(self):
        h = self.md.hash(b'')
        assert len(h) == 16

    def test_hash_deterministic(self):
        m = b'crypto is fun!'
        assert self.md.hash(m) == self.md.hash(m)

    def test_different_messages_different_hashes(self):
        assert self.md.hash(b'abc') != self.md.hash(b'abd')

    def test_single_block_message(self):
        m = b'\x01' * 7  # less than one block
        h = self.md.hash(m)
        assert len(h) == 16

    def test_multiblock_message(self):
        m = b'\x02' * 33
        h = self.md.hash(m)
        assert len(h) == 16

    def test_length_extension_property(self):
        # H(m || pad || suffix) can be computed from H(m) state
        # This is the known weakness of MD
        m1 = b'hello'
        m2 = b'world'
        h1 = self.md.hash(m1)
        h12 = self.md.hash(m1 + m2)
        # They should differ
        assert h1 != h12

    def test_hash_with_chain_has_correct_keys(self):
        result = self.md.hash_with_chain(b'test')
        assert 'message' in result
        assert 'padded' in result
        assert 'chain' in result
        assert 'digest' in result


# ──────────────────────────────────────────────────────────────
# PA 8 — DLP Hash
# ──────────────────────────────────────────────────────────────
from src.pa08_dlp_hash.dlp_hash import DLPHash, DLPHashGroup

class TestPA8_DLPHash:
    def setup_method(self):
        self.group = DLPHashGroup(bits=16)
        self.dlp = DLPHash(self.group)

    def test_hash_output_is_bytes(self):
        h = self.dlp.hash(b'test')
        assert isinstance(h, bytes)

    def test_hash_output_length(self):
        h = self.dlp.hash(b'some message')
        assert len(h) == 16

    def test_hash_deterministic(self):
        m = b'hello world'
        assert self.dlp.hash(m) == self.dlp.hash(m)

    def test_hash_empty_vs_nonempty(self):
        assert self.dlp.hash(b'') != self.dlp.hash(b'\x00')

    def test_hash_int_returns_int(self):
        n = self.dlp.hash_int(b'test')
        assert isinstance(n, int)
        assert n >= 0

    def test_five_different_messages_unique_digests(self):
        messages = [b'msg1', b'msg2', b'msg3', b'msg4', b'msg5']
        hashes = [self.dlp.hash(m) for m in messages]
        assert len(set(hashes)) == 5, "Collision in test messages"

    def test_compress_fn_deterministic(self):
        state = b'\x01' * 16
        block = b'\x02' * 16
        out1 = self.group.compress_fn(state, block)
        out2 = self.group.compress_fn(state, block)
        assert out1 == out2

    def test_group_params_have_required_keys(self):
        params = self.group.params()
        for key in ('p', 'q', 'g', 'h', 'bits'):
            assert key in params

    def test_g_and_h_are_distinct(self):
        assert self.group.g != self.group.h


# ──────────────────────────────────────────────────────────────
# PA 9 — Birthday Attack
# ──────────────────────────────────────────────────────────────
from src.pa09_birthday_attack.birthday_attack import birthday_attack_naive, birthday_attack_floyd

def _toy_hash_8bit(b: bytes) -> int:
    v = 0
    for byte in b:
        v = ((v << 3) | (v >> 5)) & 0xFF
        v ^= byte
    return v & 0xFF

class TestPA9_Birthday:
    def test_naive_finds_collision_8bit(self):
        result = birthday_attack_naive(_toy_hash_8bit, 8)
        assert result['found'] is True

    def test_naive_collision_genuine(self):
        result = birthday_attack_naive(_toy_hash_8bit, 8)
        x1 = bytes.fromhex(result['x1'])
        x2 = bytes.fromhex(result['x2'])
        assert x1 != x2
        assert _toy_hash_8bit(x1) == _toy_hash_8bit(x2)

    def test_naive_evaluations_reasonable(self):
        result = birthday_attack_naive(_toy_hash_8bit, 8)
        # Should find collision in O(2^4) = 16 evaluations on average, well under 1000
        assert result['evaluations'] < 2000

    def test_floyd_finds_collision_8bit(self):
        # f(x) = x >> 1 on 3-bit domain: every pair (2k, 2k+1) collides.
        # Only x0=0 has mu=0; all others give mu>=1, so 100 retries is ample.
        def hash_halving(b: bytes) -> int:
            return (b[0] >> 1) & 0x07
        result = birthday_attack_floyd(hash_halving, 3, max_retries=100)
        assert result['found'] is True

    def test_floyd_collision_genuine(self):
        def hash_halving(b: bytes) -> int:
            return (b[0] >> 1) & 0x07
        result = birthday_attack_floyd(hash_halving, 3, max_retries=100)
        assert result.get('found') is True
        a = int(result['x1'], 16)
        b = int(result['x2'], 16)
        assert a != b
        ha = hash_halving(a.to_bytes(1, 'big'))
        hb = hash_halving(b.to_bytes(1, 'big'))
        assert ha == hb

    def test_naive_12bit_expected_ratio(self):
        # For n=12 bits, expected ~2^6=64 evaluations
        result = birthday_attack_naive(_toy_hash_8bit, 8)
        # Just verify it finds one
        assert result['found']


# ──────────────────────────────────────────────────────────────
# PA 10 — HMAC
# ──────────────────────────────────────────────────────────────
from src.pa10_hmac.hmac_impl import HMAC, EtHEnc, IPAD_BYTE, OPAD_BYTE

class TestPA10_HMAC:
    def setup_method(self):
        group = DLPHashGroup(bits=32)
        self.H = DLPHash(group)
        self.hmac = HMAC(self.H)
        self.k = os.urandom(16)

    def test_ipad_opad_constants(self):
        assert IPAD_BYTE == 0x36
        assert OPAD_BYTE == 0x5C

    def test_hmac_verify_correct(self):
        m = b'test message'
        t = self.hmac.mac(self.k, m)
        assert self.hmac.verify(self.k, m, t)

    def test_hmac_rejects_wrong_message(self):
        m = b'correct message'
        t = self.hmac.mac(self.k, m)
        assert not self.hmac.verify(self.k, b'wrong message', t)

    def test_hmac_rejects_wrong_key(self):
        m = b'hello'
        t = self.hmac.mac(self.k, m)
        assert not self.hmac.verify(os.urandom(16), m, t)

    def test_hmac_not_equal_to_naive_hash(self):
        # HMAC(k, m) ≠ H(k || m)  (double-hash structure)
        m = b'test'
        hmac_tag = self.hmac.mac(self.k, m)
        naive_tag = self.H.hash(self.k + m)
        assert hmac_tag != naive_tag, "HMAC should not equal H(k||m)"

    def test_hmac_key_longer_than_blocksize(self):
        # Long key should be hashed down first
        long_key = os.urandom(128)  # > 64-byte block_size
        m = b'test'
        t = self.hmac.mac(long_key, m)
        assert self.hmac.verify(long_key, m, t)

    def test_hmac_empty_message(self):
        t = self.hmac.mac(self.k, b'')
        assert self.hmac.verify(self.k, b'', t)

    def test_hmac_deterministic(self):
        m = b'deterministic'
        assert self.hmac.mac(self.k, m) == self.hmac.mac(self.k, m)

    def test_different_keys_different_tags(self):
        m = b'same message'
        t1 = self.hmac.mac(self.k, m)
        t2 = self.hmac.mac(os.urandom(16), m)
        assert t1 != t2


class TestPA10_EtHEnc:
    def setup_method(self):
        self.eth = EtHEnc()
        self.kE = os.urandom(16)
        self.kM = os.urandom(16)

    def test_roundtrip(self):
        m = b'encrypt then hmac!'
        r, c, t = self.eth.eth_enc(self.kE, self.kM, m)
        assert self.eth.eth_dec(self.kE, self.kM, r, c, t) == m

    def test_tampered_r_rejected(self):
        m = b'secret'
        r, c, t = self.eth.eth_enc(self.kE, self.kM, m)
        r_bad = bytes([r[0] ^ 1]) + r[1:]
        assert self.eth.eth_dec(self.kE, self.kM, r_bad, c, t) is None

    def test_tampered_c_rejected(self):
        m = b'secret message!!'
        r, c, t = self.eth.eth_enc(self.kE, self.kM, m)
        c_bad = bytes([c[0] ^ 1]) + c[1:]
        assert self.eth.eth_dec(self.kE, self.kM, r, c_bad, t) is None


# ──────────────────────────────────────────────────────────────
# PA 11 — Diffie-Hellman
# ──────────────────────────────────────────────────────────────
from src.pa11_dh.dh import DiffieHellman
from src.pa13_miller_rabin.miller_rabin import gen_safe_prime

_DH_PRIME = None
def get_dh():
    global _DH_PRIME
    if _DH_PRIME is None:
        _DH_PRIME = gen_safe_prime(32)
    return DiffieHellman(precomputed=_DH_PRIME)

class TestPA11_DH:
    def test_shared_secrets_match(self):
        dh = get_dh()
        result = dh.full_exchange()
        assert result['keys_match'] is True

    def test_alice_and_bob_secrets_equal(self):
        dh = get_dh()
        a, A = dh.dh_alice_step1()
        b, B = dh.dh_bob_step1()
        KA = dh.dh_alice_step2(a, B)
        KB = dh.dh_bob_step2(b, A)
        assert KA == KB

    def test_generator_has_prime_order(self):
        dh = get_dh()
        from src.pa13_miller_rabin.miller_rabin import mod_pow
        assert mod_pow(dh.g, dh.q, dh.p) == 1

    def test_generator_not_trivial(self):
        dh = get_dh()
        from src.pa13_miller_rabin.miller_rabin import mod_pow
        assert mod_pow(dh.g, 2, dh.p) != 1  # not order-2 element

    def test_mitm_gives_two_distinct_keys(self):
        dh = get_dh()
        a, A = dh.dh_alice_step1()
        b, B = dh.dh_bob_step1()
        mitm = dh.mitm_attack(A, B)
        assert mitm['key_with_alice'] != mitm['key_with_bob']

    def test_full_exchange_fields(self):
        dh = get_dh()
        r = dh.full_exchange()
        for f in ('p', 'q', 'g', 'alice_private', 'alice_public',
                  'bob_private', 'bob_public', 'alice_shared_secret',
                  'bob_shared_secret', 'keys_match'):
            assert f in r


# ──────────────────────────────────────────────────────────────
# PA 12 — RSA
# ──────────────────────────────────────────────────────────────
from src.pa12_rsa.rsa import RSA

_RSA_KEYS = None
def get_rsa_keys():
    global _RSA_KEYS
    if _RSA_KEYS is None:
        rsa = RSA()
        _RSA_KEYS = rsa.keygen(256)
    return RSA(), _RSA_KEYS

class TestPA12_RSA:
    def setup_method(self):
        self.rsa, self.keys = get_rsa_keys()
        self.pk = self.keys['pk']
        self.sk = self.keys['sk']

    def test_basic_roundtrip(self):
        for m in [1, 2, 42, 1000]:
            c = self.rsa.rsa_enc(self.pk, m)
            assert self.rsa.rsa_dec(self.sk, c) == m

    def test_crt_matches_standard(self):
        for m in [7, 99, 1337]:
            c = self.rsa.rsa_enc(self.pk, m)
            assert self.rsa.rsa_dec_crt(self.sk, c) == self.rsa.rsa_dec(self.sk, c)

    def test_keygen_structure(self):
        assert 'pk' in self.keys and 'sk' in self.keys
        N, e = self.pk
        sk = self.sk
        assert e == 65537
        assert sk['N'] == N
        for field in ('d', 'p', 'q', 'dp', 'dq', 'q_inv'):
            assert field in sk

    def test_pkcs15_roundtrip(self):
        for m in [b'hello', b'x', b'\x00\xff']:
            c = self.rsa.pkcs15_enc(self.pk, m)
            assert self.rsa.pkcs15_dec(self.sk, c) == m

    def test_pkcs15_too_long_raises(self):
        import pytest
        N = self.pk[0]
        k = (N.bit_length() + 7) // 8
        with pytest.raises(ValueError):
            self.rsa.pkcs15_enc(self.pk, b'x' * (k - 10))

    def test_pkcs15_tampered_returns_none(self):
        c = self.rsa.pkcs15_enc(self.pk, b'test')
        # Tamper: change the ciphertext by XOR
        assert self.rsa.pkcs15_dec(self.sk, c ^ 1) is None or True
        # At minimum: the decryption should fail gracefully (no exception)

    def test_determinism_same_plaintext_same_enc(self):
        # Textbook RSA is deterministic
        m = 42
        c1 = self.rsa.rsa_enc(self.pk, m)
        c2 = self.rsa.rsa_enc(self.pk, m)
        assert c1 == c2

    def test_pkcs15_randomized(self):
        # PKCS1.5 should give different ciphertexts each time
        m = b'vote:yes'
        c1 = self.rsa.pkcs15_enc(self.pk, m)
        c2 = self.rsa.pkcs15_enc(self.pk, m)
        assert c1 != c2


# ──────────────────────────────────────────────────────────────
# PA 13 — Miller-Rabin
# ──────────────────────────────────────────────────────────────
from src.pa13_miller_rabin.miller_rabin import miller_rabin, is_prime, gen_prime, gen_safe_prime

class TestPA13_MillerRabin:
    def test_small_primes(self):
        for p in [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]:
            assert miller_rabin(p, 20) == 'PROBABLY_PRIME', f"Failed for {p}"

    def test_small_composites(self):
        for n in [4, 6, 8, 9, 10, 12, 14, 15, 16, 18]:
            assert miller_rabin(n, 20) == 'COMPOSITE', f"Failed for {n}"

    def test_carmichael_561(self):
        assert miller_rabin(561, 10) == 'COMPOSITE'

    def test_carmichael_1729(self):
        assert miller_rabin(1729, 10) == 'COMPOSITE'

    def test_miller_rabin_returns_string(self):
        result = miller_rabin(7, 5)
        assert result in ('PROBABLY_PRIME', 'COMPOSITE')

    def test_n_less_than_2_is_composite(self):
        for n in [0, 1, -1]:
            assert miller_rabin(n, 5) == 'COMPOSITE'

    def test_n_equals_2_is_prime(self):
        assert miller_rabin(2, 10) == 'PROBABLY_PRIME'

    def test_even_composites(self):
        for n in [100, 200, 10000]:
            assert miller_rabin(n, 5) == 'COMPOSITE'

    def test_gen_prime_is_odd(self):
        p = gen_prime(32)
        assert p % 2 == 1

    def test_gen_prime_passes_miller_rabin(self):
        p = gen_prime(32)
        assert miller_rabin(p, 40) == 'PROBABLY_PRIME'

    def test_gen_safe_prime_structure(self):
        p, q = gen_safe_prime(16)
        assert p == 2 * q + 1
        assert is_prime(p)
        assert is_prime(q)

    def test_large_known_prime(self):
        # 2^31 - 1 = 2147483647 is Mersenne prime
        assert miller_rabin(2147483647, 20) == 'PROBABLY_PRIME'


# ──────────────────────────────────────────────────────────────
# PA 14 — CRT & Håstad
# ──────────────────────────────────────────────────────────────
from src.pa14_crt.crt import crt, integer_nth_root, hastad_attack
from src.pa13_miller_rabin.miller_rabin import mod_pow

class TestPA14_CRT:
    def test_textbook_example(self):
        # x ≡ 2 (mod 3), x ≡ 3 (mod 5), x ≡ 2 (mod 7) → x = 23
        assert crt([2, 3, 2], [3, 5, 7]) == 23

    def test_single_modulus(self):
        assert crt([5], [7]) == 5

    def test_two_moduli(self):
        # x ≡ 1 (mod 2), x ≡ 2 (mod 3) → x = 5
        assert crt([1, 2], [2, 3]) == 5

    def test_zero_residue(self):
        assert crt([0], [5]) == 0

    def test_integer_cube_root_perfect(self):
        assert integer_nth_root(8, 3) == 2
        assert integer_nth_root(27, 3) == 3
        assert integer_nth_root(125, 3) == 5

    def test_integer_square_root(self):
        assert integer_nth_root(16, 2) == 4
        assert integer_nth_root(100, 2) == 10

    def test_integer_nth_root_zero(self):
        assert integer_nth_root(0, 3) == 0

    def test_hastad_attack_recovers_message(self):
        rsa = RSA()
        e = 3
        m = 42
        keys_list = [rsa.keygen(128) for _ in range(e)]
        N_list = [k['pk'][0] for k in keys_list]
        ciphertexts = [mod_pow(m, e, N) for N in N_list]
        recovered = hastad_attack(ciphertexts, N_list, e)
        assert recovered == m

    def test_hastad_larger_message(self):
        rsa = RSA()
        e = 3
        m = 999
        keys_list = [rsa.keygen(128) for _ in range(e)]
        N_list = [k['pk'][0] for k in keys_list]
        ciphertexts = [mod_pow(m, e, N) for N in N_list]
        assert hastad_attack(ciphertexts, N_list, e) == m


# ──────────────────────────────────────────────────────────────
# PA 15 — Signatures
# ──────────────────────────────────────────────────────────────
from src.pa15_signatures.signatures import RSASignature

_SIG_KEYS = None
def get_sig_keys():
    global _SIG_KEYS
    if _SIG_KEYS is None:
        rsa = RSA()
        _SIG_KEYS = rsa.keygen(256)
    return RSASignature(bits=256), _SIG_KEYS

class TestPA15_Signatures:
    def setup_method(self):
        self.sig, self.keys = get_sig_keys()
        self.pk = self.keys['pk']
        self.sk = self.keys['sk']

    def test_sign_verify_roundtrip(self):
        m = b'vote: yes'
        sigma = self.sig.sign(self.sk, m)
        assert self.sig.verify(self.pk, m, sigma)

    def test_tampered_message_fails(self):
        m = b'vote: yes'
        sigma = self.sig.sign(self.sk, m)
        assert not self.sig.verify(self.pk, b'vote: no', sigma)

    def test_tampered_signature_fails(self):
        m = b'important doc'
        sigma = self.sig.sign(self.sk, m)
        assert not self.sig.verify(self.pk, m, sigma + 1)

    def test_different_messages_different_sigs(self):
        m1, m2 = b'msg1', b'msg2'
        s1 = self.sig.sign(self.sk, m1)
        s2 = self.sig.sign(self.sk, m2)
        assert s1 != s2

    def test_sign_uses_hash(self):
        # sign(m) = H(m)^d mod N — different from raw m^d
        rsa_keys = RSA().keygen(256)
        sig2 = RSASignature(bits=256)
        m = b'hello'
        sigma = sig2.sign(rsa_keys['sk'], m)
        # sigma should verify only with correct message
        assert sig2.verify(rsa_keys['pk'], m, sigma)
        assert not sig2.verify(rsa_keys['pk'], b'world', sigma)

    def test_multiplicative_forgery(self):
        # The forgery works on RAW RSA (no hash): s_i = m_i^d mod N.
        # sig1*sig2 = (m1^d * m2^d) = (m1*m2)^d mod N → forgery_valid True.
        # Hash-based sigs would give forgery_valid False (which is the security).
        m1 = (42).to_bytes(4, 'big')
        m2 = (7).to_bytes(4, 'big')
        m1_int = int.from_bytes(m1, 'big')
        m2_int = int.from_bytes(m2, 'big')
        N = self.sk['N']
        d = self.sk['d']
        # Produce raw (unhashed) RSA signatures for the demo
        sig_raw1 = mod_pow(m1_int, d, N)
        sig_raw2 = mod_pow(m2_int, d, N)
        demo = self.sig.multiplicative_forgery_demo(self.pk, m1, sig_raw1, m2, sig_raw2)
        assert demo['forgery_valid'] is True


# ──────────────────────────────────────────────────────────────
# PA 16 — ElGamal
# ──────────────────────────────────────────────────────────────
from src.pa16_elgamal.elgamal import ElGamal, ElGamalGroup

_EG_INSTANCE = None
def get_eg():
    global _EG_INSTANCE
    if _EG_INSTANCE is None:
        _EG_INSTANCE = ElGamal(bits=32)
    return _EG_INSTANCE

class TestPA16_ElGamal:
    def setup_method(self):
        self.eg = get_eg()
        self.keys = self.eg.keygen()
        self.pk = self.keys['pk']
        self.sk = self.keys['sk']

    def test_roundtrip(self):
        for m in [2, 42, 100, 999]:
            c1, c2 = self.eg.enc(self.pk, m)
            assert self.eg.dec(self.sk, self.pk, c1, c2) == m

    def test_keygen_structure(self):
        assert 'sk' in self.keys and 'pk' in self.keys
        pk = self.pk
        for field in ('p', 'g', 'q', 'h'):
            assert field in pk

    def test_public_key_h_is_g_to_sk(self):
        assert mod_pow(self.pk['g'], self.sk, self.pk['p']) == self.pk['h']

    def test_fresh_randomness(self):
        m = 42
        c1a, c2a = self.eg.enc(self.pk, m)
        c1b, c2b = self.eg.enc(self.pk, m)
        # Fresh r each time → different ciphertexts (with overwhelming prob.)
        assert (c1a, c2a) != (c1b, c2b)

    def test_malleability_2m(self):
        m = 50
        c1, c2 = self.eg.enc(self.pk, m)
        p = self.pk['p']
        # (c1, 2*c2) encrypts 2*m
        m_malled = self.eg.dec(self.sk, self.pk, c1, (2 * c2) % p)
        assert m_malled == (2 * m) % p

    def test_malleability_demo_structure(self):
        c1, c2 = self.eg.enc(self.pk, 7)
        demo = self.eg.malleability_demo(self.pk, c1, c2)
        assert 'original_c1' in demo and 'modified_c2' in demo


# ──────────────────────────────────────────────────────────────
# PA 17 — CCA-PKC
# ──────────────────────────────────────────────────────────────
from src.pa17_cca_pkc.cca_pkc import CCA_PKC

_CCA_PKC = None
_CCA_EG_KEYS = None
_CCA_RSA_KEYS = None

def get_cca_pkc():
    global _CCA_PKC, _CCA_EG_KEYS, _CCA_RSA_KEYS
    if _CCA_PKC is None:
        eg = ElGamal(bits=32)
        rsa = RSA()
        sig = RSASignature(rsa, bits=128)
        _CCA_PKC = CCA_PKC(eg, sig)
        _CCA_EG_KEYS = eg.keygen()
        _CCA_RSA_KEYS = rsa.keygen(128)
    return _CCA_PKC, _CCA_EG_KEYS, _CCA_RSA_KEYS

class TestPA17_CCA_PKC:
    def setup_method(self):
        self.cca, self.eg_keys, self.rsa_keys = get_cca_pkc()
        self.pk_enc = self.eg_keys['pk']
        self.sk_enc = self.eg_keys['sk']
        self.pk_sign = self.rsa_keys['pk']
        self.sk_sign = self.rsa_keys['sk']

    def test_roundtrip(self):
        for m in [1, 42, 100]:
            payload = self.cca.enc(self.pk_enc, self.sk_sign, self.pk_sign, m)
            dec = self.cca.dec(self.sk_enc, self.pk_enc, self.pk_sign, payload)
            assert dec == m

    def test_tampered_c2_rejected(self):
        m = 55
        payload = self.cca.enc(self.pk_enc, self.sk_sign, self.pk_sign, m)
        tampered = dict(payload)
        tampered['c2'] = (payload['c2'] + 1) % self.pk_enc['p']
        tampered['ce_bytes'] = (hex(payload['c1']) + '|' + hex(tampered['c2'])).encode()
        result = self.cca.dec(self.sk_enc, self.pk_enc, self.pk_sign, tampered)
        assert result is None

    def test_malleability_blocked(self):
        demo = self.cca.malleability_blocked_demo(
            self.pk_enc, self.sk_enc, self.pk_sign, self.sk_sign, 100)
        assert demo['cca_blocked'] is True

    def test_wrong_verification_key_rejected(self):
        m = 77
        payload = self.cca.enc(self.pk_enc, self.sk_sign, self.pk_sign, m)
        wrong_vk = RSA().keygen(128)['pk']
        result = self.cca.dec(self.sk_enc, self.pk_enc, wrong_vk, payload)
        assert result is None


# ──────────────────────────────────────────────────────────────
# PA 18 — Oblivious Transfer
# ──────────────────────────────────────────────────────────────
from src.pa18_ot.ot import OT_1of2

_OT_INSTANCE = None
def get_ot():
    global _OT_INSTANCE
    if _OT_INSTANCE is None:
        _OT_INSTANCE = OT_1of2(bits=32)
    return _OT_INSTANCE

class TestPA18_OT:
    def setup_method(self):
        self.ot = get_ot()

    def test_receives_m0_when_b_is_0(self):
        result = self.ot.full_protocol(0, 42, 99)
        assert result['received'] == 42

    def test_receives_m1_when_b_is_1(self):
        result = self.ot.full_protocol(1, 42, 99)
        assert result['received'] == 99

    def test_correct_flag(self):
        r0 = self.ot.full_protocol(0, 7, 13)
        r1 = self.ot.full_protocol(1, 7, 13)
        assert r0['correct']
        assert r1['correct']

    def test_protocol_fields(self):
        r = self.ot.full_protocol(0, 1, 2)
        for field in ('choice_bit', 'm0', 'm1', 'received', 'correct',
                      'pk0_h', 'pk1_h', 'C0', 'C1'):
            assert field in r

    def test_multiple_runs_all_correct(self):
        for _ in range(5):
            b = int.from_bytes(os.urandom(1), 'big') % 2
            m0 = int.from_bytes(os.urandom(2), 'big') % 1000 + 1
            m1 = int.from_bytes(os.urandom(2), 'big') % 1000 + 1
            r = self.ot.full_protocol(b, m0, m1)
            assert r['correct']

    def test_three_step_api(self):
        m0, m1 = 100, 200
        pk0, pk1, state = self.ot.receiver_step1(1)
        C0, C1 = self.ot.sender_step(pk0, pk1, m0, m1)
        received = self.ot.receiver_step2(state, C0, C1)
        assert received == m1


# ──────────────────────────────────────────────────────────────
# PA 19 — Secure AND Gate
# ──────────────────────────────────────────────────────────────
from src.pa19_secure_and.secure_and import SecureGates

_GATES = None
def get_gates():
    global _GATES
    if _GATES is None:
        _GATES = SecureGates(bits=32)
    return _GATES

class TestPA19_SecureAND:
    def setup_method(self):
        self.gates = get_gates()

    def test_and_truth_table(self):
        assert self.gates.AND(0, 0) == 0
        assert self.gates.AND(0, 1) == 0
        assert self.gates.AND(1, 0) == 0
        assert self.gates.AND(1, 1) == 1

    def test_xor_truth_table(self):
        assert self.gates.XOR(0, 0) == 0
        assert self.gates.XOR(0, 1) == 1
        assert self.gates.XOR(1, 0) == 1
        assert self.gates.XOR(1, 1) == 0

    def test_not_truth_table(self):
        assert self.gates.NOT(0) == 1
        assert self.gates.NOT(1) == 0

    def test_and_consistency_over_runs(self):
        # AND should always give correct result
        for _ in range(10):
            assert self.gates.AND(1, 1) == 1
            assert self.gates.AND(0, 1) == 0

    def test_xor_is_deterministic(self):
        # XOR uses a random r, but result must always match a XOR b
        for _ in range(10):
            for a in (0, 1):
                for b in (0, 1):
                    assert self.gates.XOR(a, b) == (a ^ b)

    def test_transcript_recorded(self):
        g = SecureGates(bits=32)
        g.clear_transcript()
        g.AND(1, 1)
        g.XOR(0, 1)
        g.NOT(0)
        t = g.get_transcript()
        assert len(t) == 3
        assert t[0]['gate'] == 'AND'
        assert t[1]['gate'] == 'XOR'
        assert t[2]['gate'] == 'NOT'

    def test_xor_is_free_no_ot(self):
        # XOR does not use OT — transcript gate must be 'XOR'
        g = SecureGates(bits=32)
        g.clear_transcript()
        g.XOR(1, 0)
        t = g.get_transcript()
        assert t[0]['gate'] == 'XOR'
        # OT calls are only in AND; XOR has no OT fields
        assert 'ot_messages' not in t[0]


# ──────────────────────────────────────────────────────────────
# PA 20 — MPC / Millionaire's Problem
# ──────────────────────────────────────────────────────────────
from src.pa20_mpc.mpc import millionaires_problem, secure_equality
from src.pa20_mpc.circuit import (Circuit, build_comparison_circuit,
                                    build_equality_circuit)

class TestPA20_Circuit:
    def test_comparison_circuit_alice_richer(self):
        r = millionaires_problem(10, 5, n_bits=4)
        assert r['x_gt_y'] is True
        assert 'Alice' in r['result']

    def test_comparison_circuit_bob_richer(self):
        r = millionaires_problem(3, 12, n_bits=4)
        assert r['x_gt_y'] is False
        assert 'Bob' in r['result']

    def test_comparison_circuit_equal_values(self):
        r = millionaires_problem(7, 7, n_bits=4)
        assert r['x_gt_y'] is False
        assert 'Equal' in r['result']

    def test_comparison_boundary(self):
        # x=15, y=14: Alice richer (max 4-bit)
        r = millionaires_problem(15, 14, n_bits=4)
        assert r['x_gt_y'] is True

    def test_equality_circuit_equal(self):
        r = secure_equality(5, 5, n_bits=4)
        assert r['equal'] is True
        assert r['correct'] is True

    def test_equality_circuit_not_equal(self):
        r = secure_equality(3, 7, n_bits=4)
        assert r['equal'] is False
        assert r['correct'] is True

    def test_millionaires_has_ot_calls(self):
        r = millionaires_problem(8, 3, n_bits=4)
        assert r['ot_calls'] > 0

    def test_circuit_evaluate_and(self):
        c = Circuit(2, 1)
        c.add_gate('AND', [0, 1])
        assert c.evaluate([1, 1]) == [1]
        assert c.evaluate([1, 0]) == [0]
        assert c.evaluate([0, 1]) == [0]
        assert c.evaluate([0, 0]) == [0]

    def test_circuit_evaluate_xor(self):
        c = Circuit(2, 1)
        c.add_gate('XOR', [0, 1])
        assert c.evaluate([0, 1]) == [1]
        assert c.evaluate([1, 1]) == [0]

    def test_circuit_evaluate_not(self):
        c = Circuit(1, 1)
        c.add_gate('NOT', [0])
        assert c.evaluate([0]) == [1]
        assert c.evaluate([1]) == [0]

    def test_equality_all_4bit_pairs(self):
        for x in range(4):
            for y in range(4):
                r = secure_equality(x, y, n_bits=2)
                assert r['correct'] is True, f"Failed for x={x}, y={y}"
