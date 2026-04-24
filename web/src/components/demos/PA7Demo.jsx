import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import CopyHex from '../CopyHex';
import DemoHeader from '../DemoHeader';

const DEFAULT_MSG = 'Hello Merkle-Damgård!';

function ChainDiagram({ chain }) {
  if (!chain || chain.length === 0) return null;

  const boxW = 88, boxH = 32, arrowW = 36, gap = 4;
  const itemW = boxW + arrowW + gap;
  const totalW = boxW + (chain.length - 1) * (itemW + gap);
  const svgH = 80;
  const y = 24;

  const boxes = [];
  const arrows = [];

  chain.forEach((entry, i) => {
    const isIV = i === 0;
    const x = i * (itemW + gap);
    const label = isIV ? 'IV' : `M${i}`;
    const hex = isIV ? entry[1] : entry[1];
    const stateHex = isIV ? null : entry[2];

    boxes.push({ x, label, hex, isIV });

    if (!isIV) {
      const arrowX = x - arrowW;
      arrows.push({ x: arrowX, label: 'h(·,·)' });

      if (stateHex) {
        const stateX = x;
        boxes.push({ x: stateX + boxW + arrowW + gap, label: `z${i}`, hex: stateHex, isState: true, _fake: true });
      }
    }
  });

  const stateBoxes = [];
  for (let i = 1; i < chain.length; i++) {
    const x = i * (itemW + gap) + boxW + arrowW / 2;
    stateBoxes.push({ x, label: `z${i}`, hex: chain[i][2] });
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <svg width={Math.max(totalW + 20, 300)} height={svgH} style={{ display: 'block', minWidth: 300 }}>
        <defs>
          <marker id="md-arr" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
            <polygon points="0 0,6 2.5,0 5" fill="var(--text-muted)" />
          </marker>
        </defs>
        {chain.map((entry, i) => {
          const isIV = i === 0;
          const bx = i * (itemW + gap);
          const fill = isIV ? 'rgba(230,126,34,0.12)' : 'var(--accent-blue-bg)';
          const stroke = isIV ? 'var(--accent-orange)' : 'var(--accent-blue)';
          const label = isIV ? 'IV' : `M${i}`;
          const hex = entry[isIV ? 1 : 1];

          return (
            <g key={`b${i}`}>
              <rect x={bx} y={y} width={boxW} height={boxH} rx={5} fill={fill} stroke={stroke} strokeWidth={1.5} />
              <text x={bx + boxW/2} y={y + 11} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill={stroke} fontWeight={600}>{label}</text>
              <text x={bx + boxW/2} y={y + 24} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-secondary)">{hex.slice(0,10)}…</text>
              {i < chain.length - 1 && (
                <>
                  <line x1={bx + boxW} y1={y + boxH/2} x2={bx + boxW + arrowW - 4} y2={y + boxH/2}
                    stroke="var(--text-muted)" strokeWidth={1.5} markerEnd="url(#md-arr)" />
                  <text x={bx + boxW + arrowW/2} y={y + boxH/2 - 5} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-muted)">h(·,·)</text>
                </>
              )}
            </g>
          );
        })}
        {chain.slice(1).map((entry, i) => {
          const idx = i + 1;
          const stateX = idx * (itemW + gap) - arrowW - gap;
          return null;
        })}
        {chain.slice(1).map((entry, i) => {
          const idx = i + 1;
          const bx = idx * (itemW + gap);
          const stateX = bx - (arrowW + gap) / 2 - boxW / 2;
          return (
            <g key={`s${idx}`}>
              <rect x={bx + boxW + arrowW + gap * 2} y={y} width={boxW} height={boxH} rx={5}
                fill="var(--accent-green-bg)" stroke="var(--accent-green)" strokeWidth={1.5}
                style={{ display: idx === chain.length - 1 ? 'block' : 'none' }} />
            </g>
          );
        })}
        {chain.length > 1 && (() => {
          const last = chain[chain.length - 1];
          const finalX = (chain.length - 1) * (itemW + gap) + boxW + arrowW + gap * 2;
          return (
            <g>
              <line
                x1={(chain.length - 1) * (itemW + gap) + boxW}
                y1={y + boxH / 2}
                x2={finalX - 4}
                y2={y + boxH / 2}
                stroke="var(--accent-green)" strokeWidth={1.5} markerEnd="url(#md-arr)"
                style={{ display: 'none' }}
              />
            </g>
          );
        })()}
        <text x={chain.length * (itemW + gap) - arrowW - gap} y={y + 64} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill="var(--accent-green)">digest</text>
      </svg>
    </div>
  );
}

