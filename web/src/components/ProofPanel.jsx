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

const ROLE_STYLES = {
  foundation: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.50)', color: 'var(--accent-orange)', dot: '#F59E0B' },
  active:     { bg: 'rgba(79,108,247,0.12)',  border: 'rgba(79,108,247,0.55)',  color: 'var(--accent-blue)',   dot: '#4F6CF7' },
  target:     { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.50)',   color: 'var(--accent-green)',  dot: '#22C55E' },
  neutral:    { bg: 'var(--bg-well)',          border: 'var(--border)',          color: 'var(--text-secondary)', dot: 'var(--text-muted)' },
};

function Chip({ label, role }) {
  const s = ROLE_STYLES[role] || ROLE_STYLES.neutral;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      padding: '10px 20px', minWidth: 120,
      borderRadius: 8, border: `1.5px solid ${s.border}`, background: s.bg,
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: s.color, letterSpacing: '0.03em' }}>
        {label}
      </span>
    </div>
  );
}

// The flow is rendered as a two-row grid:
//   row 1: [empty] [theorem label] [empty] [theorem label] ...
//   row 2: [chip]  [arrow line→]   [chip]  [arrow line→]  [chip]
// This way labels are strictly above arrows, never overlapping.
function FlowDiagram({ nodes, activeSource, activeTarget }) {
  if (!nodes || nodes.length === 0) return null;

  const getRole = (node, i) => {
    if (i === 0) return 'foundation';
    if (node.primitive === activeSource || node.primitive === activeTarget) {
      return i === nodes.length - 1 ? 'target' : 'active';
    }
    return i === nodes.length - 1 ? 'target' : 'neutral';
  };

  // Build flat interleaved list: chip, arrow, chip, arrow, chip...
  const items = [];
  nodes.forEach((node, i) => {
    items.push({ type: 'chip', node, i });
    if (i < nodes.length - 1) {
      items.push({ type: 'arrow', theorem: nodes[i + 1].theorem });
    }
  });

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', overflowX: 'auto', padding: '8px 0 4px' }}>
      {items.map((item, idx) => {
        if (item.type === 'chip') {
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              {/* top spacer to align with theorem labels */}
              <div style={{ height: 24 }} />
              <Chip label={item.node.primitive} role={getRole(item.node, item.i)} />
            </div>
          );
        }
        // arrow column
        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: 130, flexShrink: 0 }}>
            {/* theorem label row */}
            <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.58rem', fontWeight: 600,
                color: 'var(--accent-orange)',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.22)',
                borderRadius: 4, padding: '2px 7px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: 118, display: 'block', textAlign: 'center',
              }} title={item.theorem}>
                {item.theorem}
              </span>
            </div>
            {/* arrow line — must align vertically with center of chips */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: 40 }}>
              <div style={{ flex: 1, height: 2, background: 'linear-gradient(to right, #9BA5D4, #4F6CF7)' }} />
              <div style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '10px solid #4F6CF7', flexShrink: 0 }} />
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
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
      margin: '0 0 12px',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px', cursor: 'pointer', userSelect: 'none',
          borderBottom: open ? '1px solid var(--border-light)' : '1px solid transparent',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(79,108,247,0.10)', border: '1px solid rgba(79,108,247,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F6CF7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
            Reduction Proof
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>{foundLabel}</span>
          <span>→</span>
          <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{srcN}</span>
          {tgtN && tgtN !== srcN && <><span>→</span><span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{tgtN}</span></>}
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
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          {open ? '▲ collapse' : '▼ expand'}
        </span>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '20px 32px 20px' }}>
          <FlowDiagram nodes={deduped} activeSource={srcN} activeTarget={tgtN} />

          {securitySummary && (
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '10px 14px', marginTop: 16,
              background: 'rgba(79,108,247,0.05)',
              border: '1px solid rgba(79,108,247,0.15)',
              borderRadius: 8,
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: 'rgba(79,108,247,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4F6CF7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security Chain</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{securitySummary}</div>
              </div>
            </div>
          )}

          {routeInfo?.supported === false && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', marginTop: 12, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: '0.76rem', color: 'var(--accent-orange)' }}>
              ⚠ No direct reduction path from <strong style={{ margin: '0 3px' }}>{srcN}</strong> to <strong style={{ margin: '0 3px' }}>{tgtN}</strong>. Try swapping or using B→A.
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
            All intermediate values computed live from your PA#1–#20 implementations.
          </div>
        </div>
      )}
    </div>
  );
}
