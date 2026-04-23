import React, { useState } from 'react';
import { api } from '../../api';
import DemoHeader from '../DemoHeader';

const MODES = ['CBC', 'OFB', 'CTR'];

const MSG_DEFAULT = '48656c6c6f20576f726c642120426c6f636b';

export default function PA4Demo() {
  const [mode, setMode] = useState('CBC');
  const [key] = useState('0123456789abcdef0123456789abcdef');
  const [msg, setMsg] = useState(MSG_DEFAULT);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const enc = await api.modes.encrypt(mode, key, msg.padEnd(32,'0'));
      setResult(enc);
    } catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  const reset = () => { setMode('CBC'); setMsg(MSG_DEFAULT); setResult(null); };

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={4} title="Block Cipher Mode Animator" tag="PRP" onReset={reset} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {MODES.map(m => (
            <button key={m} className={`btn ${mode===m?'btn-primary':'btn-secondary'}`} onClick={()=>setMode(m)}>{m}</button>
          ))}
        </div>
        <div className="form-group">
          <label>Message (hex)</label>
          <input type="text" value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!loading&&run()} />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 14 }}>
          {loading ? 'Encrypting…' : `▶ Encrypt with ${mode}`}
        </button>
        {result && !result.error && (
          <div className="result-box">
            <div><span className="result-key">Mode: </span><span className="result-val">{result.mode}</span></div>
            <div><span className="result-key">IV/Nonce: </span><span className="result-val">{result.iv || result.nonce}</span></div>
            <div><span className="result-key">Ciphertext: </span><span className="result-val">{result.ciphertext}</span></div>
            <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {mode==='CBC' && 'CBC: sequential encryption, parallel decryption, 2-block error propagation, IV reuse is fatal.'}
              {mode==='OFB' && 'OFB: keystream independent of plaintext, decryption = encryption, IV reuse is fatal.'}
              {mode==='CTR' && 'CTR: fully parallelizable, random access, nonce must be unique per key.'}
            </div>
          </div>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
      </div>
      <div className="demo-card" style={{ background: 'rgba(46,204,113,0.04)', borderColor: 'rgba(46,204,113,0.2)' }}>
        <h4>Mode Comparison</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead><tr style={{ color: 'var(--text-secondary)' }}>
            <th align="left" style={{ padding: 6 }}>Mode</th>
            <th align="center" style={{ padding: 6 }}>Par. Enc</th>
            <th align="center" style={{ padding: 6 }}>Par. Dec</th>
            <th align="center" style={{ padding: 6 }}>Error Prop</th>
            <th align="center" style={{ padding: 6 }}>IV Reuse</th>
          </tr></thead>
          <tbody>
            {[['CBC','✗','✓','2 blocks','Fatal'],['OFB','✗','✗','None','Fatal'],['CTR','✓','✓','None','Fatal']].map(([m,...r])=>(
              <tr key={m} style={{ borderTop: '1px solid var(--border)', background: mode===m?'rgba(74,158,255,0.05)':'' }}>
                <td style={{ padding: 6, color: 'var(--accent-blue)', fontWeight: 700 }}>{m}</td>
                {r.map((v,i)=><td key={i} align="center" style={{ padding: 6, color: v==='✓'?'var(--accent-green)':v==='Fatal'?'var(--accent-red)':'var(--text-secondary)' }}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
