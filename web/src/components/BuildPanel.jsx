import React, { useState } from 'react';

const PA_NUMS = { OWF: 1, OWP: 1, PRG: 1, PRF: 2, PRP: 4, MAC: 5, CRHF: '7+8', HMAC: 10, CPA_ENC: 3, CCA_ENC: 6 };

export default function BuildPanel({ foundation, source, setSource, primitives, keyHex, setKeyHex, steps, loading, onRun }) {
  const [busy, setBusy] = useState(false);
  const handleRun = async () => {
    setBusy(true);
    try { await onRun(); } finally { setBusy(false); }
  };
  const isComputing = busy || loading;
  return (
    <div className="column-panel">
      <div className="column-header">
        <h2 className="col1-header">Build</h2>
        <span className="col-badge">Leg 1: {foundation} → {source}</span>
      </div>

      <div className="form-group">
        <label>Source Primitive (A)</label>
        <select value={source} onChange={e => setSource(e.target.value)}>
          {primitives.map(p => (
            <option key={p} value={p}>{p} (PA#{PA_NUMS[p]})</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Input Key / Seed (hex)</label>
        <input
          type="text"
          value={keyHex}
          onChange={e => setKeyHex(e.target.value)}
          placeholder="e.g. 0123456789abcdef..."
          spellCheck={false}
        />
      </div>

      <div className="form-group">
        <label>
          Step-Through: {foundation} → {source}
          <span style={{ float: 'right', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            actual computed values
          </span>
        </label>
        <div className={`step-chain${isComputing && steps.length === 0 ? ' loading' : ''}`}>
          {steps.length === 0 && !isComputing && (
            <div className="step-item">
              <span className="step-stub">Enter a key and click Run</span>
            </div>
          )}
          {steps.length === 0 && isComputing && (
            <div className="step-item">
              <span className="spinner" style={{ marginRight: 8 }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Computing…</span>
            </div>
          )}
          {steps.map((s, i) => (
            <div className="step-item" key={i} title={s.desc || ''}>
              <span className="step-label">{s.label}</span>
              <span className="step-arrow">→</span>
              <span className="step-fn">{s.fn}</span>
              <span className="step-arrow">=</span>
              {s.stub
                ? <span className="step-stub">{s.value}</span>
                : <span className="step-value">{typeof s.value === 'string' ? s.value.slice(0, 32) + (s.value.length > 32 ? '…' : '') : s.value}</span>
              }
              {s.desc && (
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic', flexShrink: 0, maxWidth: '35%', textAlign: 'right', lineHeight: 1.3 }}>
                  {s.desc}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleRun} disabled={isComputing} style={{ width: '100%', marginTop: 4 }}>
        {isComputing ? <><span className="spinner" />Computing…</> : '▶ Run Computation'}
      </button>
    </div>
  );
}
