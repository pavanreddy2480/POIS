import React, { useState } from 'react';
import { api } from '../../api';

export default function PA2Demo() {
  const [key, setKey] = useState('0123456789abcdef');
  const [query, setQuery] = useState('1010');
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const padKey = key.padEnd(32,'0').slice(0,32);
      const padQuery = query.replace(/[^01]/g,'').padEnd(8,'0').slice(0,8);
      const r = await api.prf.ggm_tree(padKey, Buffer.from(parseInt(padQuery,2).toString(16).padStart(2,'0'),'hex').toString('hex') || '00');
      setTree({ ...r, queryBits: padQuery });
    } catch(e) { setTree({ error: e.message }); }
    finally { setLoading(false); }
  };

  const depth = tree?.path?.length || 0;

  return (
    <div>
      <div className="demo-card">
        <h4>🌳 PA#2 — GGM Tree PRF Visualizer</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          F_k(b1b2...bn) = G_bn(...G_b1(k)...) — follow root-to-leaf path defined by query bits
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div className="form-group">
            <label>Key k (hex)</label>
            <input type="text" value={key} onChange={e=>setKey(e.target.value)} maxLength={32} />
          </div>
          <div className="form-group">
            <label>Query x (bit string, 4–8 bits)</label>
            <input type="text" value={query} onChange={e=>setQuery(e.target.value.replace(/[^01]/g,''))} maxLength={8} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 14 }}>
          {loading ? 'Computing...' : '▶ Visualize GGM Tree'}
        </button>

        {tree && !tree.error && (
          <>
            <div className="ggm-tree">
              <div className="ggm-level">
                <div className="ggm-node active">k = {key.slice(0,8)}…</div>
              </div>
              {(tree.path || []).map((step, i) => (
                <div key={i} className="ggm-level">
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 8 }}>
                    bit {i+1}={step.bit}
                  </div>
                  <div className={`ggm-node active${i === (tree.path.length-1) ? ' leaf' : ''}`}>
                    G_{step.bit}: {step.node.slice(0,10)}…
                  </div>
                </div>
              ))}
              <div className="ggm-level">
                <div className="ggm-node leaf active">
                  F_k({query}) = {tree.output.slice(0,16)}…
                </div>
              </div>
            </div>
            <div className="result-box">
              <div><span className="result-key">F_k(x) = </span><span className="result-val">{tree.output}</span></div>
              <div><span className="result-key">Query bits: </span><span className="result-val">{query}</span></div>
              <div><span className="result-key">Tree depth: </span><span className="result-val">{tree.path?.length} levels</span></div>
            </div>
          </>
        )}
        {tree?.error && <div className="hex-display red">{tree.error}</div>}
      </div>
    </div>
  );
}
