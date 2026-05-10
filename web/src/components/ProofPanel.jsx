import React from 'react';

const FOUNDATION_BUILDS = {
  AES: {
    OWF: 'Davies-Meyer', OWP: 'AES is PRP', PRG: 'Switching lemma',
    PRF: 'AES is PRF', PRP: 'AES is PRP', MAC: 'PRF-MAC',
    CRHF: 'MD construction', HMAC: 'HMAC', CPA_ENC: 'PRF → CPA', CCA_ENC: 'Enc-then-MAC',
  },
  DLP: {
    OWF: 'DLP (g^x mod p)', OWP: 'DLP OWP', PRG: 'HILL',
    PRF: 'HILL + GGM', PRP: 'HILL + GGM + LR', MAC: 'HILL + GGM + PRF-MAC',
    CRHF: 'DLP hash', HMAC: 'DLP hash + HMAC', CPA_ENC: 'HILL + GGM + CPA', CCA_ENC: 'HILL + GGM + EtM',
  },
};

const FOUNDATION_LABEL = { AES: 'AES (PRP)', DLP: 'DLP (OWF)' };

/* Role → visual style mapping — mirrors the new Awwwards palette */
const ROLE_STYLES = {
  foundation: {
    gradient: 'linear-gradient(135deg, rgba(217,119,6,0.18) 0%, rgba(217,119,6,0.08) 100%)',
    border: 'rgba(217,119,6,0.50)',
    color: 'var(--accent-orange)',
    dot: 'var(--accent-orange)',
    glow: '0 0 12px rgba(217,119,6,0.22)',
  },
  active: {
    gradient: 'var(--gradient-brand-soft)',
    border: 'rgba(84,72,240,0.55)',
    color: 'var(--accent-blue)',
    dot: 'var(--accent-blue)',
    glow: 'var(--shadow-glow-blue)',
  },
  target: {
    gradient: 'linear-gradient(135deg, rgba(5,150,105,0.16) 0%, rgba(5,150,105,0.06) 100%)',
    border: 'rgba(5,150,105,0.50)',
    color: 'var(--accent-green)',
    dot: 'var(--accent-green)',
    glow: 'var(--shadow-glow-green)',
  },
  neutral: {
    gradient: 'var(--bg-well)',
    border: 'var(--border)',
    color: 'var(--text-secondary)',
    dot: 'var(--text-muted)',
    glow: 'none',
  },
};

function Chip({ label, role }) {
  const s = ROLE_STYLES[role] || ROLE_STYLES.neutral;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '10px 22px', minWidth: 128,
      borderRadius: 10,
      border: `1.5px solid ${s.border}`,
      background: s.gradient,
      flexShrink: 0, whiteSpace: 'nowrap',
      boxShadow: `${s.glow}, 0 2px 8px rgba(0,0,0,0.07)`,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: s.dot, flexShrink: 0,
        boxShadow: `0 0 0 2.5px ${s.border}`,
      }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.84rem',
        fontWeight: 800, color: s.color, letterSpacing: '0.02em',
      }}>
        {label}
      </span>
    </div>
  );
}

