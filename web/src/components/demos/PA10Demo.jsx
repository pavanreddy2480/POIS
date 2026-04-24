import React, { useState } from 'react';
import { api } from '../../api';
import CopyHex from '../CopyHex';
import HexInput from '../HexInput';
import DemoHeader from '../DemoHeader';

export default function PA10Demo({ onNavigate }) {
  const KEY = '0123456789abcdef';
  const [msg, setMsg] = useState('48656c6c6f20776f726c64');
  const [suffix, setSuffix] = useState('deadbeef');
  const [leResult, setLeResult] = useState(null);
  const [hmacTag, setHmacTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [leLoading, setLeLoading] = useState(false);
  const [error, setError] = useState(null);
  const [leError, setLeError] = useState(null);

  const reset = () => {
    setMsg('48656c6c6f20776f726c64');
    setSuffix('deadbeef');
    setLeResult(null);
    setHmacTag('');
    setError(null);
    setLeError(null);
  };

  const runLengthExtension = async () => {
    setLeLoading(true);
    setLeError(null);
    try {
      const m = msg.length % 2 ? msg + '0' : msg;
      const s = suffix.length % 2 ? suffix + '0' : suffix;
      const r = await api.hmac.lengthExtension(KEY, m, s);
      setLeResult(r);
    } catch(e) { setLeError(e.message); }
    finally { setLeLoading(false); }
  };

  const computeHmac = async () => {
    setLoading(true);
    setError(null);
    try {
      const m = msg.length % 2 ? msg + '0' : msg;
      const r = await api.hmac.sign(KEY, m);
      setHmacTag(r.tag);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const mono = { fontSize: '0.68rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', lineHeight: 1.7 };

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={10} title="Length Extension Attack vs HMAC" tag="EUF-CMA" onReset={reset} />
        <div className="demo-row">
          <div className="demo-half broken">
            <h5>⚠ Naive H(k‖m) — Broken</h5>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              Attacker sees t = H(k‖m). Without knowing k, they forge a valid tag for m‖pad‖suffix.
            </p>
            <HexInput label="Message m (hex)" value={msg} onChange={v => { setMsg(v); setLeResult(null); }} disabled={leLoading} style={{ fontSize: '0.72rem' }} />
            <HexInput label="Attacker suffix (hex)" value={suffix} onChange={v => { setSuffix(v); setLeResult(null); }} disabled={leLoading} style={{ fontSize: '0.72rem' }} />
            <button className="btn btn-danger" onClick={runLengthExtension} disabled={leLoading} style={{ marginBottom: 10 }}>
              {leLoading ? 'Forging…' : ' Run Length Extension Attack'}
            </button>
            {leResult && (
              <div style={{ ...mono }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>t = H(k‖m): </span>
                  <span style={{ color: 'var(--accent-orange)' }}>{leResult.naive_tag}</span>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Suffix: </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{leResult.suffix_hex}</span>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Attacker forged tag: </span>
                  <span style={{ color: 'var(--accent-red)' }}>{leResult.attacker_tag}</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ground truth H(k‖m‖pad‖sfx): </span>
                  <span style={{ color: 'var(--accent-red)' }}>{leResult.ground_truth_tag}</span>
                </div>
                <span className={`badge ${leResult.attack_succeeds ? 'badge-broken' : 'badge-secure'}`}>
                  {leResult.attack_succeeds ? '✗ Tags match — forgery succeeded!' : '✓ Tags differ — attack failed'}
                </span>
              </div>
            )}
            {leError && <div className="hex-display red" style={{ marginTop: 6, fontSize: '0.72rem' }}>Error: {leError}</div>}
          </div>
          <div className="demo-half secure">
            <h5>✓ HMAC_k(m) — Secure</h5>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              HMAC = H((k⊕opad) ‖ H((k⊕ipad) ‖ m)). Outer hash with fresh key prevents extension.
            </p>
            <HexInput
              label="Message m (hex)"
              value={msg}
              onChange={v => { setMsg(v); setHmacTag(''); }}
              onEnter={computeHmac}
              disabled={loading}
              style={{ fontSize: '0.72rem' }}
            />
            <button className="btn btn-success" onClick={computeHmac} disabled={loading} style={{ marginBottom: 8 }}>
              {'Compute HMAC'}
            </button>
            {hmacTag && <CopyHex value={hmacTag} style={{ fontSize: '0.7rem' }} />}
            {hmacTag && (
              <div style={{ marginTop: 6, fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Leading zeros expected — DLP hash with 32-bit prime outputs values &lt; 2³², so only the last 4 bytes are non-zero.
              </div>
            )}
            {error && <div className="hex-display red" style={{ marginTop: 6, fontSize: '0.72rem' }}>Error: {error}</div>}
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--accent-green)' }}>
              Cannot extend: outer H resets state with k⊕opad
            </div>
          </div>
        </div>
      </div>
      <div className="demo-card">
        <h4>HMAC_k(m) = H((k⊕opad) ‖ H((k⊕ipad) ‖ m))</h4>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: 2, color: 'var(--text-secondary)' }}>
          <div>ipad = 0x36 repeated b times</div>
          <div>opad = 0x5C repeated b times</div>
          <div>inner = H(k⊕ipad ‖ m)</div>
          <div>HMAC = H(k⊕opad ‖ inner)</div>
          <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            Security: HMAC is EUF-CMA secure if the compression function h is a PRF. This holds even when the hash H is collision-broken (e.g., HMAC-MD5 was safe in TLS long after MD5 collisions were found).
          </div>
        </div>
        {onNavigate && (
          <div className="demo-related">
            <span className="demo-related-label">Related:</span>
            <button className="demo-xlink" onClick={() => onNavigate('PA5')}>PA5 MAC Forge →</button>
          </div>
        )}
      </div>
    </div>
  );
}
