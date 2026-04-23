import React, { useState } from 'react';
import { api } from '../../api';

export default function PA20Demo() {
  const [x, setX] = useState(7);
  const [y, setY] = useState(5);
  const [nBits, setNBits] = useState(4);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const maxVal = Math.pow(2, nBits) - 1;

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.mpc.millionaire(
        Math.min(x, maxVal),
        Math.min(y, maxVal),
        nBits
      );
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  const clampedX = Math.min(x, maxVal);
  const clampedY = Math.min(y, maxVal);

  return (
    <div>
      <div className="demo-card">
        <h4>PA#20 — 2-Party MPC: Millionaire's Problem</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Alice has secret wealth x, Bob has secret wealth y. A circuit of AND/XOR/NOT gates
          (PA#19) computes x &gt; y securely — neither party reveals their value.
        </p>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bit width:</label>
          {[2, 3, 4].map(n => (
            <button key={n} className={`btn btn-${nBits === n ? 'primary' : 'secondary'}`}
              style={{ marginLeft: 8, padding: '2px 10px', fontSize: '0.8rem' }}
              onClick={() => { setNBits(n); setResult(null); }}>
              {n}-bit (0–{Math.pow(2, n) - 1})
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--accent-blue)', display: 'block', marginBottom: 4 }}>
              Alice: x = {clampedX}
            </label>
            <input type="range" min={0} max={maxVal} value={clampedX}
              onChange={e => { setX(Number(e.target.value)); setResult(null); }}
              style={{ width: '100%' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--accent-orange)', display: 'block', marginBottom: 4 }}>
              Bob: y = {clampedY}
            </label>
            <input type="range" min={0} max={maxVal} value={clampedY}
              onChange={e => { setY(Number(e.target.value)); setResult(null); }}
              style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 6, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', marginBottom: 4 }}>Alice</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
              {'$'.repeat(clampedX)}
              {clampedX === 0 && <span style={{ opacity: 0.3 }}>$</span>}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>x = {clampedX}</div>
          </div>
          <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>vs</div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', marginBottom: 4 }}>Bob</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--accent-orange)' }}>
              {'$'.repeat(clampedY)}
              {clampedY === 0 && <span style={{ opacity: 0.3 }}>$</span>}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>y = {clampedY}</div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? 'Evaluating Circuit…' : 'Run Secure Comparison'}
        </button>

        {result && !result.error && (
          <div className="step-chain" style={{ marginTop: 16 }}>
            <div className="step-item">
              <span className="step-label">Circuit complexity</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {nBits} AND gates (via OT, paid) + {nBits} XOR gates (free)
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">x &gt; y?</span>
              <span className={`badge ${result.x_gt_y ? 'badge-success' : 'badge-secondary'}`}>
                {result.x_gt_y ? 'YES' : 'NO'}
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">x == y?</span>
              <span className={`badge ${result.x_eq_y ? 'badge-success' : 'badge-secondary'}`}>
                {result.x_eq_y ? 'YES' : 'NO'}
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">Millionaire winner</span>
              <span className="badge badge-success" style={{ fontSize: '1rem' }}>
                {result.x_eq_y
                  ? '🤝 Tie — equal wealth!'
                  : result.x_gt_y
                    ? '🏆 Alice is richer!'
                    : '🏆 Bob is richer!'}
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">Plaintext check</span>
              <span style={{ fontSize: '0.8rem', color: result.x_gt_y === (clampedX > clampedY) ? 'var(--accent-green, #4ade80)' : 'var(--accent-red)' }}>
                {clampedX} &gt; {clampedY} = {clampedX > clampedY ? 'true' : 'false'}
                {result.x_gt_y === (clampedX > clampedY) ? ' ✓ matches' : ' ✗ BUG'}
              </span>
            </div>
          </div>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