function FlowDiagram({ nodes, activeSource, activeTarget }) {
  if (!nodes || nodes.length === 0) return null;

  const getRole = (node, i) => {
    if (i === 0) return 'foundation';
    if (node.primitive === activeSource || node.primitive === activeTarget) {
      return i === nodes.length - 1 ? 'target' : 'active';
    }
    return i === nodes.length - 1 ? 'target' : 'neutral';
  };

  const items = [];
  nodes.forEach((node, i) => {
    items.push({ type: 'chip', node, i });
    if (i < nodes.length - 1) {
      items.push({ type: 'arrow', theorem: nodes[i + 1].theorem });
    }
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      overflowX: 'auto', padding: '10px 0 6px',
    }}>
      {items.map((item, idx) => {
        if (item.type === 'chip') {
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{ height: 28 }} />
              <Chip label={item.node.primitive} role={getRole(item.node, item.i)} />
            </div>
          );
        }
        return (
          <div key={idx} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-end', width: 130, flexShrink: 0,
          }}>
            {/* Theorem label */}
            <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.61rem', fontWeight: 700,
                color: 'var(--accent-orange)',
                background: 'var(--accent-orange-bg)',
                border: '1px solid rgba(217,119,6,0.28)',
                borderRadius: 5, padding: '2px 8px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: 120, display: 'block', textAlign: 'center',
              }} title={item.theorem}>
                {item.theorem}
              </span>
            </div>
            {/* Gradient arrow */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: 40 }}>
              <div style={{
                flex: 1, height: 2,
                background: 'var(--gradient-brand)',
                opacity: 0.60,
              }} />
              <div style={{
                width: 0, height: 0,
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderLeft: '10px solid var(--accent-blue)',
                flexShrink: 0,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProofPanel({ open, setOpen, foundation, source, target, direction, routeInfo }) {
  const srcN = direction === 'backward' ? target : source;
  const tgtN = direction === 'backward' ? source : target;
  const foundLabel = FOUNDATION_LABEL[foundation] || foundation;

  const hopDetails = routeInfo?.hop_details || [];
  let nodes = [];

  if (routeInfo?.path && routeInfo.path.length > 1) {
    const path = routeInfo.path;
    nodes.push({ primitive: foundLabel, theorem: '' });
    path.forEach((prim, i) => {
      const th = i === 0
        ? (FOUNDATION_BUILDS[foundation]?.[prim] || `${foundation}→${prim}`)
        : (hopDetails[i - 1]?.theorem || `${path[i - 1]}→${prim}`);
      nodes.push({ primitive: prim, theorem: th });
    });
  } else {
    nodes.push({ primitive: foundLabel, theorem: '' });
    if (srcN && srcN !== foundation) {
      nodes.push({ primitive: srcN, theorem: FOUNDATION_BUILDS[foundation]?.[srcN] || `${foundation}→${srcN}` });
    }
    if (tgtN && tgtN !== srcN && tgtN !== foundation) {
      nodes.push({
        primitive: tgtN,
        theorem: routeInfo?.direction === 'backward'
          ? `${srcN} → ${tgtN}`
          : (routeInfo?.theorem || `${srcN}→${tgtN}`),
      });
    }
  }

  const deduped = nodes.filter((n, i) => i === 0 || n.primitive !== nodes[i - 1].primitive);

  const securitySummary = (() => {
    if (!routeInfo || routeInfo.supported === false) return null;
    if (hopDetails.length > 0) return hopDetails.map(h => h.security_claim).filter(Boolean).join(' → ');
    return routeInfo.security_claim || null;
  })();

  return (
    <div style={{
      background: 'var(--bg-card)',
      backdropFilter: 'blur(16px) saturate(160%)',
      WebkitBackdropFilter: 'blur(16px) saturate(160%)',
      border: '1px solid var(--border-glass)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
      margin: '0 0 12px',
      transition: 'box-shadow 0.18s ease',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 20px', cursor: 'pointer', userSelect: 'none',
          transition: 'background 0.18s ease',
          borderBottom: open ? '1px solid var(--border-light)' : '1px solid transparent',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--gradient-brand-soft)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Icon + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--gradient-brand-soft)',
            border: '1px solid rgba(84,72,240,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-blue)" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={{
            fontSize: '0.77rem', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.09em',
            color: 'var(--text-primary)',
          }}>
            Reduction Proof
          </span>
        </div>

        {/* Breadcrumb trail */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          marginLeft: 4, fontFamily: 'var(--font-mono)',
          fontSize: '0.76rem', color: 'var(--text-muted)',
        }}>
          <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>{foundLabel}</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{srcN}</span>
          {tgtN && tgtN !== srcN && (
            <>
              <span style={{ opacity: 0.5 }}>→</span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{tgtN}</span>
            </>
          )}
        </div>

        {routeInfo?.theorem && routeInfo.supported !== false && (
          <span className="badge badge-secure" style={{ marginLeft: 6, flexShrink: 0 }}>
            {routeInfo.direction === 'backward' ? `${srcN} → ${tgtN}` : routeInfo.theorem}
          </span>
        )}
        {routeInfo?.supported === false && (
          <span className="badge badge-warn" style={{ marginLeft: 6, flexShrink: 0 }}>No path</span>
        )}

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', flexShrink: 0, letterSpacing: '0.02em' }}>
          {open ? '▲ collapse' : '▼ expand'}
        </span>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '20px 32px 22px' }}>
          <FlowDiagram nodes={deduped} activeSource={srcN} activeTarget={tgtN} />

          {securitySummary && (
            <div style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '12px 16px', marginTop: 18,
              background: 'var(--gradient-brand-soft)',
              border: '1px solid rgba(84,72,240,0.22)',
              borderRadius: 10,
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 7,
                background: 'var(--gradient-brand-soft)',
                border: '1px solid rgba(84,72,240,0.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 1,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="var(--accent-blue)" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <div style={{
                  fontSize: '0.70rem', fontWeight: 800, color: 'var(--accent-blue)',
                  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>Security Chain</div>
                <div style={{
                  fontSize: '0.77rem', color: 'var(--text-secondary)',
                  lineHeight: 1.65, fontWeight: 500,
                }}>{securitySummary}</div>
              </div>
            </div>
          )}

          {routeInfo?.supported === false && (
            <div style={{
              display: 'flex', gap: 10, alignItems: 'center',
              padding: '10px 14px', marginTop: 12,
              background: 'var(--accent-orange-bg)',
              border: '1px solid rgba(217,119,6,0.30)',
              borderRadius: 9, fontSize: '0.77rem',
              color: 'var(--accent-orange)', fontWeight: 600,
            }}>
              ⚠ No direct reduction path from <strong style={{ margin: '0 3px' }}>{srcN}</strong> to <strong style={{ margin: '0 3px' }}>{tgtN}</strong>. Try swapping or using B→A.
            </div>
          )}

          <div style={{
            marginTop: 16, fontSize: '0.68rem',
            color: 'var(--text-muted)', textAlign: 'center',
            fontStyle: 'italic', fontWeight: 500, letterSpacing: '0.01em',
          }}>
            All intermediate values computed live from your PA#1–#20 implementations.
          </div>
        </div>
      )}
    </div>
  );
}
