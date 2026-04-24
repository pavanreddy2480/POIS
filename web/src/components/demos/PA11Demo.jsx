import React, { useState } from 'react';
import { api } from '../../api';
import DemoHeader from '../DemoHeader';
import CopyVal from '../CopyVal';

export default function PA11Demo({ onNavigate }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [eveEnabled, setEveEnabled] = useState(false);
  const [alicePriv, setAlicePriv] = useState('');
  const [bobPriv, setBobPriv] = useState('');

  const reset = () => { setResult(null); setEveEnabled(false); setAlicePriv(''); setBobPriv(''); };

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.dh.exchangeCustom(
        alicePriv.trim() || null,
        bobPriv.trim() || null,
        32,
      );
      setResult(r);
    } catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  const hexOnly = (s) => s.replace(/[^0-9a-fA-F]/g, '');

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={11} title="Live Diffie-Hellman Key Exchange" tag="DH" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Alice and Bob establish a shared secret K = g^(ab) mod p over a public channel.
          Eve sees g^a and g^b but cannot compute g^(ab) (CDH assumption).
        </p>

        <div className="demo-row" style={{ marginBottom: 14 }}>
          <div className="demo-half">
            <h5 style={{ color: 'var(--accent-blue)', marginBottom: 8 }}>Alice</h5>
            <div className="form-group">
              <label>Private exponent a (hex, leave empty for random)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={alicePriv}
                  onChange={e => setAlicePriv(hexOnly(e.target.value))}
                  placeholder="random"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}
                  onClick={() => setAlicePriv('')}>Randomise</button>
              </div>
            </div>
          </div>
          <div className="demo-half">
            <h5 style={{ color: 'var(--accent-orange)', marginBottom: 8 }}>Bob</h5>
            <div className="form-group">
              <label>Private exponent b (hex, leave empty for random)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={bobPriv}
                  onChange={e => setBobPriv(hexOnly(e.target.value))}
                  placeholder="random"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}
                  onClick={() => setBobPriv('')}>Randomise</button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {'▶ Run DH Exchange'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={eveEnabled} onChange={e=>setEveEnabled(e.target.checked)} />
            Enable Eve (MITM)
          </label>
        </div>

        {result && !result.error && (
          <>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
              p = {result.p?.slice(0,18)}… &nbsp; g = {result.g}
            </div>
            <div className="demo-row">
              <div className="demo-half">
                <h5 style={{ color: 'var(--accent-blue)' }}>Alice</h5>
                <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                  <div>Private a: <CopyVal value={result.alice_private} style={{ color: 'var(--text-secondary)' }}>{result.alice_private}</CopyVal></div>
                  <div>Public A=g^a: {result.alice_public?.slice(0,18)}…</div>
                  <div style={{ color: result.keys_match ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    Shared K: <CopyVal value={result.alice_shared_secret} style={{ color: 'inherit' }}>{result.alice_shared_secret?.slice(0,18)}…</CopyVal>
                  </div>
                </div>
              </div>
              <div className="demo-half">
                <h5 style={{ color: 'var(--accent-orange)' }}>Bob</h5>
                <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                  <div>Private b: <CopyVal value={result.bob_private} style={{ color: 'var(--text-secondary)' }}>{result.bob_private}</CopyVal></div>
                  <div>Public B=g^b: {result.bob_public?.slice(0,18)}…</div>
                  <div style={{ color: result.keys_match ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    Shared K: <CopyVal value={result.bob_shared_secret} style={{ color: 'inherit' }}>{result.bob_shared_secret?.slice(0,18)}…</CopyVal>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        {result?.keys_match !== undefined && (
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <span className={`badge ${result.keys_match ? 'badge-secure' : 'badge-broken'}`}>
              {result.keys_match ? '✓ K_A = K_B — Exchange Successful!' : '✗ Keys do not match!'}
            </span>
          </div>
        )}
        {result?.error && <div className="hex-display red">{result.error}</div>}
        {eveEnabled && (
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--accent-red)' }}>
            MITM Attack: Eve intercepts A and B, substitutes A′=g^e and B′=g^e.
            Alice and Bob each compute a different key — Eve can read all traffic!
            Basic DH provides no authentication.
          </div>
        )}
        {onNavigate && (
          <div className="demo-related">
            <span className="demo-related-label">Related:</span>
            <button className="demo-xlink" onClick={() => onNavigate('PA12')}>PA12 RSA Encrypt →</button>
          </div>
        )}
      </div>
    </div>
  );
}
