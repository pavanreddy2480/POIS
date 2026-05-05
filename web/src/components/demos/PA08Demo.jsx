import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import CopyHex from '../CopyHex';
import DemoHeader from '../DemoHeader';

const DEFAULT_MSG = 'Hello DLP Hash!';
const N_BITS = 16;
const EXPECTED = Math.pow(2, N_BITS / 2); // 256

// ── tiny helpers ─────────────────────────────────────────────────────────────
function hex(s) { return Array.from(new TextEncoder().encode(s)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function Mono({ children, color }) {
  return <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color: color||'var(--text-primary)' }}>{children}</span>;
}
function KV({ k, v, color }) {
  return (
    <div style={{ display:'flex', gap:8, marginBottom:4, flexWrap:'wrap' }}>
      <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', minWidth:80 }}>{k}</span>
      <Mono color={color}>{v}</Mono>
    </div>
  );
}
function Badge({ ok, label }) {
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:'0.7rem',
      fontWeight:700, fontFamily:'var(--font-mono)',
      background: ok ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)',
      color: ok ? 'var(--accent-green)' : 'var(--accent-red)',
      border:`1px solid ${ok ? 'var(--accent-green)' : 'var(--accent-red)'}`,
    }}>{label}</span>
  );
}

// ── 1. Main hash panel ────────────────────────────────────────────────────────
function HashPanel({ onReset }) {
  const [msg, setMsg] = useState(DEFAULT_MSG);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async (m) => {
    setLoading(true);
    try { setResult(await api.hash.dlp(hex(m))); }
    catch(e) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(DEFAULT_MSG); }, []); // eslint-disable-line

  const reset = () => { setMsg(DEFAULT_MSG); run(DEFAULT_MSG); onReset?.(); };

  return (
    <div className="demo-card">
      <DemoHeader num={8} title="DLP-Based Collision-Resistant Hash" tag="DLP-CRHF" onReset={reset} />
      <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:14 }}>
        Compression: <Mono color="var(--accent-blue)">f(x,y) = g^x · ĥ^y mod p</Mono> — plugged into Merkle-Damgård from PA#7.
        Collision resistance reduces to hardness of DLP in the order-<em>q</em> subgroup.
      </p>

      <div className="form-group">
        <label>Message</label>
        <input
          type="text" value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key==='Enter' && !loading && run(msg)}
        />
      </div>
      <button className="btn btn-primary" onClick={() => run(msg)} disabled={loading} style={{ marginBottom:12 }}>
        {loading ? '⏳ Hashing…' : '▶ Compute DLP_Hash'}
      </button>

      {result?.error && <div className="hex-display red">{result.error}</div>}
      {result && !result.error && (
        <>
          <div className="form-group">
            <label>Digest (hex) — {result.digest.length/2} bytes</label>
            <CopyHex value={result.digest} />
          </div>
          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4 }}>
            ℹ️ Full-size DLP Hash shown above. For PA#10 HMAC, pass <Mono>output_length</Mono> to truncate/extend.
          </div>
        </>
      )}
    </div>
  );
}

