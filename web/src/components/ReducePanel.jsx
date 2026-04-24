import React, { useState } from 'react';

const PA_NUMS = { OWF: 1, PRG: 1, PRF: 2, PRP: 4, MAC: 5, CRHF: '7+8', HMAC: 10 };

export default function ReducePanel({ source, target, setTarget, primitives, queryHex, setQueryHex, steps, routeInfo, onRun }) {
  const [busy, setBusy] = useState(false);
  const handleRun = async () => {
    setBusy(true);
    try { await onRun(); } finally { setBusy(false); }
  };
  return (
    <div className="column-panel">
      <div className="column-header">
        <h2 className="col2-header">Column 2 — Reduce</h2>
        <span className="col-badge">Leg 2: A → B</span>
      </div>

      <div className="form-group">
        <label>Target Primitive B</label>
        <select value={target} onChange={e => setTarget(e.target.value)}>
          {primitives.filter(p => p !== source).map(p => (
            <option key={p} value={p}>{p} (PA#{PA_NUMS[p]})</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Query / Message (hex)</label>
        <input
          type="text"
          value={queryHex}
          onChange={e => setQueryHex(e.target.value)}
          placeholder="e.g. deadbeefcafe0000"
          spellCheck={false}
        />
      </div>

      {routeInfo && (
        <div style={{ marginBottom: 10 }}>
          {routeInfo.supported === false
            ? <span className="badge badge-warn">⚠ {source} → {target}: {routeInfo.steps?.[0]}</span>
            : <span className="badge badge-secure">✓ {routeInfo.theorem || `${source}→${target}`}</span>
          }
        </div>
      )}

      <div className="form-group">
        <label>
          Reduction Steps: {source} → {target}
          <span style={{ float: 'right', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            A is a black box here
          </span>
        </label>
        <div className="step-chain">
          {steps.length === 0 && (
            <div className="step-item">
              <span className="step-stub">Select source/target and enter query</span>
            </div>
          )}
          {steps.map((s, i) => (
            <div className="step-item" key={i}>
              <span className="step-label">{s.label}</span>
              <span className="step-arrow">→</span>
              <span className="step-fn">{s.fn}</span>
              <span className="step-arrow">=</span>
              {s.stub
                ? <span className="step-stub">{s.value}</span>
                : <span className="step-value">{typeof s.value === 'string' ? s.value.slice(0, 40) + (s.value.length > 40 ? '…' : '') : s.value}</span>
              }
            </div>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleRun} disabled={busy} style={{ width: '100%', marginTop: 4 }}>
        ▶ Run Reduction
      </button>
    </div>
  );
}
