import React, { useState } from 'react';
import { api } from '../../api';

export default function PA18Demo() {
  const [b, setB] = useState(0);
  const [m0, setM0] = useState('Hello');
  const [m1, setM1] = useState('World');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // OT protocol uses integer messages; encode strings as char-codes sum for demo
  function strToInt(s) {
    return s.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
  }

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.ot.run(b, strToInt(m0), strToInt(m1));
      setResult({ ...r, m0_int: strToInt(m0), m1_int: strToInt(m1) });
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="demo-card">
        <h4>PA#18 — 1-of-2 Oblivious Transfer (Bellare-Micali)</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Receiver learns m_b without revealing b to sender. Sender learns nothing about b.
          Built on ElGamal: receiver creates an honest pk_b and a random pk_{'{1-b}'} (no trapdoor).
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              m₀ (Sender's message 0)
            </label>
            <input className="hex-input" value={m0} onChange={e => setM0(e.target.value)} style={{ width: '100%' }} />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              int encoding: {strToInt(m0)}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              m₁ (Sender's message 1)
            </label>
            <input className="hex-input" value={m1} onChange={e => setM1(e.target.value)} style={{ width: '100%' }} />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              int encoding: {strToInt(m1)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem' }}>Receiver's choice bit b:</span>
          {[0, 1].map(v => (
            <button key={v} className={`btn btn-${b === v ? 'primary' : 'secondary'}`}
              style={{ padding: '4px 20px' }} onClick={() => { setB(v); setResult(null); }}>
              b = {v}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? 'Running OT…' : 'Run OT Protocol'}
        </button>

        {result && !result.error && (
          <div className="step-chain" style={{ marginTop: 16 }}>
            <div className="step-item">
              <span className="step-label">Receiver step 1</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                pk_b = honest ElGamal key (has secret x_b)
                <br />pk_{'{1-b}'} = random point (no trapdoor — sender can't tell which is which)
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">Sender encrypts</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                C₀ = ElGamal.Enc(pk₀, m₀), C₁ = ElGamal.Enc(pk₁, m₁)
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">Receiver gets m_{b}</span>
              <span className="badge badge-success">
                {String(result.received)} {result.received === (b === 0 ? result.m0_int : result.m1_int) ? '✓' : ''}
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">Expected m_{b} = m{b}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {b === 0 ? result.m0_int : result.m1_int}
                {result.received === (b === 0 ? result.m0_int : result.m1_int) ? ' ✓ correct' : ' ✗ error'}
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">Receiver-privacy</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Sender sees (pk₀, pk₁) but both look uniform — b is statistically hidden
              </span>
            </div>
          </div>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
