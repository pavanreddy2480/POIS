import React, { useState } from 'react';
import { post } from '../../api';
import DemoHeader from '../DemoHeader';

const PRESETS = ['7', '42', '99', '255'];

function PKCSEm({ em }) {
  if (!em || em.length < 8) return <code style={{ fontSize: '0.6rem' }}>{em}</code>;
  const bytes = [];
  for (let i = 0; i < em.length; i += 2) bytes.push(em.slice(i, i + 2));
  const sepIdx = bytes.findIndex((b, i) => i > 1 && b === '00');
  if (sepIdx < 0) return <code style={{ fontSize: '0.6rem' }}>{em}</code>;
  const header = bytes.slice(0, 2);
  const ps = bytes.slice(2, sepIdx);
  const sep = bytes[sepIdx];
  const msg = bytes.slice(sepIdx + 1);
  const cell = (b, key, col) => (
    <span key={key} style={{ background: col + '22', borderRadius: 2, padding: '0 2px', color: col, fontFamily: 'var(--font-mono)' }}>{b}</span>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, fontSize: '0.6rem' }}>
      {header.map((b, i) => cell(b, `h${i}`, 'var(--accent-blue)'))}
      {ps.map((b, i) => cell(b, `ps${i}`, 'var(--accent-orange)'))}
      {cell(sep, 'sep', 'var(--accent-blue)')}
      {msg.map((b, i) => cell(b, `m${i}`, 'var(--accent-green)'))}
    </div>
  );
}

