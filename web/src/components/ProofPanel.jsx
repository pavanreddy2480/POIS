import React, { useState, useEffect, useRef } from 'react';

function FlowDot({ active }) {
  const [pos, setPos] = useState(0);
  const raf = useRef(null);
  const start = useRef(null);

  useEffect(() => {
    if (!active) { setPos(0); return; }
    const animate = (ts) => {
      if (!start.current) start.current = ts;
      const p = ((ts - start.current) % 1800) / 1800;
      setPos(p);
      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [active]);

  return (
    <div style={{
      position: 'absolute',
      left: `calc(${pos * 100}% - 5px)`,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 10, height: 10, borderRadius: '50%',
      background: 'var(--accent-blue)',
      boxShadow: '0 0 8px 3px rgba(74,158,255,0.7)',
      pointerEvents: 'none',
      transition: 'left 0.05s linear',
    }} />
  );
}

function PrimitivePill({ label, highlight, isLeaf }) {
  return (
    <div style={{
      padding: '6px 14px',
      borderRadius: 20,
      border: `1.5px solid ${highlight ? 'var(--accent-blue)' : isLeaf ? 'var(--accent-green)' : 'var(--border)'}`,
      background: highlight
        ? 'rgba(74,158,255,0.15)'
        : isLeaf
          ? 'rgba(46,204,113,0.12)'
          : 'var(--bg-well)',
      color: highlight ? 'var(--accent-blue)' : isLeaf ? 'var(--accent-green)' : 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.82rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {label}
    </div>
  );
}


function Arrow({ theorem, security, active }) {
  return (
    <div style={{ position: 'relative', width: 120, flexShrink: 0, height: 20 }}>
      <div style={{
        position: 'absolute', bottom: '100%', left: 0, right: 0,
        paddingBottom: 3,
        fontSize: '0.65rem', color: 'var(--accent-orange)',
        fontFamily: 'var(--font-mono)',
        textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={theorem}>{theorem}</div>
      <svg width="100%" height="20" style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <marker id={`ah-${active ? 'a' : 'i'}`} markerWidth="6" markerHeight="4"
            refX="6" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4"
              fill={active ? 'var(--accent-blue)' : 'var(--border)'} />
          </marker>
        </defs>
        <line x1="0" y1="10" x2="100%" y2="10"
          stroke={active ? 'var(--accent-blue)' : 'var(--border)'}
          strokeWidth={active ? 2 : 1}
          markerEnd={`url(#ah-${active ? 'a' : 'i'})`}
        />
      </svg>
      <FlowDot active={active} />
      <div style={{
        position: 'absolute', top: '100%', left: 0, right: 0,
        paddingTop: 3,
        fontSize: '0.6rem', color: 'var(--text-muted)',
        textAlign: 'center', lineHeight: 1.3,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }} title={security}>{security}</div>
    </div>
  );
}

function FlowDiagram({ nodes, activeSource, activeTarget }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '20px 8px', overflowX: 'auto', gap: 0 }}>
      {nodes.map((node, i) => {
        const isLast = i === nodes.length - 1;
        const isActive = node.primitive === activeSource || node.primitive === activeTarget;
        const isLeaf = isLast && i !== 0;
        const nextNode = nodes[i + 1];
        const arrowActive = isActive || (nextNode && (nextNode.primitive === activeSource || nextNode.primitive === activeTarget));
        return (
          <React.Fragment key={i}>
            <PrimitivePill label={node.primitive} highlight={isActive} isLeaf={isLeaf && !isActive} />
            {!isLast && <Arrow theorem={nextNode.theorem} security={nextNode.security} active={!!arrowActive} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const FOUNDATION_BUILDS = {
  AES: { PRF: 'AES is PRF', PRP: 'AES is PRP', PRG: 'AES PRG (CTR)', MAC: 'PRF-MAC', CRHF: 'MD+PRF', HMAC: 'HMAC-SHA' },
  DLP: { OWF: 'DLP OWF', PRG: 'HILL PRG', OWP: 'DLP OWP' },
};

export default function ProofPanel({ open, setOpen, foundation, source, target, direction, proofChain, routeInfo }) {
  // Build the chain: [foundation] → [source] → [target]
  // Each node carries the label on the INCOMING arrow (theorem + security claim)
  const foundationSecurity = foundation === 'AES'
    ? 'AES is a concrete PRP/PRF (NIST standard)'
    : 'DLP: g^x mod p is OWF/OWP under Discrete Log hardness';

  const nodes = [{ primitive: foundation, theorem: '', security: '' }];

  if (source && source !== foundation) {
    const th = FOUNDATION_BUILDS[foundation]?.[source] || `${foundation}→${source}`;
    nodes.push({ primitive: source, theorem: th, security: foundationSecurity });
  }

  if (target && target !== source && target !== foundation) {
    nodes.push({
      primitive: target,
      theorem: routeInfo?.theorem || `${source}→${target}`,
      security: routeInfo?.security_claim || '',
    });
  }

  // Multi-hop: if routeInfo has a path with intermediate nodes
  // routeInfo.path is sometimes present for multi-hop reductions
  const deduped = nodes.filter((n, i) => i === 0 || n.primitive !== nodes[i - 1].primitive);

  return (
    <div className="proof-panel">
      <div className="proof-header" onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>
        <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>{open ? '▼' : '▶'}</span>
        <h3 style={{ margin: 0, display: 'inline' }}>Reduction Proof</h3>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: 12 }}>
          {foundation} → {source}{target && target !== source ? ` → ${target}` : ''}
          {direction === 'backward' ? ' (backward)' : ''}
        </span>
        {routeInfo?.theorem && (
          <span className="badge badge-secure" style={{ marginLeft: 10 }}>
            {routeInfo.theorem}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {open ? 'collapse' : 'expand'}
        </span>
      </div>

      {open && (
        <div className="proof-body">
          <FlowDiagram
            nodes={deduped}
            activeSource={source}
            activeTarget={target}
          />

          {routeInfo?.security_claim && (
            <div style={{
              marginTop: 8, padding: '10px 14px',
              background: 'rgba(74,158,255,0.07)',
              border: '1px solid rgba(74,158,255,0.2)',
              borderRadius: 6, fontSize: '0.76rem',
              color: 'var(--text-secondary)', lineHeight: 1.5,
            }}>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Security claim: </span>
              {routeInfo.security_claim}
            </div>
          )}

          <div style={{
            marginTop: 10, fontSize: '0.72rem',
            color: 'var(--text-muted)', fontStyle: 'italic',
          }}>
            All values computed live from your PA#1–#20 implementations.
          </div>
        </div>
      )}
    </div>
  );
}
