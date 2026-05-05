import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import DemoHeader from '../DemoHeader';

// ── helpers ──────────────────────────────────────────────────────────────────
function theoreticalProb(k, n) { return 1 - Math.exp(-k * (k - 1) / Math.pow(2, n + 1)); }
function Mono({ c, children }) { return <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color: c||'var(--text-primary)' }}>{children}</span>; }
function KV({ k, v, color }) { return <div style={{ display:'flex', gap:8, marginBottom:3 }}><span style={{ fontSize:'0.72rem', color:'var(--text-muted)', minWidth:130 }}>{k}</span><Mono c={color}>{v}</Mono></div>; }
function Badge({ ok, label }) {
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:'0.7rem', fontWeight:700, fontFamily:'var(--font-mono)', background: ok ? 'rgba(52,199,89,0.15)':'rgba(255,59,48,0.15)', color: ok ? 'var(--accent-green)':'var(--accent-red)', border:`1px solid ${ok?'var(--accent-green)':'var(--accent-red)'}` }}>{label}</span>;
}

// ── BirthdayChart ─────────────────────────────────────────────────────────────
function BirthdayChart({ result, n }) {
  if (!result?.found) return null;
  const W=480, H=160, pL=44, pR=16, pT=12, pB=36, pW=W-pL-pR, pH=H-pT-pB;
  const maxK = Math.max(result.evaluations * 1.3, result.expected_2_to_n_over_2 * 2);
  const tx = k => pL + (k/maxK)*pW;
  const ty = p => pT + pH - p*pH;
  const prob = k => theoreticalProb(k, n);
  const pts = Array.from({length:201},(_,i)=>{ const k=(i/200)*maxK; return `${tx(k)},${ty(prob(k))}`; }).join(' ');
  const expX = tx(result.expected_2_to_n_over_2);
  const actX = tx(result.evaluations);
  const col = result.ratio <= 1.5 ? 'var(--accent-green)' : 'var(--accent-orange)';
  return (
    <div style={{ background:'var(--bg-well)', borderRadius:8, padding:'12px 8px', border:'1px solid var(--border)', marginTop:14 }}>
      <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:6, fontFamily:'var(--font-mono)' }}>
        P(collision by k) = 1 − e^(−k(k−1)/2^(n+1)) &nbsp;|&nbsp; blue = theory &nbsp;·&nbsp; green = actual
      </div>
      <svg width={W} height={H} style={{ display:'block', maxWidth:'100%' }}>
        <line x1={pL} y1={pT} x2={pL} y2={pT+pH} stroke="var(--border)" strokeWidth={1}/>
        <line x1={pL} y1={pT+pH} x2={pL+pW} y2={pT+pH} stroke="var(--border)" strokeWidth={1}/>
        {[0,0.25,0.5,0.75,1].map(p => (
          <g key={p}>
            <line x1={pL-3} y1={ty(p)} x2={pL} y2={ty(p)} stroke="var(--border)" strokeWidth={1}/>
            <text x={pL-5} y={ty(p)+4} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-muted)">{p.toFixed(2)}</text>
          </g>
        ))}
        <line x1={pL} y1={ty(0.5)} x2={pL+pW} y2={ty(0.5)} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 3"/>
        <polyline points={pts} fill="none" stroke="var(--accent-blue)" strokeWidth={2}/>
        <line x1={expX} y1={pT} x2={expX} y2={pT+pH} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="5 3"/>
        <text x={expX+2} y={pT+10} fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-muted)">2^(n/2)</text>
        <line x1={actX} y1={pT} x2={actX} y2={pT+pH} stroke={col} strokeWidth={2}/>
        <text x={actX+2} y={pT+22} fontSize={8} fontFamily="var(--font-mono)" fill={col}>actual</text>
        <circle cx={actX} cy={ty(prob(result.evaluations))} r={4} fill={col}/>
        <text x={pL+pW/2} y={H-4} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-muted)">k (evaluations)</text>
      </svg>
    </div>
  );
}

