import React, { useState } from 'react';
import { post } from '../../api';

export default function PA16Demo() {
  const [m, setM] = useState('1337');
  const [multiplier, setMultiplier] = useState('2');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const r = await post('/elgamal/demo', {
        message: parseInt(m),
        multiplier: parseInt(multiplier),
      });
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="demo-card">
        <h4>PA#16 — ElGamal CPA Encryption & Malleability</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          ElGamal: Enc(pk, m) = (g^r, m·h^r). It is multiplicatively malleable — multiplying
          c₂ by k yields a ciphertext that decrypts to k·m without knowing the secret key.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Plaintext m (integer &lt; q)
            </label>
            <input className="hex-input" value={m} onChange={e => setM(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ width: 110 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Multiplier k
            </label>
            <input className="hex-input" value={multiplier} onChange={e => setMultiplier(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 16 }}>
          {'Encrypt & Attack'}
        </button>

        {result && !result.error && (
          <div className="step-chain">
            <div className="step-item">
              <span className="step-label">Ciphertext (c₁, c₂)</span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <div>c₁ = g^r = {String(result.c1 || '').slice(0, 50)}…</div>
                <div>c₂ = m·h^r = {String(result.c2 || '').slice(0, 50)}…</div>
              </div>
            </div>
            <div className="step-item">
              <span className="step-label">Honest decryption</span>
              <span className="hex-display">{String(result.decrypted)}</span>
            </div>
            <div className="step-item" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
              <span className="step-label" style={{ color: 'var(--accent-red)' }}>
                Malleable attack: c₂' = {multiplier}·c₂ mod p
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">Dec(c₁, c₂') =</span>
              <span className="badge badge-danger">
                {String(result.malleable_decrypted)} = {multiplier}·m ⚡
              </span>
            </div>
          </div>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
