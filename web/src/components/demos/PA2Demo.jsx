import React, { useState, useEffect } from 'react';
import { api } from '../../api';

function GGMTreeSVG({ path }) {
  if (!path || path.length === 0) return null;

  const depth = path.length - 1;
  const nodeW = 138, nodeH = 36, vGap = 68;
  // Fixed spread per level — guarantees 2*spread - nodeW > 0 gap at every depth
  const spread = 90;
  const padH = 28, padTop = 44, padBottom = 40;

  // Root centered so worst-case all-left / all-right paths stay in bounds
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

    // Active child branches in the direction of the bit (1=right, 0=left)
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
          <polygon points="0 0,5 2,0 4" fill="var(--border)" />
        </marker>
      </defs>

      {/* Edges first so nodes render on top */}
      {edges.map((e, i) => (
        <g key={`e${i}`}>
          <line
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke={e.active ? 'var(--accent-blue)' : 'var(--border)'}
            strokeWidth={e.active ? 2 : 1}
            strokeDasharray={e.active ? undefined : '5 3'}
            markerEnd={`url(#ggm-arr-${e.active ? 'a' : 'i'})`}
          />
          {/* Label background to prevent bleed-through */}
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

      {/* Nodes */}
      {nodes.map((n, i) => {
        const rx = n.cx - nodeW / 2;
        const fill = n.active
          ? n.isLeaf ? 'var(--accent-green-bg)' : 'var(--accent-blue-bg)'
          : 'var(--bg-well)';
        const stroke = n.active
          ? n.isLeaf ? 'var(--accent-green)' : 'var(--accent-blue)'
          : 'var(--border)';

        return (
          <g key={`n${i}`} opacity={n.active ? 1 : 0.38}>
            <rect x={rx} y={n.y} width={nodeW} height={nodeH} rx={7}
              fill={fill} stroke={stroke} strokeWidth={n.active ? 1.5 : 0.75}
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

export default function PA2Demo() {
  const [key, setKey]     = useState('0123456789abcdef');
  const [query, setQuery] = useState('1010');
  const [tree, setTree]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [depth, setDepth] = useState(4);

  const run = async () => {
    setLoading(true);
    try {
      const padKey = key.padEnd(32, '0').slice(0, 32);
      const bits   = query.replace(/[^01]/g, '').padEnd(depth, '0').slice(0, depth);
      const byteVal = parseInt(bits.padEnd(8, '0').slice(0, 8), 2);
      const qHex   = byteVal.toString(16).padStart(2, '0');
      const r = await api.prf.ggm_tree(padKey, qHex, depth);
      setTree({ ...r, queryBits: bits });
    } catch (e) {
      setTree({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); }, [query, key, depth]);

  return (
    <div>
      <div className="demo-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4>PA#2 — GGM Tree PRF Visualizer</h4>
          <span className="badge badge-secure">SECURE</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          F_k(b₁b₂…bₙ) = G_bₙ(…G_b₁(k)…). Each bit steers left (0) or right (1).
          Dashed nodes are inactive siblings.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 12 }}>
          <div className="form-group">
            <label>Key k (hex, 16 bytes)</label>
            <input type="text" value={key} onChange={e => setKey(e.target.value)} maxLength={32} />
          </div>
          <div className="form-group">
            <label>Query x (bits)</label>
            <input
              type="text" value={query}
              onChange={e => setQuery(e.target.value.replace(/[^01]/g, '').slice(0, depth))}
              maxLength={depth}
            />
          </div>
          <div className="form-group">
            <label>Depth</label>
            <select
              value={depth} onChange={e => setDepth(+e.target.value)}
              style={{
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px',
              }}
            >
              {[2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Toggle bits:</span>
          {Array.from({ length: depth }).map((_, i) => {
            const bit = query[i] || '0';
            return (
              <button key={i}
                onClick={() => {
                  const arr = query.padEnd(depth, '0').split('');
                  arr[i] = bit === '0' ? '1' : '0';
                  setQuery(arr.join(''));
                }}
                style={{
                  width: 34, height: 34, borderRadius: 6, border: '1px solid var(--border)',
                  background: bit === '1' ? 'var(--accent-blue-bg)' : 'var(--bg-well)',
                  color: bit === '1' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)', cursor: 'pointer',
                  fontSize: '0.9rem', fontWeight: 600,
                }}>
                {bit}
              </button>
            );
          })}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>= b₁b₂…bₙ</span>
        </div>

        {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 8 }}>Computing…</div>}

        {tree && !tree.error && (
          <>
            {/* overflowX: auto so deep trees scroll rather than squish */}
            <div style={{
              background: 'var(--bg-well)', borderRadius: 8,
              padding: '16px 12px', marginBottom: 12,
              border: '1px solid var(--border)', overflowX: 'auto',
            }}>
              <GGMTreeSVG path={tree.path || []} />
            </div>
            <div className="result-box">
              <div>
                <span className="result-key">F_k(x) = </span>
                <span className="result-val" style={{ color: 'var(--accent-green)' }}>{tree.output}</span>
              </div>
              <div>
                <span className="result-key">Query bits: </span>
                <span className="result-val">{query.padEnd(depth, '0').slice(0, depth)}</span>
              </div>
              <div>
                <span className="result-key">Path length: </span>
                <span className="result-val">{tree.path?.length || 0} nodes (depth {depth})</span>
              </div>
            </div>
          </>
        )}
        {tree?.error && (
          <div className="hex-display" style={{ color: 'var(--accent-red)' }}>{tree.error}</div>
        )}
      </div>
    </div>
  );
}