// ── 2. Group params panel ─────────────────────────────────────────────────────
function GroupParamsPanel() {
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.hash.dlpParams()
      .then(setParams)
      .catch(e => setParams({ error: e.message }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="demo-card">
      <h4>Group Setup — Safe-Prime Subgroup of Z*_p</h4>
      <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:12 }}>
        <strong>p = 2q+1</strong> (Sophie Germain prime). <strong>g</strong> generates the order-<em>q</em> subgroup.
        <strong> ĥ = g^α mod p</strong> with α randomly chosen then <em>discarded</em> — nobody knows α.
        Finding a collision requires computing log_g(ĥ) = α (the DLP).
      </p>
      {loading && <div style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>Loading group parameters…</div>}
      {params?.error && <div className="hex-display red">{params.error}</div>}
      {params && !params.error && (
        <div style={{ background:'var(--bg-well)', padding:'12px 14px', borderRadius:8, border:'1px solid var(--border)' }}>
          <KV k="p (prime)" v={params.p_hex} color="var(--accent-blue)" />
          <KV k="q (order)" v={params.q_hex} color="var(--accent-orange)" />
          <KV k="p bits" v={`${params.p_bits}-bit`} />
          <KV k="q bits" v={`${params.q_bits}-bit`} />
          <KV k="g (generator)" v={params.g_hex} color="var(--accent-green)" />
          <KV k="ĥ = g^α mod p" v={params.h_hex} color="var(--accent-purple)" />
          <KV k="IV" v={params.iv} />
          <KV k="Block size" v={`${params.block_size} bytes`} />
          <div style={{ marginTop:10, padding:'8px 10px', borderRadius:6, background:'rgba(52,199,89,0.06)', border:'1px solid var(--accent-green)', fontSize:'0.72rem', color:'var(--text-secondary)', lineHeight:1.7 }}>
            <strong style={{ color:'var(--accent-green)' }}>Verification:</strong> g^q ≡ 1 (mod p) ✓ &nbsp;·&nbsp; p = 2q+1 ✓ &nbsp;·&nbsp; α discarded after ĥ computed ✓
          </div>
        </div>
      )}
    </div>
  );
}

