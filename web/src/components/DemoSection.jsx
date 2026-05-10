import React, { useState, useRef, useEffect } from 'react';
import BuildPanel from './BuildPanel';
import ReducePanel from './ReducePanel';
import ProofPanel from './ProofPanel';
import PA1Demo from './demos/PA01Demo';
import PA2Demo from './demos/PA02Demo';
import PA3Demo from './demos/PA03Demo';
import PA4Demo from './demos/PA04Demo';
import PA5Demo from './demos/PA05Demo';
import PA6Demo from './demos/PA06Demo';
import PA7Demo from './demos/PA07Demo';
import PA8Demo from './demos/PA08Demo';
import PA9Demo from './demos/PA09Demo';
import PA10Demo from './demos/PA10Demo';
import PA11Demo from './demos/PA11Demo';
import PA12Demo from './demos/PA12Demo';
import PA13Demo from './demos/PA13Demo';
import PA14Demo from './demos/PA14Demo';
import PA15Demo from './demos/PA15Demo';
import PA16Demo from './demos/PA16Demo';
import PA17Demo from './demos/PA17Demo';
import PA18Demo from './demos/PA18Demo';
import PA19Demo from './demos/PA19Demo';
import PA20Demo from './demos/PA20Demo';

const DEMOS = [
  { id: 'PA1',  num: 1,  label: 'OWF / PRG',        tag: 'OWF',  Component: PA1Demo },
  { id: 'PA2',  num: 2,  label: 'GGM Tree PRF',      tag: 'PRF',  Component: PA2Demo },
  { id: 'PA3',  num: 3,  label: 'IND-CPA Enc',       tag: 'CPA',  Component: PA3Demo },
  { id: 'PA4',  num: 4,  label: 'Modes CBC/OFB/CTR', tag: 'PRP',  Component: PA4Demo },
  { id: 'PA5',  num: 5,  label: 'MAC Forge',          tag: 'MAC',  Component: PA5Demo },
  { id: 'PA6',  num: 6,  label: 'Malleability CCA',   tag: 'CCA',  Component: PA6Demo },
  { id: 'PA7',  num: 7,  label: 'Merkle-Damgård',     tag: 'HASH', Component: PA7Demo },
  { id: 'PA8',  num: 8,  label: 'DLP Hash',           tag: 'DLP',  Component: PA8Demo },
  { id: 'PA9',  num: 9,  label: 'Birthday Attack',    tag: 'CRHF', Component: PA9Demo },
  { id: 'PA10', num: 10, label: 'HMAC',               tag: 'HMAC', Component: PA10Demo },
  { id: 'PA11', num: 11, label: 'DH Key Exchange',    tag: 'DH',   Component: PA11Demo },
  { id: 'PA12', num: 12, label: 'RSA Encrypt',        tag: 'RSA',  Component: PA12Demo },
  { id: 'PA13', num: 13, label: 'Miller-Rabin',       tag: 'MATH', Component: PA13Demo },
  { id: 'PA14', num: 14, label: 'Håstad CRT Attack',  tag: 'CRT',  Component: PA14Demo },
  { id: 'PA15', num: 15, label: 'RSA Signatures',     tag: 'SIG',  Component: PA15Demo },
  { id: 'PA16', num: 16, label: 'ElGamal',            tag: 'EG',   Component: PA16Demo },
  { id: 'PA17', num: 17, label: 'CCA-PKC',            tag: 'CCA',  Component: PA17Demo },
  { id: 'PA18', num: 18, label: 'Oblivious Transfer', tag: 'OT',   Component: PA18Demo },
  { id: 'PA19', num: 19, label: 'Secure AND',         tag: 'MPC',  Component: PA19Demo },
  { id: 'PA20', num: 20, label: 'MPC Circuit',        tag: 'MPC',  Component: PA20Demo },
];

