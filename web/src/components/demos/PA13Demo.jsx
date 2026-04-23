import React, { useState } from 'react';
import { api } from '../../api';

export default function PA13Demo() {
  const [n, setN] = useState('561');
  const [k, setK] = useState(20);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.millerRabin.test(parseInt(n), k);
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  async function genPrime() {
    setLoading(true);
    try {
      const r = await api.millerRabin.genPrime(32);
      setN(String(parseInt(r.prime, 16)));
      setResult(null);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="demo-card">
        <h4>PA#13 — Miller-Rabin Primality Test</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          561 is the smallest Carmichael number — it fools Fermat's test but Miller-Rabin catches it.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Number n
            </label>
            <input
              className="hex-input"
              value={n}
              onChange={e => setN(e.target.value)}
              placeholder="integer to test"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ width: 130 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Rounds k = {k}
            </label>
            <input
              type="range" min={1} max={40} value={k}
              onChange={e => setK(Number(e.target.value))}
              style={{ width: '100%', marginTop: 6 }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? 'Testing…' : 'Test Primality'}
          </button>
          <button className="btn btn-secondary" onClick={genPrime} disabled={loading}>
            Gen 32-bit Prime
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {[['561 (Carmichael)', '561'], ['1105', '1105'], ['1009 (prime)', '1009'], ['7919 (prime)', '7919']].map(([label, val]) => (
            <button key={val} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }}
              onClick={() => { setN(val); setResult(null); }}>
              {label}
            </button>
          ))}
        </div>

        {result && !result.error && (
          <div className="step-chain">
            <div className="step-item">
              <span className="step-label">Miller-Rabin (k={result.rounds || k})</span>
              <span className={`badge ${result.result === 'PROBABLY_PRIME' ? 'badge-success' : 'badge-danger'}`}>
                {result.result}
              </span>
            </div>
            {result.witness && (
              <div className="step-item">
                <span className="step-label">Composite Witness</span>
                <span className="hex-display">{String(result.witness)}</span>
              </div>
            )}
            <div className="step-item">
              <span className="step-label">Error bound</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Pr[error] ≤ 4<sup>-{k}</sup> ≈ {(Math.pow(4, -k)).toExponential(2)}
              </span>
            </div>
          </div>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