// ── 1. Main live birthday attack panel ───────────────────────────────────────
function LiveAttackPanel() {
  const [n, setN] = useState(12);
  const [result, setResult] = useState(null);
  const [floyd, setFloyd] = useState(null);
  const [loading, setLoading] = useState(false);
  const [counter, setCounter] = useState(0);
  const timerRef = useRef(null);

  const expected = Math.pow(2, n/2);

  const run = async () => {
    setResult(null); setFloyd(null); setCounter(0); setLoading(true);
    let c = 0;
    timerRef.current = setInterval(() => { c += Math.floor(Math.random()*8)+2; setCounter(Math.min(c, expected*3)); }, 60);
    try {
      const [rNaive, rFloyd] = await Promise.all([
        api.birthday.attack(n),
        api.birthday.floyd(n),
      ]);
      clearInterval(timerRef.current);
      setCounter(rNaive.evaluations || 0);
      setResult(rNaive);
      setFloyd(rFloyd);
    } catch(e) {
      clearInterval(timerRef.current);
      setResult({ error: e.message });
    } finally { setLoading(false); }
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const displayCount = result?.evaluations ?? counter;
  const pct = Math.min((displayCount / expected) * 100, 100);

  return (
    <div className="demo-card">
      <DemoHeader num={9} title="Live Birthday Attack" tag="CRHF" onReset={() => { setResult(null); setFloyd(null); setN(12); setCounter(0); }} />
      <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:14 }}>
        Expected collision at O(2^(n/2)) evaluations. Runs <strong>naive</strong> (hash table) and <strong>Floyd</strong> (O(1) memory) attacks simultaneously.
      </p>
      <div className="form-group">
        <label>Output bits n: <strong>{n}</strong> &nbsp;→&nbsp; target 2^(n/2) = <strong>{expected.toFixed(0)}</strong></label>
        <input type="range" min={8} max={16} step={2} value={n} onChange={e => { setN(+e.target.value); setResult(null); setFloyd(null); setCounter(0); }} />
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.7rem', color:'var(--text-muted)' }}>
          {[8,10,12,14,16].map(v => <span key={v}>{v}</span>)}
        </div>
      </div>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom:14 }}>
        {loading ? '🔍 Searching…' : '▶ Run Attack'}
      </button>

      {(loading || result) && (
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:4 }}>
            <span>Hashes evaluated: <strong style={{ color:'var(--text-primary)' }}>{displayCount.toLocaleString()}</strong></span>
            <span>Target ≈ {expected.toFixed(0)}</span>
          </div>
          <div style={{ height:8, background:'var(--bg-well)', borderRadius:4, overflow:'hidden', border:'1px solid var(--border)' }}>
            <div style={{ height:'100%', borderRadius:4, width:`${pct}%`, background: result?.found ? 'var(--accent-green)' : 'var(--accent-orange)', transition: loading?'width 0.1s':'width 0.4s' }}/>
          </div>
        </div>
      )}

      {result?.error && <div className="hex-display red">{result.error}</div>}
      {result && !result.error && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[['🎯 Naive (hash table)', result], ['🐢 Floyd (O(1) memory)', floyd]].map(([label, r], i) => (
              r && <div key={i} style={{ background:'var(--bg-well)', padding:'10px 12px', borderRadius:8, border:`1px solid ${r.found?'var(--accent-green)':'var(--border)'}` }}>
                <div style={{ fontSize:'0.72rem', fontWeight:700, marginBottom:6 }}>{label}</div>
                <Badge ok={r.found} label={r.found ? '✓ COLLISION' : '✗ NOT FOUND'} />
                {r.found && <>
                  <div style={{ marginTop:8 }}>
                    <KV k="x₁" v={r.x1} color="var(--accent-blue)"/>
                    <KV k="x₂" v={r.x2} color="var(--accent-orange)"/>
                    <KV k="H(x₁)=H(x₂)" v={r.hash} color="var(--accent-green)"/>
                    <KV k="Evaluations" v={`${r.evaluations} (ratio: ${r.ratio?.toFixed(2)}×)`}/>
                    <KV k="Time" v={`${r.time_sec?.toFixed(3)}s`}/>
                  </div>
                </>}
              </div>
            ))}
          </div>
          <BirthdayChart result={result} n={n}/>
        </>
      )}
    </div>
  );
}

// ── 2. Toy hash multi-n panel ─────────────────────────────────────────────────
function ToyHashPanel() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const all = await Promise.all([8,12,16].map(n => api.birthday.toyHash(n)));
      setResults(all);
    } catch(e) { setResults([{error:e.message}]); }
    finally { setLoading(false); }
  };

  return (
    <div className="demo-card">
      <h4>Toy Hash — Attack n∈{'{8,12,16}'} Bits</h4>
      <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:10 }}>
        A deliberately weak XOR-rotate hash. Confirm empirical evaluations ≈ 2^(n/2) for each n. Plots naive vs Floyd.
      </p>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom:12 }}>
        {loading ? '⏳ Running…' : '▶ Run Toy Hash Attacks'}
      </button>
      {results && !results[0]?.error && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.72rem', fontFamily:'var(--font-mono)' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['n (bits)', '2^(n/2)', 'Naive evals', 'Naive ratio', 'Floyd evals', 'Floyd ratio'].map(h => (
                  <th key={h} style={{ padding:'4px 8px', color:'var(--text-muted)', textAlign:'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r,i) => (
                <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'5px 8px', color:'var(--accent-blue)', fontWeight:700 }}>{r.n_bits}</td>
                  <td style={{ padding:'5px 8px' }}>{r.expected_2_to_n_over_2}</td>
                  <td style={{ padding:'5px 8px', color: r.naive?.found ? 'var(--accent-green)':'var(--accent-red)' }}>{r.naive?.evaluations ?? '–'}</td>
                  <td style={{ padding:'5px 8px' }}>{r.naive?.ratio?.toFixed(2)}×</td>
                  <td style={{ padding:'5px 8px', color: r.floyd?.found ? 'var(--accent-green)':'var(--accent-red)' }}>{r.floyd?.evaluations ?? '–'}</td>
                  <td style={{ padding:'5px 8px' }}>{r.floyd?.ratio?.toFixed(2)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop:8, fontSize:'0.68rem', color:'var(--text-muted)' }}>
            Ratios near 1.0× confirm the birthday bound prediction. Floyd uses O(1) memory vs O(2^(n/2)) for naive.
          </div>
        </div>
      )}
    </div>
  );
}

