import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import CopyHex from '../CopyHex';
import DemoHeader from '../DemoHeader';

const DEFAULT_MSG_8 = 'Hello DLP Hash!';

export default function PA8Demo() {
  const [msg, setMsg] = useState(DEFAULT_MSG_8);
  const [result, setResult] = useState(null);
  const [birthday, setBirthday] = useState(null);
  const [loading, setLoading] = useState(false);
  const [huntLoading, setHuntLoading] = useState(false);

  const doRun = async (m) => {
    setLoading(true);
    try {
      const hex = Array.from(new TextEncoder().encode(m)).map(b=>b.toString(16).padStart(2,'0')).join('');
      const r = await api.hash.dlp(hex);
      setResult(r);
    } catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  const run = () => doRun(msg);
  const reset = () => { setMsg(DEFAULT_MSG_8); setResult(null); setBirthday(null); doRun(DEFAULT_MSG_8); };

  const hunt = async () => {
    setHuntLoading(true);
    try {
      const r = await api.birthday.attack(12);
      setBirthday(r);
    } catch(e) { setBirthday({ error: e.message }); }
    finally { setHuntLoading(false); }
  };

  useEffect(() => { doRun(DEFAULT_MSG_8); }, []); // eslint-disable-line

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={8} title="DLP-Based Collision-Resistant Hash" tag="DLP-CRHF" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          h(x,y) = g^x · ĥ^y mod p (DLP compression) wrapped in Merkle-Damgård. Collision resistance reduces to DLP hardness.
        </p>
        <div className="form-group">
          <label>Message</label>
          <input
            type="text"
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && run()}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 10 }}>
          {loading ? 'Computing…' : '▶ Compute DLP_Hash'}
        </button>
        {result && !result.error && (
          <div className="form-group">
            <label>Digest</label>
            <CopyHex value={result.digest} />
          </div>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
      </div>
      <div className="demo-card">
        <h4>Collision Hunt (Birthday Attack, n=12 bits)</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
          Expected collision near 2^(n/2) = 2^6 = 64 evaluations. Progress bar shows count vs 2^(n/2).
        </p>
        <button className="btn btn-primary" onClick={hunt} disabled={huntLoading} style={{ marginBottom: 10 }}>
          {huntLoading ? 'Searching...' : '▶ Run Birthday Attack'}
        </button>
        {birthday?.error && <div className="hex-display red">{birthday.error}</div>}
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
