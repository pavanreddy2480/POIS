import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import DemoHeader from '../DemoHeader';

const TABS = ['Millionaire', 'Equality', 'Bit-Addition'];

function GateChip({ type }) {
  const colors = {
    AND: { bg: 'rgba(231,76,60,0.15)', border: 'rgba(231,76,60,0.4)', text: 'var(--accent-red)' },
    XOR: { bg: 'rgba(52,152,219,0.12)', border: 'rgba(52,152,219,0.35)', text: 'var(--accent-blue)' },
    NOT: { bg: 'rgba(243,156,18,0.12)', border: 'rgba(243,156,18,0.35)', text: 'var(--accent-orange)' },
  };
  const c = colors[type] || colors.XOR;
  return (
    <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 4,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
      {type}
    </span>
  );
}

function ResultBanner({ result, circuitType }) {
  if (!result) return null;
  if (circuitType === 'Millionaire') {
    const isAlice = result.result === 'Alice is richer';
    const isEqual = result.result === 'Equal';
    const color = isEqual ? 'var(--accent-orange)' : isAlice ? 'var(--accent-blue)' : 'var(--accent-green)';
    return (
      <div style={{ background: `${color}18`, border: `2px solid ${color}55`,
        borderRadius: 10, padding: '14px 18px', marginBottom: 14, textAlign: 'center' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4,
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Secure Comparison Result</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>
          {result.result === 'Equal' ? '🤝 Equal Wealth' :
           result.result === 'Alice is richer' ? '🏆 Alice is Richer' : '🏆 Bob is Richer'}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Actual values x and y were never revealed — only the comparison result is learned.
        </div>
      </div>
    );
  }
  if (circuitType === 'Equality') {
    const color = result.equal ? 'var(--accent-green)' : 'var(--accent-orange)';
    return (
      <div style={{ background: `${color}18`, border: `2px solid ${color}55`,
        borderRadius: 10, padding: '14px 18px', marginBottom: 14, textAlign: 'center' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4,
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Secure Equality Result</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>
          {result.equal ? '✓ x = y (Equal)' : '✗ x ≠ y (Not Equal)'}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Neither x nor y was revealed — only equality/inequality is output.
        </div>
      </div>
    );
  }
  if (circuitType === 'Bit-Addition') {
    return (
      <div style={{ background: 'rgba(162,155,254,0.12)', border: '2px solid rgba(162,155,254,0.4)',
        borderRadius: 10, padding: '14px 18px', marginBottom: 14, textAlign: 'center' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4,
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Secure Addition Result</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a29bfe' }}>
          x + y mod 2<sup>{result.n_bits}</sup> = {result.sum}
        </div>
        <div style={{ fontSize: '0.7rem', color: result.correct ? 'var(--accent-green)' : 'var(--accent-red)',
          marginTop: 4 }}>
          {result.correct ? `✓ Correct (expected ${result.expected})` : `✗ ERROR (expected ${result.expected})`}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
          Only the sum is revealed — neither x nor y is disclosed to the other party.
        </div>
      </div>
    );
  }
  return null;
}

export default function PA20Demo() {
  const [tab, setTab] = useState('Millionaire');
  const [x, setX] = useState(7);
  const [y, setY] = useState(12);
  const [nBits, setNBits] = useState(4);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animatedGates, setAnimatedGates] = useState([]);
  const animRef = useRef(null);

  const maxVal = Math.pow(2, nBits) - 1;
  const cx = Math.min(x, maxVal);
  const cy = Math.min(y, maxVal);

  function reset() {
    setResult(null); setError(null); setProgress(0);
    setAnimatedGates([]); setTraceOpen(false);
    if (animRef.current) clearTimeout(animRef.current);
  }

  function animateTrace(trace) {
    setAnimatedGates([]);
    setProgress(0);
    const total = trace.length;
    if (total === 0) { setProgress(100); return; }

    let i = 0;
    function step() {
      i++;
      setProgress(Math.round((i / total) * 100));
      setAnimatedGates(trace.slice(0, i));
      if (i < total) {
        animRef.current = setTimeout(step, Math.max(20, 800 / total));
      }
    }
    animRef.current = setTimeout(step, 50);
  }

  async function runCircuit() {
    setLoading(true); setError(null); setResult(null);
    setProgress(0); setAnimatedGates([]); setTraceOpen(false);
    try {
      let r;
      if (tab === 'Millionaire') r = await api.mpc.millionaire(cx, cy, nBits);
      else if (tab === 'Equality')  r = await api.mpc.equality(cx, cy, nBits);
      else                          r = await api.mpc.addition(cx, cy, nBits);
      setResult(r);
      animateTrace(r.gate_trace || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { reset(); }, [tab, nBits]);
  useEffect(() => () => { if (animRef.current) clearTimeout(animRef.current); }, []);

  const btnLabel = tab === 'Millionaire' ? '▶ Who is richer?' :
                   tab === 'Equality'    ? '▶ Are they equal?' :
                                          '▶ Compute x + y';

  return (
    <div>
      <style>{`
        @keyframes pa20In { from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)} }
        .pa20-in { animation: pa20In 0.28s ease forwards; }
        .gate-row { display:flex; gap:8px; align-items:center; padding:4px 8px; border-radius:5px;
          background:var(--bg-well); border:1px solid var(--border); margin-bottom:4px;
          font-size:0.63rem; font-family:var(--font-mono); }
      `}</style>

      <div className="demo-card">
        <DemoHeader num={20} title="All 2-Party Secure Computation (Yao/GMW)" tag="MPC" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
          Given Secure AND (PA#19) + Secure XOR (free via additive secret sharing), any polynomial-time
          2-party function f(x,y) is securely computable. Each AND gate triggers one OT call (PA#18
          {'→'} ElGamal PA#16 {'→'} Miller-Rabin PA#13).
        </p>

        {/* Grand theorem box */}
        <div style={{ padding: '8px 12px', background: 'rgba(162,155,254,0.08)',
          border: '1px solid rgba(162,155,254,0.35)', borderRadius: 8, marginBottom: 14,
          fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: '#a29bfe' }}>MPC Completeness Theorem:</strong>{' '}
          AND + XOR are functionally complete — any boolean circuit is securely evaluable.
          This is the essence of Yao's Garbled Circuits / GMW.
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {TABS.map(t => (
            <button key={t}
              className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '5px 14px' }}
              onClick={() => setTab(t)}>
              {t === 'Millionaire' ? '💰 Millionaire' :
               t === 'Equality'   ? '⚖ Equality'     : '➕ Bit-Addition'}
            </button>
          ))}
        </div>

        {/* n-bit selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>n-bit width:</span>
          {[2, 3, 4].map(n => (
            <button key={n} className={`btn btn-${nBits === n ? 'primary' : 'secondary'}`}
              style={{ padding: '3px 10px', fontSize: '0.72rem' }}
              onClick={() => setNBits(n)}>
              {n}-bit (0–{Math.pow(2, n)-1})
            </button>
          ))}
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 4 }}>
            Toy params: 4-bit. Try x=7, y=12 → Bob is richer.
          </span>
        </div>

        {/* Alice / Bob panels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {/* Alice */}
          <div style={{ background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.3)',
            borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-blue)',
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Alice — her value x
            </div>
            <input type="range" min={0} max={maxVal} value={cx}
              onChange={e => { setX(Number(e.target.value)); reset(); }}
              style={{ width: '100%', marginBottom: 6 }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800,
              color: 'var(--accent-blue)', textAlign: 'center' }}>
              x = {cx}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center',
              marginTop: 4, fontStyle: 'italic' }}>
              {tab === 'Millionaire'
                ? 'Alice keeps x hidden. Bob sees only the comparison result.'
                : 'Alice keeps x hidden. Only the function output is revealed.'}
            </div>
          </div>

          {/* Bob */}
          <div style={{ background: 'rgba(243,156,18,0.06)', border: '1px solid rgba(243,156,18,0.3)',
            borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-orange)',
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Bob — his value y
            </div>
            <input type="range" min={0} max={maxVal} value={cy}
              onChange={e => { setY(Number(e.target.value)); reset(); }}
              style={{ width: '100%', marginBottom: 6 }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800,
              color: 'var(--accent-orange)', textAlign: 'center' }}>
              y = {cy}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center',
              marginTop: 4, fontStyle: 'italic' }}>
              {tab === 'Millionaire'
                ? 'Bob keeps y hidden. Alice sees only the comparison result.'
                : 'Bob keeps y hidden. Only the function output is revealed.'}
            </div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={runCircuit}
          disabled={loading} style={{ marginBottom: 14, fontSize: '0.9rem' }}>
          {loading ? '⏳ Evaluating circuit gate-by-gate…' : btnLabel}
        </button>
        {error && <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem' }}>{error}</p>}

        {/* Progress bar */}
        {(loading || (result && progress > 0)) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4,
              fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              <span>Circuit evaluation progress</span>
              <span>{animatedGates.length} / {result?.total_gates || '?'} gates</span>
            </div>
            <div style={{ height: 8, background: 'var(--bg-well)', borderRadius: 4,
              border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-green))',
                borderRadius: 4, transition: 'width 0.1s linear' }} />
            </div>
            {/* Animated gate mini-display */}
            {animatedGates.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {animatedGates.slice(-8).map((g, i) => (
                  <span key={i} style={{
                    fontSize: '0.58rem', fontFamily: 'var(--font-mono)',
                    padding: '2px 6px', borderRadius: 3,
                    background: g.gate_type === 'AND' ? 'rgba(231,76,60,0.15)' :
                                g.gate_type === 'XOR' ? 'rgba(52,152,219,0.12)' : 'rgba(243,156,18,0.12)',
                    color: g.gate_type === 'AND' ? 'var(--accent-red)' :
                           g.gate_type === 'XOR' ? 'var(--accent-blue)' : 'var(--accent-orange)',
                    border: '1px solid var(--border)',
                  }}>
                    {g.gate_type}→{g.output_val}
                  </span>
                ))}
                {animatedGates.length > 8 && (
                  <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', padding: '2px 4px' }}>
                    +{animatedGates.length - 8} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Result banner */}
        {result && progress === 100 && (
          <div className="pa20-in">
            <ResultBanner result={result} circuitType={tab} />

            {/* Performance stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6,
              marginBottom: 12 }}>
              {[
                { label: 'OT Calls (AND)', value: result.ot_calls,
                  color: 'var(--accent-red)', note: '← cost of MPC' },
                { label: 'XOR Gates (free)', value: result.xor_gates,
                  color: 'var(--accent-blue)', note: '← no OT needed' },
                { label: 'NOT Gates (free)', value: result.not_gates,
                  color: 'var(--accent-orange)', note: '← local only' },
                { label: 'Time (ms)', value: result.elapsed_ms,
                  color: 'var(--accent-green)', note: `n=${nBits} bits` },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-well)',
                  border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
                  textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color,
                    fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)',
                    marginTop: 2, lineHeight: 1.4 }}>
                    {s.label}<br /><span style={{ color: s.color, opacity: 0.7 }}>{s.note}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Circuit trace expandable */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
              marginBottom: 10 }}>
              <button
                onClick={() => setTraceOpen(v => !v)}
                style={{ width: '100%', background: 'var(--bg-well)', border: 'none',
                  padding: '9px 14px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', cursor: 'pointer', color: 'var(--text-secondary)',
                  fontSize: '0.74rem', fontWeight: 600 }}>
                <span>
                  {'▶ Circuit Trace — '}
                  <span style={{ color: 'var(--accent-red)' }}>{result.ot_calls} AND (OT)</span>
                  {' + '}
                  <span style={{ color: 'var(--accent-blue)' }}>{result.xor_gates} XOR</span>
                  {' + '}
                  <span style={{ color: 'var(--accent-orange)' }}>{result.not_gates} NOT</span>
                  {` = ${result.total_gates} gates total`}
                </span>
                <span style={{ fontSize: '0.7rem' }}>{traceOpen ? '▲ Collapse' : '▼ Expand'}</span>
              </button>
              {traceOpen && (
                <div style={{ maxHeight: 340, overflowY: 'auto', padding: '10px 12px',
                  background: 'var(--bg-primary)' }}>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8,
                    padding: '6px 10px', background: 'var(--bg-well)', borderRadius: 6,
                    fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                    <span><strong style={{ color: 'var(--accent-blue)' }}>Alice:</strong> wires 0–{nBits-1} (x bits)</span>
                    <span><strong style={{ color: 'var(--accent-orange)' }}>Bob:</strong> wires {nBits}–{nBits*2-1} (y bits) — values hidden from Alice</span>
                    <span><strong style={{ color: 'var(--text-secondary)' }}>Internal:</strong> wires ≥{nBits*2} (computed, visible)</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--accent-red)' }}>AND = 1 OT call each</span>
                  </div>

                  {/* Column headers */}
                  <div style={{ display: 'grid',
                    gridTemplateColumns: '28px 44px 1fr 80px 28px 60px',
                    gap: 6, padding: '3px 6px', marginBottom: 4,
                    fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span>#</span>
                    <span>Type</span>
                    <span>Input wires (indices only — values hidden if from other party)</span>
                    <span>Output wire</span>
                    <span>= </span>
                    <span>Value</span>
                  </div>

                  {(result.gate_trace || []).map((g, i) => {
                    const inputStr = g.gate_type === 'NOT'
                      ? g.input_labels[0]
                      : `${g.input_labels[0]} ${g.gate_type === 'AND' ? '∧' : '⊕'} ${g.input_labels[1]}`;
                    const isOutput = i === (result.gate_trace.length - 1);
                    return (
                      <div key={i} style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 44px 1fr 80px 28px 60px',
                        gap: 6, alignItems: 'center',
                        padding: '4px 6px', borderRadius: 5, marginBottom: 3,
                        background: isOutput
                          ? 'rgba(39,174,96,0.1)'
                          : g.uses_ot ? 'rgba(231,76,60,0.05)' : 'var(--bg-well)',
                        border: `1px solid ${isOutput ? 'rgba(39,174,96,0.3)' : 'var(--border)'}`,
                        fontSize: '0.62rem', fontFamily: 'var(--font-mono)',
                      }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.58rem' }}>{i+1}</span>
                        <GateChip type={g.gate_type} />
                        <span style={{ color: 'var(--text-muted)', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.6rem' }}
                          title={inputStr}>
                          {inputStr}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                          {'→ w'}{g.output_wire}
                          {isOutput && <span style={{ color: 'var(--accent-green)' }}> [OUT]</span>}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>=</span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{
                            fontWeight: 800, fontSize: '0.85rem',
                            color: g.output_val === 1 ? 'var(--accent-green)' : 'var(--text-secondary)',
                          }}>
                            {g.output_val}
                          </span>
                          {g.uses_ot && (
                            <span style={{ fontSize: '0.55rem', color: 'var(--accent-red)',
                              padding: '1px 4px', borderRadius: 3,
                              background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)' }}>
                              OT{g.ot_call_index}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(231,76,60,0.05)',
                    border: '1px solid rgba(231,76,60,0.2)', borderRadius: 6,
                    fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--accent-red)' }}>Privacy note:</strong>{' '}
                    Wire indices for Alice (w0–w{nBits-1}) and Bob (w{nBits}–w{nBits*2-1}) are shown
                    as wire numbers only — their actual bit <em>values</em> are never disclosed in
                    this trace. Output wire values (w≥{nBits*2}) are intermediate results of
                    secure computation, safe to reveal. Each AND gate's OT transcript is
                    simulatable from the output alone.
                  </div>
                </div>
              )}
            </div>

            {/* Privacy verification */}
            <div style={{ background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.25)',
              borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-green)',
                marginBottom: 6 }}>Privacy Verification — Transcript Simulability</div>
              <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                The transcript consists of one OT exchange per AND gate: (pk₀, pk₁, C₀, C₁) per gate.
                Under DDH, these values are computationally indistinguishable from uniform random
                group elements regardless of the actual bit values. A simulator given only the output
                can generate an indistinguishable transcript — confirming neither party learns anything
                beyond the function output.
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="badge badge-secure" style={{ fontSize: '0.6rem' }}>
                  {'✓'} Alice learns only: {
                    tab === 'Millionaire' ? result.result :
                    tab === 'Equality' ? (result.equal ? 'x=y' : 'x≠y') :
                    `sum = ${result.sum}`
                  }
                </span>
                <span className="badge badge-secure" style={{ fontSize: '0.6rem' }}>
                  {'✓'} Bob learns only: {
                    tab === 'Millionaire' ? result.result :
                    tab === 'Equality' ? (result.equal ? 'x=y' : 'x≠y') :
                    `sum = ${result.sum}`
                  }
                </span>
              </div>
            </div>
          </div>
        )}

        {/* End-to-end lineage */}
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-well)',
          border: '1px solid var(--border)', borderRadius: 6,
          fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Lineage: PA#20 {'→'} PA#19 (Secure AND) {'→'} PA#18 (OT) {'→'} PA#16 (ElGamal) {'→'} PA#11 (DH) + PA#13 (Miller-Rabin)
        </div>
      </div>
    </div>
  );
}
