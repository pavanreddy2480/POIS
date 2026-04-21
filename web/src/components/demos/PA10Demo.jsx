import React, { useState } from 'react';
import { api } from '../../api';

export default function PA10Demo() {
  const [key] = useState('0123456789abcdef');
  const [msg, setMsg] = useState('48656c6c6f20776f726c64');
  const [suffix, setSuffix] = useState('deadbeef');
  const [hmacTag, setHmacTag] = useState('');
  const [loading, setLoading] = useState(false);

  const computeHmac = async () => {
    setLoading(true);
    try {
      const r = await api.hmac.sign(key, msg.padEnd(16,'0'));
      setHmacTag(r.tag);
    } catch(e) {}
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="demo-card">
        <h4>🔏 PA#10 — Length Extension Attack vs HMAC</h4>
        <div className="demo-row">
          <div className="demo-half broken">
            <h5>⚠ Naive H(k‖m) — Broken</h5>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
              Given H(k‖m) = t, attacker can compute H(k‖m‖pad‖m') for ANY suffix m' WITHOUT knowing k.
            </p>
            <div className="hex-display red">
              Length-extension: H(k‖m‖pad‖suffix) computable from t alone
            </div>
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--accent-red)' }}>
              The MD state after processing k‖m is exactly t = H(k‖m). Just continue hashing!
            </div>
          </div>
          <div className="demo-half secure">
            <h5>✓ HMAC_k(m) — Secure</h5>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
              HMAC = H((k⊕opad) ‖ H((k⊕ipad) ‖ m)). Outer hash with fresh key prevents extension.
            </p>
            <div className="form-group">
              <label>Message (hex)</label>
              <input type="text" value={msg} onChange={e=>setMsg(e.target.value)} style={{ fontSize: '0.72rem' }} />
            </div>
            <button className="btn btn-success" onClick={computeHmac} disabled={loading} style={{ marginBottom: 8 }}>Compute HMAC</button>
            {hmacTag && <div className="hex-display" style={{ fontSize: '0.7rem' }}>{hmacTag}</div>}
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--accent-green)' }}>
              Cannot extend: outer H resets state with k⊕opad
            </div>
          </div>
        </div>
      </div>
      <div className="demo-card">
        <h4>📐 HMAC_k(m) = H((k⊕opad) ‖ H((k⊕ipad) ‖ m))</h4>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: 2, color: 'var(--text-secondary)' }}>
          <div>ipad = 0x36 repeated b times</div>
          <div>opad = 0x5C repeated b times</div>
          <div>inner = H(k⊕ipad ‖ m)</div>
          <div>HMAC = H(k⊕opad ‖ inner)</div>
          <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            Security: HMAC is EUF-CMA secure if the compression function h is a PRF. This holds even when the hash H is collision-broken (e.g., HMAC-MD5 was safe in TLS long after MD5 collisions were found).
          </div>
        </div>
      </div>
    </div>
  );
}
