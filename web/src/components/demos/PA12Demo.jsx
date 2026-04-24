import React, { useState } from 'react';
import { post } from '../../api';
import DemoHeader from '../DemoHeader';

function PsPanel({ label, ps }) {
  if (!ps) return null;
  const bytes = ps.match(/.{2}/g) || [];
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{label} ({bytes.length} bytes):</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {bytes.map((b, i) => (
          <span key={i} style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
            padding: '1px 4px', borderRadius: 3,
            background: `hsl(${parseInt(b,16) * 1.4},55%,38%)`,
            color: '#fff', opacity: 0.88,
          }}>{b}</span>
        ))}
      </div>
    </div>
  );
}

export default function PA12Demo() {
  const [msgHex, setMsgHex] = useState('48656c6c6f20576f726c6421212121');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pkcs, setPkcs] = useState(false);

  const reset = () => { setResult(null); setPkcs(false); };

  async function run() {
    setLoading(true);
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
        <DemoHeader num={12} title="RSA Determinism Attack" tag="RSA" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Raw RSA is deterministic: encrypting the same message twice yields the same ciphertext.
          PKCS#1 v1.5 padding randomizes each encryption via fresh random PS bytes.
        </p>
        <div className="form-group">
          <label>Message (hex)</label>
          <input
            type="text"
            value={msgHex}
            onChange={e => { setMsgHex(e.target.value); setResult(null); }}
            onKeyDown={e => e.key === 'Enter' && !loading && run()}
            placeholder="message hex"
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 12 }}>
          <input type="checkbox" checked={pkcs} onChange={e => setPkcs(e.target.checked)} />
          Use PKCS#1 v1.5 padding (randomized)
        </label>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {'Encrypt × 2'}
        </button>
        {result && !result.error && (
          <div style={{ marginTop: 16 }}>
            <div className="step-chain">
              <div className="step-item">
                <span className="step-label">Ciphertext 1</span>
                <span className="hex-display" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>{result.ct1}</span>
              </div>
              <div className="step-item">
                <span className="step-label">Ciphertext 2</span>
                <span className="hex-display" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>{result.ct2}</span>
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
            {result.ps1 && (
              <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-well)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                  PKCS#1 v1.5 Padding Bytes (PS)
                </div>
                <PsPanel label="PS₁ (Encryption 1)" ps={result.ps1} />
                <PsPanel label="PS₂ (Encryption 2)" ps={result.ps2} />
                <div style={{ marginTop: 8, fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  EM = 0x00 ‖ 0x02 ‖ PS (random, non-zero) ‖ 0x00 ‖ m — each colour encodes a distinct random byte value.
                  Fresh PS per encryption ⇒ different ciphertexts even for identical m.
                </div>
              </div>
            )}
          </div>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