function ChainFlow({ chain }) {
  if (!chain || chain.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 'max-content', padding: '8px 4px' }}>
        {chain.map((entry, i) => {
          const isIV = i === 0;
          const label = isIV ? 'IV' : `M${i}`;
          const hex = entry[isIV ? 1 : 1];
          const stateHex = isIV ? null : entry[2];
          return (
            <React.Fragment key={i}>
              <div style={{
                padding: '6px 10px', borderRadius: 6, minWidth: 80, textAlign: 'center',
                background: isIV ? 'rgba(230,126,34,0.12)' : 'var(--accent-blue-bg)',
                border: `1px solid ${isIV ? 'var(--accent-orange)' : 'var(--accent-blue)'}`,
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isIV ? 'var(--accent-orange)' : 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>{label}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{hex.slice(0,10)}…</div>
              </div>
              {!isIV && stateHex && (
                <>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '0 4px', whiteSpace: 'nowrap' }}>→ h(·,·) →</div>
                  <div style={{
                    padding: '6px 10px', borderRadius: 6, minWidth: 80, textAlign: 'center',
                    background: 'var(--accent-green-bg)',
                    border: '1px solid var(--accent-green)',
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>z{i}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{stateHex.slice(0,10)}…</div>
                  </div>
                  {i < chain.length - 1 && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '0 4px' }}>→</div>}
                </>
              )}
              {isIV && chain.length > 1 && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '0 4px' }}>→</div>}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default function PA7Demo() {
  const [msg, setMsg] = useState(DEFAULT_MSG);
  const [result, setResult] = useState(null);
  const [altMsg, setAltMsg] = useState(DEFAULT_MSG.slice(0,-1) + '?');
  const [altResult, setAltResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const doRun = async (m) => {
    const hex = Array.from(new TextEncoder().encode(m)).map(b=>b.toString(16).padStart(2,'0')).join('');
    const r = await api.hash.md(hex);
    return r;
  };

  const run = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([doRun(msg), doRun(altMsg)]);
      setResult(r1);
      setAltResult(r2);
    } catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  const reset = () => {
    setMsg(DEFAULT_MSG);
    setAltMsg(DEFAULT_MSG.slice(0,-1) + '?');
    setResult(null);
    setAltResult(null);
  };

  useEffect(() => { run(); }, []); // eslint-disable-line

  const handleMsgChange = (v) => {
    setMsg(v);
    if (altMsg === msg.slice(0,-1) + '?') setAltMsg(v.slice(0,-1) + '?');
  };

  const diffDigests = (d1, d2) => {
    if (!d1 || !d2) return null;
    const len = Math.min(d1.length, d2.length);
    return Array.from({length: len}, (_, i) => ({ ch: d2[i], diff: d1[i] !== d2[i] }));
  };

  const diffs = diffDigests(result?.digest, altResult?.digest);

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={7} title="Merkle-Damgård Chain Viewer" tag="CRHF" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Pads message, splits into 8-byte blocks, applies compression function iteratively. z₀ → h(z₀,M₁) → h(z₁,M₂) → …
        </p>
        <div className="form-group">
          <label>Message (text)</label>
          <input
            type="text"
            value={msg}
            onChange={e => handleMsgChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && run()}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 14 }}>
          {'▶ Hash with Merkle-Damgård'}
        </button>
        {result && !result.error && (
          <>
            <div className="form-group">
              <label>Digest</label>
              <CopyHex value={result.digest} />
            </div>
            {result.chain && (
              <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: '12px 10px', border: '1px solid var(--border)', marginBottom: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                  Chain: IV → h(IV, M₁) → z₁ → h(z₁, M₂) → z₂ → …
                </div>
                <ChainFlow chain={result.chain} />
              </div>
            )}
          </>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
      </div>

      <div className="demo-card">
        <h4>Avalanche Effect</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
          Change one character — watch the digest change completely.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="form-group">
            <label>Original message</label>
            <input type="text" value={msg} readOnly style={{ opacity: 0.7 }} />
          </div>
          <div className="form-group">
            <label>Altered message</label>
            <input type="text" value={altMsg} onChange={e => setAltMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && run()} />
          </div>
        </div>
        {result?.digest && altResult?.digest && (
          <div className="result-box">
            <div style={{ marginBottom: 6 }}>
              <span className="result-key">Original digest: </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-primary)' }}>{result.digest}</span>
            </div>
            <div>
              <span className="result-key">Altered digest:  </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                {diffs?.map((d, i) => (
                  <span key={i} style={{ color: d.diff ? 'var(--accent-red)' : 'var(--text-primary)', fontWeight: d.diff ? 700 : 400 }}>{d.ch}</span>
                ))}
              </span>
            </div>
            {diffs && (
              <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {diffs.filter(d=>d.diff).length}/{diffs.length} hex chars differ ({Math.round(diffs.filter(d=>d.diff).length/diffs.length*100)}%)
              </div>
            )}
          </div>
        )}
      </div>

      <div className="demo-card">
        <h4>MD Padding Construction</h4>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
          <div>EM = M ‖ 1 ‖ 0* ‖ ⟨|M|⟩₆₄</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            Append 0x80 (1-bit + zeros), then pad until length ≡ block_size−8 (mod block_size), then 64-bit big-endian length.
          </div>
          {result?.padded && (
            <div style={{ marginTop: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Padded hex: </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{result.padded}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