// ── 3. Empirical CDF panel ────────────────────────────────────────────────────
function EmpiricalPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selN, setSelN] = useState(12);

  const run = async () => {
    setLoading(true);
    try { setData(await api.birthday.empirical()); }
    catch(e) { setData({ error: e.message }); }
    finally { setLoading(false); }
  };

  const curve = data?.curves?.find(c => c.n === selN);

  const W=480, H=160, pL=44, pR=16, pT=12, pB=36, pW=W-pL-pR, pH=H-pT-pB;
  const pts = curve?.cdf_points || [];
  const maxK = pts.length ? pts[pts.length-1].k : 1;
  const tx = k => pL + (k/maxK)*pW;
  const ty = p => pT + pH - p*pH;
  const empPts = pts.map(p=>`${tx(p.k)},${ty(p.empirical)}`).join(' ');
  const thPts  = pts.map(p=>`${tx(p.k)},${ty(p.theoretical)}`).join(' ');
  const expX = curve ? tx(curve.expected_2_to_n_over_2) : 0;

  return (
    <div className="demo-card">
      <h4>Empirical Birthday Curve (100 trials per n)</h4>
      <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:10 }}>
        CDF of evaluations-until-collision. Overlay: theoretical 1−e^(−k(k−1)/2^(n+1)).
      </p>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom:12 }}>
        {loading ? '⏳ Running 500 trials…' : '▶ Run Empirical Survey'}
      </button>
      {data?.error && <div className="hex-display red">{data.error}</div>}
      {data && !data.error && (
        <>
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            {data.curves.map(c => (
              <button key={c.n} onClick={() => setSelN(c.n)} style={{
                padding:'3px 10px', borderRadius:4, fontSize:'0.72rem', fontWeight:700, cursor:'pointer',
                background: selN===c.n ? 'var(--accent-blue)' : 'var(--bg-well)',
                color: selN===c.n ? '#fff' : 'var(--text-muted)',
                border:`1px solid ${selN===c.n ? 'var(--accent-blue)':'var(--border)'}`,
              }}>n={c.n}</button>
            ))}
          </div>
          {curve && (
            <>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:4 }}>
                n={curve.n}: mean={curve.mean_evaluations} evals, expected={curve.expected_2_to_n_over_2.toFixed(1)}, ratio={curve.ratio}×
                &nbsp;|&nbsp;<span style={{ color:'var(--accent-blue)' }}>── theory</span>&nbsp;&nbsp;<span style={{ color:'var(--accent-green)' }}>── empirical</span>
              </div>
              <svg width={W} height={H} style={{ display:'block', maxWidth:'100%' }}>
                <line x1={pL} y1={pT} x2={pL} y2={pT+pH} stroke="var(--border)" strokeWidth={1}/>
                <line x1={pL} y1={pT+pH} x2={pL+pW} y2={pT+pH} stroke="var(--border)" strokeWidth={1}/>
                {[0,0.25,0.5,0.75,1].map(p=>(
                  <g key={p}>
                    <line x1={pL-3} y1={ty(p)} x2={pL} y2={ty(p)} stroke="var(--border)" strokeWidth={1}/>
                    <text x={pL-5} y={ty(p)+4} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-muted)">{p.toFixed(2)}</text>
                  </g>
                ))}
                {thPts && <polyline points={thPts} fill="none" stroke="var(--accent-blue)" strokeWidth={2}/>}
                {empPts && <polyline points={empPts} fill="none" stroke="var(--accent-green)" strokeWidth={2} strokeDasharray="4 3"/>}
                <line x1={expX} y1={pT} x2={expX} y2={pT+pH} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="5 3"/>
                <text x={expX+2} y={pT+10} fontSize={8} fontFamily="var(--font-mono)" fill="var(--text-muted)">2^(n/2)</text>
                <text x={pL+pW/2} y={H-4} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-muted)">k (evaluations)</text>
              </svg>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── 4. DLP truncated attack panel ─────────────────────────────────────────────
