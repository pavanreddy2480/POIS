# Part 4: Advanced Public-Key Cryptography and Secure Computation — PA16 to PA20

This part covers the final frontier of the course: building from public-key encryption toward **secure multi-party computation (MPC)** — the remarkable idea that two parties can jointly compute a function over their private inputs without either party learning anything about the other's input beyond what the output itself reveals. Each PA in this group is a direct dependency of the next, forming a clean four-layer stack:

```
ElGamal (PA16)
    ↓  used by
CCA-Secure PKC (PA17)    Oblivious Transfer (PA18)
                                  ↓  used by
                         Secure Gates (PA19)
                                  ↓  used by
                      Secure Circuit Evaluation (PA20)
```

---

## PA16 — ElGamal Public-Key Cryptosystem

### What it achieves

ElGamal is a public-key encryption scheme built directly on the Diffie-Hellman key exchange. Like DH, it derives its security from the **Decisional Diffie-Hellman (DDH) assumption**: given `g^a`, `g^b`, and `g^c` in a prime-order group, it is computationally hard to distinguish whether `c = ab mod q` (a real DH tuple) from a random `c`. ElGamal achieves **IND-CPA security** — an eavesdropper cannot tell which of two chosen plaintexts was encrypted, as long as DDH holds.

Unlike RSA encryption (which is deterministic in textbook form), ElGamal is **inherently randomized**: every call to `enc` uses a fresh ephemeral exponent `r`, so the same message encrypts to a different ciphertext every time. This randomness is structurally necessary, not optional padding.

However, ElGamal is **not IND-CCA secure** — it is **malleable**. Given a ciphertext `(c1, c2)` encrypting `m`, an attacker can produce `(c1, λ*c2 mod p)` which decrypts to `λ*m`, without knowing `m` or the secret key. PA17 fixes this.

### Source: `src/pa16_elgamal/elgamal.py`

---

#### Class: `ElGamalGroup`

Encapsulates the prime-order group over which all ElGamal operations are performed.

---

#### `ElGamalGroup.__init__(self, bits=64, precomputed=None)`

**Input:** `bits` — bit length of the safe prime `p`. Optionally a precomputed `(p, q)` tuple.

**What it does:**
- Calls `gen_safe_prime(bits)` from PA13 to produce a safe prime `p = 2q + 1` and its Sophie Germain prime `q`.
- Calls `_find_generator()` to select a generator `g` of the prime-order-`q` subgroup.

**Why a safe prime?** The same reason as in PA11 DH: the prime-order subgroup of size `q` is where DDH hardness lives. Small-subgroup attacks (Pohlig-Hellman) are neutralized because the subgroup order `q` is prime and large.

---

#### `ElGamalGroup._find_generator(self) -> int`

**Input:** none (uses `self.p`, `self.q`).

**Output:** An integer `g` that generates the order-`q` subgroup of `Z_p*`.

**What it does:**
- For safe prime `p = 2q + 1`, iterates `g = 2, 3, ...`.
- Checks `g^q ≡ 1 mod p` (confirms `g` has order dividing `q`) and `g^2 ≢ 1 mod p` (excludes trivial elements with order 1 or 2).
- The first `g` satisfying both is the generator returned.

---

#### `ElGamalGroup.random_exponent(self) -> int`

**Input:** none.

**Output:** A cryptographically random integer in `(1, q)`.

**What it does:** Samples `os.urandom(nbytes)`, interprets as big-endian integer, reduces mod `q`. Retries if the result is ≤ 1. This is used for both key generation and the per-encryption ephemeral exponent.

---

#### Class: `ElGamal`

Wraps key generation, encryption, and decryption around an `ElGamalGroup`.

---

#### `ElGamal.__init__(self, group=None, bits=64)`

**Input:** Optional `ElGamalGroup` instance, or `bits` to create one.

**What it does:** Stores the group. Creates one if not provided.

---

#### `ElGamal.keygen(self) -> dict`

**Input:** none.

**Output:**
```
{
    "sk": x,              # private key — random integer in (1, q)
    "pk": {"p": p, "g": g, "q": q, "h": h}   # public key
}
```
where `h = g^x mod p`.

**What it does:**
1. Samples private key `x` as a random exponent from the group.
2. Computes `h = g^x mod p` — the public key component.
3. Returns both as a dict.

**What the key pair represents:** The private key `x` is the discrete logarithm of `h` base `g`. Anyone can compute `g^x` from `x`, but recovering `x` from `h = g^x mod p` is the discrete logarithm problem — computationally hard by assumption.

---

#### `ElGamal.enc(self, pk: dict, m: int) -> tuple`

**Input:** Public key dict `{"p", "g", "q", "h"}`, plaintext integer `m` (must be a group element in `[1, p)`).

**Output:** Ciphertext `(c1, c2)` — a pair of integers.