export default function PA14Demo() {
  const [m, setM] = useState('42');
  const [pkcs, setPkcs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);   // 0=idle 1=crt_shown 2=root_shown
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function reset() { setStep(0); setResult(null); setError(null); }
  function onSetM(v) { setM(v); reset(); }
  function onTogglePkcs(v) { setPkcs(v); reset(); }

  async function runAttack() {
    if (!m || isNaN(parseInt(m, 10))) return;
    setLoading(true);
    setError(null);
    setStep(0);
    setResult(null);
    try {
      const r = await post('/hastad/demo', { message: parseInt(m, 10), use_pkcs: pkcs });
      setResult(r);
      setStep(1);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function trunc(s, n = 22) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  return (
    <div>
      <style>{`
        @keyframes pa14SlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pa14-appear { animation: pa14SlideIn 0.3s ease forwards; }
      `}</style>

      <div className="demo-card">
        <DemoHeader num={14} title="Håstad's Broadcast Attack" tag="RSA" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          When the same message <code>m</code> is sent to 3 recipients each using RSA with
          exponent <code>e=3</code>, an attacker recovers <code>m</code> via CRT + integer
          cube root — no factoring required. PKCS#1 v1.5 padding defeats this by randomising
          each sender's ciphertext.
        </p>

        {/* Input row */}
        <div className="form-group">
          <label>Message m (small integer)</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {PRESETS.map(v => (
              <button key={v} className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                onClick={() => onSetM(v)}>
                {v}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={m}
            onChange={e => onSetM(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && runAttack()}
            placeholder="e.g. 42"
          />
        </div>

        {/* PKCS toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={pkcs} onChange={e => onTogglePkcs(e.target.checked)} />
          Use PKCS#1 v1.5 padding (defeats attack)
        </label>
        {pkcs && (
          <div style={{ fontSize: '0.76rem', color: 'var(--accent-orange)', marginBottom: 12, padding: '6px 10px', background: 'rgba(243,156,18,0.07)', borderRadius: 6, border: '1px solid rgba(243,156,18,0.28)' }}>
            Each sender prepends <strong>fresh random nonzero PS bytes</strong> → the three
            padded messages differ → CRT combines three different em³ values → cube root fails.
          </div>
        )}

        <button className="btn btn-primary" onClick={runAttack}
          disabled={loading || !m || isNaN(parseInt(m, 10))}
          style={{ marginBottom: 16 }}>
          {loading ? '⏳ Generating keys & encrypting…' : '▶ Run Håstad Attack'}
        </button>

        {error && (
          <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: 12 }}>{error}</p>
        )}

        {/* ── Step 1: Recipients + CRT ── */}
        {step >= 1 && result && (
          <div className="pa14-appear">
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Broadcast Recipients (e = 3)
            </div>

            {/* 3 recipient panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {result.moduli.map((N, i) => (
                <div key={i} style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', fontWeight: 700, marginBottom: 6 }}>
                    Recipient {i + 1}
                  </div>
                  <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>N{i+1} =</span> {trunc(N, 18)}
                  </div>
                  <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: pkcs ? 8 : 0 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>c{i+1} =</span> {trunc(result.ciphertexts[i], 18)}
                  </div>
                  {pkcs && result.padded_ems && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                        EM{i+1} <span style={{ color: 'var(--accent-blue)' }}>00 02</span>{' '}
                        <span style={{ color: 'var(--accent-orange)' }}>PS</span>{' '}
                        <span style={{ color: 'var(--accent-blue)' }}>00</span>{' '}
                        <span style={{ color: 'var(--accent-green)' }}>m</span>:
                      </div>
                      <PKCSEm em={result.padded_ems[i]} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* PKCS explanation box */}
            {pkcs && result.padded_ems && (
              <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(243,156,18,0.05)', border: '1px solid rgba(243,156,18,0.22)', borderRadius: 8, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 700, color: 'var(--accent-orange)' }}>Why the attack fails: </span>
                The orange bytes (PS) are independently randomised per sender.
                All three <code>EM</code> values are different, so CRT operates on three
                distinct cubes — the result is <strong>not</strong> a perfect cube of any single value.
              </div>
            )}

            {/* Attacker Eve — CRT step */}
            <div style={{ background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.28)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>
                Attacker (Eve) — Step 1: Chinese Remainder Theorem
              </div>
              <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <div>CRT(c₁, c₂, c₃) mod N₁N₂N₃</div>
                <div style={{ color: 'var(--text-primary)', wordBreak: 'break-all', marginTop: 2 }}>
                  = {trunc(result.m_cubed, 60)}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {pkcs
                    ? 'This is a mix of EM₁³ + EM₂³ + … — not a perfect cube (EM values differ)'
                    : 'This equals m³ exactly (all three plaintexts were the same m)'}
                </div>
              </div>

              {step === 1 && (
                <button className="btn btn-primary" onClick={() => setStep(2)}
                  style={{ marginTop: 10, fontSize: '0.8rem' }}>
                  ∛ Compute Integer Cube Root
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Cube root result ── */}
        {step >= 2 && result && (
          <div className="pa14-appear" style={{
            background: result.attack_succeeded
              ? 'rgba(39,174,96,0.07)'
              : 'rgba(231,76,60,0.07)',
            border: `1px solid ${result.attack_succeeded ? 'rgba(39,174,96,0.32)' : 'rgba(231,76,60,0.32)'}`,
            borderRadius: 8,
            padding: 12,
          }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700,
              color: result.attack_succeeded ? 'var(--accent-green)' : 'var(--accent-red)',
              marginBottom: 8 }}>
              Attacker (Eve) — Step 2: Integer Cube Root
            </div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 10 }}>
              <div>∛(CRT result) =</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.8rem', marginTop: 4, wordBreak: 'break-all' }}>
                {trunc(result.recovered, 50)}
              </div>
              {!result.attack_succeeded && (
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Floor root shown — cube root is <strong>not exact</strong>; decoded bytes are garbage.
                </div>
              )}
              {result.attack_succeeded && (
                <div style={{ fontSize: '0.62rem', color: 'var(--accent-green)', marginTop: 4 }}>
                  Exact cube root confirmed: {result.recovered}³ = m³ ✓
                </div>
              )}
            </div>

            <span className={`badge ${result.attack_succeeded ? 'badge-danger' : 'badge-secure'}`}>
              {result.attack_succeeded
                ? `⚡ Attack succeeded — recovered m = ${result.recovered}`
                : `✓ Attack failed — PKCS padding defeated Håstad`}
            </span>

            {!result.attack_succeeded && (
              <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                PKCS#1 v1.5 ensures each sender's padded message <code>EM</code> is
                independently randomised. The attacker's CRT reconstruction is not equal
                to any single <code>EM³</code>, so no exact cube root exists.
                The integer cube root returns a floor approximation — the decrypted
                bytes are meaningless, not <code>m = {m}</code>.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
