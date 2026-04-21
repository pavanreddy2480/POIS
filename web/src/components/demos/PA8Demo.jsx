import React, { useState } from 'react';
import { api } from '../../api';

export default function PA8Demo() {
  const [msg, setMsg] = useState('Hello DLP Hash!');
  const [result, setResult] = useState(null);
  const [birthday, setBirthday] = useState(null);
  const [loading, setLoading] = useState(false);
  const [huntLoading, setHuntLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const hex = Array.from(new TextEncoder().encode(msg)).map(b=>b.toString(16).padStart(2,'0')).join('');
      const r = await api.hash.dlp(hex);
      setResult(r);
    } catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  const hunt = async () => {
    setHuntLoading(true);
    try {
      const r = await api.birthday.attack(12);
      setBirthday(r);
    } catch(e) { setBirthday({ error: e.message }); }
    finally { setHuntLoading(false); }
  };

  return (
    <div>
      <div className="demo-card">
        <h4>🔢 PA#8 — DLP-Based Collision-Resistant Hash</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          h(x,y) = g^x · ĥ^y mod p (DLP compression) wrapped in Merkle-Damgård. Collision resistance reduces to DLP hardness.
        </p>
        <div className="form-group">
          <label>Message</label>
          <input type="text" value={msg} onChange={e=>setMsg(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 10 }}>▶ Compute DLP_Hash</button>
        {result && !result.error && (
          <div className="result-box">
            <div><span className="result-key">Digest: </span><span className="result-val">{result.digest}</span></div>
          </div>
        )}
      </div>
      <div className="demo-card">
        <h4>🎂 Collision Hunt (Birthday Attack, n=12 bits)</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
          Expected collision near 2^(n/2) = 2^6 = 64 evaluations. Progress bar shows count vs 2^(n/2).
        </p>
        <button className="btn btn-primary" onClick={hunt} disabled={huntLoading} style={{ marginBottom: 10 }}>
          {huntLoading ? '🔍 Searching...' : '▶ Run Birthday Attack'}
        </button>
        {birthday && !birthday.error && (
          <div className="result-box">
            <div><span className="result-key">Found: </span><span className="result-val" style={{ color: birthday.found ? 'var(--accent-green)' : 'var(--accent-red)' }}>{birthday.found ? 'YES' : 'NO'}</span></div>
            {birthday.found && <>
              <div><span className="result-key">x₁: </span><span className="result-val">{birthday.x1}</span></div>
              <div><span className="result-key">x₂: </span><span className="result-val">{birthday.x2}</span></div>
              <div><span className="result-key">Hash: </span><span className="result-val">{birthday.hash}</span></div>
            </>}
            <div><span className="result-key">Evaluations: </span><span className="result-val">{birthday.evaluations} (expected ≈{birthday.expected_2_to_n_over_2})</span></div>
            {birthday.ratio && <div><span className="result-key">Ratio: </span><span className="result-val">{birthday.ratio?.toFixed(2)}× expected</span></div>}
          </div>
        )}
      </div>
    </div>
  );
}
