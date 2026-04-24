import React, { useState } from 'react';
import { post } from '../../api';
import DemoHeader from '../DemoHeader';

export default function PA14Demo() {
  const [m, setM] = useState('42');
  const [pkcs, setPkcs] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const reset = () => { setResult(null); setPkcs(false); };

  async function run() {
    setLoading(true);
    try {
      const r = await post('/hastad/demo', { message: parseInt(m), use_pkcs: pkcs });
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={14} title="Håstad's Broadcast Attack" tag="RSA" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          If the same message m is encrypted with e=3 to 3 different RSA public keys, an attacker
          can recover m using CRT and an integer cube root — no factoring needed.
          PKCS#1 v1.5 padding defeats this by randomising each sender's plaintext.
        </p>

        <div className="form-group">
          <label>Message m (small integer, m³ &lt; N₁N₂N₃)</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {['7', '42', '99', '255'].map(v => (
              <button key={v} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                onClick={() => { setM(v); setResult(null); }}>
                {v}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={m}
            onChange={e => { setM(e.target.value); setResult(null); }}
            onKeyDown={e => e.key === 'Enter' && !loading && run()}
            placeholder="small integer"
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={pkcs} onChange={e => { setPkcs(e.target.checked); setResult(null); }} />
          Use PKCS#1 v1.5 padding (defeats attack)
        </label>
        {pkcs && (
          <div style={{ fontSize: '0.76rem', color: 'var(--accent-orange)', marginBottom: 10, padding: '6px 10px', background: 'rgba(243,156,18,0.08)', borderRadius: 6, border: '1px solid rgba(243,156,18,0.3)' }}>
            Each sender adds different random PS bytes → three encryptions encode different padded messages → CRT result ≠ m³ → cube root fails.
          </div>
        )}

        <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 16 }}>
          {'▶ Run Håstad Attack'}
        </button>

        {result && !result.error && (
          <>
            {/* Three recipient panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              {result.moduli?.map((N, i) => (
                <div key={i} style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', fontWeight: 700, marginBottom: 4 }}>
                    Recipient {i+1}
                  </div>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    N{i+1} = {N.slice(0, 18)}…
                  </div>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    c{i+1} = {(result.ciphertexts?.[i] || '').slice(0, 18)}…
                  </div>
                </div>
              ))}
            </div>

            {/* Attacker panel */}
            <div style={{ background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>
                Attacker (Eve)
              </div>
              <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>CRT(c₁,c₂,c₃) = m³ = </span>
                  {result.m_cubed.slice(0, 40)}{result.m_cubed.length > 40 ? '…' : ''}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>∛(m³) = </span>
                  <span style={{ color: result.attack_succeeded ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                    {result.recovered}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <span className={`badge ${result.attack_succeeded ? 'badge-danger' : 'badge-secure'}`}>
                  {result.attack_succeeded
                    ? `⚡ Attack succeeded! Recovered m = ${result.recovered}`
                    : `✓ Attack failed — cube root of CRT result ≠ ${m}`}
                </span>
              </div>
              {!result.attack_succeeded && (
                <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  PKCS padding randomised each plaintext → CRT combined three different em³ values → result is not m³ → integer cube root fails.
                </div>
              )}
            </div>
          </>
        )}
        {result?.error && <p style={{ color: 'var(--accent-red)', marginTop: 8 }}>{result.error}</p>}
      </div>
    </div>
  );
}
