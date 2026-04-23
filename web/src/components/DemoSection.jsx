import React, { useState, useRef } from 'react';
import BuildPanel from './BuildPanel';
import ReducePanel from './ReducePanel';
import ProofPanel from './ProofPanel';
import PA1Demo from './demos/PA1Demo';
import PA2Demo from './demos/PA2Demo';
import PA3Demo from './demos/PA3Demo';
import PA4Demo from './demos/PA4Demo';
import PA5Demo from './demos/PA5Demo';
import PA6Demo from './demos/PA6Demo';
import PA7Demo from './demos/PA7Demo';
import PA8Demo from './demos/PA8Demo';
import PA9Demo from './demos/PA9Demo';
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
  proofOpen, setProofOpen, direction, proofChain, onRun,
}) {
  const [active, setActive] = useState('home');
  const [navOpen, setNavOpen] = useState(true);
  const [mounted, setMounted] = useState(() => new Set());
  const navRef = useRef(null);

  const activateDemo = (id) => {
    setActive(id);
    if (id !== 'home') {
      setMounted(prev => {
        if (prev.has(id)) return prev;
        return new Set([...prev, id]);
      });
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
          <div className="explorer-panels">
            <BuildPanel
              foundation={foundation}
              source={source}
              setSource={setSource}
              primitives={primitives}
              keyHex={keyHex}
              setKeyHex={setKeyHex}
              steps={buildSteps}
              onRun={onRun}
            />
            <ReducePanel
              source={source}
              target={target}
              setTarget={setTarget}
              primitives={primitives}
              queryHex={queryHex}
              setQueryHex={setQueryHex}
              steps={reduceSteps}
              routeInfo={routeInfo}
              onRun={onRun}
            />
            <ProofPanel
              open={proofOpen}
              setOpen={setProofOpen}
              foundation={foundation}
              source={source}
              target={target}
              direction={direction}
              proofChain={proofChain}
              routeInfo={routeInfo}
            />
          </div>
        )}
        {DEMOS.map(d => (
          mounted.has(d.id) ? (
            <div key={d.id} style={{ display: active === d.id ? 'block' : 'none' }}>
              <d.Component />
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
}
