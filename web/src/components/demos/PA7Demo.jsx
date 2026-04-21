import React, { useState } from 'react';
import { api } from '../../api';

export default function PA7Demo() {
  const [msg, setMsg] = useState('Hello Merkle-Damgård!');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const hex = Array.from(new TextEncoder().encode(msg)).map(b=>b.toString(16).padStart(2,'0')).join('');
      const r = await api.hash.md(hex);
      setResult(r);
    } catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="demo-card">
        <h4>🔗 PA#7 — Merkle-Damgård Chain Viewer</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Pads message, splits into blocks, applies compression function iteratively. z₀ → h(z₀,M₁) → h(z₁,M₂) → …
        </p>
        <div className="form-group">
          <label>Message (text)</label>
          <input type="text" value={msg} onChange={e=>setMsg(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 14 }}>
          ▶ Hash with Merkle-Damgård
        </button>
        {result && !result.error && (
          <div>
            <div className="form-group">
              <label>Message (hex)</label>
              <div className="hex-display">{result.message}</div>
            </div>
            <div className="form-group">
              <label>Digest</label>
              <div className="hex-display">{result.digest}</div>
            </div>
          </div>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
      </div>
      <div className="demo-card">
        <h4>📐 How MD-Strengthening Padding Works</h4>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
          <div>EM = M ‖ 1 ‖ 0* ‖ ⟨|M|⟩₆₄</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            Append 1-bit, then zero-padding, then 64-bit big-endian length of original message.
            Total length is multiple of block size b.
          </div>
        </div>
      </div>
    </div>
  );
}