**What it does:**
1. Samples a fresh ephemeral exponent `r` from `group.random_exponent()`.
2. Computes `c1 = g^r mod p` — the ephemeral public value (like Alice's DH step).
3. Computes `c2 = m * h^r mod p` — the message masked with the shared secret `h^r = (g^x)^r = g^(xr)`.
4. Returns `(c1, c2)`.

**Why this encrypts `m` securely:** The receiver with private key `x` can compute `c1^x = (g^r)^x = g^(xr) = h^r`, which is the same mask. So `c2 / c1^x = m`. An eavesdropper sees `c1 = g^r` and `c2 = m * g^(xr)`, but recovering `m` requires knowing `g^(xr)`, which requires either `x` (private key) or solving the CDH problem.

**Why encryption is randomized:** The fresh `r` every call means identical plaintexts produce completely different ciphertexts. This is precisely what IND-CPA security requires — without randomness, an adversary can simply re-encrypt `m0` and `m1` and check which matches the challenge ciphertext.

---

#### `ElGamal.dec(self, sk: int, pk: dict, c1: int, c2: int) -> int`

**Input:** Private key `x` (integer), public key dict, ciphertext components `c1` and `c2`.

**Output:** Plaintext integer `m`.

**What it does:**
1. Computes `s = c1^x mod p` — recovers the shared secret `g^(xr)`.
2. Computes `s_inv = s^(-1) mod p` using `mod_inverse`.
3. Returns `c2 * s_inv mod p = (m * s) * s^(-1) = m`.

**Correctness:** `c1^x = (g^r)^x = g^(rx)` and `h^r = (g^x)^r = g^(xr) = g^(rx)`. So the receiver recomputes the exact same masking value the sender used, and divides it out.

---

#### `ElGamal.malleability_demo(self, pk: dict, c1: int, c2: int) -> dict`

**Input:** Public key dict, ciphertext `(c1, c2)`.

**Output:** Dict with:
- `original_c1`, `original_c2` — hex of the original ciphertext.
- `modified_c2` — hex of `2 * c2 mod p`.
- `note` — explanation.

**What it does:** Produces a modified ciphertext `(c1, 2*c2 mod p)`.

**Why this is devastating:** Decrypting `(c1, 2*c2)` gives:
```
(2 * c2) * (c1^x)^(-1) = 2 * (m * h^r) * (h^r)^(-1) = 2 * m
```
The attacker doubled the plaintext without knowing `m` or `x`. More generally, multiplying `c2` by any known scalar `λ` scales the decrypted message to `λ * m`. This is the **multiplicative malleability** of ElGamal.

**Security implication:** ElGamal is not IND-CCA2 secure. In a CCA game, the adversary submits the modified ciphertext to the decryption oracle, learns `2m`, and trivially identifies which message was encrypted. PA17 fixes this by attaching a signature that cannot be forged when `c2` is modified.

---

#### `ElGamal.run_cpa_game(self, pk, sk, num_rounds=20) -> dict`

**Input:** Public key, secret key, number of game rounds.

**Output:** Dict with `rounds`, `correct_guesses`, `advantage` (≈ 0.0 for a secure scheme).

**What it does:** Simulates the IND-CPA security game:
1. In each round, pick two random messages `m0`, `m1`.
2. Flip a coin `b` and encrypt `m_b`.
3. The "adversary" guesses `b` uniformly at random (cannot do better assuming DDH).
4. Count how often the guess is correct.

**What it demonstrates:** With a DDH-hard group, the adversary's advantage (deviation from 1/2 win rate) is negligible — shown empirically to be near zero over `num_rounds` rounds.

---

## PA17 — CCA-Secure Public-Key Cryptography (Signcryption)

### What it achieves

PA17 upgrades ElGamal from IND-CPA to **IND-CCA2 security** using a standard paradigm: **Encrypt-then-Sign** (also called signcryption). The idea is that any tampering with the ciphertext will invalidate the attached signature, and the decryption procedure rejects any payload whose signature does not verify. This completely blocks the malleability attack demonstrated in PA16.

The scheme combines:
- **ElGamal** (PA16) for semantically-secure encryption.
- **RSASignature** (PA15) for message authentication.

The core invariant: the decryptor verifies the signature on the *ciphertext bytes* before ever passing those bytes to the decryption algorithm. A CCA adversary who modifies the ciphertext must also forge a valid signature — which is computationally infeasible.

### Source: `src/pa17_cca_pkc/cca_pkc.py`

---

#### Class: `CCA_PKC`

#### `CCA_PKC.__init__(self, elgamal=None, sig_scheme=None)`

**Input:** Optional `ElGamal` instance, optional `RSASignature` instance.

**What it does:** Stores both sub-schemes, creating defaults (32-bit ElGamal, 128-bit RSA signatures) if not provided. The two schemes use independent key pairs: one for encryption, one for signing.

---

#### `CCA_PKC.enc(self, pk_enc, sk_sign, vk_sign, m: int) -> dict`

**Input:**
- `pk_enc` — ElGamal public key for encryption.
- `sk_sign` — RSA private key for signing (the sender's signing key).
- `vk_sign` — RSA public key for verification (included in output for reference).
- `m` — plaintext integer.

**Output:** Dict:
```
{
    "c1": int,        # ElGamal ephemeral g^r mod p
    "c2": int,        # ElGamal ciphertext m * h^r mod p
    "sigma": int,     # RSA signature over ce_bytes
    "ce_bytes": bytes # serialized (hex(c1) + "|" + hex(c2))
}
```

**What it does:**

1. **Encrypt:** Calls `ElGamal.enc(pk_enc, m)` to get `(c1, c2)`.
2. **Serialize:** Produces `ce_bytes = (hex(c1) + "|" + hex(c2)).encode()` — a canonical byte-string representation of the ciphertext. This is the string that gets signed.
3. **Sign:** Calls `RSASignature.sign(sk_sign, ce_bytes)` to produce `sigma = H(ce_bytes)^d mod N`.
4. Returns all four values in a dict.

**Why sign the ciphertext, not the plaintext?** Signing the plaintext (sign-then-encrypt) has a subtle weakness: the attacker could strip the encryption layer, read the signature, and re-encrypt to a different recipient. Signing the ciphertext (encrypt-then-sign) ties the signature to the specific encryption, preventing re-routing attacks. This is the standard construction for authenticated encryption in PKC settings.

---

#### `CCA_PKC.dec(self, sk_enc, pk_enc, vk_sign, payload: dict)`

**Input:**
- `sk_enc` — ElGamal private key (integer `x`).
- `pk_enc` — ElGamal public key dict.
- `vk_sign` — RSA verification key `(N, e)`.
- `payload` — dict with `c1`, `c2`, `sigma`, `ce_bytes`.

**Output:** Plaintext integer `m`, or `None` if signature verification fails.

**What it does:**

1. **Verify-first:** Calls `RSASignature.verify(vk_sign, ce_bytes, sigma)`. If this returns `False`, immediately returns `None` — the ciphertext is rejected without any decryption attempt.
2. **Decrypt:** Only if verification passes, calls `ElGamal.dec(sk_enc, pk_enc, c1, c2)` and returns the result.

**Why reject before decrypting?** This is the CCA2 security property. In a CCA2 game, the adversary submits modified ciphertexts to a decryption oracle. If the decryptor decrypted first and then checked the tag, timing or error side-channels could leak information about partial decryptions. Rejecting before decryption means modified ciphertexts produce zero information — there is nothing to leak.

**CCA2 argument:** Any ciphertext reaching decryption is one for which the attacker produced a valid signature. Forging an RSA signature requires inverting `H(m)^e mod N` without knowing `d` — which is computationally infeasible. So the adversary can only submit ciphertexts they themselves encrypted, which gives them no advantage in the IND-CCA2 game.

---

#### `CCA_PKC.malleability_blocked_demo(self, pk_enc, sk_enc, pk_sign, sk_sign, m) -> dict`

**Input:** Both key pairs (encryption and signing), plaintext `m`.

**Output:** Dict with:
- `original_m` — the original message.
- `tampered_c2` — hex of `2 * c2 mod p` (the malleability attempt).
- `decryption_result` — result of decrypting the tampered payload (should be `None`).
- `cca_blocked` — `True` if decryption returned `None`.
- `note` — explanation.

**What it does:**
1. Legitimately encrypts `m` to get `payload` with a valid signature on `(c1, c2)`.
2. Creates a `tampered` copy where `c2` is replaced by `2 * c2 mod p` and `ce_bytes` is recomputed to reflect the new `c2` — but the `sigma` field is left unchanged (the old signature, computed over the original `ce_bytes`).
3. Attempts to decrypt the tampered payload.

**What it demonstrates:** The old signature covers the original `ce_bytes`. The tampered payload has different `ce_bytes` (because `c2` changed), so `RSASignature.verify` returns `False`, and `dec` returns `None`. The malleability attack that succeeded against plain ElGamal is completely blocked. `cca_blocked` is `True`.

---

## PA18 — 1-out-of-2 Oblivious Transfer

### What it achieves

**Oblivious Transfer (OT)** is a two-party cryptographic protocol with a remarkable privacy property: a **sender** holds two messages `(m0, m1)` and a **receiver** holds a choice bit `b`. After the protocol:
- The receiver learns exactly `m_b` — the message corresponding to their choice.
- The receiver learns **nothing** about `m_{1-b}` — the other message is information-theoretically hidden.
- The sender learns **nothing** about `b` — they cannot tell which message was received.

OT is one of the most fundamental primitives in cryptography — it is complete for secure computation. Any two-party function can be computed with OT as the only primitive. PA18 implements the **Bellare-Micali** variant using ElGamal.

The key insight: the receiver generates **one real ElGamal key pair** (with a known secret key) and **one fake public key** (a random group element with no associated secret key). They send both to the sender, but only reveal which is "real" to themselves. The sender encrypts `m0` under the first and `m1` under the second. The receiver can decrypt exactly one.

### Source: `src/pa18_ot/ot.py`

---

#### Class: `OT_1of2`

#### `OT_1of2.__init__(self, elgamal=None, bits=32)`

**Input:** Optional `ElGamal` instance, or bit size for group generation.

**What it does:** Stores an `ElGamal` instance and the underlying `ElGamalGroup`, creating them if not provided.

---

#### `OT_1of2.receiver_step1(self, b: int) -> tuple`

**Input:** Choice bit `b` in `{0, 1}`.

**Output:** `(pk0, pk1, state)` where:
- `pk0`, `pk1` — two ElGamal-format public key dicts (share the same `p`, `g`, `q`).
- `state` — dict `{"b": b, "sk_b": x_b, "pk_enc": pk_b}` — the receiver's private state.

**What it does:**

1. **Honest key for `b`:** Samples a real private key `x_b` using `group.random_exponent()`. Computes `h_b = g^{x_b} mod p`. This is a genuine ElGamal public key — the receiver can decrypt ciphertexts encrypted under it.

2. **Fake key for `1-b`:** Samples `h_{1-b}` as a uniformly random integer in `[2, p)` — a random group element with **no associated discrete logarithm** that the receiver knows. This is computationally indistinguishable from a real public key (DDH), but there is no `x` such that `g^x = h_{1-b} mod p` that the receiver knows.

3. **Assign to positions:** If `b == 0`, `pk0 = pk_b` (real) and `pk1 = pk_{1-b}` (fake). If `b == 1`, `pk0 = pk_{1-b}` (fake) and `pk1 = pk_b` (real).

4. Returns `(pk0, pk1, state)`. The receiver sends `(pk0, pk1)` to the sender and keeps `state` private.

**Sender privacy:** From the sender's view, both `pk0` and `pk1` look like valid ElGamal public keys (under DDH). The sender cannot distinguish the real key from the fake one, so they cannot tell which message the receiver intends to decrypt — i.e., `b` is hidden from the sender.

---

#### `OT_1of2.sender_step(self, pk0: dict, pk1: dict, m0: int, m1: int) -> tuple`

**Input:** Both public keys `pk0`, `pk1` (as received from the receiver), messages `m0` and `m1`.

**Output:** `(C0, C1)` — two ElGamal ciphertexts, each a `(c1, c2)` tuple.

**What it does:**
- `C0 = ElGamal.enc(pk0, m0)` — encrypts `m0` under `pk0`.
- `C1 = ElGamal.enc(pk1, m1)` — encrypts `m1` under `pk1`.
- Returns `(C0, C1)` to the receiver.

**Receiver privacy:** The receiver only has the secret key for `pk_b`. They can decrypt `C_b = ElGamal.enc(pk_b, m_b)` and recover `m_b`. But `C_{1-b}` is encrypted under the fake key — there is no secret key for it, so decryption is impossible. The message `m_{1-b}` is computationally hidden.

---

#### `OT_1of2.receiver_step2(self, state: dict, C0: tuple, C1: tuple) -> int`

**Input:** Receiver's private state, both ciphertexts `C0` and `C1`.

**Output:** Recovered message `m_b`.

**What it does:**
- Selects `Cb = C0 if b == 0 else C1` — picks the ciphertext corresponding to the choice bit.
- Calls `ElGamal.dec(sk_b, pk_b, Cb[0], Cb[1])` using the real secret key `sk_b`.
- Returns the recovered plaintext.

**Why decryption succeeds:** `Cb` was encrypted under `pk_b`, which has a corresponding secret key `sk_b` known to the receiver. Standard ElGamal decryption recovers `m_b` exactly. The other ciphertext `C_{1-b}` was encrypted under the fake key — the receiver has no key for it and cannot decrypt it.

---

#### `OT_1of2.full_protocol(self, b: int, m0: int, m1: int) -> dict`

**Input:** Choice bit `b`, sender's messages `m0` and `m1`.

**Output:** Dict with:
- `choice_bit` — `b`.
- `m0`, `m1` — both sender messages (for test verification).
- `received` — the message the receiver got (`m_b`).
- `correct` — boolean confirming `received == m_b`.
- `pk0_h`, `pk1_h` — hex of the two public key `h` values.
- `C0`, `C1` — both ciphertexts as hex tuples.

**What it does:** Runs all three steps in sequence: `receiver_step1` → `sender_step` → `receiver_step2`, and packages the full transcript.

---

### OT Security Summary

| Property | Who is protected | Mechanism |
|----------|-----------------|-----------|
| **Sender privacy** | Sender doesn't learn `b` | Both `pk0`, `pk1` look identical under DDH |
| **Receiver privacy** | Receiver only gets `m_b` | No secret key exists for `pk_{1-b}` |
| **Correctness** | Receiver gets the right message | ElGamal decryption is correct |

---

## PA19 — Secure AND, XOR, and NOT Gates

### What it achieves

PA19 builds the three fundamental boolean gate operations — AND, XOR, NOT — as **secure two-party computations**. Two parties, Alice (who holds bit `a`) and Bob (who holds bit `b`), jointly compute `a AND b`, `a XOR b`, or `NOT a` such that:
- Neither party learns the other's input beyond what the gate output reveals.
- The output is correct.

This is the building block for evaluating arbitrary boolean circuits securely (PA20).

The central asymmetry in cost:
- **AND** requires OT — it takes one full PA18 protocol call per gate. This is the "expensive" gate.
- **XOR** is "free" — it can be computed via additive secret sharing with no OT.
- **NOT** is "free" — it requires no communication at all (Alice flips her local share).

This asymmetry is fundamental to the efficiency of Yao's garbled circuit and GMW protocols. Circuit designers try to minimize AND gate count.

### Source: `src/pa19_secure_and/secure_and.py`

---

#### Class: `SecureGates`

#### `SecureGates.__init__(self, ot=None, bits=32)`

**Input:** Optional `OT_1of2` instance, or bit size.

**What it does:** Stores an `OT_1of2` instance (creates one if not provided) and initializes an empty transcript list.

---

#### `SecureGates.AND(self, a: int, b: int) -> int`

**Input:** Alice's bit `a` in `{0, 1}`, Bob's bit `b` in `{0, 1}`.

**Output:** `a AND b` (0 or 1).

**What it does — OT-based AND:**

The key observation is that `a AND b = a * b`. If Bob has choice bit `b` and receives `m_b` from an OT where Alice's messages are `(m0, m1) = (0, a)`:
- If `b = 0`: Bob receives `m0 = 0 = a * 0 = a AND 0`.
- If `b = 1`: Bob receives `m1 = a = a * 1 = a AND 1`.

So Bob receives exactly `a AND b`.

1. Sets `m0 = 0`, `m1 = a` (Alice's OT sender messages).
2. Bob acts as OT receiver with choice bit `b`: calls `ot.receiver_step1(b)` → `(pk0, pk1, state)`.
3. Alice acts as OT sender: calls `ot.sender_step(pk0, pk1, 0, a)` → `(C0, C1)`.
4. Bob decrypts: calls `ot.receiver_step2(state, C0, C1)` → `result = a AND b`.
5. Reduces `result % 2` to ensure a clean bit.
6. Records the gate in `_transcript` and returns.

**Privacy:** Bob's choice bit `b` is hidden from Alice (OT sender privacy). Alice's bit `a` is hidden from Bob unless `b = 1` (and then Bob learns `a`, but that's unavoidable since the output `a AND b` already reveals `a` when `b = 1`).

---

#### `SecureGates.XOR(self, a: int, b: int) -> int`

**Input:** Alice's bit `a`, Bob's bit `b`.

**Output:** `a XOR b`.

**What it does — Secret-sharing-based XOR:**

XOR has a beautiful property: it equals addition mod 2 (`a ⊕ b = (a + b) mod 2`). This allows a "free" (no OT) protocol via additive secret sharing:

1. Alice samples a uniformly random bit `r` from `os.urandom(1)`.
2. Alice computes `alice_share = a XOR r` and sends `r` to Bob. (Bob computes `bob_share = b XOR r`.)
3. Both parties compute the output by XORing their shares:
   ```
   alice_share XOR bob_share = (a XOR r) XOR (b XOR r) = a XOR b
   ```
   The `r` terms cancel.

**Why this is "free" and private:** There is no OT call. The random `r` is information-theoretically independent of `a` — Alice's share `a XOR r` is uniformly random regardless of `a`, so Bob learns nothing about `a` from the share alone. Symmetrically, Alice learns nothing about `b`.

**Note on the implementation:** Since this is a simulation (both parties are in the same process), the code computes the result directly. In a real two-party setting, Alice and Bob would exchange shares over a network.

---

#### `SecureGates.NOT(self, a: int) -> int`

**Input:** Alice's bit `a`.

**Output:** `1 - a` (logical NOT).

**What it does:** Returns `1 - a`. No communication, no OT, no randomness.

**Why NOT is free:** In a secret-sharing context, if Alice holds a share `s_A` of some bit `v` (where `v = s_A XOR s_B`), she can flip her share to `1 - s_A`. The result satisfies `(1 - s_A) XOR s_B = 1 XOR s_A XOR s_B = NOT v`. Flipping a share locally flips the shared value — no messages needed.

---

#### `SecureGates.get_transcript(self) -> list`

**Output:** A copy of the internal transcript list.

**What it does:** Returns all recorded gate operations as a list of dicts, each containing `gate`, the input values, any intermediate values (for AND and XOR), and the `result`. Used for debugging and demonstrating protocol steps.

---

#### `SecureGates.clear_transcript(self)`

**What it does:** Empties the transcript list. Called before tests that need a clean slate.

---

#### `verify_truth_tables(gates: SecureGates, runs: int = 50) -> dict`

**Input:** A `SecureGates` instance, number of runs per input combination.

**Output:** Dict `{"AND": bool, "XOR": bool, "NOT": bool}` — `True` if every run of every input combination produced the correct output.

**What it does:** For every (a, b) pair in {0,1}², runs AND and XOR `runs` times, checking against Python's `&` and `^`. For each `a` in {0,1}, runs NOT `runs` times. Returns whether all results matched.

**Why run multiple times?** AND uses OT which involves cryptographic randomness. Running 50 times verifies statistical correctness — if the implementation had a bias or off-by-one, it would show up across 200 AND calls.

---

## PA20 — Boolean Circuit Representation and Secure Multi-Party Computation

### What it achieves

PA20 is the culmination of the entire course. It assembles everything — ElGamal (PA16), RSA signatures (PA15), OT (PA18), and Secure Gates (PA19) — into a complete **two-party secure computation (2PC)** system.

The central concept is a **boolean circuit**: any computable function can be expressed as a directed acyclic graph (DAG) of AND, XOR, and NOT gates. PA20 provides:

1. **`circuit.py`** — A pure data-structure representation of boolean circuits, with three pre-built circuits: comparison (`x > y`), equality (`x == y`), and addition (`x + y mod 2^n`).
2. **`mpc.py`** — `SecureEval`: a circuit evaluator that replaces each AND gate call with `SecureGates.AND` (which internally calls OT), making the evaluation **cryptographically secure** — neither party learns the other's input.

The headline application is the **Millionaire's Problem**: Alice knows her wealth `x`, Bob knows his wealth `y`. They want to know who is richer without either revealing their actual wealth. This is solved by running the comparison circuit through `SecureEval`.

### Source: `src/pa20_mpc/circuit.py` and `src/pa20_mpc/mpc.py`

---

### `circuit.py` — Boolean Circuit Data Structure

#### `@dataclass Gate`

Fields:
- `gate_type: str` — one of `'AND'`, `'XOR'`, `'NOT'`, `'INPUT'`.
- `inputs: List[int]` — list of wire indices that feed into this gate (1 for NOT, 2 for AND/XOR).
- `output: int` — wire index where this gate's output is written.

A wire is just an integer index into a value array. Gates are implicitly in topological order because each gate's output wire index is strictly greater than all its input wire indices (wires are allocated sequentially).

---

#### Class: `Circuit`

#### `Circuit.__init__(self, n_inputs: int, n_outputs: int = 1)`

**Input:** Number of input wires `n_inputs`, number of output wires `n_outputs`.

**What it does:** Initializes an empty circuit. Sets `n_wires = n_inputs` (input wires 0 through `n_inputs-1` are pre-allocated). Gates are added later via `add_gate`.

---

#### `Circuit.add_gate(self, gate_type: str, input_wires: list) -> int`

**Input:** Gate type string, list of input wire indices.

**Output:** The new output wire index.

**What it does:**
1. Allocates the next wire index `out_wire = self.n_wires`.
2. Increments `n_wires`.
3. Appends a new `Gate(gate_type, input_wires, out_wire)` to `self.gates`.
4. Returns `out_wire` so the caller can use it as input to future gates.

**Why this API works:** Circuits are built compositionally. Each `add_gate` call returns a wire index; passing that index as input to a later `add_gate` creates the circuit's DAG structure without any explicit graph wiring — it's implicit in the wire numbering.

---

#### `Circuit.evaluate(self, inputs: list) -> list`

**Input:** List of input bit values (length must equal `n_inputs`).

**Output:** List of output bit values (the last `n_outputs` wires).

**What it does:**
1. Initializes a wire value array: input values followed by zeros for all intermediate/output wires.
2. Iterates through `self.gates` in order (topological order is guaranteed by wire numbering):
   - `AND`: `wires[out] = wires[in0] & wires[in1]`
   - `XOR`: `wires[out] = wires[in0] ^ wires[in1]`
   - `NOT`: `wires[out] = 1 - wires[in0]`
3. Returns `wires[-n_outputs:]` — the last `n_outputs` values.

**Why topological order is automatic:** Wire indices increase monotonically as gates are added. Gate `i` can only reference wire indices ≤ `i + n_inputs - 1` (earlier outputs or inputs). So iterating gates in insertion order is always topological.

---

#### `_or_gate(c: Circuit, a: int, b: int) -> int`

**Input:** Circuit, two input wire indices `a` and `b`.

**Output:** Output wire index of the OR result.

**What it does:** Implements OR via De Morgan's/XOR identity:
```
OR(a, b) = a XOR b XOR (a AND b)
```
Because `a XOR b = 1` when exactly one is 1, and `a AND b = 1` when both are 1 — XORing them gives 1 when at least one is 1. Uses 3 gates: 1 XOR, 1 AND, 1 XOR.

**Why not use OR directly?** The standard Yao/GMW framework works with AND and XOR as primitives (AND is expensive/OT-based, XOR is free). OR is derived. Having OR as a helper lets the comparison circuit use a natural ripple-carry structure.

---

#### `build_comparison_circuit(n_bits: int) -> Circuit`

**Input:** Number of bits `n_bits`.

**Output:** A `Circuit` with `2 * n_bits` inputs (first `n_bits` = `x`, next `n_bits` = `y`, MSB first) and 1 output (1 if `x > y`, 0 otherwise).

**What it does — MSB-first ripple comparator:**

Tracks two state bits through `n_bits` stages:
- `GT` — "so far, x is greater than y" — starts at 0 (constant 0 via `XOR(0,0)`).
- `EQ` — "so far, x equals y bit-for-bit" — starts at 1 (constant 1 via `NOT(0)`).

For each bit position `i` (MSB first):

**Check if `x[i] > y[i]`:** `xi AND (NOT yi)` — true when `x[i] = 1` and `y[i] = 0`.

**Check if `x[i] == y[i]`:** `NOT (xi XOR yi)` — true when both bits are equal.

**Update GT state:**
```
new_GT = OR(GT, EQ AND (x[i] > y[i]))
```
Translation: "x is now greater if it was already greater, or if x and y were equal so far and x[i] just became greater."

**Update EQ state:**
```
new_EQ = EQ AND (x[i] == y[i])
```
Translation: "x and y are still equal if they were equal so far and this bit is also equal."

**Final output:** `XOR(GT, constant_0) = GT` — the final GT flag is the circuit's output wire.

**Gate count:** Each bit stage uses ~8 gates (NOT, AND, XOR, NOT, AND, XOR+AND+XOR for OR, AND). Total ≈ `8 * n_bits` gates.

---

#### `build_equality_circuit(n_bits: int) -> Circuit`

**Input:** `n_bits`.

**Output:** Circuit with `2 * n_bits` inputs, 1 output (1 if `x == y`, else 0).

**What it does:**
- For each bit position `i`, computes `NOT(x[i] XOR y[i])` — equals 1 iff `x[i] == y[i]`.
- ANDs all `n_bits` equality bits together using a running accumulator.
- The final AND output is 1 iff all bits match.

**Gate count:** `2 * n_bits` (one XOR + one NOT per bit) plus `n_bits - 1` ANDs for the chain = `3 * n_bits - 1` gates total.

---

#### `build_addition_circuit(n_bits: int) -> tuple`

**Input:** `n_bits`.

**Output:** `(circuit, sum_wires)` — the Circuit and a list of `n_bits` output wire indices for `sum[0..n-1]` (LSB first).

**What it does — ripple-carry adder:**

Inputs: `x[0..n-1]` (LSB first), `y[0..n-1]` (LSB first). Computes `x + y mod 2^n`.

Maintains a carry wire initialized to 0 (`XOR(0,0)`). For each bit `i`:

**Sum bit:**
```
xor1 = x[i] XOR y[i]
sum[i] = xor1 XOR carry
```

**New carry:**
```
and1 = x[i] AND y[i]       ← carry when both are 1
and2 = xor1 AND carry      ← carry when exactly one is 1 AND there's an incoming carry
new_carry = and1 XOR and2  ← OR(and1, and2) via XOR (they can't both be 1 simultaneously)
```

The carry XOR trick works because `(x AND y)` and `((x XOR y) AND carry)` are mutually exclusive — you cannot have `x = y = 1` and `x XOR y = 1` at the same time.

**Gate count:** Per bit: 2 XOR + 3 AND = 5 gates. Total: `5 * n_bits`.

---

### `mpc.py` — Secure Circuit Evaluation

---

#### Class: `SecureEval`

#### `SecureEval.__init__(self, gates=None)`

**Input:** Optional `SecureGates` instance.

**What it does:** Stores the `SecureGates` instance (creates one if not provided) and initializes `ot_calls = 0` as a counter for auditing OT usage.

---

#### `SecureEval.evaluate(self, circuit: Circuit, x_Alice: list, y_Bob: list) -> list`

**Input:**
- `circuit` — a `Circuit` instance (built by one of the `build_*` functions).
- `x_Alice` — Alice's input bits (list of 0/1 integers).
- `y_Bob` — Bob's input bits (list of 0/1 integers).

**Output:** List of output bit values (the circuit's final outputs).

**What it does:**

1. **Asserts** `len(x_Alice) + len(y_Bob) == circuit.n_inputs`.
2. **Initializes** the wire value array: concatenate Alice's and Bob's inputs, pad with zeros.
3. **Iterates gates in topological order:**
   - `AND` gate: calls `self.gates.AND(a, b)` — this internally runs a full OT protocol. Increments `ot_calls`.
   - `XOR` gate: calls `self.gates.XOR(a, b)` — free, no OT.
   - `NOT` gate: calls `self.gates.NOT(a)` — free, local.
4. Writes the result of each gate to the appropriate wire.
5. Returns `wires[-circuit.n_outputs:]`.

**What makes this secure:** Every AND gate uses `SecureGates.AND`, which runs a complete OT protocol. In a real distributed setting, Alice and Bob each run their respective sides of the OT. Neither party learns the inputs that aren't revealed by the output — the OT protocol ensures that:
- Alice never learns Bob's input bits (OT sender privacy).
- Bob never learns Alice's input bits beyond what he needs for OT receiver decryption.

**Cost analysis:** `ot_calls` equals the number of AND gates in the circuit. For the `n_bits`-bit comparison circuit, that's approximately `4 * n_bits` OT calls. Each OT call involves a full ElGamal key generation and two ElGamal encryptions.

---

#### `int_to_bits(n: int, nbits: int, msb_first: bool = True) -> list`

**Input:** Integer `n`, bit length `nbits`, endianness flag.

**Output:** List of `nbits` bits.

**What it does:**
- Extracts bit `i` as `(n >> i) & 1` for `i = 0` to `nbits - 1` (gives LSB-first).
- Reverses the list if `msb_first=True`.

Used to convert Alice's and Bob's integer inputs into the bit lists expected by the circuit.

---

#### `millionaires_problem(x: int, y: int, n_bits: int = 4) -> dict`

**Input:** Alice's wealth `x`, Bob's wealth `y`, bit width `n_bits` (default 4).

**Output:** Dict with:
- `x`, `y` — the inputs.
- `n_bits` — bit width used.
- `result` — human-readable string: `"Alice is richer"`, `"Bob is richer"`, or `"Equal"`.
- `x_gt_y` — boolean.
- `ot_calls` — number of OT calls made during evaluation.

**What it does:**

1. Creates `SecureGates` and `SecureEval`.
2. Builds the comparison circuit: `build_comparison_circuit(n_bits)`.
3. Converts `x` and `y` to `n_bits`-bit MSB-first bit lists (truncating to `2^n_bits`).
4. Calls `evaluator.evaluate(circuit, x_bits, y_bits)`.
5. Reads the output bit `x_gt_y`.
6. Packages result.

**What Yao's Millionaire's Problem is:** This is the canonical example problem in secure computation, posed by Andrew Yao in 1982. Two millionaires want to know who is richer without revealing their actual wealth. It motivated the development of garbled circuits and the entire field of secure computation.

**Correctness:** `x_gt_y == 1` iff `x > y` (truncated to `n_bits` bits). For `n_bits = 4`, inputs are compared modulo 16. The test `millionaires_problem(7, 12, n_bits=4)` correctly returns `"Bob is richer"`.

---

#### `secure_equality(x: int, y: int, n_bits: int = 4) -> dict`

**Input:** Two integers `x`, `y`, bit width `n_bits`.

**Output:** Dict with:
- `x`, `y` — inputs.
- `equal` — boolean, `True` iff `x == y` (modulo `2^n_bits`).
- `correct` — boolean confirming `equal == (x == y)`.
- `ot_calls` — OT count.

**What it does:**

1. Builds the equality circuit: `build_equality_circuit(n_bits)`.
2. Converts inputs to bit lists.
3. Evaluates securely via `SecureEval`.
4. Returns whether the output bit was 1.

**Use case:** Two parties want to check if their private data matches (e.g., password equality, set membership) without revealing the data itself. The equality circuit costs `n_bits - 1` AND gates (= OT calls), significantly cheaper than the comparison circuit.

---

### Full Dependency Stack of PA20

When `millionaires_problem(7, 12, n_bits=4)` is called, the following chain executes:

```
millionaires_problem
  └─ SecureEval.evaluate (for each AND gate):
       └─ SecureGates.AND(a, b)          [PA19]
            └─ OT_1of2.receiver_step1(b)
                 └─ ElGamalGroup.random_exponent()
                 └─ mod_pow(g, x_b, p)   [PA13]
            └─ OT_1of2.sender_step(pk0, pk1, 0, a)
                 └─ ElGamal.enc(pk0, 0)  [PA16]
                 └─ ElGamal.enc(pk1, a)  [PA16]
            └─ OT_1of2.receiver_step2(state, C0, C1)
                 └─ ElGamal.dec(sk_b, pk_b, Cb[0], Cb[1])  [PA16]
```

Each AND gate in the comparison circuit triggers one complete OT protocol, which triggers two ElGamal encryptions and one ElGamal decryption, each of which uses `mod_pow` from PA13 (square-and-multiply modular exponentiation over a safe prime group from PA13's `gen_safe_prime`).

---

## Dependency Graph

```
PA13 (mod_pow, mod_inverse, gen_safe_prime)
         ↓
PA16 (ElGamal, ElGamalGroup)
    ↓              ↓
PA17 (CCA_PKC)   PA18 (OT_1of2)
  [also uses         ↓
   PA15/RSASig]  PA19 (SecureGates: AND, XOR, NOT)
                     ↓
               PA20 (Circuit, SecureEval,
                     millionaires_problem,
                     secure_equality)
```

- **PA16** depends on PA13 for safe prime generation, `mod_pow`, `mod_inverse`.
- **PA17** depends on PA16 (encryption) and PA15 (RSA signatures from Part 3).
- **PA18** depends on PA16 (ElGamal as the OT sub-protocol).
- **PA19** depends on PA18 (OT for AND gate) and uses `os.urandom` directly for XOR.
- **PA20** depends on PA19 (for secure gate evaluation) and defines its own Circuit data structure.

---

## Interface Summary

| PA | Class / Function | Key Input | Key Output |
|----|-----------------|-----------|------------|
| PA16 | `ElGamalGroup(bits)` | bit size | group with `p`, `q`, `g` |
| PA16 | `ElGamal.keygen()` | — | `{"sk": x, "pk": {p,g,q,h}}` |
| PA16 | `ElGamal.enc(pk, m)` | public key dict, int | `(c1, c2)` tuple |
| PA16 | `ElGamal.dec(sk, pk, c1, c2)` | private key int, pk dict, ints | plaintext int |
| PA16 | `ElGamal.malleability_demo(pk, c1, c2)` | ciphertext | dict showing `2*m` decrypt |
| PA16 | `ElGamal.run_cpa_game(pk, sk, rounds)` | keys, round count | dict with advantage ≈ 0 |
| PA17 | `CCA_PKC.enc(pk_enc, sk_sign, vk_sign, m)` | ElGamal pk, RSA sk/pk, int | dict with `c1,c2,sigma,ce_bytes` |
| PA17 | `CCA_PKC.dec(sk_enc, pk_enc, vk_sign, payload)` | ElGamal sk, RSA vk, payload | plaintext int or `None` |
| PA17 | `CCA_PKC.malleability_blocked_demo(...)` | both key pairs, m | dict with `cca_blocked=True` |
| PA18 | `OT_1of2.receiver_step1(b)` | choice bit | `(pk0, pk1, state)` |
| PA18 | `OT_1of2.sender_step(pk0, pk1, m0, m1)` | two pks, two messages | `(C0, C1)` ciphertext pair |
| PA18 | `OT_1of2.receiver_step2(state, C0, C1)` | private state, ciphertexts | recovered message `m_b` |
| PA18 | `OT_1of2.full_protocol(b, m0, m1)` | bit, two messages | full transcript dict |
| PA19 | `SecureGates.AND(a, b)` | two bits | `a AND b` (uses OT) |
| PA19 | `SecureGates.XOR(a, b)` | two bits | `a XOR b` (free) |
| PA19 | `SecureGates.NOT(a)` | one bit | `NOT a` (free) |
| PA19 | `verify_truth_tables(gates, runs)` | SecureGates instance | dict of truth table correctness |
| PA20 | `Circuit(n_inputs, n_outputs)` | wire counts | empty circuit |
| PA20 | `Circuit.add_gate(type, wires)` | gate type, input wires | output wire index |
| PA20 | `Circuit.evaluate(inputs)` | input bit list | output bit list |
| PA20 | `build_comparison_circuit(n_bits)` | bit width | Circuit for `x > y` |
| PA20 | `build_equality_circuit(n_bits)` | bit width | Circuit for `x == y` |
| PA20 | `build_addition_circuit(n_bits)` | bit width | `(Circuit, sum_wires)` for `x+y` |
| PA20 | `SecureEval.evaluate(circuit, x_Alice, y_Bob)` | circuit, two bit lists | output bit list |
| PA20 | `millionaires_problem(x, y, n_bits)` | two integers | dict with richer/equal result |
| PA20 | `secure_equality(x, y, n_bits)` | two integers | dict with equality result |
