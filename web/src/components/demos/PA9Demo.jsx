import React, { useState } from 'react';
import { api } from '../../api';

export default function PA9Demo() {
  const [n, setN] = useState(12);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.birthday.attack(n);
      setResult(r);
    } catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  const expected = Math.pow(2, n/2);

  return (
    <div>
      <div className="demo-card">
        <h4>🎂 PA#9 — Live Birthday Attack</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Hash n-bit outputs. Expected collision at O(2^(n/2)) evaluations. The birthday bound is information-theoretically tight.
        </p>
        <div className="form-group">
          <label>Output bit length n: {n} bits (target: 2^(n/2) = {expected.toFixed(0)} evaluations)</label>
          <input type="range" min={8} max={16} step={2} value={n} onChange={e=>setN(+e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {[8,10,12,14,16].map(v=><span key={v}>{v}</span>)}
          </div>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? '🔍 Running Attack...' : '▶ Run Birthday Attack'}
        </button>
        {result && !result.error && (
          <div className="result-box" style={{ marginTop: 14 }}>
            {result.found ? (
              <>
                <div style={{ color: 'var(--accent-green)', fontWeight: 700, marginBottom: 8 }}>✓ Collision Found!</div>
                <div><span className="result-key">x₁: </span><span className="result-val">{result.x1}</span></div>
                <div><span className="result-key">x₂: </span><span className="result-val">{result.x2}</span></div>
                <div><span className="result-key">H(x₁)=H(x₂): </span><span className="result-val">{result.hash}</span></div>
                <div><span className="result-key">Evaluations: </span><span className="result-val">{result.evaluations}</span></div>
                <div><span className="result-key">Expected 2^(n/2): </span><span className="result-val">{result.expected_2_to_n_over_2}</span></div>
                <div><span className="result-key">Ratio: </span><span className="result-val">{result.ratio?.toFixed(2)}×</span></div>
                <div><span className="result-key">Time: </span><span className="result-val">{result.time_sec?.toFixed(3)}s</span></div>
              </>
            ) : (
              <div style={{ color: 'var(--accent-red)' }}>No collision found in {result.evaluations} attempts</div>
            )}
          </div>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
      </div>
      <div className="demo-card">
        <h4>📊 MD5/SHA-1 Context</h4>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
          <div>MD5 (n=128): needs ~2^64 ops → broken in 2005</div>
          <div>SHA-1 (n=160): needs ~2^80 ops → broken in 2017</div>
          <div>SHA-256 (n=256): needs ~2^128 ops → currently secure</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>
            At 10^9 hashes/sec: 2^128 ops ≈ 10^29 years (age of universe: ~10^10 years)
          </div>
        </div>
      </div>
    </div>
  );
}
