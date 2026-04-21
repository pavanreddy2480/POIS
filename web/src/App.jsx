import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import BuildPanel from './components/BuildPanel';
import ReducePanel from './components/ReducePanel';
import ProofPanel from './components/ProofPanel';
import DemoSection from './components/DemoSection';

const PRIMITIVES = ['OWF', 'PRG', 'PRF', 'PRP', 'MAC', 'CRHF', 'HMAC'];
const PA_NUMS = { OWF: 1, PRG: 1, PRF: 2, PRP: 4, MAC: 5, CRHF: '7+8', HMAC: 10 };

export default function App() {
  const [foundation, setFoundation] = useState('AES');
  const [source, setSource]         = useState('PRG');
  const [target, setTarget]         = useState('PRF');
  const [keyHex, setKeyHex]         = useState('0123456789abcdef0123456789abcdef');
  const [queryHex, setQueryHex]     = useState('deadbeefcafe0000');
  const [direction, setDirection]   = useState('forward'); // forward | backward
  const [proofOpen, setProofOpen]   = useState(false);
  const [buildSteps, setBuildSteps] = useState([]);
  const [reduceSteps, setReduceSteps] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [routeInfo, setRouteInfo]   = useState(null);

  const runComputations = useCallback(async () => {
    if (!keyHex || keyHex.length < 8) return;
    setLoading(true);

    try {
      // Column 1: Foundation → Source
      const steps1 = [];
      if (foundation === 'AES') {
        steps1.push({ label: 'AES key', fn: 'AES-128', value: keyHex.slice(0, 32).padEnd(32, '0'), desc: 'Foundation (AES PRP/PRF)' });
        if (['PRG', 'PRF', 'PRP', 'MAC', 'CRHF', 'HMAC'].includes(source)) {
          try {
            const r = await api.prf.evaluate(keyHex.slice(0, 32).padEnd(32, '0'), '0'.repeat(16));
            steps1.push({ label: 'F_k(0)', fn: 'AES_k(0)', value: r.output, desc: 'PRF evaluation' });
            if (source === 'PRG') {
              const r2 = await api.prf.evaluate(keyHex.slice(0, 32).padEnd(32, '0'), '1'.repeat(16));
              steps1.push({ label: 'PRG(s)', fn: 'F_k(0)||F_k(1)', value: r.output + r2.output, desc: 'Length-doubling PRG' });
            }
          } catch (e) { steps1.push({ label: 'Error', fn: source, value: e.message, stub: true }); }
        }
      } else {
        steps1.push({ label: 'DLP seed', fn: 'g^x mod p', value: keyHex, desc: 'Foundation (DLP OWF/OWP)' });
        steps1.push({ label: 'OWF(x)', fn: 'g^x mod p', value: '(DLP evaluation)', desc: 'OWF output' });
      }
      setBuildSteps(steps1);

      // Routing table
      const srcFinal = direction === 'backward' ? target : source;
      const tgtFinal = direction === 'backward' ? source : target;
      const route = await api.reduce(srcFinal, tgtFinal, foundation).catch(() => null);
      setRouteInfo(route);

      // Column 2: Source → Target
      const steps2 = [];
      if (source === 'PRG' && target === 'PRF') {
        try {
          const bits = queryHex || '0'.repeat(8);
          const tree = await api.prf.ggm_tree(
            keyHex.slice(0, 32).padEnd(32, '0'),
            bits.slice(0, 8).padEnd(8, '0')
          );
          steps2.push({ label: 'k (key)', fn: 'GGM root', value: keyHex.slice(0, 32), desc: 'Start at root' });
          (tree.path || []).forEach((p, i) => {
            steps2.push({ label: `Level ${i+1}`, fn: `G_${p.bit}`, value: p.node, desc: `bit ${p.bit}` });
          });
          steps2.push({ label: 'F_k(x)', fn: 'GGM leaf', value: tree.output, desc: 'PRF output' });
        } catch (e) {
          steps2.push({ label: 'PRG→PRF', fn: 'GGM Tree', value: 'Computing...', stub: false });
        }
      } else if (source === 'PRF' && target === 'MAC') {
        try {
          const m = queryHex || '0'.repeat(16);
          const r = await api.mac.sign(keyHex.slice(0, 32).padEnd(32, '0'), m.padEnd(16, '0'));
          steps2.push({ label: 'Mac_k(m)', fn: 'F_k(m)', value: r.tag, desc: 'PRF-MAC: tag = F_k(m)' });
        } catch (e) { steps2.push({ label: 'Error', fn: 'MAC', value: e.message, stub: true }); }
      } else {
        if (route && route.steps) {
          route.steps.forEach((s, i) => {
            steps2.push({ label: `Step ${i+1}`, fn: s, value: '(computed)', desc: route.theorem || '' });
          });
        } else {
          steps2.push({ label: `${source}→${target}`, fn: 'Reduction', value: `PA#${PA_NUMS[target] || '?'} Not yet run`, stub: !route?.supported });
        }
      }
      setReduceSteps(steps2);
    } finally {
      setLoading(false);
    }
  }, [foundation, source, target, keyHex, queryHex, direction]);

  useEffect(() => { runComputations(); }, [foundation, source, target, direction]);

  const handleKeyChange = (v) => { setKeyHex(v); };
  const handleQueryChange = (v) => { setQueryHex(v); };

  const proofChain = routeInfo ? [
    { primitive: foundation, theorem: 'Foundation', security: 'Assumed secure' },
    ...(routeInfo.steps || []).map((s, i) => ({
      primitive: s,
      theorem: routeInfo.theorem || '',
      security: i === 0 ? `Security of ${source} implies...` : `...security of ${target}`,
    }))
  ] : [];

  return (
    <div className="main-layout">
      {/* Top Bar */}
      <div className="top-bar">
        <h1>CS8.401 · Minicrypt Clique Explorer</h1>
        <div className="foundation-toggle">
          <button className={foundation==='AES'?'active':''} onClick={()=>setFoundation('AES')}>
            AES-128 (PRP)
          </button>
          <button className={foundation==='DLP'?'active':''} onClick={()=>setFoundation('DLP')}>
            DLP (g^x mod p)
          </button>
        </div>
        <span className="foundation-badge">Foundation: {foundation}</span>
        <div className="direction-toggle">
          <span>Direction:</span>
          <button className={direction==='forward'?'active':''} onClick={()=>setDirection('forward')}>
            Forward (A→B)
          </button>
          <button className={direction==='backward'?'active':''} onClick={()=>setDirection('backward')}>
            Backward (B→A)
          </button>
        </div>
        {loading && <div className="spinner" />}
      </div>

      {/* Two-Column Main */}
      <div className="two-column">
        <BuildPanel
          foundation={foundation}
          source={source}
          setSource={setSource}
          primitives={PRIMITIVES}
          keyHex={keyHex}
          setKeyHex={handleKeyChange}
          steps={buildSteps}
          onRun={runComputations}
        />
        <ReducePanel
          source={source}
          target={target}
          setTarget={setTarget}
          primitives={PRIMITIVES}
          queryHex={queryHex}
          setQueryHex={handleQueryChange}
          steps={reduceSteps}
          routeInfo={routeInfo}
          onRun={runComputations}
        />
      </div>

      {/* Proof Panel */}
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

      {/* Demo Tabs Section */}
      <DemoSection />
    </div>
  );
}
