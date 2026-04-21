"""
PA#2 — AES-128 from scratch.
No external cryptographic libraries used.
Implements: SubBytes, ShiftRows, MixColumns, AddRoundKey, KeySchedule.
"""

# ── S-box (forward) ──────────────────────────────────────────────────────────
SBOX = [
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
]

# ── Inverse S-box ────────────────────────────────────────────────────────────
INV_SBOX = [0] * 256
for i, v in enumerate(SBOX):
    INV_SBOX[v] = i

# ── Round constants (Rcon) ───────────────────────────────────────────────────
RCON = [0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36]

# ── GF(2^8) multiplication (irreducible poly 0x11b) ─────────────────────────
def _xtime(a: int) -> int:
    return ((a << 1) ^ 0x1b) & 0xff if a & 0x80 else (a << 1) & 0xff

def _gf_mul(a: int, b: int) -> int:
    result = 0
    for _ in range(8):
        if b & 1:
            result ^= a
        a = _xtime(a)
        b >>= 1
    return result & 0xff

# ── State helpers ────────────────────────────────────────────────────────────
def _bytes_to_state(b: bytes) -> list:
    """Convert 16 bytes to 4x4 column-major state matrix."""
    s = [[0]*4 for _ in range(4)]
    for r in range(4):
        for c in range(4):
            s[r][c] = b[r + 4*c]
    return s

def _state_to_bytes(s: list) -> bytes:
    out = []
    for c in range(4):
        for r in range(4):
            out.append(s[r][c])
    return bytes(out)

# ── AES round operations ─────────────────────────────────────────────────────
def _sub_bytes(state: list) -> list:
    return [[SBOX[state[r][c]] for c in range(4)] for r in range(4)]

def _inv_sub_bytes(state: list) -> list:
    return [[INV_SBOX[state[r][c]] for c in range(4)] for r in range(4)]

def _shift_rows(state: list) -> list:
    return [
        [state[0][0], state[0][1], state[0][2], state[0][3]],
        [state[1][1], state[1][2], state[1][3], state[1][0]],
        [state[2][2], state[2][3], state[2][0], state[2][1]],
        [state[3][3], state[3][0], state[3][1], state[3][2]],
    ]

def _inv_shift_rows(state: list) -> list:
    return [
        [state[0][0], state[0][1], state[0][2], state[0][3]],
        [state[1][3], state[1][0], state[1][1], state[1][2]],
        [state[2][2], state[2][3], state[2][0], state[2][1]],
        [state[3][1], state[3][2], state[3][3], state[3][0]],
    ]

def _mix_columns(state: list) -> list:
    new_state = [[0]*4 for _ in range(4)]
    for c in range(4):
        s0, s1, s2, s3 = state[0][c], state[1][c], state[2][c], state[3][c]
        new_state[0][c] = _gf_mul(2,s0) ^ _gf_mul(3,s1) ^ s2 ^ s3
        new_state[1][c] = s0 ^ _gf_mul(2,s1) ^ _gf_mul(3,s2) ^ s3
        new_state[2][c] = s0 ^ s1 ^ _gf_mul(2,s2) ^ _gf_mul(3,s3)
        new_state[3][c] = _gf_mul(3,s0) ^ s1 ^ s2 ^ _gf_mul(2,s3)
    return new_state

def _inv_mix_columns(state: list) -> list:
    new_state = [[0]*4 for _ in range(4)]
    for c in range(4):
        s0, s1, s2, s3 = state[0][c], state[1][c], state[2][c], state[3][c]
        new_state[0][c] = _gf_mul(0x0e,s0) ^ _gf_mul(0x0b,s1) ^ _gf_mul(0x0d,s2) ^ _gf_mul(0x09,s3)
        new_state[1][c] = _gf_mul(0x09,s0) ^ _gf_mul(0x0e,s1) ^ _gf_mul(0x0b,s2) ^ _gf_mul(0x0d,s3)
        new_state[2][c] = _gf_mul(0x0d,s0) ^ _gf_mul(0x09,s1) ^ _gf_mul(0x0e,s2) ^ _gf_mul(0x0b,s3)
        new_state[3][c] = _gf_mul(0x0b,s0) ^ _gf_mul(0x0d,s1) ^ _gf_mul(0x09,s2) ^ _gf_mul(0x0e,s3)
    return new_state

