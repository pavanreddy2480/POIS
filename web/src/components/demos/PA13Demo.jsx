import React, { useState } from 'react';
import { api } from '../../api';
import DemoHeader from '../DemoHeader';

// Pre-loaded examples as required by the spec
const EXAMPLES = [
  {
    label: '561 — Carmichael',
    n: '561',
    desc: 'Passes Fermat, caught by Miller-Rabin',
    tag: 'carmichael',
  },
  {
    label: '512-bit prime',
    n: '9628778660068230364479991562896796378162668945783677908731316663173209503531445078024813391251486235269244452804936571703728986967512043885930053029218657',
    desc: 'Known 512-bit prime (PROBABLY_PRIME)',
    tag: 'prime',
  },
  {
    label: '2⁶⁷−1 — composite',
    n: '147573952589676412927',
    desc: '= 761838257287 × 193707721',
    tag: 'composite',
  },
  {
    label: '7919 — prime',
    n: '7919',
    desc: '1000th prime number',
    tag: 'prime',
  },
];

const tagStyle = {
  carmichael: { color: 'var(--accent-orange)', border: '1px solid var(--accent-orange)', background: 'var(--accent-orange-bg)' },
  prime:      { color: 'var(--accent-green)',  border: '1px solid var(--accent-green)',  background: 'var(--accent-green-bg)' },
  composite:  { color: 'var(--accent-red)',    border: '1px solid var(--accent-red)',    background: 'var(--accent-red-bg)' },
};

// Abbreviate a long decimal/hex string for display
const abbr = (s, n = 18) =>
  s && s.length > n + 2 ? s.slice(0, n) + '…' : (s || '–');