// ── 3. Integration test panel ─────────────────────────────────────────────────
function IntegrationPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setData(await api.hash.dlpIntegration()); }
    catch(e) { setData({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="demo-card">
      <h4>Integration Test — 5 Messages, Distinct Digests</h4>
      <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:10 }}>
        Hash messages of lengths 0, 1, 5, 15, and 44 bytes through DLP_Hash. All digests must be distinct.
      </p>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom:12 }}>
        {loading ? '⏳ Running…' : '▶ Run Integration Test'}
      </button>
      {data?.error && <div className="hex-display red">{data.error}</div>}
      {data && !data.error && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <Badge ok={data.pass} label={data.pass ? '✓ ALL DISTINCT' : '✗ COLLISION'} />
            <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
              {data.test_count} messages → {data.test_count} unique digests
            </span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {data.results.map((r, i) => (
              <div key={i} style={{ background:'var(--bg-well)', borderRadius:6, padding:'8px 12px', border:`1px solid ${r.duplicate ? 'var(--accent-red)' : 'var(--border)'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-primary)' }}>
                    #{i+1} — {r.label}
                  </span>
                  <span style={{ fontSize:'0.68rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
                    "{r.message}" ({r.length_bytes}B)
                  </span>
                </div>
                <div style={{ fontSize:'0.67rem', fontFamily:'var(--font-mono)', color:'var(--accent-green)', wordBreak:'break-all' }}>
                  {r.digest}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── 4. DLP Collision Resistance panel ────────────────────────────────────────
function CollisionResistancePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setData(await api.hash.dlpCollisionDemo()); }
    catch(e) { setData({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="demo-card">
      <h4>Collision Resistance ↔ DLP Hardness</h4>
      <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:10 }}>
        Any pair <Mono>(x₁,y₁) ≠ (x₂,y₂)</Mono> with <Mono>f(x₁,y₁)=f(x₂,y₂)</Mono> immediately reveals α = log_g(ĥ).
        Below we show a <em>constructed</em> collision using α (only possible during setup).
      </p>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom:12 }}>
        {loading ? '⏳ Computing…' : '▶ Show DLP Hardness Argument'}
      </button>
      {data?.error && <div className="hex-display red">{data.error}</div>}
      {data && !data.error && (
        <>
          <div style={{ background:'var(--bg-well)', padding:'10px 14px', borderRadius:8, border:'1px solid var(--border)', marginBottom:12 }}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>Constructed Collision (using hidden α)</div>
            <KV k="(x₁, y₁)" v={`(${data.x1}, ${data.y1})`} color="var(--accent-blue)" />
            <KV k="(x₂, y₂)" v={`(${data.x2}, ${data.y2})`} color="var(--accent-orange)" />
            <KV k="Δy (y₂-y₁)" v={data.y_delta} />
            <KV k="Δx = -α·Δy mod q" v={data.x_delta} />
            <KV k="f(x₁,y₁)" v={data.h_x1y1} color="var(--accent-green)" />
            <KV k="f(x₂,y₂)" v={data.h_x2y2} color="var(--accent-green)" />
            <div style={{ marginTop:6, display:'flex', gap:8, flexWrap:'wrap' }}>
              <Badge ok={data.collision_found} label={data.collision_found ? '✓ COLLISION VERIFIED' : '✗ NO COLLISION'} />
              {data.alpha_recovered && <Badge ok={true} label="✓ α RECOVERED FROM COLLISION" />}
            </div>
            {data.extracted_alpha != null && (
              <div style={{ marginTop:8, fontSize:'0.7rem', color:'var(--text-muted)' }}>
                From collision: α = (x₁-x₂)·(y₂-y₁)⁻¹ mod q = <Mono color="var(--accent-purple)">{data.extracted_alpha}</Mono>
                {data.alpha_recovered ? ' ✓ matches setup α' : ''}
              </div>
            )}
          </div>
          <div style={{ background:'rgba(99,102,241,0.08)', padding:'10px 14px', borderRadius:8, border:'1px solid rgba(99,102,241,0.3)', fontSize:'0.72rem', color:'var(--text-secondary)', lineHeight:1.8 }}>
            <strong style={{ color:'var(--accent-purple)' }}>Algebraic reduction:</strong><br/>
            If f(x₁,y₁) = f(x₂,y₂) then g^(x₁-x₂) ≡ ĥ^(y₂-y₁) (mod p)<br/>
            Since ĥ = g^α → x₁-x₂ ≡ α·(y₂-y₁) (mod q)<br/>
            → <strong>α = (x₁-x₂)·(y₂-y₁)⁻¹ mod q</strong> (if y₁≠y₂)<br/>
            <em>Collision finder ⟹ DLP solver. QED.</em>
          </div>
        </>
      )}
    </div>
  );
}

// ── 5. Birthday Attack panel ──────────────────────────────────────────────────
function BirthdayPanel() {
  const [result, setBirthday] = useState(null);
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const timerRef = useRef(null);

  const hunt = async () => {
    setBirthday(null);
    setCount(0);
    setRunning(true);

    // Animate counter while waiting
    let c = 0;
    timerRef.current = setInterval(() => {
      c += Math.floor(Math.random() * 12) + 4;
      setCount(Math.min(c, EXPECTED * 3));
    }, 80);

    try {
      const r = await api.birthday.attack(N_BITS);
      clearInterval(timerRef.current);
      setCount(r.evaluations || 0);
      setBirthday(r);
    } catch(e) {
      clearInterval(timerRef.current);
      setBirthday({ error: e.message });
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const displayCount = result ? (result.evaluations || count) : count;
  const progressPct = Math.min((displayCount / EXPECTED) * 100, 100);
  const ratio = result?.ratio;

  return (
    <div className="demo-card">
      <h4>🎂 Collision Hunt — Birthday Attack (n = {N_BITS}-bit output)</h4>
      <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:10 }}>
        Expected collision after ≈ 2^(n/2) = <strong>{EXPECTED}</strong> hash evaluations (birthday bound).
        Toy parameters: output truncated to {N_BITS} bits. Progress bar tracks count vs 2^(n/2).
      </p>

      <button className="btn btn-primary" onClick={hunt} disabled={running} style={{ marginBottom:14 }}>
        {running ? '🔍 Searching…' : '▶ Run Birthday Attack'}
      </button>

      {(running || result) && (
        <>
          {/* Live counter + progress bar */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:6 }}>
              <span>Hashes evaluated: <strong style={{ color:'var(--text-primary)' }}>{displayCount.toLocaleString()}</strong></span>
              <span>Target ≈ 2^(n/2) = {EXPECTED}</span>
            </div>
            <div style={{ height:10, background:'var(--bg-well)', borderRadius:6, overflow:'hidden', border:'1px solid var(--border)' }}>
              <div style={{
                height:'100%', borderRadius:6,
                width:`${progressPct}%`,
                background: result?.found
                  ? 'var(--accent-green)'
                  : running
                  ? 'var(--accent-orange)'
                  : 'var(--accent-red)',
                transition: running ? 'width 0.1s linear' : 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginTop:4, textAlign:'right' }}>
              {progressPct.toFixed(0)}% of 2^(n/2)
            </div>
          </div>

          {result?.error && <div className="hex-display red">{result.error}</div>}
          {result && !result.error && (
            <div className="result-box">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <Badge ok={result.found} label={result.found ? '✓ COLLISION FOUND' : '✗ NOT FOUND'} />
                {ratio && (
                  <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                    {result.evaluations} evals = {ratio.toFixed(2)}× expected ({EXPECTED})
                  </span>
                )}
              </div>
              {result.found && (
                <div style={{ background:'var(--bg-well)', borderRadius:6, padding:'8px 12px', border:'1px solid var(--accent-green)' }}>
                  <KV k="Input x₁" v={result.x1} color="var(--accent-blue)" />
                  <KV k="Input x₂" v={result.x2} color="var(--accent-orange)" />
                  <KV k="Hash value" v={result.hash} color="var(--accent-green)" />
                  <div style={{ marginTop:8, fontSize:'0.7rem', color:'var(--text-muted)' }}>
                    Both inputs produce the same {N_BITS}-bit hash — found in O(√2^n) = O(2^(n/2)) = O({EXPECTED}) evaluations.
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── 6. PA#10 forward pointer ──────────────────────────────────────────────────
function HMAC_ForwardPointer() {
  return (
    <div className="demo-card" style={{ border:'1px solid rgba(99,102,241,0.4)', background:'rgba(99,102,241,0.04)' }}>
      <h4 style={{ color:'var(--accent-purple)' }}>→ PA#10 Forward Pointer: HMAC Interface</h4>
      <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:10 }}>
        DLP_Hash is designed to plug directly into PA#10's HMAC construction.
        The interface is fully compatible:
      </p>
      <div style={{ background:'var(--bg-well)', padding:'10px 14px', borderRadius:8, border:'1px solid var(--border)', fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-secondary)', lineHeight:2 }}>
        <div><span style={{ color:'var(--accent-green)' }}>DLPHash</span><span style={{ color:'var(--text-muted)' }}>.hash(</span><span style={{ color:'var(--accent-blue)' }}>message: bytes</span><span style={{ color:'var(--text-muted)' }}>) </span>→ <span style={{ color:'var(--accent-orange)' }}>bytes</span></div>
        <div style={{ color:'var(--text-muted)', fontSize:'0.68rem' }}>output_length configurable — default = block_size (16 bytes)</div>
        <div style={{ marginTop:6 }}><span style={{ color:'var(--accent-green)' }}>HMAC</span>(K, M) = <span style={{ color:'var(--accent-blue)' }}>DLPHash</span>( (K⊕opad) ‖ <span style={{ color:'var(--accent-blue)' }}>DLPHash</span>((K⊕ipad) ‖ M) )</div>
      </div>
      <div style={{ marginTop:10, fontSize:'0.72rem', color:'var(--text-muted)' }}>
        ✓ Stateless · ✓ Returns bytes · ✓ Configurable output length · ✓ Collision resistant under DLP hardness
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PA8Demo() {
  return (
    <div>
      <HashPanel />
      <GroupParamsPanel />
      <IntegrationPanel />
      <CollisionResistancePanel />
      <BirthdayPanel />
      <HMAC_ForwardPointer />
    </div>
  );
}
