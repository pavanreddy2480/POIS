import React, { useState } from 'react';
import { api } from '../../api';

const GATE_ROWS = [
  { a: 0, b: 0 }, { a: 0, b: 1 }, { a: 1, b: 0 }, { a: 1, b: 1 },
];

export default function PA19Demo() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const r = await api.secureAnd.compute(a, b);
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="demo-card">
        <h4>PA#19 — Secure AND Gate via OT</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Alice holds bit a, Bob holds bit b. Using 1-of-2 OT: Alice sends (0, a); Bob chooses
          index b and receives m_b = a∧b — without Alice learning b or Bob learning a.
          XOR and NOT are free via additive secret sharing.
        </p>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'flex-start' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Alice's bit a
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1].map(v => (
                <button key={v} className={`btn btn-${a === v ? 'primary' : 'secondary'}`}
                  style={{ padding: '4px 16px' }} onClick={() => { setA(v); setResult(null); }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Bob's bit b
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1].map(v => (
                <button key={v} className={`btn btn-${b === v ? 'primary' : 'secondary'}`}
                  style={{ padding: '4px 16px' }} onClick={() => { setB(v); setResult(null); }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              Expected a∧b
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-orange)' }}>
              {a & b}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {'Compute Secure AND'}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowTable(!showTable)}>
            {showTable ? 'Hide' : 'Show'} Truth Table
          </button>
        </div>

        {showTable && (
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)' }}>
                {['a', 'b', 'AND (via OT)', 'XOR (free)', 'NOT a (free)'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border-color)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GATE_ROWS.map(row => (
                <tr key={`${row.a}${row.b}`}
                  style={{ background: row.a === a && row.b === b ? 'rgba(212,175,55,0.1)' : 'transparent' }}>
                  <td style={{ padding: '4px 8px' }}>{row.a}</td>
                  <td style={{ padding: '4px 8px' }}>{row.b}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--accent-orange)' }}>{row.a & row.b}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--accent-blue)' }}>{row.a ^ row.b}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{1 - row.a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {result && !result.error && (
          <div className="step-chain">
            <div className="step-item">
              <span className="step-label">OT transcript</span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Alice sends: m₀=0, m₁={a}<br />
                Bob chose: b={b} → received m_{b} = {result.AND}
              </div>
            </div>
            <div className="step-item">
              <span className="step-label">a AND b = {a}∧{b}</span>
              <span className={`badge ${result.AND === (a & b) ? 'badge-success' : 'badge-danger'}`}>
                {result.AND} {result.AND === (a & b) ? '✓' : '✗'}
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">a XOR b = {a}⊕{b}</span>
              <span className="badge" style={{ background: 'rgba(96,165,250,0.15)', color: 'var(--accent-blue)' }}>
                {result.XOR}
              </span>
            </div>
            <div className="step-item">
              <span className="step-label">NOT a = ¬{a}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{result.NOT_a}</span>
            </div>
          </div>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
