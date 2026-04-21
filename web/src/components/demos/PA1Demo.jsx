import React, { useState, useEffect } from 'react';
import { api } from '../../api';

export default function PA1Demo() {
  const [seed, setSeed] = useState('0123456789abcdef');
  const [length, setLength] = useState(32);
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

  const ratio = result?.ones_ratio ?? 0.5;
  const barColor = Math.abs(ratio - 0.5) < 0.08 ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div>
      <div className="demo-card">
        <h4>🎲 PA#1 — Live PRG Output Viewer</h4>
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
              <div className="hex-display">{result.output_hex}</div>
            </div>
            <div className="form-group">
              <label>Randomness Test — Bit Ratio (expected ≈50%): {(ratio*100).toFixed(1)}%</label>
              <div className="advantage-bar">
                <div className="advantage-fill" style={{ width: `${ratio*100}%`, background: barColor }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                <span>0%</span>
                <span style={{ color: result.frequency_pass ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {result.frequency_pass ? '✓ PASS' : '✗ FAIL'} — Frequency test
                </span>
                <span>100%</span>
              </div>
            </div>
            <div className="result-box" style={{ marginTop: 8 }}>
              <div><span className="result-key">Seed: </span><span className="result-val">{result.seed}</span></div>
              <div><span className="result-key">Length: </span><span className="result-val">{result.length_bytes} bytes = {result.length_bytes*8} bits</span></div>
              <div><span className="result-key">Ones ratio: </span><span className="result-val">{(ratio*100).toFixed(2)}%</span></div>
            </div>
          </>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
        {loading && <div className="spinner" style={{ margin: '10px auto', display: 'block' }} />}
      </div>
      <div className="demo-card">
        <h4>📖 Security Note</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text-primary)' }}>OWF → PRG:</strong> The HILL theorem proves that any OWF yields a PRG via the iterative hard-core bit construction.
          The DLP OWF (f(x) = g^x mod p) and AES OWF (f(k) = AES_k(0^128) ⊕ k) are used as concrete instantiations.
          Backward: any PRG G is itself a OWF (G(s) is one-way since recovering s from G(s) would break pseudorandomness).
        </p>
      </div>
    </div>
  );
}
