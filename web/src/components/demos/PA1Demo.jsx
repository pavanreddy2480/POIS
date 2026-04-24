import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import CopyHex from '../CopyHex';
import DemoHeader from '../DemoHeader';

const SEED_DEFAULT = '0123456789abcdef';
const LENGTH_DEFAULT = 32;

function runsTest(outputHex) {
  const bits = [];
  for (const c of outputHex) {
    const n = parseInt(c, 16);
    for (let i = 3; i >= 0; i--) bits.push((n >> i) & 1);
  }
  const n = bits.length;
  const n1 = bits.filter(b => b === 1).length;
  const n0 = n - n1;
  if (n0 === 0 || n1 === 0) return { runs: 0, expected: 0, pass: false };
  let runs = 1;
  for (let i = 1; i < n; i++) { if (bits[i] !== bits[i-1]) runs++; }
  const expected = (2 * n1 * n0) / n + 1;
  const variance = (2 * n1 * n0 * (2 * n1 * n0 - n)) / (n * n * (n - 1));
  if (variance <= 0) return { runs, expected: Math.round(expected), z: '0.00', pass: true };
  const z = Math.abs(runs - expected) / Math.sqrt(variance);
  return { runs, expected: Math.round(expected), z: z.toFixed(2), pass: z < 1.96 };
}

export default function PA1Demo() {
  const [seed, setSeed] = useState(SEED_DEFAULT);
  const [length, setLength] = useState(LENGTH_DEFAULT);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.prg.generate(seed.padEnd(16, '0'), length);
      setResult(r);
    } catch (e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, [seed, length]);

  const reset = () => { setSeed(SEED_DEFAULT); setLength(LENGTH_DEFAULT); };
  const ratio = result?.ones_ratio ?? 0.5;
  const freqColor = Math.abs(ratio - 0.5) < 0.08 ? 'var(--accent-green)' : 'var(--accent-red)';
  const runs = result?.output_hex ? runsTest(result.output_hex) : null;

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={1} title="Live PRG Output Viewer" tag="PRG" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          OWF-based Pseudorandom Generator: G(s) = b(x₀)‖b(x₁)‖… (HILL construction via DLP/AES)
        </p>
        <div className="form-group">
          <label>Seed (hex, 16 bytes)</label>
          <input type="text" value={seed} onChange={e=>setSeed(e.target.value)} maxLength={32} />
        </div>
        <div className="form-group">
          <label>Output Length (bytes): {length}</label>
          <input type="range" min={8} max={256} value={length} onChange={e=>setLength(+e.target.value)} />
        </div>
        {result && !result.error && (
          <>
            <div className="form-group">
              <label>PRG Output (hex)</label>
              <CopyHex value={result.output_hex} />
            </div>

            {/* Frequency test (NIST SP 800-22 Test 1) */}
            <div className="form-group">
              <label>
                NIST Test 1 — Frequency (Monobit): {(ratio*100).toFixed(1)}% ones
              </label>
              <div className="advantage-bar">
                <div className="advantage-fill" style={{ width: `${ratio*100}%`, background: freqColor }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                <span>0%</span>
                <span style={{ color: result.frequency_pass ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                  {result.frequency_pass ? '✓ PASS' : '✗ FAIL'}
                </span>
                <span>100%</span>
              </div>
            </div>

            {/* Runs test (NIST SP 800-22 Test 3) */}
            {runs && (
              <div className="form-group">
                <label>
                  NIST Test 3 — Runs: {runs.runs} runs (expected ≈ {runs.expected}), |z| = {runs.z}
                </label>
                <div className="advantage-bar">
                  <div className="advantage-fill" style={{
                    width: `${Math.min(100, (runs.runs / (runs.expected * 2)) * 100)}%`,
                    background: runs.pass ? 'var(--accent-green)' : 'var(--accent-red)',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  <span>0 runs</span>
                  <span style={{ color: runs.pass ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                    {runs.pass ? '✓ PASS' : '✗ FAIL'} (|z| &lt; 1.96 at 95%)
                  </span>
                  <span>{runs.expected * 2} runs</span>
                </div>
              </div>
            )}

            <div className="result-box" style={{ marginTop: 8 }}>
              <div><span className="result-key">Seed: </span><span className="result-val">{result.seed}</span></div>
              <div><span className="result-key">Length: </span><span className="result-val">{result.length_bytes} bytes = {result.length_bytes*8} bits</span></div>
              <div><span className="result-key">Ones ratio: </span><span className="result-val">{(ratio*100).toFixed(2)}%</span></div>
              <div><span className="result-key">Frequency: </span><span style={{ color: result.frequency_pass ? 'var(--accent-green)' : 'var(--accent-red)' }}>{result.frequency_pass ? 'PASS' : 'FAIL'}</span></div>
              {runs && <div><span className="result-key">Runs: </span><span style={{ color: runs.pass ? 'var(--accent-green)' : 'var(--accent-red)' }}>{runs.pass ? 'PASS' : 'FAIL'} ({runs.runs} runs, |z|={runs.z})</span></div>}
            </div>
          </>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
      </div>
      <div className="demo-card">
        <h4>Security Note</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text-primary)' }}>OWF → PRG:</strong> The HILL theorem proves that any OWF yields a PRG via the iterative hard-core bit construction.
          The DLP OWF (f(x) = g^x mod p) and AES OWF (f(k) = AES_k(0¹²⁸) ⊕ k) are used as concrete instantiations.
          Backward: any PRG G is itself a OWF — G(s) is one-way since recovering s from G(s) would break pseudorandomness.
        </p>
      </div>
    </div>
  );
}
