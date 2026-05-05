import React, { useState } from 'react';
import { api } from '../../api';
import HexInput from '../HexInput';
import DemoHeader from '../DemoHeader';

export default function PA3Demo() {
  const [key] = useState(() => Array.from({length:16},()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join(''));
  const [m0, setM0] = useState('48656c6c6f');
  const [m1, setM1] = useState('576f726c64');
  const [rounds, setRounds] = useState([]);
  const [advantage, setAdvantage] = useState(0);
  const [reuse, setReuse] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingRound, setPendingRound] = useState(null);

  const requestChallenge = async () => {
    if (!m0 || !m1 || m0.length !== m1.length || m0.length % 2 !== 0) return;
    setLoading(true);
    setError(null);
    try {
      const b = Math.random() < 0.5 ? 0 : 1;
      const msg = b === 0 ? m0 : m1;
      const enc = await api.enc.cpa(key, msg, reuse);

      if (reuse) {
        // Broken mode: deterministic nonce → c = F_k(0) ⊕ m_b.
        // Fetch reference ciphertext for m0 with the same broken nonce, then compare.
        const ref0 = await api.enc.cpa(key, m0, true);
        const autoGuess = enc.ciphertext === ref0.ciphertext ? 0 : 1;
        const correct = autoGuess === b;
        const newRound = { b, guess: autoGuess, correct, auto: true,
          ct: enc.ciphertext?.slice(0,16)+'…', r: enc.r?.slice(0,8)+'…' };
        setRounds(prev => {
          const next = [...prev, newRound].slice(-20);
          const wins = next.filter(rd=>rd.correct).length;
          setAdvantage(Math.abs(wins/next.length - 0.5));
          return next;
        });
      } else {
        setPendingRound({ b, ct: enc.ciphertext, r: enc.r });
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const submitGuess = (guess) => {
    if (!pendingRound) return;
    const { b, ct, r } = pendingRound;
    const correct = guess === b;
    const newRound = { b, guess, correct, auto: false, ct: ct?.slice(0,16)+'…', r: r?.slice(0,8)+'…' };
    setRounds(prev => {
      const next = [...prev, newRound].slice(-20);
      const wins = next.filter(rd=>rd.correct).length;
      setAdvantage(Math.abs(wins/next.length - 0.5));
      return next;
    });
    setPendingRound(null);
  };

  const advColor = advantage < 0.1 ? 'var(--accent-green)' : 'var(--accent-red)';

  const reset = () => {
    setM0('48656c6c6f');
    setM1('576f726c64');
    setRounds([]);
    setAdvantage(0);
    setReuse(false);
    setError(null);
    setPendingRound(null);
  };

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={3} title="IND-CPA Security Game" tag="IND-CPA" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Play the IND-CPA game: challenger encrypts either m₀ or m₁; you try to guess which.
          In secure mode, your advantage should converge to ≈0.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <HexInput label="Message m₀ (hex)" value={m0} onChange={setM0} disabled={loading || !!pendingRound} />
          <HexInput label="Message m₁ (hex, same length)" value={m1} onChange={setM1} disabled={loading || !!pendingRound} />
        </div>
        {m0.length !== m1.length && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: 4 }}>⚠ Messages must be of equal length.</div>
        )}
        {m0.length % 2 !== 0 && m0.length === m1.length && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: 4 }}>⚠ Message lengths must be even (valid hex).</div>
        )}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, marginTop: 14, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={reuse} onChange={e=>setReuse(e.target.checked)} disabled={!!pendingRound} />
            <span>Reuse nonce (BROKEN mode)</span>
          </label>
          {reuse && <span className="badge badge-broken">⚠ BROKEN</span>}
          {!reuse && <span className="badge badge-secure">✓ SECURE</span>}
        </div>

        {!pendingRound ? (
          <button className="btn btn-primary" onClick={requestChallenge} disabled={loading || !m0 || m0.length !== m1.length || m0.length % 2 !== 0}>
            {reuse ? 'Encrypt + Auto-Break (Challenger picks b)' : 'Encrypt (Challenger picks b)'}
          </button>
        ) : (
          <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 14, marginBottom: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
              <div>Challenger sent ciphertext (r, c):</div>
              <div style={{ fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                r = {pendingRound.r?.slice(0,16)}… &nbsp;&nbsp; ct = {pendingRound.ct?.slice(0,16)}…
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Your guess — was this m</span>
              <button className="btn btn-primary" style={{ minWidth: 56 }} onClick={() => submitGuess(0)}>m₀</button>
              <button className="btn btn-primary" style={{ minWidth: 56 }} onClick={() => submitGuess(1)}>m₁</button>
            </div>
          </div>
        )}

        <div className="form-group" style={{ marginTop: 14 }}>
          <label>Adversary Advantage: {(advantage*100).toFixed(1)}% (target ≤10%)</label>
          <div className="advantage-bar">
            <div className="advantage-fill" style={{ width: `${Math.min(advantage*200, 100)}%`, background: advColor }} />
          </div>
        </div>
        {reuse && rounds.length > 0 && (
          <div style={{ marginBottom: 8, padding: 10, background: 'rgba(231,76,60,0.06)', borderRadius: 6,
            border: '1px solid rgba(231,76,60,0.2)', fontSize: '0.74rem', color: 'var(--accent-red)', lineHeight: 1.5 }}>
            <strong>Broken mode:</strong> F_k(0) ⊕ m is deterministic. Adversary encrypts m₀ with the same fixed nonce,
            compares ct* with ref enc(m₀) — match ⇒ b=0, no match ⇒ b=1. Advantage = 1.
          </div>
        )}
        {rounds.length > 0 && (
          <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            {rounds.slice(-5).reverse().map((r,i) => (
              <div key={i} style={{ padding: '3px 0', color: r.correct ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                Round: b={r.b}, guess={r.guess}{r.auto ? ' [auto]' : ''} → {r.correct ? '✓ Correct' : '✗ Wrong'} | CT: {r.ct}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Rounds played: {rounds.length}/20 | Advantage: {advantage.toFixed(3)}
        </div>
        {error && <div className="hex-display red" style={{ marginTop: 8 }}>Error: {error}</div>}
      </div>
    </div>
  );
}
