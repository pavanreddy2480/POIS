import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api';
import CopyHex from '../CopyHex';
import DemoHeader from '../DemoHeader';

const SEED_DEFAULT = '0123456789abcdef';
const LENGTH_DEFAULT = 32;
const MIN_LEN = 8;
const MAX_LEN = 256;

/* ── NIST SP 800-22 client-side tests ─────────────────────────────────────── */

function hexToBits(hex) {
  const bits = [];
  for (const c of hex) {
    const n = parseInt(c, 16);
    for (let i = 3; i >= 0; i--) bits.push((n >> i) & 1);
  }
  return bits;
}

// Test 1: Frequency (Monobit)
function frequencyTest(bits) {
  const n = bits.length;
  const ones = bits.filter(b => b === 1).length;
  const s = Math.abs(2 * ones - n) / Math.sqrt(n);
  // erfc approximation
  const erfc = x => {
    const t = 1 / (1 + 0.3275911 * x);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    return poly * Math.exp(-x * x);
  };
  const p = erfc(s / Math.sqrt(2));
  return { ones, zeros: n - ones, ratio: ones / n, s: s.toFixed(4), p: p.toFixed(4), pass: p >= 0.01 };
}

// Test 2: Block Frequency (M=8 bits per block)
function blockFrequencyTest(bits, M = 8) {
  const n = bits.length;
  const N = Math.floor(n / M); // number of blocks
  if (N < 1) return { N: 0, chi2: '0.0000', p: '0.0000', pass: false };

  // Regularised lower incomplete gamma P(a,x) via series expansion
  function logGamma(z) {
    const c = [76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
    let y = z, tmp = z + 5.5;
    tmp -= (z + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
    return -tmp + Math.log(2.5066282746310005 * ser / z);
  }
  function gammainc(a, x) { // regularised lower: P(a,x)
    if (x < 0) return 0;
    if (x === 0) return 0;
    let sum = 1 / a, term = 1 / a;
    for (let i = 1; i < 300; i++) {
      term *= x / (a + i);
      sum += term;
      if (Math.abs(term) < 1e-12) break;
    }
    return Math.min(1, Math.exp(-x + a * Math.log(x) - logGamma(a)) * sum);
  }

  let chi2 = 0;
  for (let i = 0; i < N; i++) {
    const block = bits.slice(i * M, (i + 1) * M);
    const pi_i = block.filter(b => b === 1).length / M;
    chi2 += (pi_i - 0.5) ** 2;
  }
  chi2 *= 4 * M;
  const p = 1 - gammainc(N / 2, chi2 / 2); // igamc = 1 - P
  return { N, M, chi2: chi2.toFixed(4), p: p.toFixed(4), pass: p >= 0.01 };
}

// Test 3: Runs
function runsTest(bits) {
  const n = bits.length;
  const ones = bits.filter(b => b === 1).length;
  const pi = ones / n;
  if (Math.abs(pi - 0.5) >= 2 / Math.sqrt(n)) {
    return { runs: 0, expected: 0, z: 'N/A', p: '0.0000', pass: false, blocked: true };
  }
  let runs = 1;
  for (let i = 1; i < n; i++) { if (bits[i] !== bits[i - 1]) runs++; }
  const expected = 2 * n * pi * (1 - pi);
  const z = Math.abs(runs - expected) / Math.sqrt(2 * n * pi * (1 - pi));
  // erfc-based p-value
  const erfc = x => {
    const t = 1 / (1 + 0.3275911 * x);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    return poly * Math.exp(-x * x);
  };
  const p = erfc(z / Math.sqrt(2));
  return { runs, expected: Math.round(expected), z: z.toFixed(4), p: p.toFixed(4), pass: p >= 0.01 };
}

// Test 4: Serial (overlapping 2-bit patterns)
function serialTest(bits) {
  const n = bits.length;
  if (n < 8) return { p1: '0.0000', p2: '0.0000', pass: false };
  const m = 2; // 2-bit patterns

  function countPatterns(bits, m) {
    const counts = {};
    for (let i = 0; i < n - m + 1; i++) {
      let key = '';
      for (let j = 0; j < m; j++) key += bits[(i + j) % n];
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  const vm = Object.values(countPatterns(bits, m)).reduce((a, c) => a + c * c, 0);
  const vm1 = Object.values(countPatterns(bits, m - 1)).reduce((a, c) => a + c * c, 0);
  const vm2 = m >= 2 ? Object.values(countPatterns(bits, m - 2)).reduce((a, c) => a + c * c, 0) : n;

  const psi2m = (Math.pow(2, m) / n) * vm - n;
  const psi2m1 = (Math.pow(2, m - 1) / n) * vm1 - n;
  const psi2m2 = m >= 2 ? (Math.pow(2, m - 2) / n) * vm2 - n : 0;

  const del1 = psi2m - psi2m1;
  const del2 = psi2m - 2 * psi2m1 + psi2m2;

  // Chi-squared CDF approximation for p-value
  function chiSqP(chi2, df) {
    if (chi2 <= 0) return 1;
    const k = df / 2;
    const x = chi2 / 2;
    function logGamma(z) {
      const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
      let x = z, y = z, tmp = x + 5.5;
      tmp -= (x + 0.5) * Math.log(tmp);
      let ser = 1.000000000190015;
      for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
      return -tmp + Math.log(2.5066282746310005 * ser / x);
    }
    let s = Math.exp(-x + k * Math.log(x) - logGamma(k));
    let sum = 1 / k;
    let term = 1 / k;
    for (let i = 1; i < 100; i++) {
      term *= x / (k + i);
      sum += term;
      if (term < 1e-10) break;
    }
    return Math.max(0, Math.min(1, 1 - s * sum));
  }

  const df1 = Math.pow(2, m - 1);
  const df2 = Math.pow(2, m - 2);
  const p1 = chiSqP(del1, df1).toFixed(4);
  const p2 = chiSqP(del2, df2).toFixed(4);

  return { del1: del1.toFixed(4), del2: del2.toFixed(4), p1, p2, pass: parseFloat(p1) >= 0.01 && parseFloat(p2) >= 0.01 };
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function PA1Demo() {
  const [seed, setSeed] = useState(SEED_DEFAULT);
  const [length, setLength] = useState(LENGTH_DEFAULT);
  const [lengthInput, setLengthInput] = useState(String(LENGTH_DEFAULT));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTests, setShowTests] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const debounceRef = useRef(null);

  const run = useCallback(async (s, l) => {
    setLoading(true);
    try {
      const padded = s.padEnd(32, '0').slice(0, 32);
      const r = await api.prg.generate(padded, l);
      setResult(r);
    } catch (e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => run(seed, length), 300);
    return () => clearTimeout(debounceRef.current);
  }, [seed, length, run]);

  const reset = () => {
    setSeed(SEED_DEFAULT);
    setLength(LENGTH_DEFAULT);
    setLengthInput(String(LENGTH_DEFAULT));
    setShowTests(false);
  };

  const runRandomnessTests = async () => {
    setTestRunning(true);
    try {
      const padded = seed.padEnd(32, '0').slice(0, 32);
      const r = await api.prg.generate(padded, length);
      setResult(r);
    } catch (e) { /* keep existing result */ }
    finally { setTestRunning(false); setShowTests(true); }
  };

  const handleSlider = (e) => {
    const v = +e.target.value;
    setLength(v);
    setLengthInput(String(v));
  };

  const handleNumberInput = (e) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-') { setLengthInput(raw); return; }
    const v = parseInt(raw, 10);
    if (isNaN(v)) return;
    const clamped = Math.max(MIN_LEN, Math.min(MAX_LEN, v));
    setLengthInput(String(clamped));
    setLength(clamped);
  };

  const handleNumberBlur = () => {
    const v = parseInt(lengthInput, 10);
    const clamped = isNaN(v) ? MIN_LEN : Math.max(MIN_LEN, Math.min(MAX_LEN, v));
    setLength(clamped);
    setLengthInput(String(clamped));
  };

  const bits = result?.output_hex ? hexToBits(result.output_hex) : null;
  const freq = bits ? frequencyTest(bits) : null;
  const blockFreq = bits ? blockFrequencyTest(bits) : null;
  const runs = bits ? runsTest(bits) : null;
  const serial = bits ? serialTest(bits) : null;

  const allPass = freq?.pass && (runs?.blocked || runs?.pass) && blockFreq?.pass && serial?.pass;
  const freqColor = freq ? (freq.pass ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--accent-green)';

  const TestBadge = ({ pass }) => (
    <span className={`badge ${pass ? 'badge-secure' : 'badge-broken'}`}
      style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
      {pass ? '✓ PASS' : '✗ FAIL'}
    </span>
  );

  const TestCard = ({ title, pass, children, skip }) => (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 7, padding: 10,
      borderLeft: `3px solid ${skip ? 'var(--accent-orange)' : pass ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        {skip
          ? <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--accent-orange)', color: '#000' }}>SKIP</span>
          : <TestBadge pass={pass} />}
      </div>
      {children}
    </div>
  );

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={1} title="Live PRG Output Viewer" tag="PRG" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          OWF-based Pseudorandom Generator: G(s) = b(x₀)‖b(x₁)‖… (HILL construction via DLP/AES-CTR).
          Output updates live as you type or move the slider.
        </p>

        {/* Seed */}
        <div className="form-group">
          <label>Seed s (hex, 16 bytes = 32 hex chars)</label>
          <input id="pa1-seed-input" type="text" value={seed}
            onChange={e => setSeed(e.target.value)} maxLength={32}
            placeholder="0123456789abcdef0123456789abcdef"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }} />
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>
            {seed.length}/32 hex chars{seed.length < 32 && ' — zero-padded to 16 bytes'}
          </div>
        </div>

        {/* Length: slider + number input */}
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <span>Output Length ℓ</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{length} bytes = {length * 8} bits</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input id="pa1-length-slider" type="range" min={MIN_LEN} max={MAX_LEN}
              value={length} onChange={handleSlider} style={{ flex: 1 }} />
            <input id="pa1-length-number" type="number" min={MIN_LEN} max={MAX_LEN}
              value={lengthInput} onChange={handleNumberInput} onBlur={handleNumberBlur}
              style={{ width: 72, textAlign: 'center', fontFamily: 'var(--font-mono)',
                fontSize: '0.88rem', padding: '4px 6px', flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>bytes</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
            <span>{MIN_LEN}B</span><span>{MAX_LEN}B</span>
          </div>
        </div>

        {loading && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>⏳ Generating…</div>}

        {result && !result.error && (
          <>
            {/* PRG hex output */}
            <div className="form-group">
              <label>G(s) — PRG Output (hex)</label>
              <CopyHex value={result.output_hex} />
            </div>

            {/* Randomness Test button */}
            <button id="pa1-randomness-test-btn" className="btn btn-primary"
              onClick={runRandomnessTests} disabled={testRunning}
              style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1rem' }}>🔬</span>
              {testRunning ? 'Running tests…' : 'Randomness Test'}
            </button>

            {/* ── All NIST tests — only shown after button click ────────── */}
            {showTests && freq && (
              <div style={{
                background: 'var(--bg-tertiary)',
                border: `1px solid ${allPass ? 'rgba(0,200,100,0.3)' : 'rgba(255,60,60,0.3)'}`,
                borderRadius: 10, padding: 14, marginBottom: 16,
              }}>
                {/* Overall verdict */}
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 10,
                  color: allPass ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {allPass ? '✓ PRG output passes randomness tests' : '✗ PRG output failed one or more tests'}
                </div>

                {/* Bit ratio bar ≈50% */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem',
                    color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
                    <span>Bit ratio (ones vs zeros)</span>
                    <span style={{ color: freqColor }}>{(freq.ratio * 100).toFixed(2)}% ones — {freq.pass ? '≈ 50% ✓' : 'not ≈ 50% ✗'}</span>
                  </div>
                  <div style={{ display: 'flex', height: 18, borderRadius: 6, overflow: 'hidden',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: `${(1 - freq.ratio) * 100}%`, background: 'var(--accent-blue)',
                      opacity: 0.55, transition: 'width 0.4s ease', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.62rem', color: '#fff', fontWeight: 700 }}>
                      {freq.zeros > 12 ? `${freq.zeros} zeros` : ''}
                    </div>
                    <div style={{ width: `${freq.ratio * 100}%`, background: freqColor,
                      transition: 'width 0.4s ease', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.62rem', color: '#fff', fontWeight: 700 }}>
                      {freq.ones > 12 ? `${freq.ones} ones` : ''}
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 16 }}>
                    <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: 8, background: 'var(--text-muted)', opacity: 0.5 }} />
                    <div style={{ position: 'absolute', left: '50%', top: 9, transform: 'translateX(-50%)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>50%</div>
                  </div>
                </div>

                {/* 2×2 grid of all 4 tests */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

                  {/* T1 */}
                  <TestCard title="T1 — Frequency (Monobit)" pass={freq.pass}>
                    <div className="advantage-bar" style={{ height: 6 }}>
                      <div className="advantage-fill" style={{ width: `${freq.ratio * 100}%`, background: freqColor }} />
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      p = {freq.p} · ones={freq.ones}, zeros={freq.zeros}
                    </div>
                  </TestCard>

                  {/* T2 */}
                  {blockFreq && (
                    <TestCard title={`T2 — Block Frequency (M=${blockFreq.M})`} pass={blockFreq.pass}>
                      <div className="advantage-bar" style={{ height: 6 }}>
                        <div className="advantage-fill" style={{
                          width: `${Math.min(100, parseFloat(blockFreq.p) * 100)}%`,
                          background: blockFreq.pass ? 'var(--accent-green)' : 'var(--accent-red)',
                        }} />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        p = {blockFreq.p} · χ² = {blockFreq.chi2} / {blockFreq.N} blocks
                      </div>
                    </TestCard>
                  )}

                  {/* T3 */}
                  {runs && (
                    <TestCard title="T3 — Runs" pass={runs.pass} skip={runs.blocked}>
                      {runs.blocked ? (
                        <div style={{ fontSize: '0.68rem', color: 'var(--accent-orange)' }}>Pre-condition: frequency must pass first</div>
                      ) : (
                        <>
                          <div className="advantage-bar" style={{ height: 6 }}>
                            <div className="advantage-fill" style={{
                              width: `${Math.min(100, (runs.runs / Math.max(1, runs.expected * 2)) * 100)}%`,
                              background: runs.pass ? 'var(--accent-green)' : 'var(--accent-red)',
                            }} />
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            p = {runs.p} · {runs.runs} runs (exp≈{runs.expected}) · |z|={runs.z}
                          </div>
                        </>
                      )}
                    </TestCard>
                  )}

                  {/* T4 */}
                  {serial && (
                    <TestCard title="T4 — Serial (2-bit patterns)" pass={serial.pass}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[{ label: 'Δ₁ψ²', p: serial.p1 }, { label: 'Δ²ψ²', p: serial.p2 }].map(({ label, p }) => {
                          const pf = parseFloat(p);
                          return (
                            <div key={label} style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label} p={p}</div>
                              <div className="advantage-bar" style={{ height: 5 }}>
                                <div className="advantage-fill" style={{
                                  width: `${Math.min(100, Math.max(0, pf * 100))}%`,
                                  background: pf >= 0.01 ? 'var(--accent-green)' : 'var(--accent-red)',
                                }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4 }}>Overlapping 2-bit patterns uniformity</div>
                    </TestCard>
                  )}
                </div>

                {/* Summary row */}
                <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap',
                  borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                  {freq && <span style={{ color: freq.pass ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '0.75rem', fontWeight: 600 }}>T1: {freq.pass ? 'PASS' : 'FAIL'}</span>}
                  {blockFreq && <span style={{ color: blockFreq.pass ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '0.75rem', fontWeight: 600 }}>T2: {blockFreq.pass ? 'PASS' : 'FAIL'}</span>}
                  {runs && <span style={{ color: runs.blocked ? 'var(--accent-orange)' : runs.pass ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '0.75rem', fontWeight: 600 }}>T3: {runs.blocked ? 'SKIP' : runs.pass ? 'PASS' : 'FAIL'}</span>}
                  {serial && <span style={{ color: serial.pass ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '0.75rem', fontWeight: 600 }}>T4: {serial.pass ? 'PASS' : 'FAIL'}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{result.length_bytes}B · {result.length_bytes * 8} bits · p≥0.01 to pass</span>
                </div>
              </div>
            )}
          </>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
      </div>

      {/* Security / theory card */}
      <div className="demo-card">
        <h4>OWF ↔ PRG — Security Notes</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 8 }}>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12, borderLeft: '3px solid var(--accent-purple)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6, color: 'var(--accent-purple)' }}>
              OWF → PRG (PA#1a)
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              HILL theorem: any OWF f yields a PRG via the iterative hard-core bit construction.
              G(s) = b(x₀)‖b(x₁)‖… where xᵢ₊₁ = f(xᵢ) and b = LSB is the Goldreich-Levin hard-core predicate.
              DLP OWF: f(x) = gˣ mod p. AES OWF: f(k) = AESₖ(0¹²⁸) ⊕ k.
            </p>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12, borderLeft: '3px solid var(--accent-blue)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6, color: 'var(--accent-blue)' }}>
              PRG → OWF (PA#1b)
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Claim: f(s) = G(s) is a OWF. Proof (contrapositive): if an adversary inverts G(s) with non-negligible
              probability, it distinguishes G(s) from uniform (using the inversion to reconstruct s, then recompute G(s)),
              contradicting PRG security. Hence no efficient adversary can recover s from G(s).
            </p>
          </div>
        </div>
        <div style={{ marginTop: 10, padding: 10, background: 'rgba(255,200,0,0.05)', borderRadius: 6,
          border: '1px solid rgba(255,200,0,0.15)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Toy parameters:</strong> 32-bit safe prime for DLP demo,
          AES-128 for speed. Seed is 64-bit (8 bytes used, 16-byte field zero-padded). Output runs in under 1 second.
          Interface exposes <code>seed(s)</code> and <code>next_bits(n)</code> for PA#2 black-box consumption.
        </div>
      </div>
    </div>
  );
}