export default function DemoSection({
  foundation, source, setSource, target, setTarget,
  primitives, keyHex, setKeyHex, queryHex, setQueryHex,
  buildSteps, reduceSteps, routeInfo,
  proofOpen, setProofOpen, direction, loading, onRun,
  onActiveChange,
}) {
  const [active, setActive] = useState(() => localStorage.getItem('activeDemo') || 'home');
  const [navOpen, setNavOpen] = useState(() => localStorage.getItem('navOpen') !== 'false');
  const [mounted, setMounted] = useState(() => {
    const a = localStorage.getItem('activeDemo') || 'home';
    return a !== 'home' ? new Set([a]) : new Set();
  });
  const [freshId, setFreshId] = useState(null);
  const navRef = useRef(null);
  const freshTimer = useRef(null);

  useEffect(() => { localStorage.setItem('navOpen', navOpen); }, [navOpen]);

  useEffect(() => {
    const demo = DEMOS.find(d => d.id === active);
    onActiveChange?.(active, demo?.label ?? null);
  }, []); // notify parent of initial active state

  const activateDemo = (id) => {
    setActive(id);
    localStorage.setItem('activeDemo', id);
    const demo = DEMOS.find(d => d.id === id);
    onActiveChange?.(id, demo?.label ?? null);
    if (id !== 'home') {
      const isNew = !mounted.has(id);
      setMounted(prev => {
        if (prev.has(id)) return prev;
        return new Set([...prev, id]);
      });
      if (isNew) {
        clearTimeout(freshTimer.current);
        setFreshId(id);
        freshTimer.current = setTimeout(() => setFreshId(null), 520);
      }
    }
  };

  const handleNavKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(navRef.current?.querySelectorAll('.demo-nav-item') || []);
    const idx = items.indexOf(document.activeElement);
    if (idx === -1) { items[0]?.focus(); return; }
    const next = e.key === 'ArrowDown'
      ? items[(idx + 1) % items.length]
      : items[(idx - 1 + items.length) % items.length];
    next?.focus();
  };

  return (
    <div className="demo-layout">
      {/* Arc-style left nav */}
      <nav ref={navRef} className={`demo-nav${navOpen ? '' : ' collapsed'}`} onKeyDown={handleNavKeyDown}>
        {/* Collapse / expand toggle */}
        <div className="demo-nav-toggle">
          <button
            className="demo-nav-toggle-btn"
            onClick={() => setNavOpen(o => !o)}
            title={navOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {navOpen ? '‹' : '›'}
          </button>
        </div>

        {/* Home */}
        <div className="demo-nav-title">Explorer</div>
        <button
          className={`demo-nav-item${active === 'home' ? ' active' : ''}`}
          onClick={() => activateDemo('home')}
        >
          <span className="demo-nav-num" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.69-8.69a2.25 2.25 0 0 0-3.18 0l-8.69 8.69a.75.75 0 1 0 1.06 1.06l8.69-8.69Z" />
              <path d="M12 5.432 3.841 13.59A1.875 1.875 0 0 0 3.75 14.5V20.25c0 .414.336.75.75.75H9a.75.75 0 0 0 .75-.75v-4.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75v4.5c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75V14.5a1.875 1.875 0 0 0-.091-.91L12 5.432Z" />
            </svg>
          </span>
          <span className="demo-nav-label">Reduction Explorer</span>
          <span className="demo-nav-tag">HOME</span>
        </button>

        <div className="demo-nav-divider" />
        <div className="demo-nav-title">Assignments</div>

        {DEMOS.map(d => (
          <button
            key={d.id}
            className={`demo-nav-item${active === d.id ? ' active' : ''}`}
            onClick={() => activateDemo(d.id)}
          >
            <span className="demo-nav-num">PA{d.num}</span>
            <span className="demo-nav-label">{d.label}</span>
            <span className="demo-nav-tag">{d.tag}</span>
            {mounted.has(d.id) && <span className="demo-nav-done" aria-label="visited" />}
          </button>
        ))}
      </nav>

      {/* Playground */}
      <div className="demo-playground">
        {active === 'home' && (
          <div className="home-hint">
            <span className="home-hint-icon">⬡</span>
            <span>Pick a <strong>source</strong> and <strong>target</strong> primitive below to trace the security reduction, or select a <strong>PA assignment</strong> from the sidebar to explore live interactive demos.</span>
          </div>
        )}
        {active === 'home' && (
          <div className="explorer-panels">
            <BuildPanel
              foundation={foundation}
              source={direction === 'backward' ? target : source}
              setSource={direction === 'backward' ? setTarget : setSource}
              primitives={primitives}
              keyHex={direction === 'backward' ? queryHex : keyHex}
              setKeyHex={direction === 'backward' ? setQueryHex : setKeyHex}
              steps={buildSteps}
              loading={loading}
              onRun={onRun}
            />
            <ReducePanel
              source={direction === 'backward' ? target : source}
              target={direction === 'backward' ? source : target}
              setTarget={direction === 'backward' ? setSource : setTarget}
              primitives={primitives}
              queryHex={direction === 'backward' ? keyHex : queryHex}
              setQueryHex={direction === 'backward' ? setKeyHex : setQueryHex}
              steps={reduceSteps}
              routeInfo={routeInfo}
              loading={loading}
              onRun={onRun}
              direction={direction}
            />
            <ProofPanel
              open={proofOpen}
              setOpen={setProofOpen}
              foundation={foundation}
              source={source}
              target={target}
              direction={direction}
              routeInfo={routeInfo}
            />
          </div>
        )}
        {DEMOS.map((d, idx) => (
          mounted.has(d.id) ? (
            <div key={d.id} style={{ display: active === d.id ? 'block' : 'none', position: 'relative' }}>
              {freshId === d.id && (
                <div className="demo-skeleton-overlay">
                  <div className="demo-skeleton-card">
                    <div className="skel skel-hdr" />
                    <div className="skel skel-line skel-w70" />
                    <div className="skel skel-line skel-w50" />
                    <div className="skel skel-block" />
                  </div>
                </div>
              )}
              <d.Component onNavigate={activateDemo} />
              <div className="demo-page-nav">
                {idx > 0 ? (
                  <button className="demo-page-nav-btn" onClick={() => activateDemo(DEMOS[idx - 1].id)}>
                    ← PA{DEMOS[idx - 1].num} {DEMOS[idx - 1].label}
                  </button>
                ) : <span />}
                {idx < DEMOS.length - 1 ? (
                  <button className="demo-page-nav-btn next" onClick={() => activateDemo(DEMOS[idx + 1].id)}>
                    PA{DEMOS[idx + 1].num} {DEMOS[idx + 1].label} →
                  </button>
                ) : <span />}
              </div>
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
}
