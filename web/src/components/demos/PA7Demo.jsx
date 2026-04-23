import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import CopyHex from '../CopyHex';
import DemoHeader from '../DemoHeader';

const DEFAULT_MSG_7 = 'Hello Merkle-Damgård!';

export default function PA7Demo() {
  const [msg, setMsg] = useState(DEFAULT_MSG_7);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const doRun = async (m) => {
    setLoading(true);
    try {
      const hex = Array.from(new TextEncoder().encode(m)).map(b=>b.toString(16).padStart(2,'0')).join('');
      const r = await api.hash.md(hex);
      setResult(r);
    } catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  const run = () => doRun(msg);
  const reset = () => { setMsg(DEFAULT_MSG_7); setResult(null); doRun(DEFAULT_MSG_7); };

  useEffect(() => { doRun(DEFAULT_MSG_7); }, []); // eslint-disable-line

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={7} title="Merkle-Damgård Chain Viewer" tag="CRHF" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Pads message, splits into blocks, applies compression function iteratively. z₀ → h(z₀,M₁) → h(z₁,M₂) → …
        </p>
        <div className="form-group">
          <label>Message (text)</label>
          <input
            type="text"
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && run()}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 14 }}>
          {loading ? 'Hashing…' : '▶ Hash with Merkle-Damgård'}
        </button>
        {result && !result.error && (
          <div>
            <div className="form-group">
              <label>Message (hex)</label>
              <CopyHex value={result.message} />
            </div>
            <div className="form-group">
              <label>Digest</label>
              <CopyHex value={result.digest} />
            </div>
          </div>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
      </div>
      <div className="demo-card">
        <h4>MD Padding Construction</h4>
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
