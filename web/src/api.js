const BASE = '/api';

export async function post(endpoint, body = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export async function get(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export const api = {
  owf: { evaluate: (value) => post('/owf/evaluate', { value }) },
  prg: { generate: (seed_hex, length) => post('/prg/generate', { seed_hex, length }) },
  prf: {
    evaluate: (key_hex, input_hex, depth, prf_type) => post('/prf/evaluate', { key_hex, input_hex, depth, prf_type }),
    ggm_tree: (key_hex, input_hex, depth) => post('/prf/ggm_tree', { key_hex, input_hex, depth }),
  },
  enc: {
    cpa: (key_hex, message_hex) => post('/enc/cpa', { key_hex, message_hex }),
    dec: (key_hex, r_hex, c_hex) => post('/enc/dec', { key_hex, r_hex, c_hex }),
  },
  modes: {
    encrypt: (mode, key_hex, message_hex, iv_hex) =>
      post(`/modes/${mode}/encrypt`, { mode, key_hex, message_hex, iv_hex }),
    encryptBlocks: (mode, key_hex, message_hex, iv_hex) =>
      post('/modes/encrypt_blocks', { mode, key_hex, message_hex, iv_hex }),
    flipAndDecrypt: (mode, key_hex, iv_hex, ciphertext_hex, block_index) =>
      post('/modes/flip_and_decrypt', { mode, key_hex, iv_hex, ciphertext_hex, block_index }),
  },
  mac: {
    sign: (key_hex, message_hex) => post('/mac/sign', { key_hex, message_hex }),
    verify: (key_hex, message_hex, tag_hex) => post('/mac/verify', { key_hex, message_hex, tag_hex }),
  },
  cca: {
    encrypt: (ke_hex, km_hex, message_hex) => post('/cca/encrypt', { ke_hex, km_hex, message_hex }),
  },
  hash: {
    dlp: (message_hex) => post('/hash/dlp', { message_hex }),
    md: (message_hex) => post('/hash/merkle_damgard', { message_hex }),
  },
  birthday: { attack: (n_bits) => post('/birthday/attack', { n_bits }) },
  hmac: {
    sign: (key_hex, message_hex) => post('/hmac/sign', { key_hex, message_hex }),
    verify: (key_hex, message_hex, tag_hex) => post('/hmac/verify', { key_hex, message_hex, tag_hex }),
    lengthExtension: (key_hex, message_hex, suffix_hex) => post('/hmac/length_extension', { key_hex, message_hex, suffix_hex }),
  },
  dh: {
    exchange: (bits = 32) => post('/dh/exchange', { bits }),
    exchangeCustom: (alice_priv_hex, bob_priv_hex, bits = 32) =>
      post('/dh/exchange_custom', { alice_priv_hex, bob_priv_hex, bits }),
  },
  rsa: {
    keygen: (bits = 128) => post('/rsa/keygen', { bits }),
    encrypt: (N_hex, e, m) => post('/rsa/encrypt', { N_hex, e, m }),
  },
  millerRabin: {
    test: (n, k = 20) => post('/miller_rabin/test', { n, k }),
    genPrime: (bits = 64) => post('/miller_rabin/gen_prime', { bits }),
  },
  crt: { solve: (residues, moduli) => post('/crt/solve', { residues, moduli }) },
  sig: { sign: (key_hex, message_hex) => post('/sig/sign', { key_hex, message_hex }) },
  elgamal: {
    keygen: () => post('/elgamal/keygen', {}),
    encrypt: (N_hex, e, m) => post('/elgamal/encrypt', { N_hex, e, m }),
  },
  ot: { run: (b, m0, m1) => post('/ot/run', { b, m0, m1 }) },
  secureAnd: { compute: (a, b) => post('/secure_and/compute', { a, b }) },
  mpc: { millionaire: (x, y, n_bits = 4) => post('/mpc/millionaire', { x, y, n_bits }) },
  reduce: Object.assign(
    (source, target, foundation = 'AES') => post('/reduce', { source, target, foundation }),
    { all: () => get('/reduce/all') }
  ),
};