def _add_round_key(state: list, round_key: list) -> list:
    return [[state[r][c] ^ round_key[r][c] for c in range(4)] for r in range(4)]

# ── Key Schedule ─────────────────────────────────────────────────────────────
def _key_expansion(key: bytes) -> list:
    """Expand 16-byte key into 11 round keys (each 16 bytes as 4x4 state)."""
    assert len(key) == 16, "AES-128 requires 16-byte key"
    W = []
    for i in range(4):
        W.append(list(key[4*i:4*i+4]))

    for i in range(4, 44):
        temp = list(W[i-1])
        if i % 4 == 0:
            # RotWord
            temp = temp[1:] + temp[:1]
            # SubWord
            temp = [SBOX[b] for b in temp]
            # XOR with Rcon
            temp[0] ^= RCON[i // 4]
        W.append([W[i-4][j] ^ temp[j] for j in range(4)])

    # Convert to list of 11 round key states
    round_keys = []
    for rnd in range(11):
        rk = [[0]*4 for _ in range(4)]
        for c in range(4):
            for r in range(4):
                rk[r][c] = W[rnd*4 + c][r]
        round_keys.append(rk)
    return round_keys

# ── AES-128 Encrypt ──────────────────────────────────────────────────────────
def aes_encrypt(key_bytes: bytes, plaintext_bytes: bytes) -> bytes:
    """AES-128 encrypt a single 16-byte block."""
    assert len(key_bytes) == 16, "Key must be 16 bytes"
    assert len(plaintext_bytes) == 16, "Plaintext must be 16 bytes"

    round_keys = _key_expansion(key_bytes)
    state = _bytes_to_state(plaintext_bytes)
    state = _add_round_key(state, round_keys[0])

    for rnd in range(1, 10):
        state = _sub_bytes(state)
        state = _shift_rows(state)
        state = _mix_columns(state)
        state = _add_round_key(state, round_keys[rnd])

    # Final round (no MixColumns)
    state = _sub_bytes(state)
    state = _shift_rows(state)
    state = _add_round_key(state, round_keys[10])

    return _state_to_bytes(state)

# ── AES-128 Decrypt ──────────────────────────────────────────────────────────
def aes_decrypt(key_bytes: bytes, ciphertext_bytes: bytes) -> bytes:
    """AES-128 decrypt a single 16-byte block."""
    assert len(key_bytes) == 16, "Key must be 16 bytes"
    assert len(ciphertext_bytes) == 16, "Ciphertext must be 16 bytes"

    round_keys = _key_expansion(key_bytes)
    state = _bytes_to_state(ciphertext_bytes)
    state = _add_round_key(state, round_keys[10])

    for rnd in range(9, 0, -1):
        state = _inv_shift_rows(state)
        state = _inv_sub_bytes(state)
        state = _add_round_key(state, round_keys[rnd])
        state = _inv_mix_columns(state)

    state = _inv_shift_rows(state)
    state = _inv_sub_bytes(state)
    state = _add_round_key(state, round_keys[0])

    return _state_to_bytes(state)


if __name__ == "__main__":
    # NIST test vector
    key = bytes.fromhex("000102030405060708090a0b0c0d0e0f")
    pt  = bytes.fromhex("00112233445566778899aabbccddeeff")
    ct  = aes_encrypt(key, pt)
    print("CT:", ct.hex())
    assert ct.hex() == "69c4e0d86a7b0430d8cdb78070b4c55a", f"AES encrypt failed: {ct.hex()}"
    pt2 = aes_decrypt(key, ct)
    assert pt2 == pt, "AES decrypt failed"
    print("AES-128 self-test passed.")
