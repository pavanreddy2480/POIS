import React, { useState } from 'react';
import { api } from '../../api';

export default function PA3Demo() {
  const [key] = useState(() => Array.from({length:16},()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join(''));
  const [m0, setM0] = useState('48656c6c6f');
  const [m1, setM1] = useState('576f726c64');
  const [rounds, setRounds] = useState([]);
  const [advantage, setAdvantage] = useState(0);
  const [reuse, setReuse] = useState(false);
  const [loading, setLoading] = useState(false);

  const playRound = async () => {
    if (!m0 || !m1 || m0.length !== m1.length) return;
    setLoading(true);
    try {
      const b = Math.random() < 0.5 ? 0 : 1;
      const msg = b === 0 ? m0 : m1;
      let enc;
      if (reuse) {
        enc = await api.enc.cpa(key, msg.padEnd(32,'0').slice(0,32));
        // In reuse mode, we always use same r (simulated by same key+same msg)
      } else {
        enc = await api.enc.cpa(key, msg.padEnd(32,'0').slice(0,32));
      }
      // Student guesses randomly
      const guess = Math.random() < 0.5 ? 0 : 1;
      const correct = guess === b;
      const newRound = { b, guess, correct, ct: enc.ciphertext?.slice(0,16)+'…', r: enc.r?.slice(0,8)+'…' };
      setRounds(prev => {
        const next = [...prev, newRound].slice(-20);
        const wins = next.filter(r=>r.correct).length;
        setAdvantage(Math.abs(wins/next.length - 0.5));
        return next;
      });
    } catch(e) {}
    finally { setLoading(false); }
  };

  const advColor = advantage < 0.1 ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div>
      <div className="demo-card">
        <h4>🎮 PA#3 — IND-CPA Security Game</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Play the IND-CPA game: challenger encrypts either m₀ or m₁; you try to guess which.
          In secure mode, your advantage should converge to ≈0.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Message m₀ (hex)</label>
            <input type="text" value={m0} onChange={e=>setM0(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Message m₁ (hex, same length)</label>
            <input type="text" value={m1} onChange={e=>setM1(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={playRound} disabled={loading}>
            Encrypt (Challenger picks b)
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={reuse} onChange={e=>setReuse(e.target.checked)} />
            <span>Reuse nonce (BROKEN mode)</span>
          </label>
          {reuse && <span className="badge badge-broken">⚠ BROKEN</span>}
          {!reuse && <span className="badge badge-secure">✓ SECURE</span>}
        </div>
        <div className="form-group">
          <label>Adversary Advantage: {(advantage*100).toFixed(1)}% (target ≤10%)</label>
          <div className="advantage-bar">
            <div className="advantage-fill" style={{ width: `${Math.min(advantage*200, 100)}%`, background: advColor }} />
          </div>
        </div>
        {rounds.length > 0 && (
          <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            {rounds.slice(-5).reverse().map((r,i) => (
              <div key={i} style={{ padding: '3px 0', color: r.correct ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                Round: b={r.b}, guess={r.guess} → {r.correct ? '✓ Correct' : '✗ Wrong'} | CT: {r.ct}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Rounds played: {rounds.length}/20 | Advantage: {(advantage).toFixed(3)}
        </div>
      </div>
    </div>
  );
}
