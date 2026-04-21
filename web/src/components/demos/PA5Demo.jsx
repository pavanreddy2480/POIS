import React, { useState } from 'react';
import { api } from '../../api';

const HIDDEN_KEY = '8f3a1b2c4d5e6f70';

export default function PA5Demo() {
  const [signedMsgs, setSignedMsgs] = useState([]);
  const [forgeMsg, setForgeMsg] = useState('');
  const [forgeTag, setForgeTag] = useState('');
  const [forgeResult, setForgeResult] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [loading, setLoading] = useState(false);

  const addSigned = async () => {
    setLoading(true);
    try {
      const msg = Array.from({length:4},()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join('');
      const r = await api.mac.sign(HIDDEN_KEY, msg);
      setSignedMsgs(prev => [...prev.slice(-49), { msg, tag: r.tag }]);
    } catch(e) {}
    finally { setLoading(false); }
  };

  const submitForgery = async () => {
    setLoading(true);
    setAttempts(a => a+1);
    try {
      const r = await api.mac.verify(HIDDEN_KEY, forgeMsg.padEnd(8,'0'), forgeTag);
      const ok = r.valid && !signedMsgs.some(s => s.msg === forgeMsg);
      setForgeResult(ok);
      if (ok) setSuccesses(s => s+1);
    } catch(e) { setForgeResult(false); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="demo-card">
        <h4>🔐 PA#5 — EUF-CMA MAC Forge Attempt</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          You see up to 50 (message, tag) pairs signed with a hidden key k. Try to forge a valid tag on a NEW message.
        </p>
        <button className="btn btn-secondary" onClick={addSigned} disabled={loading || signedMsgs.length >= 50} style={{ marginBottom: 14 }}>
          + Get Signed Message
        </button>
        <div style={{ maxHeight: 140, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: 14 }}>
          {signedMsgs.map((s,i)=>(
            <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              m={s.msg} → t={s.tag.slice(0,16)}…
            </div>
          ))}
          {signedMsgs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No signed messages yet</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="form-group">
            <label>Forge message m* (hex)</label>
            <input type="text" value={forgeMsg} onChange={e=>setForgeMsg(e.target.value)} placeholder="new message" />
          </div>
          <div className="form-group">
            <label>Forge tag t* (hex)</label>
            <input type="text" value={forgeTag} onChange={e=>setForgeTag(e.target.value)} placeholder="guessed tag" />
          </div>
        </div>
        <button className="btn btn-danger" onClick={submitForgery} disabled={loading}>Submit Forgery</button>
        {forgeResult !== null && (
          <div style={{ marginTop: 10 }}>
            <span className={`badge ${forgeResult ? 'badge-broken' : 'badge-secure'}`}>
              {forgeResult ? '⚠ Forgery ACCEPTED' : '✓ Forgery REJECTED'}
            </span>
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Attempts: {attempts} | Successes: {successes} (expected 0 in ≥20 attempts)
        </div>
      </div>
    </div>
  );
}
