import React, { useState } from 'react';
import { post } from '../../api';

export default function PA12Demo() {
  const [msgHex, setMsgHex] = useState('48656c6c6f20576f726c6421212121');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pkcs, setPkcs] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await post('/rsa/demo', { message_hex: msgHex, use_pkcs: pkcs });
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="demo-card">
        <h4>PA#12 — RSA Determinism Attack</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Raw RSA is deterministic: encrypting the same message twice yields the same ciphertext.
          PKCS#1 v1.5 padding randomizes each encryption.
        </p>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
          Message (hex)
        </label>
        <input
          className="hex-input"
          value={msgHex}
          onChange={e => setMsgHex(e.target.value)}
          placeholder="message hex"
          style={{ width: '100%', marginBottom: 8 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 12 }}>
          <input type="checkbox" checked={pkcs} onChange={e => setPkcs(e.target.checked)} />
          Use PKCS#1 v1.5 padding (randomized)
        </label>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? 'Computing…' : 'Encrypt × 2'}
        </button>
        {result && !result.error && (
          <div style={{ marginTop: 16 }}>
            <div className="step-chain">
              <div className="step-item">
                <span className="step-label">Ciphertext 1</span>
                <span className="hex-display" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>
                  {result.ct1}
                </span>
              </div>
              <div className="step-item">
                <span className="step-label">Ciphertext 2</span>
                <span className="hex-display" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>
                  {result.ct2}
                </span>
              </div>
              <div className="step-item">
                <span className="step-label">Identical?</span>
                <span className={`badge ${result.identical ? 'badge-danger' : 'badge-success'}`}>
                  {result.identical ? '⚠ YES — deterministic!' : '✓ NO — randomized by PKCS'}
                </span>
              </div>
              {result.decrypted && (
                <div className="step-item">
                  <span className="step-label">Decrypted</span>
                  <span className="hex-display">{result.decrypted}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
