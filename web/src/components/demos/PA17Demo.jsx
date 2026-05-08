import React, { useState } from 'react';
import { post } from '../../api';
import DemoHeader from '../DemoHeader';

const MSG_PRESETS = ['Hello Alice!', 'Secret CCA message!', 'transfer $1000'];

export default function PA17Demo() {
  const [msg, setMsg]     = useState('Hello Alice!');
  const [step, setStep]   = useState(0);   // 0=idle 1=signcrypted 2=tampered 3=oracle
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  function reset() { setStep(0); setResult(null); setError(null); }

  async function signcrypt() {
    setLoading(true); setError(null); setStep(0); setResult(null);
    try {
      const r = await post('/cca/demo', { message: msg, tamper_ciphertext: false });
      setResult(r);
      setStep(1);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function trunc(s, n = 20) {
    s = String(s ?? '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  return (
    <div>
      <style>{`
        @keyframes pa17In {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pa17-in { animation: pa17In 0.28s ease forwards; }
      `}</style>

      <div className="demo-card">
        <DemoHeader num={17} title="CCA-Secure PKC via Sign-then-Encrypt" tag="CCA" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Combines <strong>PA#16 ElGamal</strong> + <strong>PA#15 RSA Signatures</strong>.
          Textbook RSA/ElGamal are malleable — an attacker can submit a modified ciphertext
          and learn information. Signing the ciphertext before decryption defeats this.
        </p>

        {/* Construction flow diagram */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14,
          flexWrap: 'wrap', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
          {[
            { label: 'plaintext m', color: 'var(--accent-green)' },
            null,
            { label: 'ElGamal C_E', color: 'var(--accent-blue)' },
            null,
            { label: 'Sign σ', color: 'var(--accent-orange)' },
            null,
            { label: '(C_E, σ)', color: '#a29bfe' },
          ].map((item, i) =>
            item === null
              ? <span key={i} style={{ color: 'var(--text-muted)' }}>→</span>
              : <div key={i} style={{ padding: '3px 10px', borderRadius: 6,
                  background: item.color + '18', border: `1px solid ${item.color}44`,
                  color: item.color }}>
                  {item.label}
                </div>
          )}
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>⤵ Vrfy &amp; Dec</span>
        </div>

        {/* Message input */}
        <div className="form-group">
          <label>Message</label>
          <div style={{ display: 'flex', gap: 4, marginBottom: 5, flexWrap: 'wrap' }}>
            {MSG_PRESETS.map(v => (
              <button key={v} className="btn btn-secondary"
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                onClick={() => { setMsg(v); reset(); }}>
                {v}
              </button>
            ))}
          </div>
          <input type="text" value={msg}
            onChange={e => { setMsg(e.target.value); reset(); }}
            onKeyDown={e => e.key === 'Enter' && !loading && signcrypt()}
            placeholder="Any string message" />
        </div>

        <button className="btn btn-primary" onClick={signcrypt}
          disabled={loading || !msg} style={{ marginBottom: 14 }}>
          {loading ? '⏳ Generating keys & signcrypting…' : '▶ Signcrypt (Encrypt-then-Sign)'}
        </button>
        {error && <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: 10 }}>{error}</p>}

        {/* ── Step 1: Signcryption result ── */}
        {step >= 1 && result && (
          <div className="pa17-in">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {/* Step 1: ElGamal Encrypt */}
              <div style={{ background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.25)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 6 }}>
                  Step 1 — ElGamal Encrypt(m)
                </div>
                <div style={{ fontSize: '0.61rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.85 }}>
                  <div>m_int = {trunc(result.m_int, 16)}</div>
                  <div>c₁ = g^r mod p</div>
                  <div style={{ paddingLeft: 8, color: 'var(--text-primary)' }}>{trunc(result.c1)}</div>
                  <div>c₂ = m·h^r mod p</div>
                  <div style={{ paddingLeft: 8, color: 'var(--text-primary)' }}>{trunc(result.c2)}</div>
                </div>
              </div>
              {/* Step 2: Sign C_E */}
              <div style={{ background: 'rgba(243,156,18,0.06)', border: '1px solid rgba(243,156,18,0.25)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-orange)', marginBottom: 6 }}>
                  Step 2 — RSA Sign C_E
                </div>
                <div style={{ fontSize: '0.61rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.85 }}>
                  <div>input: (c₁ ‖ c₂)</div>
                  <div>σ = H(C_E)^d mod N</div>
                  <div style={{ color: 'var(--accent-orange)' }}>{trunc(result.sigma, 22)}</div>
                </div>
              </div>
            </div>

            {/* Output + honest decrypt */}
            <div style={{ background: 'var(--bg-well)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Signcrypted output (C_E, σ)
              </div>
              <div style={{ fontSize: '0.61rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <div>C_E = ({trunc(result.c1)}, {trunc(result.c2)})</div>
                <div>σ &nbsp;&nbsp;= {trunc(result.sigma, 28)}</div>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.7rem' }}>
                Honest Dec: Vrfy(vk, C_E, σ) = ✓ → ElGamal.Dec ={' '}
                <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {result.m_int}
                </span>
                <span className="badge badge-secure" style={{ marginLeft: 8, fontSize: '0.6rem' }}>✓ Correct</span>
              </div>
            </div>

            {step === 1 && (
              <button className="btn btn-secondary" onClick={() => setStep(2)}
                style={{ marginBottom: 12 }}>
                ✎ Tamper with C_E (simulate CCA attacker)
              </button>
            )}
          </div>
        )}

        {/* ── Step 2: Tampered ciphertext ── */}
        {step >= 2 && result && (
          <div className="pa17-in" style={{ marginBottom: 12 }}>
            <div style={{ background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>
                CCA Attacker: Modify C_E
              </div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                <div>c₁' = c₁ <span style={{ color: 'var(--text-muted)' }}>(unchanged)</span></div>
                <div>c₂' = 2·c₂ mod p = <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{trunc(result.c2_tampered)}</span></div>
                <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                  σ is kept unchanged — it still covers the original (c₁, c₂), not C_E'.
                </div>
              </div>
            </div>
            {step === 2 && (
              <button className="btn btn-primary" onClick={() => setStep(3)}
                style={{ marginTop: 10, background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}>
                Submit (C_E', σ) to Decryption Oracle
              </button>
            )}
          </div>
        )}

        {/* ── Step 3: Oracle results — two-panel comparison ── */}
        {step >= 3 && result && (
          <div className="pa17-in">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Decryption Oracle Response
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {/* Left: CCA-secure scheme → ⊥ */}
              <div style={{ background: 'rgba(39,174,96,0.07)', border: '1px solid rgba(39,174,96,0.32)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-green)', marginBottom: 8 }}>
                  PA#17 — CCA-Secure Scheme
                </div>
                <div style={{ fontSize: '0.63rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 2, marginBottom: 8 }}>
                  <div>
                    1. Vrfy(vk, C_E', σ) ={' '}
                    <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>FAIL</span>
                  </div>
                  <div style={{ paddingLeft: 10, color: 'var(--text-muted)', fontSize: '0.58rem' }}>
                    σ covers original C_E ≠ C_E'
                  </div>
                  <div>2. Decryption <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>ABORTED</span></div>
                  <div>
                    Output:{' '}
                    <span style={{ color: 'var(--accent-red)', fontWeight: 700, fontSize: '1rem' }}>⊥</span>
                  </div>
                </div>
                <span className="badge badge-secure" style={{ fontSize: '0.6rem' }}>
                  ✓ CCA blocked — oracle useless
                </span>
              </div>

              {/* Right: Plain ElGamal → 2m (malleable) */}
              <div style={{ background: 'rgba(231,76,60,0.07)', border: '1px solid rgba(231,76,60,0.32)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>
                  PA#16 — Plain ElGamal (no sig)
                </div>
                <div style={{ fontSize: '0.63rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 2, marginBottom: 8 }}>
                  <div>No signature check</div>
                  <div>Dec(sk, c₁, c₂') =</div>
                  <div style={{ paddingLeft: 10 }}>
                    <span style={{ color: 'var(--accent-orange)', fontWeight: 700, fontSize: '0.78rem' }}>
                      {result.eg_tampered_dec}
                    </span>
                    {result.eg_tampered_equals_2m && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>= 2·m ✓</span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginTop: 2 }}>
                    Malleability attack — attacker learned info about m.
                  </div>
                </div>
                <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>
                  ⚡ CPA-only: malleability succeeds
                </span>
              </div>
            </div>

            {/* Summary */}
            <div style={{ padding: '10px 14px', background: 'rgba(39,174,96,0.05)', border: '1px solid rgba(39,174,96,0.2)', borderRadius: 8, fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-green)', marginBottom: 4 }}>
                CCA Security Guarantee
              </div>
              <div>
                Any tampered ciphertext returns <code>⊥</code> — signature verification fires
                before decryption, so the oracle reveals nothing.
                Untampered ciphertexts decrypt correctly (m = <code>{result.m_int}</code>).
              </div>
              <div style={{ marginTop: 6, fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Lineage: PA#17 → PA#15 (RSA Signatures) + PA#16 (ElGamal) → PA#12 (RSA) + PA#11 (DH) → PA#13 (Miller-Rabin)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
