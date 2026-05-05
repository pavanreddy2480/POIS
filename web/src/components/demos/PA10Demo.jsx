import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import CopyHex from '../CopyHex';
import HexInput from '../HexInput';
import DemoHeader from '../DemoHeader';

function KV({ k, v, color }) { return <div style={{ display:'flex', gap:8, marginBottom:4 }}><span style={{ fontSize:'0.72rem', color:'var(--text-muted)', minWidth:100 }}>{k}</span><span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color: color||'var(--text-primary)', wordBreak:'break-all' }}>{v}</span></div>; }

// ── 1. Length Extension vs HMAC Panel ─────────────────────────────────────────
function LengthExtensionPanel() {
  const KEY = '0123456789abcdef';
  const [msg, setMsg] = useState('48656c6c6f20776f726c64'); // "Hello world"
  const [suffix, setSuffix] = useState('deadbeef');
  const [leResult, setLeResult] = useState(null);
  const [hmacTag, setHmacTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [leLoading, setLeLoading] = useState(false);
  const [error, setError] = useState(null);
  const [leError, setLeError] = useState(null);

  const runLengthExtension = async () => {
    setLeLoading(true); setLeError(null);
    try {
      const m = msg.length % 2 ? msg + '0' : msg;
      const s = suffix.length % 2 ? suffix + '0' : suffix;
      const r = await api.hmac.lengthExtension(KEY, m, s);
      setLeResult(r);
    } catch(e) { setLeError(e.message); }
    finally { setLeLoading(false); }
  };

  const computeHmac = async () => {
    setLoading(true); setError(null);
    try {
      const m = msg.length % 2 ? msg + '0' : msg;
      const r = await api.hmac.sign(KEY, m);
      setHmacTag(r.tag);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const mono = { fontSize: '0.68rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', lineHeight: 1.7 };

  return (
    <div className="demo-card">
      <DemoHeader num={10} title="Length Extension Attack vs HMAC" tag="EUF-CMA" onReset={()=>{setMsg('48656c6c6f20776f726c64'); setSuffix('deadbeef'); setLeResult(null); setHmacTag('');}} />

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
              <KV k="t = H(k‖m):" v={leResult.naive_tag} color="var(--accent-orange)"/>
              <KV k="Suffix:" v={leResult.suffix_hex} color="var(--text-secondary)"/>
              <KV k="Attacker tag:" v={leResult.attacker_tag} color="var(--accent-red)"/>
              <KV k="Ground truth:" v={leResult.ground_truth_tag} color="var(--accent-red)"/>
              <div style={{ marginTop:8, padding:'4px 8px', borderRadius:4, background: leResult.attack_succeeds ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)', color: leResult.attack_succeeds ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight:700 }}>
                {leResult.attack_succeeds ? '✗ Tags match — forgery succeeded!' : '✓ Tags differ — attack failed'}
              </div>
            </div>
          )}
          {leError && <div className="hex-display red" style={{ marginTop: 6, fontSize: '0.72rem' }}>Error: {leError}</div>}
        </div>

        <div className="demo-half secure">
          <h5>✓ HMAC_k(m) — Secure (PA#8 DLP Hash)</h5>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            HMAC = H((k⊕opad) ‖ H((k⊕ipad) ‖ m)). Outer hash with fresh key prevents extension.
          </p>
          <HexInput label="Message m (hex)" value={msg} onChange={v => { setMsg(v); setHmacTag(''); }} disabled={loading} style={{ fontSize: '0.72rem' }} />
          <div style={{ height: 60 }}></div>
          <button className="btn btn-success" onClick={computeHmac} disabled={loading} style={{ marginBottom: 8 }}>
            Compute HMAC
          </button>
          {hmacTag && <CopyHex value={hmacTag} style={{ fontSize: '0.7rem' }} />}
          {hmacTag && (
            <div style={{ marginTop: 6, fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Leading zeros expected — DLP hash with 32-bit prime outputs values &lt; 2³², so only the last 4 bytes are non-zero.
            </div>
          )}
          {error && <div className="hex-display red" style={{ marginTop: 6, fontSize: '0.72rem' }}>Error: {error}</div>}
          {leResult && (
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--accent-green)', padding:'4px 8px', borderRadius:4, background:'rgba(52,199,89,0.1)' }}>
              ✓ Cannot extend: outer H resets state with k⊕opad
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 2. EUF-CMA Game Panel ─────────────────────────────────────────────────────
function EUFCMAPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setData(await api.hmac.eufCma()); }
    catch(e) { setData({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="demo-card">
      <h4>EUF-CMA Security Game (CRHF ⇒ MAC)</h4>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
        An adversary makes 50 queries to the HMAC oracle, then tries to forge a tag for a new message.
      </p>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 12 }}>
        {loading ? 'Running Game…' : '▶ Run EUF-CMA Game'}
      </button>
      {data?.error && <div className="hex-display red">{data.error}</div>}
      {data && !data.error && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:'0.75rem' }}>Queries: <strong>{data.n_queries}</strong></span>
            <span style={{ fontSize:'0.75rem' }}>Total Forgeries: <strong style={{color:data.total_forgeries>0?'var(--accent-red)':'var(--accent-green)'}}>{data.total_forgeries}</strong></span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {Object.entries(data.forgery_attempts).map(([name, r]) => (
              <div key={name} style={{ background:'var(--bg-well)', padding:'8px 10px', borderRadius:6, border:`1px solid ${r.is_forgery?'var(--accent-red)':'var(--border)'}` }}>
                <div style={{ fontSize:'0.75rem', fontWeight:700, marginBottom:4 }}>{r.attempt}</div>
                <div style={{ fontSize:'0.7rem', color:r.succeeds?'var(--accent-orange)':'var(--accent-green)' }}>
                  Succeeds: {r.succeeds ? 'Yes' : 'No'} | Valid Forgery: {r.is_forgery ? 'Yes' : 'No'}
                </div>
                <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginTop:4 }}>{r.explanation}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:12, padding:'8px 12px', borderRadius:6, background: data.adversary_succeeded ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)', color: data.adversary_succeeded ? 'var(--accent-red)' : 'var(--accent-green)', fontSize:'0.75rem', fontWeight:700 }}>
            Conclusion: {data.conclusion}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 3. MAC => CRHF Panel ──────────────────────────────────────────────────────
function MacToCrhfPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setData(await api.hmac.macHash()); }
    catch(e) { setData({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="demo-card">
      <h4>MAC ⇒ CRHF (Backward Direction)</h4>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
        Construct a compression function h'(cv, block) = HMAC_k(cv ‖ block) for fixed public k. Plug into Merkle-Damgård to get MAC_Hash.
      </p>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 12 }}>
        {loading ? 'Computing…' : '▶ Build MAC_Hash & Demo'}
      </button>
      {data?.error && <div className="hex-display red">{data.error}</div>}
      {data && !data.error && (
        <div>
          <KV k="Fixed key k:" v={data.k_hex} />
          <KV k="Message 1:" v={data.message1} color="var(--accent-blue)" />
          <KV k="Digest 1:" v={data.digest1} />
          <KV k="Message 2:" v={data.message2} color="var(--accent-orange)" />
          <KV k="Digest 2:" v={data.digest2} />
          <div style={{ marginTop:10, fontSize:'0.72rem', color:'var(--text-muted)', background:'var(--bg-well)', padding:'8px', borderRadius:6 }}>
            {data.reduction}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 4. Encrypt-then-HMAC Panel ────────────────────────────────────────────────
function EncryptThenHmacPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setData(await api.hmac.cca2Game()); }
    catch(e) { setData({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="demo-card">
      <h4>Encrypt-then-HMAC (IND-CCA2 Secure)</h4>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
        EtH: Encrypt with kE to get C. Then compute tag t = HMAC_kM(C). Transmit (C, t). IND-CCA2 game tampers with ciphertext.
      </p>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 12 }}>
        {loading ? 'Running Game…' : '▶ Run IND-CCA2 Game'}
      </button>
      {data?.error && <div className="hex-display red">{data.error}</div>}
      {data && !data.error && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:'0.75rem' }}>Tamper attempts: <strong>{data.n_tamper_attempts}</strong></span>
            <span style={{ fontSize:'0.75rem' }}>Successful: <strong style={{color:data.n_successful_tampering>0?'var(--accent-red)':'var(--accent-green)'}}>{data.n_successful_tampering}</strong></span>
            <span style={{ fontSize:'0.75rem' }}>Advantage: <strong>{data.adversary_advantage}</strong></span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', fontSize:'0.7rem', textAlign:'left', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  <th style={{ padding:'4px 0' }}>Attempt</th>
                  <th style={{ padding:'4px 0' }}>Tampered Byte</th>
                  <th style={{ padding:'4px 0' }}>Tampered Bit</th>
                  <th style={{ padding:'4px 0' }}>MAC Rejected?</th>
                </tr>
              </thead>
              <tbody>
                {data.tamper_results.map((r, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'4px 0' }}>{r.attempt}</td>
                    <td style={{ padding:'4px 0' }}>{r.tamper_byte}</td>
                    <td style={{ padding:'4px 0' }}>{r.tamper_bit}</td>
                    <td style={{ padding:'4px 0', color: r.rejected ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight:700 }}>
                      {r.rejected ? 'Yes (⊥)' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:12, padding:'8px 12px', borderRadius:6, background: data.secure ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: data.secure ? 'var(--accent-green)' : 'var(--accent-red)', fontSize:'0.75rem', fontWeight:700 }}>
            {data.conclusion}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 5. Timing Demo Panel ──────────────────────────────────────────────────────
function TimingDemoPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setData(await api.hmac.timingDemo()); }
    catch(e) { setData({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="demo-card">
      <h4>Constant-Time Comparison</h4>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
        Compare two tags. A naive implementation exits early if bytes differ, leaking the point of failure via timing. A constant-time implementation XORs all bytes.
      </p>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 12 }}>
        {loading ? 'Measuring Timing…' : '▶ Run Timing Demo'}
      </button>
      {data?.error && <div className="hex-display red">{data.error}</div>}
      {data && !data.error && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div style={{ background:'var(--bg-well)', padding:'8px', borderRadius:6, border:'1px solid var(--border)' }}>
              <div style={{ fontSize:'0.75rem', fontWeight:700, marginBottom:6, color:'var(--accent-red)' }}>Naive (Early Exit)</div>
              <KV k="Early mismatch:" v={`${data.naive_early_ms} ms`} />
              <KV k="Late mismatch:" v={`${data.naive_late_ms} ms`} />
              <KV k="Ratio (Late/Early):" v={`${data.naive_ratio}x`} color={data.naive_ratio>1.1?'var(--accent-red)':'var(--text-primary)'} />
            </div>
            <div style={{ background:'var(--bg-well)', padding:'8px', borderRadius:6, border:'1px solid var(--border)' }}>
              <div style={{ fontSize:'0.75rem', fontWeight:700, marginBottom:6, color:'var(--accent-green)' }}>Constant Time (XOR)</div>
              <KV k="Early mismatch:" v={`${data.ct_early_ms} ms`} />
              <KV k="Late mismatch:" v={`${data.ct_late_ms} ms`} />
              <KV k="Ratio (Late/Early):" v={`${data.ct_ratio}x`} color="var(--accent-green)" />
            </div>
          </div>
          <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>
            {data.explanation}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PA10Demo({ onNavigate }) {
  return (
    <div>
      <LengthExtensionPanel />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <EUFCMAPanel />
        <MacToCrhfPanel />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <EncryptThenHmacPanel />
        <TimingDemoPanel />
      </div>
      {onNavigate && (
        <div className="demo-related" style={{ marginTop: 20 }}>
          <span className="demo-related-label">Related:</span>
          <button className="demo-xlink" onClick={() => onNavigate('PA8')}>PA8 DLP Hash →</button>
        </div>
      )}
    </div>
  );
}
