import React, { useState } from 'react';
import { post } from '../../api';

export default function PA15Demo() {
  const [msg, setMsg] = useState('Sign this message!');
  const [tampered, setTampered] = useState(false);
  const [forgery, setForgery] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await post('/sig/demo', {
        message: msg,
        tamper: tampered,
        show_forgery: forgery,
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
        <h4>PA#15 — RSA Digital Signatures (Hash-then-Sign)</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          σ = H(m)^d mod N. Verify: H(m) == σ^e mod N.
          Raw RSA signatures (without hashing) are vulnerable to multiplicative forgery.
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
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
            <input type="checkbox" checked={tampered} onChange={e => setTampered(e.target.checked)} />
            Tamper message before verify
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
            <input type="checkbox" checked={forgery} onChange={e => setForgery(e.target.checked)} />
            Show multiplicative forgery
          </label>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? 'Working…' : 'Sign & Verify'}
        </button>

        {result && !result.error && (
          <div className="step-chain" style={{ marginTop: 16 }}>
            <div className="step-item">
              <span className="step-label">Message hash H(m)</span>
              <span className="hex-display" style={{ fontSize: '0.75rem' }}>{result.hash}</span>
            </div>
            <div className="step-item">
              <span className="step-label">Signature σ = H(m)^d</span>
              <span className="hex-display" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>
                {String(result.signature || '').slice(0, 80)}…
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">Verification</span>
              <span className={`badge ${result.valid ? 'badge-success' : 'badge-danger'}`}>
                {result.valid ? '✓ VALID' : '✗ INVALID' + (tampered ? ' (tampered)' : '')}
              </span>
            </div>
            {result.forgery && (
              <>
                <div className="step-item" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 8, marginTop: 4 }}>
                  <span className="step-label" style={{ color: 'var(--accent-red)' }}>
                    Forgery: σ = σ₁·σ₂ mod N
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    sign(m₁) × sign(m₂) ≡ sign(m₁·m₂) under raw RSA
                  </span>
                </div>
                <div className="step-item">
                  <span className="step-label">Forgery valid?</span>
                  <span className={`badge ${result.forgery.verifies ? 'badge-danger' : 'badge-success'}`}>
                    {result.forgery.verifies ? '⚠ YES — raw RSA forged!' : '✓ NO — hash prevents forgery'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
