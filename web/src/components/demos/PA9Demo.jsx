import React, { useState } from 'react';
import { api } from '../../api';
import DemoHeader from '../DemoHeader';
import CopyVal from '../CopyVal';

function BirthdayChart({ result, n }) {
  if (!result || !result.found) return null;

  const W = 480, H = 160;
  const padL = 44, padR = 16, padT = 12, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxK = Math.max(result.evaluations * 1.3, result.expected_2_to_n_over_2 * 1.5);
  const domain = Math.pow(2, n);
  const kMax = Math.min(maxK, domain);

  const prob = (k) => 1 - Math.exp(-k * (k - 1) / Math.pow(2, n + 1));

  const steps = 200;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const k = (i / steps) * kMax;
    const p = prob(k);
    const cx = padL + (k / kMax) * plotW;
    const cy = padT + plotH - p * plotH;
    return `${cx},${cy}`;
  }).join(' ');

  const toX = (k) => padL + (k / kMax) * plotW;
  const toY = (p) => padT + plotH - p * plotH;

  const expX = toX(result.expected_2_to_n_over_2);
  const actX = toX(result.evaluations);
  const actColor = result.evaluations <= result.expected_2_to_n_over_2 * 1.5
    ? 'var(--accent-green)' : 'var(--accent-orange)';

  return (
    <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: '12px 8px', border: '1px solid var(--border)', marginTop: 14 }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
        Collision probability vs evaluations k — theoretical curve P(k) = 1 − e^(−k(k−1)/2^(n+1))
      </div>
      <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT+plotH} stroke="var(--border)" strokeWidth={1} />
        <line x1={padL} y1={padT+plotH} x2={padL+plotW} y2={padT+plotH} stroke="var(--border)" strokeWidth={1} />

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1.0].map(p => (
          <g key={p}>
            <line x1={padL-3} y1={toY(p)} x2={padL} y2={toY(p)} stroke="var(--border)" strokeWidth={1} />
            <text x={padL-5} y={toY(p)+4} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-muted)">{p.toFixed(2)}</text>
          </g>
        ))}

        {/* 50% dashed line */}
        <line x1={padL} y1={toY(0.5)} x2={padL+plotW} y2={toY(0.5)}
          stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 3" />
        <text x={padL+plotW-2} y={toY(0.5)-4} textAnchor="end" fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-muted)">50%</text>

        {/* Theoretical curve */}
        <polyline points={points} fill="none" stroke="var(--accent-blue)" strokeWidth={2} />

        {/* Expected 2^(n/2) vertical */}
        <line x1={expX} y1={padT} x2={expX} y2={padT+plotH}
          stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="5 3" />
        <text x={expX+2} y={padT+10} fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-muted)">2^(n/2)</text>

        {/* Actual collision vertical */}
        <line x1={actX} y1={padT} x2={actX} y2={padT+plotH}
          stroke={actColor} strokeWidth={2} />
        <text x={actX+2} y={padT+22} fontSize={8} fontFamily="var(--font-mono)" fill={actColor}>actual</text>

        {/* Dot at actual collision */}
        <circle cx={actX} cy={toY(prob(result.evaluations))} r={4} fill={actColor} />

        {/* X-axis label */}
        <text x={padL + plotW/2} y={H-4} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-muted)">k (evaluations)</text>
        <text x={8} y={padT + plotH/2} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-muted)"
          transform={`rotate(-90,8,${padT + plotH/2})`}>P(collision)</text>
      </svg>
    </div>
  );
}

export default function PA9Demo({ onNavigate }) {
  const [n, setN] = useState(12);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const reset = () => { setN(12); setResult(null); };

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.birthday.attack(n);
      setResult(r);
    } catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  const expected = Math.pow(2, n/2);

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={9} title="Live Birthday Attack" tag="CRHF" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Hash n-bit outputs. Expected collision at O(2^(n/2)) evaluations. The birthday bound is information-theoretically tight.
        </p>
        <div className="form-group">
          <label>Output bit length n: {n} bits (target: 2^(n/2) = {expected.toFixed(0)} evaluations)</label>
          <input type="range" min={8} max={16} step={2} value={n} onChange={e=>setN(+e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {[8,10,12,14,16].map(v=><span key={v}>{v}</span>)}
          </div>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {'▶ Run Birthday Attack'}
        </button>
        {result && !result.error && (
          <>
            <div className="result-box" style={{ marginTop: 14 }}>
              {result.found ? (
                <>
                  <div style={{ color: 'var(--accent-green)', fontWeight: 700, marginBottom: 8 }}>✓ Collision Found!</div>
                  <div><span className="result-key">x₁: </span><CopyVal>{result.x1}</CopyVal></div>
                  <div><span className="result-key">x₂: </span><CopyVal>{result.x2}</CopyVal></div>
                  <div><span className="result-key">H(x₁)=H(x₂): </span><CopyVal>{result.hash}</CopyVal></div>
                  <div><span className="result-key">Evaluations: </span><span className="result-val">{result.evaluations}</span></div>
                  <div><span className="result-key">Expected 2^(n/2): </span><span className="result-val">{result.expected_2_to_n_over_2}</span></div>
                  <div><span className="result-key">Ratio: </span><span className="result-val">{result.ratio?.toFixed(2)}×</span></div>
                  <div><span className="result-key">Time: </span><span className="result-val">{result.time_sec?.toFixed(3)}s</span></div>
                </>
              ) : (
                <div style={{ color: 'var(--accent-red)' }}>No collision found in {result.evaluations} attempts</div>
              )}
            </div>
            <BirthdayChart result={result} n={n} />
          </>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
      </div>
      {onNavigate && (
        <div className="demo-related">
          <span className="demo-related-label">Related:</span>
          <button className="demo-xlink" onClick={() => onNavigate('PA7')}>PA7 Merkle-Damgård →</button>
        </div>
      )}
      <div className="demo-card">
        <h4>MD5/SHA-1 Context</h4>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
          <div>MD5 (n=128): needs ~2^64 ops → broken in 2005</div>
          <div>SHA-1 (n=160): needs ~2^80 ops → broken in 2017</div>
          <div>SHA-256 (n=256): needs ~2^128 ops → currently secure</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>
            At 10^9 hashes/sec: 2^128 ops ≈ 10^29 years (age of universe: ~10^10 years)
          </div>
        </div>
      </div>
    </div>
  );
}