export default function PA13Demo({ onNavigate }) {
  const [nInput, setNInput]         = useState('561');
  const [k, setK]                   = useState(20);
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [carmichael, setCarmichael] = useState(null);
  const [carmLoading, setCarmLoading] = useState(false);
  const [bench, setBench]           = useState(null);
  const [benchLoading, setBenchLoading] = useState(false);

  const reset = () => { setResult(null); };

  // Allow digits only in the input (up to 20 digits or large preloaded values)
  const handleNChange = e => setNInput(e.target.value.replace(/[^0-9]/g, ''));

  const runTest = async () => {
    if (!nInput.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await api.millerRabin.testVerbose(nInput.trim(), k);
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const runCarmichael = async () => {
    setCarmLoading(true);
    setCarmichael(null);
    try {
      const r = await api.millerRabin.carmichaelDemo();
      setCarmichael(r);
    } catch (e) {
      setCarmichael({ error: e.message });
    } finally {
      setCarmLoading(false);
    }
  };

  const runBenchmark = async () => {
    setBenchLoading(true);
    setBench(null);
    try {
      const r = await api.millerRabin.benchmark();
      setBench(r);
    } catch (e) {
      setBench({ error: e.message });
    } finally {
      setBenchLoading(false);
    }
  };

  const isPrime = result?.result === 'PROBABLY_PRIME';

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={13} title="Miller-Rabin Primality Test" tag="MR" onReset={reset} />

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          Probabilistic primality test. Each round catches composites with probability ≥ 3/4.
          After k rounds, error ≤ 4<sup>−k</sup>. Catches Carmichael numbers unlike naive Fermat.
        </p>

        {/* ── Pre-loaded examples ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            Pre-loaded examples (click to test):
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EXAMPLES.map(ex => (
              <button key={ex.label}
                onClick={() => { setNInput(ex.n); setResult(null); }}
                title={ex.desc}
                style={{
                  fontSize: '0.74rem', padding: '4px 10px', borderRadius: 5,
                  cursor: 'pointer', transition: 'opacity 0.15s',
                  ...(tagStyle[ex.tag] || {}),
                }}>
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Input row ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Number n (up to 20 digits, or use pre-loaded)
            </label>
            <input
              type="text"
              value={nInput}
              onChange={handleNChange}
              placeholder="Enter any integer…"
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
            />
          </div>
          <div style={{ width: 160 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Rounds k = <strong>{k}</strong> &nbsp;(error ≤ 4<sup>−{k}</sup>)
            </label>
            <input
              type="range" min={1} max={40} value={k}
              onChange={e => setK(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          <button className="btn btn-primary" onClick={runTest} disabled={loading}
                  style={{ whiteSpace: 'nowrap', minWidth: 110 }}>
            {loading ? '…' : '▶ Test Primality'}
          </button>
        </div>

        {/* ── Result ── */}
        {result && !result.error && (
          <div style={{ marginBottom: 16 }}>
            {/* Verdict banner */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
              padding: '10px 14px', borderRadius: 8,
              background: isPrime ? 'var(--accent-green-bg)' : 'var(--accent-red-bg)',
              border: `1px solid ${isPrime ? 'var(--accent-green)' : 'var(--accent-red)'}`,
            }}>
              <span style={{
                fontSize: '1.1rem', fontWeight: 800,
                color: isPrime ? 'var(--accent-green)' : 'var(--accent-red)',
                fontFamily: 'var(--font-mono)',
              }}>
                {isPrime ? '✓ PROBABLY PRIME' : '✗ COMPOSITE'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {result.rounds_run} round{result.rounds_run !== 1 ? 's' : ''} run
                &nbsp;|&nbsp; {result.time_sec}s
                &nbsp;|&nbsp; error ≤ 4<sup>−{result.rounds_requested}</sup>
                &nbsp;≈ {(Math.pow(4, -(result.rounds_requested || k))).toExponential(1)}
              </span>
            </div>

            {/* Decomposition */}
            <div style={{
              fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
              padding: '5px 10px', background: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 10,
            }}>
              n = {abbr(result.n, 30)}
              &nbsp;&nbsp;|&nbsp;&nbsp;
              n−1 = 2<sup>{result.s}</sup> × {abbr(String(result.d), 20)}
              &nbsp;&nbsp;(s={result.s}, d={abbr(String(result.d), 14)})
            </div>

            {/* Witness table */}
            {result.rounds && result.rounds.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%', borderCollapse: 'collapse',
                  fontSize: '0.68rem', fontFamily: 'var(--font-mono)',
                }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      <th style={thStyle}>Round</th>
                      <th style={thStyle}>Base a<sub>i</sub></th>
                      <th style={thStyle}>x₀ = a^d mod n</th>
                      <th style={thStyle}>Squaring sequence</th>
                      <th style={thStyle}>Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rounds.map(r => (
                      <tr key={r.round} style={{
                        background: r.witness ? 'var(--accent-red-bg)' : undefined,
                        borderBottom: '1px solid var(--border)',
                      }}>
                        <td style={tdStyle}>{r.round}</td>
                        <td style={tdStyle}>{abbr(r.a, 16)}</td>
                        <td style={tdStyle}>{abbr(r.x0, 16)}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                          {r.sequence.map((v, i) => (
                            <span key={i}>
                              {i > 0 && <span style={{ color: 'var(--border)', margin: '0 3px' }}>→</span>}
                              {abbr(v, 14)}
                            </span>
                          ))}
                        </td>
                        <td style={tdStyle}>
                          {r.witness ? (
                            <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>
                              WITNESS ☠
                            </span>
                          ) : (
                            <span style={{ color: 'var(--accent-green)' }}>
                              passed ({r.reason})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {result?.error && (
          <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginBottom: 12 }}>
            Error: {result.error}
          </div>
        )}

        {/* ── Carmichael Demo ── */}
        <div style={{
          marginTop: 16, padding: 14, borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.83rem', marginBottom: 6 }}>
            Carmichael Number Demo — n = 561
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
            561 = 3 × 11 × 17 is the smallest Carmichael number.
            It passes Fermat's test (a<sup>560</sup> ≡ 1 mod 561) for all bases coprime to 561,
            fooling naive primality tests — but Miller-Rabin correctly identifies it as COMPOSITE.
          </p>
          <button className="btn btn-secondary" onClick={runCarmichael} disabled={carmLoading}
                  style={{ fontSize: '0.78rem' }}>
            {carmLoading ? '…' : '▶ Run Carmichael Demo'}
          </button>

          {carmichael && !carmichael.error && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{
                  flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 7,
                  border: '1px solid var(--accent-orange)', background: 'var(--accent-orange-bg)',
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-orange)', marginBottom: 6, fontSize: '0.78rem' }}>
                    Fermat Test — FOOLED ⚠
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', lineHeight: 2 }}>
                    {carmichael.fermat_values?.map(fv => (
                      <div key={fv.base}>
                        {fv.base}<sup>560</sup> mod 561 = <span style={{ color: 'var(--accent-green)' }}>{fv.value}</span>
                        &nbsp;{fv.passes ? '✓ passes' : '✗'}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.67rem', color: 'var(--accent-orange)', marginTop: 6 }}>
                    All bases coprime to 561 pass — Fermat says PRIME!
                  </div>
                </div>
                <div style={{
                  flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 7,
                  border: '1px solid var(--accent-green)', background: 'var(--accent-green-bg)',
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-green)', marginBottom: 6, fontSize: '0.78rem' }}>
                    Miller-Rabin — CAUGHT ✓
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', lineHeight: 2 }}>
                    <div>Result: <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>COMPOSITE</span></div>
                    <div>n−1 = 560 = 2<sup>{carmichael.mr_trace?.s}</sup> × {carmichael.mr_trace?.d}</div>
                    {carmichael.mr_trace?.rounds?.map(r => r.witness && (
                      <div key={r.round} style={{ color: 'var(--accent-red)' }}>
                        Round {r.round}: a={r.a}, x₀={abbr(r.x0)} → WITNESS
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.67rem', color: 'var(--accent-green)', marginTop: 6 }}>
                    Found a strong witness — COMPOSITE confirmed.
                  </div>
                </div>
              </div>
            </div>
          )}
          {carmichael?.error && (
            <div style={{ color: 'var(--accent-red)', fontSize: '0.78rem', marginTop: 8 }}>
              {carmichael.error}
            </div>
          )}
        </div>

        {/* ── Performance Benchmark ── */}
        <div style={{
          marginTop: 14, padding: 14, borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.83rem', marginBottom: 6 }}>
            Performance Benchmark (512 / 1024 / 2048-bit)
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
            By the Prime Number Theorem, a random odd b-bit integer is prime with probability ≈ 2/ln(2<sup>b</sup>),
            so expected candidates before finding a prime ≈ b·ln(2)/2. Click to measure.
          </p>
          <button className="btn btn-secondary" onClick={runBenchmark} disabled={benchLoading}
                  style={{ fontSize: '0.78rem' }}>
            {benchLoading ? '⏳ Running (may take ~10s)…' : '▶ Run Performance Benchmark'}
          </button>

          {bench && !bench.error && (
            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
              }}>
                <thead>
                  <tr style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                    <th style={thStyle}>Bits</th>
                    <th style={thStyle}>Trials</th>
                    <th style={thStyle}>Avg candidates</th>
                    <th style={thStyle}>Theoretical O(ln n)</th>
                    <th style={thStyle}>Ratio</th>
                    <th style={thStyle}>Avg time</th>
                  </tr>
                </thead>
                <tbody>
                  {bench.results.map(row => (
                    <tr key={row.bits} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>{row.bits}</td>
                      <td style={tdStyle}>{row.trials}</td>
                      <td style={{ ...tdStyle, color: 'var(--accent-blue)', fontWeight: 600 }}>
                        {row.avg_candidates}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                          ({row.samples.join(', ')})
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--accent-teal)' }}>{row.theoretical_pnt}</td>
                      <td style={{ ...tdStyle, color: 'var(--accent-orange)' }}>{row.ratio}×</td>
                      <td style={tdStyle}>{row.avg_time_sec}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Theoretical = b·ln(2)/2 (PNT for odd integers). Ratio ≈ 1.0 confirms the prediction.
              </div>
            </div>
          )}
          {bench?.error && (
            <div style={{ color: 'var(--accent-red)', fontSize: '0.78rem', marginTop: 8 }}>
              {bench.error}
            </div>
          )}
        </div>

        {onNavigate && (
          <div className="demo-related" style={{ marginTop: 14 }}>
            <span className="demo-related-label">Related:</span>
            <button className="demo-xlink" onClick={() => onNavigate('PA11')}>PA11 DH →</button>
            <button className="demo-xlink" onClick={() => onNavigate('PA12')}>PA12 RSA →</button>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '6px 10px', textAlign: 'left',
  borderBottom: '1px solid var(--border)', fontWeight: 600,
};
const tdStyle = {
  padding: '5px 10px',
};
