import React, { useState, useEffect } from 'react';
import { api } from '../../api';

function GGMTreeSVG({ path, query }) {
  if (!path || path.length === 0) return null;

  const depth = path.length - 1; // root + depth levels
  const nodeW = 130, nodeH = 36, hGap = 20, vGap = 50;
  const levelW = (nodeW + hGap);
  const totalW = Math.max(levelW * Math.pow(2, Math.min(depth, 4)) + 40, 500);
  const totalH = (depth + 1) * (nodeH + vGap) + 20;

  // Build tree positions - only show the active path + siblings
  const nodes = [];
  const edges = [];

  // Root
  nodes.push({ x: totalW / 2 - nodeW / 2, y: 10, label: path[0].node.slice(0, 8) + '…', active: true, level: 0 });

  let x = totalW / 2;
  for (let i = 1; i < path.length; i++) {
    const bit = path[i].bit;
    const py = 10 + (i - 1) * (nodeH + vGap) + nodeH / 2;
    const cy = 10 + i * (nodeH + vGap);
    const spread = (totalW / 4) / Math.pow(2, i - 1);

    // Active child
    const cx = x + (bit === 1 ? spread : -spread);
    nodes.push({ x: cx - nodeW / 2, y: cy, label: path[i].node.slice(0, 8) + '…', active: true, level: i, bit });
    edges.push({ x1: x, y1: py, x2: cx, y2: cy, active: true, label: `G_${bit}` });

    // Inactive sibling (greyed)
    const sx = x + (bit === 1 ? -spread : spread);
    nodes.push({ x: sx - nodeW / 2, y: cy, label: '…', active: false, level: i, bit: 1 - bit });
    edges.push({ x1: x, y1: py, x2: sx, y2: cy, active: false, label: `G_${1 - bit}` });

    x = cx;
  }

  return (
    <svg width="100%" viewBox={`0 0 ${totalW} ${totalH}`} style={{ overflow: 'visible', maxHeight: 300 }}>
      {edges.map((e, i) => (
        <g key={i}>
          <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke={e.active ? 'var(--accent-blue)' : '#333'}
            strokeWidth={e.active ? 2 : 1}
            strokeDasharray={e.active ? 'none' : '4,3'}
          />
          <text x={(e.x1 + e.x2) / 2 + 4} y={(e.y1 + e.y2) / 2}
            fontSize="10" fill={e.active ? 'var(--accent-blue)' : '#555'}
            fontFamily="var(--font-mono)">
            {e.label}
          </text>
        </g>
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <rect x={n.x} y={n.y} width={nodeW} height={nodeH} rx={6}
            fill={n.active ? (n.level === depth ? 'rgba(46,204,113,0.15)' : 'rgba(74,158,255,0.15)') : 'rgba(50,50,70,0.5)'}
            stroke={n.active ? (n.level === depth ? 'var(--accent-green)' : 'var(--accent-blue)') : '#444'}
            strokeWidth={n.active ? (n.level === depth ? 2 : 1.5) : 1}
          />
          <text x={n.x + nodeW / 2} y={n.y + nodeH / 2 + 4}
            textAnchor="middle" fontSize="11" fill={n.active ? '#e8eaf6' : '#555'}
            fontFamily="var(--font-mono)">
            {n.label}
          </text>
          {n.level === 0 && (
            <text x={n.x + nodeW / 2} y={n.y - 5} textAnchor="middle" fontSize="9" fill="var(--accent-gold)">
              root k
            </text>
          )}
          {n.level === depth && n.active && (
            <text x={n.x + nodeW / 2} y={n.y + nodeH + 12} textAnchor="middle" fontSize="10" fill="var(--accent-green)">
              F_k(x)
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function PA2Demo() {
  const [key, setKey] = useState('0123456789abcdef');
  const [query, setQuery] = useState('1010');
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [depth, setDepth] = useState(4);

  const run = async () => {
    setLoading(true);
    try {
      const padKey = key.padEnd(32, '0').slice(0, 32);
      const bits = query.replace(/[^01]/g, '').padEnd(depth, '0').slice(0, depth);
      const byteVal = parseInt(bits.padEnd(8, '0').slice(0, 8), 2);
      const qHex = byteVal.toString(16).padStart(2, '0');
      const r = await api.prf.ggm_tree(padKey, qHex, depth);
      setTree({ ...r, queryBits: bits });
    } catch (e) {
      setTree({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Auto-run when inputs change
  useEffect(() => { run(); }, [query, key, depth]);

  return (
    <div>
      <div className="demo-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4>PA#2 — GGM Tree PRF Visualizer</h4>
          <span className="badge badge-secure">SECURE</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          F_k(b₁b₂…bₙ) = G_bₙ(…G_b₁(k)…) — traverse the binary tree bit by bit
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 12 }}>
          <div className="form-group">
            <label>Key k (hex, 16 bytes)</label>
            <input type="text" value={key} onChange={e => setKey(e.target.value)} maxLength={32} />
          </div>
          <div className="form-group">
            <label>Query x (bits)</label>
            <input type="text" value={query}
              onChange={e => setQuery(e.target.value.replace(/[^01]/g, '').slice(0, depth))} maxLength={depth} />
          </div>
          <div className="form-group">
            <label>Depth</label>
            <select value={depth} onChange={e => setDepth(+e.target.value)}
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px' }}>
              {[2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Bit toggles */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Toggle bits:</span>
          {Array.from({ length: depth }).map((_, i) => {
            const bit = (query[i] || '0');
            return (
              <button key={i}
                onClick={() => {
                  const arr = (query.padEnd(depth, '0')).split('');
                  arr[i] = bit === '0' ? '1' : '0';
                  setQuery(arr.join(''));
                }}
                style={{
                  width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)',
                  background: bit === '1' ? 'rgba(74,158,255,0.2)' : 'var(--bg-primary)',
                  color: bit === '1' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)', cursor: 'pointer', fontSize: '0.85rem',
                }}>
                {bit}
              </button>
            );
          })}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>= b₁b₂…</span>
        </div>

        {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Computing tree…</div>}

        {tree && !tree.error && (
          <>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '12px', marginBottom: 10, border: '1px solid var(--border)' }}>
              <GGMTreeSVG path={tree.path || []} query={query} />
            </div>
            <div className="result-box">
              <div><span className="result-key">F_k(x) = </span>
                <span className="result-val" style={{ color: 'var(--accent-green)' }}>{tree.output}</span></div>
              <div><span className="result-key">Query bits: </span>
                <span className="result-val">{query.padEnd(depth, '0').slice(0, depth)}</span></div>
              <div><span className="result-key">Active path length: </span>
                <span className="result-val">{tree.path?.length || 0} nodes</span></div>
            </div>
          </>
        )}
        {tree?.error && <div className="hex-display" style={{ color: 'var(--accent-red)' }}>{tree.error}</div>}
      </div>
    </div>
  );
}