function DLPAttackPanel() {
  const [n, setN] = useState(16);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true); setData(null);
    try { setData(await api.birthday.dlpTruncated(n)); }
    catch(e) { setData({ error: e.message }); }
    finally { setLoading(false); }
  };

  const r = data?.result;
  return (
    <div className="demo-card">
      <h4>Attack Truncated DLP Hash (PA#8)</h4>
      <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:10 }}>
        DLP hash is provably collision-resistant — but truncating to n bits makes it birthday-attackable in O(2^(n/2)) evaluations regardless of its algebraic security.
      </p>
      <div className="form-group">
        <label>Truncated output n: <strong>{n}</strong> bits &nbsp;(target ≈ {Math.pow(2, n/2).toFixed(0)} evals)</label>
        <input type="range" min={8} max={16} step={2} value={n} onChange={e => { setN(+e.target.value); setData(null); }}/>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.7rem', color:'var(--text-muted)' }}>
          {[8,10,12,14,16].map(v => <span key={v}>{v}</span>)}
        </div>
      </div>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom:12 }}>
        {loading ? '⏳ Attacking…' : '▶ Attack DLP Hash'}
      </button>
      {data?.error && <div className="hex-display red">{data.error}</div>}
      {r && (
        <div style={{ background:'var(--bg-well)', padding:'10px 14px', borderRadius:8, border:`1px solid ${r.found?'var(--accent-green)':'var(--border)'}` }}>
          <Badge ok={r.found} label={r.found ? '✓ COLLISION FOUND' : '✗ NOT FOUND'}/>
          {r.found && <div style={{ marginTop:8 }}>
            <KV k="x₁" v={r.x1} color="var(--accent-blue)"/>
            <KV k="x₂" v={r.x2} color="var(--accent-orange)"/>
            <KV k="H(x₁)=H(x₂)" v={r.hash} color="var(--accent-green)"/>
            <KV k="Evaluations" v={r.evaluations}/>
            <KV k="Expected 2^(n/2)" v={r.expected_2_to_n_over_2}/>
            <KV k="Ratio" v={`${r.ratio?.toFixed(2)}×`}/>
          </div>}
          {data.analysis && <div style={{ marginTop:10, fontSize:'0.72rem', color:'var(--text-muted)', lineHeight:1.7, borderTop:'1px solid var(--border)', paddingTop:8 }}>{data.analysis}</div>}
        </div>
      )}
    </div>
  );
}

// ── 5. MD5/SHA-1 context panel ────────────────────────────────────────────────
function ContextPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.birthday.md5Sha1Context()
      .then(setData).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const row = (name, d, note) => d && (
    <div key={name} style={{ background:'var(--bg-well)', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', marginBottom:8 }}>
      <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>{name} (n={d.n_bits})</div>
      <KV k="Birthday ops" v={d.ops_scientific} color="var(--accent-orange)"/>
      <KV k="At 10⁹ hash/s" v={`${d.seconds?.toExponential(2)} seconds`}/>
      <KV k="In years" v={d.years_scientific}/>
      <KV k="Universe ages" v={`${d.universe_ages?.toExponential(2)}×`}/>
      {note && <div style={{ marginTop:6, fontSize:'0.68rem', color:'var(--accent-red)', fontStyle:'italic' }}>{note}</div>}
    </div>
  );

  return (
    <div className="demo-card">
      <h4>MD5 / SHA-1 Context — Why Output Length Matters</h4>
      {loading && <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>Computing…</div>}
      {data && <>
        {row('MD5',    data.md5,   'Practically broken (2004) via differential attacks; birthday bound = 2^64')}
        {row('SHA-1',  data.sha1,  'Deprecated (SHAttered 2017); differential attack cost 2^63, not birthday')}
        {row('SHA-256',data.sha256,'Currently secure; birthday bound 2^128 ≫ age of universe')}
        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:8, lineHeight:1.8 }}>
          {data.note}
        </div>
      </>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PA9Demo({ onNavigate }) {
  return (
    <div>
      <LiveAttackPanel/>
      <ToyHashPanel/>
      <EmpiricalPanel/>
      <DLPAttackPanel/>
      <ContextPanel/>
      {onNavigate && (
        <div className="demo-related">
          <span className="demo-related-label">Related:</span>
          <button className="demo-xlink" onClick={() => onNavigate('PA7')}>PA7 Merkle-Damgård →</button>
          <button className="demo-xlink" onClick={() => onNavigate('PA8')}>PA8 DLP Hash →</button>
        </div>
      )}
    </div>
  );
}
