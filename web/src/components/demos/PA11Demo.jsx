import React, { useState } from 'react';
import { api } from '../../api';

export default function PA11Demo() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [eveEnabled, setEveEnabled] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.dh.exchange(32);
      setResult(r);
    } catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="demo-card">
        <h4>🤝 PA#11 — Live Diffie-Hellman Key Exchange</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Alice and Bob establish a shared secret K = g^(ab) mod p over a public channel.
          Eve sees g^a and g^b but cannot compute g^(ab) (CDH assumption).
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? '⏳ Exchanging...' : '▶ Run DH Exchange'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={eveEnabled} onChange={e=>setEveEnabled(e.target.checked)} />
            Enable Eve (MITM)
          </label>
        </div>
        {result && !result.error && (
          <div className="demo-row">
            <div className="demo-half">
              <h5 style={{ color: 'var(--accent-blue)' }}>Alice</h5>
              <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                <div>Private a: {result.alice_private?.slice(0,10)}…</div>
                <div>Public A=g^a: {result.alice_public?.slice(0,10)}…</div>
                <div style={{ color: result.keys_match ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  Shared K: {result.alice_shared_secret?.slice(0,12)}…
                </div>
              </div>
            </div>
            <div className="demo-half">
              <h5 style={{ color: 'var(--accent-gold)' }}>Bob</h5>
              <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                <div>Private b: {result.bob_private?.slice(0,10)}…</div>
                <div>Public B=g^b: {result.bob_public?.slice(0,10)}…</div>
                <div style={{ color: result.keys_match ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  Shared K: {result.bob_shared_secret?.slice(0,12)}…
                </div>
              </div>
            </div>
          </div>
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
            ⚠ MITM Attack: Eve intercepts A and B, substitutes A'=g^e and B'=g^e.
            Alice and Bob each compute a different key — Eve can read all traffic!
            Basic DH provides no authentication.
          </div>
        )}
      </div>
    </div>
  );
}
