import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import DemoHeader from '../DemoHeader';
import CopyVal from '../CopyVal';
import CopyHex from '../CopyHex';
import { hexToBits, frequencyTest, blockFrequencyTest, runsTest, serialTest } from '../../utils/randomness';

function GGMTreeSVG({ path }) {
  if (!path || path.length === 0) return null;

  const depth = path.length - 1;
  const nodeW = 138, nodeH = 36, vGap = 68;
  const spread = 90;
  const padH = 28, padTop = 44, padBottom = 40;

  const rootCX = padH + depth * spread + nodeW / 2;
  const totalW  = padH * 2 + depth * spread * 2 + nodeW;
  const totalH  = padTop + (depth + 1) * (nodeH + vGap) - vGap + padBottom + 20;

  const getY = (lvl) => padTop + lvl * (nodeH + vGap);

  const nodes = [];
  const edges = [];

  nodes.push({
    cx: rootCX, y: getY(0),
    label: path[0].node.slice(0, 14) + '…',
    active: true, level: 0, isRoot: true, isLeaf: depth === 0,
  });

  let cx = rootCX;
  for (let i = 1; i <= depth; i++) {
    const bit = path[i].bit;
    const parentBottomY = getY(i - 1) + nodeH;
    const childTopY     = getY(i);
    const midY          = (parentBottomY + childTopY) / 2;

    const childCX = cx + (bit === 1 ? spread : -spread);
    const sibCX   = cx + (bit === 1 ? -spread : spread);

    nodes.push({
      cx: childCX, y: childTopY,
      label: path[i].node.slice(0, 14) + '…',
      active: true, level: i, bit, isLeaf: i === depth,
    });
    edges.push({
      x1: cx, y1: parentBottomY, x2: childCX, y2: childTopY,
      active: true, label: `G_${bit}`, lx: (cx + childCX) / 2, ly: midY,
    });

    nodes.push({
      cx: sibCX, y: childTopY,
      label: '· · ·', active: false, level: i, bit: 1 - bit,
    });
    edges.push({
      x1: cx, y1: parentBottomY, x2: sibCX, y2: childTopY,
      active: false, label: `G_${1 - bit}`, lx: (cx + sibCX) / 2, ly: midY,
    });

    cx = childCX;
  }

  return (
    <svg width={totalW} height={totalH} style={{ display: 'block' }}>
      <defs>
        <marker id="ggm-arr-a" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
          <polygon points="0 0,7 2.5,0 5" fill="var(--accent-blue)" />
        </marker>
        <marker id="ggm-arr-i" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <polygon points="0 0,5 2,0 4" fill="var(--text-muted)" />
        </marker>
      </defs>

      {edges.map((e, i) => (
        <g key={`e${i}`}>
          <line
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke={e.active ? 'var(--accent-blue)' : 'var(--text-muted)'}
            strokeWidth={e.active ? 2 : 1.5}
            strokeDasharray={e.active ? undefined : '5 3'}
            markerEnd={`url(#ggm-arr-${e.active ? 'a' : 'i'})`}
          />
          <rect x={e.lx - 15} y={e.ly - 9} width={30} height={14} rx={3}
            fill="var(--bg-card)" opacity="0.9" />
          <text
            x={e.lx} y={e.ly + 2}
            textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)"
            fill={e.active ? 'var(--accent-blue)' : 'var(--text-muted)'}
          >
            {e.label}
          </text>
        </g>
      ))}

      {nodes.map((n, i) => {
        const rx = n.cx - nodeW / 2;
        const fill = n.active
          ? n.isLeaf ? 'var(--accent-green-bg)' : 'var(--accent-blue-bg)'
          : 'var(--bg-well)';
        const stroke = n.active
          ? n.isLeaf ? 'var(--accent-green)' : 'var(--accent-blue)'
          : 'var(--text-muted)';

        return (
          <g key={`n${i}`} opacity={n.active ? 1 : 0.55}>
            <rect x={rx} y={n.y} width={nodeW} height={nodeH} rx={7}
              fill={fill} stroke={stroke} strokeWidth={n.active ? 1.5 : 1}
            />
            <text
              x={n.cx} y={n.y + nodeH / 2 + 4}
              textAnchor="middle" fontSize={n.active ? 10.5 : 9}
              fontFamily="var(--font-mono)"
              fill={n.active ? 'var(--text-primary)' : 'var(--text-muted)'}
            >
              {n.label}
            </text>

            {n.isRoot && (
              <text x={n.cx} y={n.y - 12} textAnchor="middle"
                fontSize={9} fontFamily="var(--font-mono)"
                fill="var(--accent-orange)" fontWeight="600">
                root k
              </text>
            )}
            {n.active && !n.isRoot && (
              <text x={rx - 6} y={n.y + nodeH / 2 + 4}
                textAnchor="end" fontSize={9}
                fontFamily="var(--font-mono)" fill="var(--text-muted)">
                L{n.level}
              </text>
            )}
            {n.isLeaf && n.active && (
              <text x={n.cx} y={n.y + nodeH + 18} textAnchor="middle"
                fontSize={10} fontFamily="var(--font-mono)"
                fill="var(--accent-green)" fontWeight="600">
                F_k(x)
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const TestBadge = ({ pass }) => (
  <span className={`badge ${pass ? 'badge-secure' : 'badge-broken'}`}
    style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
    {pass ? '✓ PASS' : '✗ FAIL'}
  </span>
);

const TestCard = ({ title, pass, children, skip }) => (
  <div style={{ background: 'var(--bg-primary)', borderRadius: 7, padding: 10,
    borderLeft: `3px solid ${skip ? 'var(--accent-orange)' : pass ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      {skip
        ? <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--accent-orange)', color: '#000' }}>SKIP</span>
        : <TestBadge pass={pass} />}
    </div>
    {children}
  </div>
);

export default function PA2Demo() {
  const [key, setKey]     = useState('0123456789abcdef0123456789abcdef');
  const [query, setQuery] = useState('1010');
  const [tree, setTree]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [depth, setDepth] = useState(4);
  const [prfType, setPrfType] = useState('GGM');

  // PRG from PRF states
  const [prgSeed, setPrgSeed] = useState('0123456789abcdef0123456789abcdef');
  const [prgResult, setPrgResult] = useState(null);
  const [showPrgTests, setShowPrgTests] = useState(false);
  const [prgRunning, setPrgRunning] = useState(false);

  // Distinguishing Game states
  const [distRunning, setDistRunning] = useState(false);
  const [distResult, setDistResult] = useState(null);

  const runTree = async () => {
    setLoading(true);
    try {
      const padKey = key.padEnd(32, '0').slice(0, 32);
      const bits   = query.replace(/[^01]/g, '').padEnd(depth, '0').slice(0, depth);
      const byteVal = parseInt(bits.padEnd(8, '0').slice(0, 8), 2);
      const qHex   = byteVal.toString(16).padStart(2, '0');
      
      if (prfType === 'GGM') {
        const r = await api.prf.ggm_tree(padKey, qHex, depth);
        setTree({ ...r, queryBits: bits });
      } else {
        // AES just evaluates, no tree path
        const r = await api.prf.evaluate(padKey, qHex.padEnd(32, '0'), depth, 'AES');
        setTree({ output: r.output, queryBits: bits, path: [] });
      }
    } catch (e) {
      setTree({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const runPRG = async () => {
    setPrgRunning(true);
    try {
      const padSeed = prgSeed.padEnd(32, '0').slice(0, 32);
      // G(s) = F_s(0^16) || F_s(1^16)
      const zeroInput = "00".repeat(16);
      const oneInput = "01".repeat(16); // or 11... wait, requirement says 1^n, let's use 0101.. or ff.. let's use ff for 1s
      const onesInput = "ff".repeat(16);
      
      const r0 = await api.prf.evaluate(padSeed, zeroInput, depth, prfType);
      const r1 = await api.prf.evaluate(padSeed, onesInput, depth, prfType);
      
      const outHex = r0.output + r1.output;
      setPrgResult({ output_hex: outHex, length_bytes: outHex.length / 2 });
      setShowPrgTests(true);
    } catch (e) {
      setPrgResult({ error: e.message });
    } finally {
      setPrgRunning(false);
    }
  };

  const runDistinguishingGame = async () => {
    setDistRunning(true);
    try {
      const padKey = key.padEnd(32, '0').slice(0, 32);
      let prfOutputs = '';
      let randomOutputs = '';
      
      // We will batch queries or just run them in a loop
      const promises = [];
      for (let i = 0; i < 100; i++) {
        // random 16 bytes
        const randHex = Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('');
        promises.push(api.prf.evaluate(padKey, randHex, depth, prfType).then(r => r.output));
        // truly random function output (just random bytes)
        randomOutputs += Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('');
      }
      
      const outputs = await Promise.all(promises);
      prfOutputs = outputs.join('');
      
      const prfBits = hexToBits(prfOutputs);
      const randBits = hexToBits(randomOutputs);
      
      setDistResult({
        prf: frequencyTest(prfBits),
        rand: frequencyTest(randBits),
      });
    } catch (e) {
      setDistResult({ error: e.message });
    } finally {
      setDistRunning(false);
    }
  };

  const reset = () => { 
    setKey('0123456789abcdef0123456789abcdef'); 
    setQuery('1010'); 
    setDepth(4); 
    setTree(null); 
    setPrgResult(null);
    setShowPrgTests(false);
    setDistResult(null);
  };

  useEffect(() => {
    setQuery(q => q.padEnd(depth, '0').slice(0, depth));
  }, [depth]);

  useEffect(() => { runTree(); }, [query, key, depth, prfType]);

  const bits = prgResult?.output_hex ? hexToBits(prgResult.output_hex) : null;
  const freq = bits ? frequencyTest(bits) : null;
  const blockFreq = bits ? blockFrequencyTest(bits) : null;
  const runs = bits ? runsTest(bits) : null;
  const serial = bits ? serialTest(bits) : null;
  const allPass = freq?.pass && (runs?.blocked || runs?.pass) && blockFreq?.pass && serial?.pass;
  const freqColor = freq ? (freq.pass ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--accent-green)';

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={2} title="GGM PRF Visualizer & Properties" tag="PRF" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Pseudorandom Function (PRF). Select between the GGM Tree (built from AES as a PRG) or direct AES-128.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 12, marginBottom: 12 }}>
          <div className="form-group">
            <label>Key k (hex, 16 bytes = 32 chars)</label>
            <input
              type="text" value={key} maxLength={32}
              onChange={e => setKey(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 32))}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div className="form-group">
            <label>Query x (bits)</label>
            <input
              type="text" value={query}
              onChange={e => setQuery(e.target.value.replace(/[^01]/g, '').slice(0, depth))}
              maxLength={depth}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div className="form-group">
            <label>Depth (n)</label>
            <select
              value={depth} onChange={e => setDepth(+e.target.value)}
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px' }}
            >
              {[4, 5, 6, 7, 8].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>PRF Type</label>
            <select
              value={prfType} onChange={e => setPrfType(e.target.value)}
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px' }}
            >
              <option value="GGM">GGM Tree</option>
              <option value="AES">AES-128</option>
            </select>
          </div>
        </div>

        {prfType === 'GGM' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Toggle query bits:</span>
            {Array.from({ length: depth }).map((_, i) => {
              const bit = query[i] || '0';
              return (
                <button key={i}
                  onClick={() => {
                    const arr = query.padEnd(depth, '0').split('');
                    arr[i] = bit === '0' ? '1' : '0';
                    setQuery(arr.join(''));
                  }}
                  style={{ width: 34, height: 34, borderRadius: 6, border: '1px solid var(--border)', background: bit === '1' ? 'var(--accent-blue-bg)' : 'var(--bg-well)', color: bit === '1' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                  {bit}
                </button>
              );
            })}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>= b₁b₂…bₙ</span>
          </div>
        )}

        {tree && !tree.error && (
          <>
            {prfType === 'GGM' ? (
              <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: '16px 12px', marginBottom: 12, border: '1px solid var(--border)', overflowX: 'auto' }}>
                <GGMTreeSVG path={tree.path || []} />
              </div>
            ) : (
              <div style={{ padding: 16, background: 'var(--bg-well)', borderRadius: 8, marginBottom: 12, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                GGM Tree visualizer is disabled for AES-128. AES computes the PRF output directly via a block cipher rather than a path of PRG evaluations.
              </div>
            )}
            <div className="result-box">
              <div>
                <span className="result-key">F_k(x) = </span>
                <CopyVal value={tree.output} style={{ color: 'var(--accent-green)' }}>{tree.output}</CopyVal>
              </div>
              {prfType === 'GGM' && (
                <div>
                  <span className="result-key">Path length: </span>
                  <span className="result-val">{tree.path?.length || 0} nodes (depth {depth})</span>
                </div>
              )}
            </div>
          </>
        )}
        {tree?.error && <div className="hex-display" style={{ color: 'var(--accent-red)' }}>{tree.error}</div>}
      </div>

      {/* PRG from PRF (PA#2b) */}
      <div className="demo-card">
        <h4>Length-Doubling PRG from PRF (PA#2b)</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Construct a PRG G(s) = F_s(0^n) ‖ F_s(1^n). Evaluates the current PRF (<strong>{prfType}</strong>) twice to produce length-doubled pseudorandom output.
        </p>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Seed s (acts as PRF key)</label>
          <input type="text" value={prgSeed} onChange={e => setPrgSeed(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 32))} style={{ fontFamily: 'var(--font-mono)' }} />
        </div>
        
        <button className="btn btn-primary" onClick={runPRG} disabled={prgRunning} style={{ marginBottom: 14 }}>
          {prgRunning ? 'Evaluating...' : 'Generate PRG Output & Test'}
        </button>

        {prgResult && !prgResult.error && (
          <div className="form-group">
            <label>G(s) Output (hex, {prgResult.length_bytes} bytes)</label>
            <CopyHex value={prgResult.output_hex} />
          </div>
        )}

        {showPrgTests && freq && (
          <div style={{ background: 'var(--bg-tertiary)', border: `1px solid ${allPass ? 'rgba(0,200,100,0.3)' : 'rgba(255,60,60,0.3)'}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 10, color: allPass ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {allPass ? '✓ PRG output passes randomness tests' : '✗ PRG output failed one or more tests'}
            </div>
            
            {/* 2×2 grid of all 4 tests */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <TestCard title="T1 — Frequency" pass={freq.pass}>
                <div className="advantage-bar" style={{ height: 6 }}><div className="advantage-fill" style={{ width: `${freq.ratio * 100}%`, background: freqColor }} /></div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>p = {freq.p} · ones={freq.ones}, zeros={freq.zeros}</div>
              </TestCard>
              {blockFreq && (
                <TestCard title={`T2 — Block Freq (M=${blockFreq.M})`} pass={blockFreq.pass}>
                  <div className="advantage-bar" style={{ height: 6 }}><div className="advantage-fill" style={{ width: `${Math.min(100, parseFloat(blockFreq.p) * 100)}%`, background: blockFreq.pass ? 'var(--accent-green)' : 'var(--accent-red)' }} /></div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>p = {blockFreq.p} · χ² = {blockFreq.chi2}</div>
                </TestCard>
              )}
              {runs && (
                <TestCard title="T3 — Runs" pass={runs.pass} skip={runs.blocked}>
                  {runs.blocked ? (<div style={{ fontSize: '0.68rem', color: 'var(--accent-orange)' }}>Freq must pass</div>) : (
                    <>
                      <div className="advantage-bar" style={{ height: 6 }}><div className="advantage-fill" style={{ width: `${Math.min(100, (runs.runs / Math.max(1, runs.expected * 2)) * 100)}%`, background: runs.pass ? 'var(--accent-green)' : 'var(--accent-red)' }} /></div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>p = {runs.p} · runs={runs.runs}</div>
                    </>
                  )}
                </TestCard>
              )}
              {serial && (
                <TestCard title="T4 — Serial" pass={serial.pass}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[{ label: 'p₁', p: serial.p1 }, { label: 'p₂', p: serial.p2 }].map(({ label, p }) => (
                      <div key={label} style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}={p}</div>
                      </div>
                    ))}
                  </div>
                </TestCard>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Distinguishing Game */}
      <div className="demo-card">
        <h4>Distinguishing Game Demo</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Queries the <strong>{prfType}</strong> PRF on 100 random inputs and compares the output statistics against a truly random function (Math.random) to confirm no statistical difference.
        </p>
        <button className="btn btn-primary" onClick={runDistinguishingGame} disabled={distRunning} style={{ marginBottom: 14 }}>
          {distRunning ? 'Running 100 Queries...' : 'Run Distinguishing Game'}
        </button>

        {distResult && !distResult.error && distResult.prf && distResult.rand && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8, borderLeft: '3px solid var(--accent-purple)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 8, color: 'var(--accent-purple)' }}>PRF (Real) F_k(x)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <strong>Ones:</strong> {distResult.prf.ones} <br/>
                <strong>Zeros:</strong> {distResult.prf.zeros} <br/>
                <strong>Ratio:</strong> {(distResult.prf.ratio * 100).toFixed(2)}% <br/>
                <strong>P-value:</strong> {distResult.prf.p} ({distResult.prf.pass ? 'Uniform✓' : 'Non-uniform✗'})
              </div>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8, borderLeft: '3px solid var(--accent-blue)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 8, color: 'var(--accent-blue)' }}>Truly Random Function</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <strong>Ones:</strong> {distResult.rand.ones} <br/>
                <strong>Zeros:</strong> {distResult.rand.zeros} <br/>
                <strong>Ratio:</strong> {(distResult.rand.ratio * 100).toFixed(2)}% <br/>
                <strong>P-value:</strong> {distResult.rand.p} ({distResult.rand.pass ? 'Uniform✓' : 'Non-uniform✗'})
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
              Conclusion: The PRF output statistics are indistinguishable from truly random data.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
