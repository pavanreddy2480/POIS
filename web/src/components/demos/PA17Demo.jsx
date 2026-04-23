import React, { useState } from 'react';
import { post } from '../../api';

export default function PA17Demo() {
  const [msg, setMsg] = useState('Secret CCA message!');
  const [tamper, setTamper] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await post('/cca/demo', { message: msg, tamper_ciphertext: tamper });
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="demo-card">
        <h4>PA#17 — CCA-Secure PKC (Sign-then-Encrypt)</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Sign-then-Encrypt: σ = RSASign(m), then ElGamal-Encrypt(m ‖ σ).
          Any tampering with the ciphertext causes signature verification to fail → ⊥.
        </p>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
          Message
        </label>
        <input
          className="hex-input"
          value={msg}
          onChange={e => setMsg(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 12 }}>
          <input type="checkbox" checked={tamper} onChange={e => setTamper(e.target.checked)} />
          Tamper ciphertext (simulate chosen-ciphertext attack)
        </label>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? 'Working…' : 'Encrypt & Decrypt'}
        </button>

        {result && !result.error && (
          <div className="step-chain" style={{ marginTop: 16 }}>
            <div className="step-item">
              <span className="step-label">Step 1 — RSA Sign</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                σ = H(m)^d mod N
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">Step 2 — ElGamal Encrypt(m ‖ σ)</span>
              <span className="hex-display" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>
                c = ({String(result.c1 || '').slice(0, 30)}…, {String(result.c2 || '').slice(0, 30)}…)
              </span>
            </div>
            {tamper && (
              <div className="step-item" style={{ color: 'var(--accent-red)' }}>
                <span className="step-label">Attack — Tamper c₂</span>
                <span style={{ fontSize: '0.8rem' }}>c₂ ← c₂ ⊕ 1 (flip lowest bit)</span>
              </div>
            )}
            <div className="step-item">
              <span className="step-label">Decryption result</span>
              <span className={`badge ${result.success ? 'badge-success' : 'badge-danger'}`}>
                {result.success
                  ? `✓ "${result.decrypted}"`
                  : '⊥ — signature invalid, decryption rejected'}
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">Security guarantee</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {result.success
                  ? 'Honest decryption: no tampering detected'
                  : 'CCA: oracle returns ⊥ on any modified ciphertext — no information leaks'}
              </span>
            </div>
          </div>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
