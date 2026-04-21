import React, { useState } from 'react';
import { post } from '../../api';

export default function PA14Demo() {
  const [m, setM] = useState('42');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await post('/hastad/demo', { message: parseInt(m) });
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="demo-card">
        <h4>PA#14 — Håstad's Broadcast Attack</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          If the same message m is encrypted with e=3 to 3 different RSA public keys, an attacker
          can recover m using the Chinese Remainder Theorem and an integer cube root — no factoring needed.
        </p>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
          Message m (small integer, m³ &lt; N₁N₂N₃)
        </label>
        <input
          className="hex-input"
          value={m}
          onChange={e => setM(e.target.value)}
          placeholder="small integer"
          style={{ width: '100%', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {['7', '42', '99', '255'].map(v => (
            <button key={v} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '3px 10px' }}
              onClick={() => { setM(v); setResult(null); }}>
              {v}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 16 }}>
          {loading ? 'Attacking…' : 'Run Håstad Attack'}
        </button>

        {result && !result.error && (
          <div className="step-chain">
            <div className="step-item">
              <span className="step-label">3 RSA Moduli</span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {result.moduli?.map((n, i) => (
                  <div key={i}>N{i+1} = {String(n).slice(0, 40)}…</div>
                ))}
              </div>
            </div>
            <div className="step-item">
              <span className="step-label">Ciphertexts cᵢ = m³ mod Nᵢ</span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {result.ciphertexts?.map((c, i) => (
                  <div key={i}>c{i+1} = {String(c).slice(0, 40)}…</div>
                ))}
              </div>
            </div>
            <div className="step-item">
              <span className="step-label">CRT → m³</span>
              <span className="hex-display" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>
                {String(result.m_cubed || '').slice(0, 80)}…
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">∛(m³) = Recovered m</span>
              <span className={`badge ${String(result.recovered) === String(m) ? 'badge-danger' : 'badge-secondary'}`}>
                {String(result.recovered)}
                {String(result.recovered) === String(m) ? ' ⚡ Attack succeeded!' : ''}
              </span>
            </div>
          </div>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
