import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import BuildPanel from './components/BuildPanel';
import ReducePanel from './components/ReducePanel';
import ProofPanel from './components/ProofPanel';
import DemoSection from './components/DemoSection';

function xorHex(a, b) {
  const len = Math.min(a.length, b.length);
  let out = '';
  for (let i = 0; i < len; i += 2) {
    out += (parseInt(a.slice(i, i+2), 16) ^ parseInt(b.slice(i, i+2), 16))
      .toString(16).padStart(2, '0');
  }
  return out;
}

const PRIMITIVES = ['OWF', 'OWP', 'PRG', 'PRF', 'PRP', 'MAC', 'CRHF', 'HMAC', 'CPA_ENC', 'CCA_ENC'];
const PA_NUMS = { OWF: 1, OWP: 1, PRG: 1, PRF: 2, PRP: 4, MAC: 5, CRHF: '7+8', HMAC: 10, CPA_ENC: 3, CCA_ENC: 6 };

export default function App() {
  const [foundation, setFoundation] = useState('AES');
  const [source, setSource]         = useState('PRG');
  const [target, setTarget]         = useState('PRF');
  const [keyHex, setKeyHex]         = useState('0123456789abcdef0123456789abcdef');
  const [queryHex, setQueryHex]     = useState('deadbeefcafe0000');
  const [direction, setDirection]   = useState('forward'); // forward | backward
  const [proofOpen, setProofOpen]   = useState(true);
  const [buildSteps, setBuildSteps] = useState([]);
  const [reduceSteps, setReduceSteps] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [routeInfo, setRouteInfo]   = useState(null);
  const [darkMode, setDarkMode]     = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [activeDemo, setActiveDemo] = useState({ id: 'home', label: null });

  // Keep source ≠ target at all times — prevents the React controlled-select
  // mismatch where the dropdown visually shows the first filtered option but
  // state never updates (causing srcN === tgtN in runComputations).
  useEffect(() => {
    if (source === target) {
      const next = PRIMITIVES.find(p => p !== source);
      if (next) setTarget(next);
    }
  }, [source]);

  useEffect(() => {
    if (target === source) {
      const next = PRIMITIVES.find(p => p !== target);
      if (next) setSource(next);
    }
  }, [target]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    root.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', darkMode);
    const t = setTimeout(() => root.classList.remove('theme-transitioning'), 320);
    return () => clearTimeout(t);
  }, [darkMode]);

  useEffect(() => {
    const moveCursorToEnd = (e) => {
      const t = e.target;
      if (t.tagName !== 'INPUT') return;
      const type = (t.getAttribute('type') || 'text').toLowerCase();
      if (type !== 'text') return;
      setTimeout(() => t.setSelectionRange(t.value.length, t.value.length), 0);
    };
    document.addEventListener('focus', moveCursorToEnd, true);
    return () => document.removeEventListener('focus', moveCursorToEnd, true);
  }, []);

  // Plain async function — redefined on every render so it always closes over the
  // current keyHex / queryHex / foundation / source / target / direction.
  const runComputations = async () => {
    // Clear stale steps immediately so old direction's values never persist
    setBuildSteps([]);
    setReduceSteps([]);

    const effKey = direction === 'backward' ? queryHex : keyHex;
    const effQuery = direction === 'backward' ? keyHex : queryHex;

    if (!effKey || !effKey.trim()) {
      return;
    }
    setLoading(true);

    try {
      const srcN = direction === 'backward' ? target : source;
      const tgtN = direction === 'backward' ? source : target;

      const k32  = (effKey || '').slice(0, 32).padEnd(32, '0');
      const k16  = (effKey || '').slice(0, 16).padEnd(16, '0');
      const qPad = (effQuery || '').padEnd(32, '0').slice(0, 32);
      const qShort = (effQuery || '').padEnd(16, '0').slice(0, 16);

      // ── Column 1: Foundation → Source ──────────────────────────────────────
      const steps1 = [];
      if (foundation === 'AES') {
        steps1.push({ label: 'AES key', fn: 'AES-128 PRP/PRF', value: k32, desc: 'Foundation (AES PRP/PRF)' });
        try {
          const r0 = await api.prf.evaluate(k32, '0'.repeat(32));
          if (srcN === 'OWF') {
            // Davies-Meyer: f(k) = AES_k(0^128) ⊕ k
            const owfOut = xorHex(r0.output, k32);
            steps1.push({ label: 'AES_k(0¹²⁸)', fn: 'AES encrypt', value: r0.output, desc: 'AES block evaluation' });
            steps1.push({ label: 'OWF(k)', fn: 'AES_k(0) ⊕ k', value: owfOut, desc: 'Davies-Meyer compression OWF' });
          } else if (srcN === 'PRG') {
            const r1 = await api.prf.evaluate(k32, '1'.repeat(32));
            steps1.push({ label: 'F_k(0)', fn: 'AES_k(0)', value: r0.output, desc: 'PRF evaluation at 0' });
            steps1.push({ label: 'PRG(s)', fn: 'F_k(0)‖F_k(1)', value: r0.output + r1.output, desc: 'Length-doubling PRG' });
          } else if (srcN === 'PRF') {
            steps1.push({ label: 'F_k(0)', fn: 'AES_k(0)', value: r0.output, desc: 'AES is directly a PRF' });
          } else if (srcN === 'PRP') {
            steps1.push({ label: 'AES_k(0)', fn: 'AES-128', value: r0.output, desc: 'AES is a PRP (block cipher)' });
          } else if (srcN === 'MAC') {
            steps1.push({ label: 'F_k(0)', fn: 'AES_k(0)', value: r0.output, desc: 'PRF basis for MAC' });
            const rm = await api.mac.sign(k32, qPad.slice(0, 32));
            steps1.push({ label: 'MAC_k(m)', fn: 'F_k(m)', value: rm.tag, desc: 'PRF-MAC: tag = AES_k(m)' });
          } else if (srcN === 'CRHF') {
            steps1.push({ label: 'F_k(0)', fn: 'PRF basis', value: r0.output, desc: 'PRF for MD compression' });
            const rmd = await api.hash.md(qShort);
            steps1.push({ label: 'H(m)', fn: 'MD[PRF]', value: rmd.digest, desc: 'Merkle-Damgård CRHF' });
          } else if (srcN === 'HMAC') {
            steps1.push({ label: 'F_k(0)', fn: 'PRF basis', value: r0.output, desc: 'Foundation for HMAC' });
            const rh = await api.hmac.sign(k16, qShort);
            steps1.push({ label: 'HMAC_k(m)', fn: 'H(k⊕opad‖H(k⊕ipad‖m))', value: rh.tag, desc: 'HMAC over PA#8 DLP hash' });
          } else if (srcN === 'OWP') {
            steps1.push({ label: 'AES_k(m)', fn: 'AES-128 PRP', value: r0.output, desc: 'AES is a PRP — a bijection on {0,1}¹²⁸, i.e. a one-way permutation' });
          } else if (srcN === 'CPA_ENC') {
            const rcpa = await api.enc.cpa(k32, qPad.slice(0, 32));
            steps1.push({ label: 'r (nonce)', fn: 'random', value: rcpa.r, desc: 'Random nonce r ← {0,1}ⁿ' });
            steps1.push({ label: 'CPA_Enc_k(m)', fn: 'F_k(r) ⊕ m', value: rcpa.ciphertext, desc: 'PRF → CPA: ciphertext = F_k(r) ⊕ m' });
          } else if (srcN === 'CCA_ENC') {
            const rcca = await api.cca.encrypt(k32, k32, qPad.slice(0, 32));
            steps1.push({ label: 'r', fn: 'CPA nonce', value: rcca.r, desc: 'CPA inner layer: r ← {0,1}ⁿ' });
            steps1.push({ label: 'c', fn: 'CPA_Enc_kE(m)', value: rcca.ciphertext, desc: 'CPA ciphertext' });
            steps1.push({ label: 't', fn: 'MAC_kM(r‖c)', value: rcca.tag, desc: 'Encrypt-then-MAC integrity tag → IND-CCA2' });
          }
        } catch (e) { steps1.push({ label: 'Error', fn: srcN, value: e.message, stub: true }); }
      } else {
        // DLP foundation
        const xInput = (effKey || '').slice(0, 16).padEnd(16, '0');
        steps1.push({ label: 'DLP input x', fn: 'g^x mod p', value: xInput, desc: 'Foundation (DLP OWF/OWP)' });
        try {
          const r = await api.owf.evaluate(xInput);
          const owfOut = r.output.replace(/^0x/, '');
          steps1.push({ label: 'OWF(x)', fn: 'g^x mod p', value: owfOut, desc: 'DLP one-way function output' });
          if (srcN === 'PRG') {
            const seedH = (effKey || '').slice(0, 8).padEnd(8, '0');
            const rp = await api.prg.generate(seedH, 16);
            steps1.push({ label: 'PRG(s)', fn: 'HILL hard-core bits', value: rp.output_hex, desc: `Iterative hard-core bit extraction (ratio: ${(rp.ones_ratio*100).toFixed(1)}%)` });
          } else if (srcN === 'CRHF') {
            const rdlp = await api.hash.dlp(qShort);
            steps1.push({ label: 'DLPHash(m)', fn: 'g^x·ĥ^y mod p', value: rdlp.digest, desc: 'DLP-based CRHF (PA#8)' });
          } else if (srcN === 'HMAC') {
            const rh = await api.hmac.sign(k16, qShort);
            steps1.push({ label: 'HMAC_k(m)', fn: 'DLP hash in HMAC', value: rh.tag, desc: 'HMAC over DLP hash (PA#10)' });
          } else if (srcN === 'OWP') {
            steps1.push({ label: 'OWP(x) = g^x mod p', fn: 'DLP OWP', value: owfOut, desc: 'g^x mod p is bijective on Z_q — directly a one-way permutation' });
          } else if (srcN === 'CPA_ENC') {
            steps1.push({ label: 'DLP OWF', fn: 'g^x mod p', value: owfOut, desc: 'Foundation: DLP OWF' });
            steps1.push({ label: 'OWF → PRG → PRF → CPA', fn: 'multi-hop chain', value: '(HILL + GGM + nonce-enc)', stub: true, desc: 'DLP OWF → HILL PRG → GGM PRF → CPA encryption' });
          } else if (srcN === 'CCA_ENC') {
            steps1.push({ label: 'DLP OWF', fn: 'g^x mod p', value: owfOut, desc: 'Foundation: DLP OWF' });
            steps1.push({ label: 'OWF → … → CCA', fn: 'multi-hop chain', value: '(HILL + GGM + EtM)', stub: true, desc: 'DLP OWF → HILL PRG → GGM PRF → CPA → Encrypt-then-MAC → IND-CCA2' });
          } else if (srcN !== 'OWF') {
            steps1.push({ label: srcN, fn: 'via OWF chain', value: '(multi-hop from DLP)', desc: `${srcN} built from DLP OWF via reduction chain` });
          }
        } catch (e) { steps1.push({ label: 'Error', fn: 'DLP OWF', value: e.message, stub: true }); }
      }
      setBuildSteps(steps1);

      // Derive the concrete source primitive key from Leg 1's final computed output.
      // Leg 2 uses this instead of the raw user key — "continuing from the source" means
      // the output of Column 1 is piped as the concrete implementation of A in Column 2.
      const buildFinalValue = steps1
        .filter(s => !s.stub && typeof s.value === 'string' && /^[0-9a-fA-F]{8,}$/.test(s.value))
        .slice(-1)[0]?.value ?? k32;
      const srcKey32 = buildFinalValue.slice(0, 32).padEnd(32, '0');
      const srcKey16 = srcKey32.slice(0, 16);

      // Routing table lookup
      const route = await api.reduce(srcN, tgtN, foundation).catch(() => null);
      setRouteInfo(route);

      // ── Column 2: Source → Target (live computations) ──────────────────────

      // Generic per-hop computation used by the BFS fallback.
      // Returns { steps: [...], outputKey32: string } where outputKey32 feeds the next hop.
      const computeHop = async (from, to, key32, k32raw) => {
        const key16 = key32.slice(0, 16);
        const steps = [];
        let outputKey32 = key32;

        if (from === 'OWF' && to === 'PRG') {
          const seedH = (k32raw || key32).slice(0, 8);
          const rp = await api.prg.generate(seedH, 32);
          steps.push({ label: 'HILL seed k', fn: 'OWF input key', value: k32raw || key32, desc: 'HILL PRG seed = OWF input key k' });
          steps.push({ label: 'PRG(k)', fn: 'HILL hardcore', value: rp.output_hex, desc: `Iterate OWF, extract hardcore bits (${(rp.ones_ratio*100).toFixed(1)}% ones)` });
          outputKey32 = rp.output_hex.slice(0, 32).padEnd(32, '0');
        } else if (from === 'OWF' && to === 'PRF') {
          const seedH = (k32raw || key32).slice(0, 8);
          const rp = await api.prg.generate(seedH, 32);
          steps.push({ label: 'OWF→PRG', fn: 'HILL hardcore', value: rp.output_hex, desc: `HILL: iterate OWF on key k (${(rp.ones_ratio*100).toFixed(1)}% ones)` });
          const tree = await api.prf.ggm_tree(key32, qShort.slice(0, 8));
          let lc = 0;
          (tree.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWF output from Leg 1' });
            } else {
              lc++;
              steps.push({ label: `Level ${lc}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM traverse bit ${p.bit}` });
            }
          });
          steps.push({ label: 'F_k(x)', fn: 'GGM leaf = PRF', value: tree.output, desc: 'PRF output via OWF-seeded GGM' });
          outputKey32 = tree.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'OWF' && to === 'MAC') {
          const seedM = (k32raw || key32).slice(0, 8);
          const rpM = await api.prg.generate(seedM, 32);
          steps.push({ label: 'OWF→PRG', fn: 'HILL hardcore', value: rpM.output_hex, desc: 'HILL: iterate OWF on key k → pseudorandom bits' });
          const treeM = await api.prf.ggm_tree(key32, qShort.slice(0, 8));
          let lcM = 0;
          (treeM.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWF key' });
            } else { lcM++; steps.push({ label: `Level ${lcM}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM bit ${p.bit}` }); }
          });
          steps.push({ label: 'OWF→PRF', fn: 'GGM leaf', value: treeM.output, desc: 'PRF via OWF-seeded GGM' });
          const rmM = await api.mac.sign(key32, qPad.slice(0, 32));
          steps.push({ label: 'MAC_k(m)', fn: 'PRF-MAC: F_k(m)', value: rmM.tag, desc: 'PRF-MAC: tag = F_k(m)' });
          outputKey32 = rmM.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'OWF' && to === 'HMAC') {
          const seedHM = (k32raw || key32).slice(0, 8);
          const rpHM = await api.prg.generate(seedHM, 32);
          steps.push({ label: 'OWF→PRG', fn: 'HILL hardcore', value: rpHM.output_hex, desc: 'HILL: iterate OWF on key k → pseudorandom bits' });
          const treeHM = await api.prf.ggm_tree(key32, qShort.slice(0, 8));
          let lcHM = 0;
          (treeHM.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWF key' });
            } else { lcHM++; steps.push({ label: `Level ${lcHM}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM bit ${p.bit}` }); }
          });
          steps.push({ label: 'OWF→PRF', fn: 'GGM leaf', value: treeHM.output, desc: 'PRF via OWF-seeded GGM' });
          const rmHM = await api.mac.sign(key32, qPad.slice(0, 32));
          steps.push({ label: 'MAC_k(m)', fn: 'PRF-MAC', value: rmHM.tag, desc: 'PRF-MAC: tag = F_k(m)' });
          const tagHM = await api.hmac.sign(key32.slice(0, 16), qShort);
          steps.push({ label: 'HMAC_k(m)', fn: 'H(k⊕opad‖H(k⊕ipad‖m))', value: tagHM.tag, desc: 'MAC → HMAC double-hash structure' });
          outputKey32 = tagHM.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'OWF' && to === 'CCA_ENC') {
          const seedCC = (k32raw || key32).slice(0, 8);
          const rpCC = await api.prg.generate(seedCC, 32);
          steps.push({ label: 'OWF→PRG', fn: 'HILL hardcore', value: rpCC.output_hex, desc: 'HILL: iterate OWF on key k → pseudorandom bits' });
          const treeCC = await api.prf.ggm_tree(key32, qShort.slice(0, 8));
          let lcCC = 0;
          (treeCC.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWF key' });
            } else { lcCC++; steps.push({ label: `Level ${lcCC}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM bit ${p.bit}` }); }
          });
          steps.push({ label: 'OWF→PRF', fn: 'GGM leaf', value: treeCC.output, desc: 'PRF via OWF-seeded GGM' });
          const rcpaCC = await api.enc.cpa(key32, qPad.slice(0, 32));
          steps.push({ label: 'r', fn: 'CPA nonce', value: rcpaCC.r, desc: 'Random nonce r ← {0,1}ⁿ for CPA layer' });
          steps.push({ label: 'CPA_Enc(m)', fn: 'F_k(r)⊕m', value: rcpaCC.ciphertext, desc: 'PRF → IND-CPA (PA#3)' });
          const rccaCC = await api.cca.encrypt(key32, key32, qPad.slice(0, 32));
          steps.push({ label: 't=MAC_k(r‖c)', fn: 'Enc-then-MAC', value: rccaCC.tag, desc: 'Encrypt-then-MAC → IND-CCA2 (PA#6)' });
          outputKey32 = (rccaCC.tag || key32).slice(0, 32).padEnd(32, '0');
        } else if (from === 'OWF' && to === 'OWP') {
          if (foundation === 'AES') {
            const r = await api.prf.evaluate(key32, qShort.padEnd(32, '0'));
            steps.push({ label: 'AES_k(x)', fn: 'AES-128 PRP', value: r.output, desc: 'AES with fixed key k is a bijection on {0,1}^128 — PRP = permutation' });
            steps.push({ label: 'OWP(x)', fn: 'PRP = bijective OWF', value: r.output, desc: 'AES_k is one-way and bijective → OWP. Davies-Meyer gives OWF, but AES itself is OWP.' });
            outputKey32 = r.output.slice(0, 32).padEnd(32, '0');
          } else {
            const r = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owfOut = r.output.replace(/^0x/, '');
            steps.push({ label: 'x ∈ Z_q', fn: 'domain', value: qShort.padEnd(16, '0'), desc: 'Input x ∈ Z_q' });
            steps.push({ label: 'g^x mod p', fn: 'DLP OWF', value: owfOut, desc: 'DLP OWF evaluation' });
            steps.push({ label: 'OWP(x)', fn: 'bijection on Z_q', value: owfOut, desc: 'g^x is bijective → OWP' });
            outputKey32 = owfOut.slice(0, 32).padEnd(32, '0');
          }
        } else if (from === 'OWF' && to === 'PRP') {
          // OWF → PRF (GGM) → PRP (Luby-Rackoff)
          const treeP = await api.prf.ggm_tree(key32, qShort.slice(0, 8));
          let lcP = 0;
          (treeP.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) steps.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWF key' });
            else { lcP++; steps.push({ label: `Level ${lcP}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM bit ${p.bit}` }); }
          });
          steps.push({ label: 'OWF→PRF', fn: 'GGM leaf', value: treeP.output, desc: 'PRF via OWF-seeded GGM' });
          const L0p = qPad.slice(0, 16), R0p = (qPad.slice(16, 32) || '').padEnd(16, '0');
          const rpp1 = await api.prf.evaluate(key32, L0p.padEnd(32, '0'));
          const R1p = xorHex(R0p, rpp1.output.slice(0, 16));
          const rpp2 = await api.prf.evaluate(key32, R1p.padEnd(32, '0'));
          const L1p = xorHex(L0p, rpp2.output.slice(0, 16));
          const rpp3 = await api.prf.evaluate(key32, L1p.padEnd(32, '0'));
          const R2p = xorHex(R1p, rpp3.output.slice(0, 16));
          steps.push({ label: 'Round 1', fn: 'R₁=R₀⊕F_k(L₀)', value: `R₁=${R1p.slice(0, 8)}…`, desc: 'Luby-Rackoff Feistel round 1' });
          steps.push({ label: 'Round 2', fn: 'L₁=L₀⊕F_k(R₁)', value: `L₁=${L1p.slice(0, 8)}…`, desc: 'Luby-Rackoff Feistel round 2' });
          steps.push({ label: 'PRP_k(x)', fn: 'L₁‖R₂', value: L1p + R2p, desc: '3-round Luby-Rackoff PRP from OWF' });
          outputKey32 = (L1p + R2p).slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRG' && to === 'PRF') {
          const tree = await api.prf.ggm_tree(key32, qShort.slice(0, 8));
          let lc = 0;
          (tree.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = PRG output (source key)' });
            } else {
              lc++;
              steps.push({ label: `Level ${lc}`, fn: `G_${p.bit}`, value: p.node, desc: `Traverse bit ${p.bit}` });
            }
          });
          steps.push({ label: 'F_k(x)', fn: 'GGM leaf', value: tree.output, desc: 'PRF output at query x' });
          outputKey32 = tree.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRG' && to === 'OWF') {
          steps.push({ label: 'G(s)', fn: 'PRG output', value: key32, desc: 'PRG output G(s) — one-way by OWF hardness' });
          steps.push({ label: 'OWF hardness', fn: 'G is OWF', value: 'inverting G(s) ⇒ inverting the underlying OWF', stub: true, desc: 'HILL contrapositive' });
          outputKey32 = key32;
        } else if (from === 'PRG' && to === 'OWP') {
          if (foundation === 'AES') {
            steps.push({ label: 'G(s)', fn: 'PRG output', value: key32, desc: 'AES-based PRG output' });
            const rOWP = await api.prf.evaluate(key32, qPad.slice(0, 32));
            steps.push({ label: 'PRG→PRF→PRP', fn: 'switching lemma', value: rOWP.output, desc: 'AES PRP with fixed key is OWP' });
            outputKey32 = rOWP.output.slice(0, 32).padEnd(32, '0');
          } else {
            steps.push({ label: 'G(s)', fn: 'HILL PRG', value: key32, desc: 'HILL PRG output' });
            const rcOWP = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owpOut = rcOWP.output.replace(/^0x/, '');
            steps.push({ label: 'OWP(x)=g^x mod p', fn: 'DLP OWP', value: owpOut, desc: 'DLP: g^x mod p is bijective on Z_q' });
            outputKey32 = owpOut.slice(0, 32).padEnd(32, '0');
          }
        } else if (from === 'PRF' && to === 'PRP') {
          const L0 = qPad.slice(0, 16), R0 = (qPad.slice(16, 32) || '').padEnd(16, '0');
          const rr1 = await api.prf.evaluate(key32, L0.padEnd(32, '0'));
          const R1 = xorHex(R0, rr1.output.slice(0, 16));
          const rr2 = await api.prf.evaluate(key32, R1.padEnd(32, '0'));
          const L1 = xorHex(L0, rr2.output.slice(0, 16));
          const rr3 = await api.prf.evaluate(key32, L1.padEnd(32, '0'));
          const R2 = xorHex(R1, rr3.output.slice(0, 16));
          steps.push({ label: 'Round 1', fn: 'R₁=R₀⊕F_k(L₀)', value: `L₀=${L0.slice(0,8)}… R₁=${R1.slice(0,8)}…`, desc: 'Luby-Rackoff Feistel round 1' });
          steps.push({ label: 'Round 2', fn: 'L₁=L₀⊕F_k(R₁)', value: `L₁=${L1.slice(0,8)}… R₁=${R1.slice(0,8)}…`, desc: 'Feistel round 2' });
          steps.push({ label: 'Round 3', fn: 'R₂=R₁⊕F_k(L₁)', value: `L₁=${L1.slice(0,8)}… R₂=${R2.slice(0,8)}…`, desc: 'Feistel round 3 → Luby-Rackoff PRP' });
          steps.push({ label: 'PRP(x)', fn: 'L₁‖R₂', value: L1 + R2, desc: '3-round PRP output' });
          outputKey32 = (L1 + R2).slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRF' && to === 'MAC') {
          const r = await api.mac.sign(key32, qPad.slice(0, 32));
          steps.push({ label: 'MAC_k(m)', fn: 'F_k(m)', value: r.tag, desc: 'PRF-MAC: tag = F_k(m)' });
          outputKey32 = r.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRF' && to === 'CRHF') {
          steps.push({ label: 'PRF key k', fn: 'compression key', value: key32, desc: 'PRF key as MD compression function key' });
          const rmd = await api.hash.md(qShort);
          const chain = rmd?.chain || [];
          chain.forEach((entry, i) => {
            if (i === 0) steps.push({ label: 'IV = 0ⁿ', fn: 'init', value: entry[1], desc: 'MD init vector' });
            else steps.push({ label: `z${i}`, fn: `h(z${i-1},M${i})`, value: entry[2] || entry[1], desc: `Compress block ${i}` });
          });
          steps.push({ label: 'H(m)', fn: 'MD[PRF]', value: rmd.digest, desc: 'CRHF output' });
          outputKey32 = rmd.digest.slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRF' && to === 'PRG') {
          const r0 = await api.prf.evaluate(key32, '0'.repeat(32));
          const r1 = await api.prf.evaluate(key32, '1'.repeat(32));
          steps.push({ label: 'F_k(0)', fn: 'PRF eval', value: r0.output, desc: 'PRG left half' });
          steps.push({ label: 'F_k(1)', fn: 'PRF eval', value: r1.output, desc: 'PRG right half' });
          steps.push({ label: 'G(k)', fn: 'F_k(0)‖F_k(1)', value: r0.output + r1.output, desc: 'Length-doubling PRG from PRF' });
          outputKey32 = (r0.output + r1.output).slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRF' && to === 'OWF') {
          const r = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'F_k(x)', fn: 'AES_k(x)', value: r.output, desc: 'PRF with fixed key is one-way' });
          steps.push({ label: 'OWF(x)', fn: 'F_k = OWF', value: r.output, desc: 'Guessing x from F_k(x) would break PRF security' });
          outputKey32 = r.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRF' && to === 'OWP') {
          const r = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'F_k(x)', fn: 'AES_k(x)', value: r.output, desc: 'AES PRF is a OWP: bijective PRP with fixed key' });
          steps.push({ label: 'OWP(x)', fn: 'F_k = OWP', value: r.output, desc: 'AES PRP with fixed key is a bijective one-way function' });
          outputKey32 = r.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRF' && to === 'CPA_ENC') {
          const rcpa = await api.enc.cpa(key32, qPad.slice(0, 32));
          steps.push({ label: 'r', fn: 'nonce', value: rcpa.r, desc: 'Random nonce r ← {0,1}ⁿ' });
          steps.push({ label: 'CPA_Enc(m)', fn: 'F_k(r) ⊕ m', value: rcpa.ciphertext, desc: 'PRF → CPA: ciphertext = F_k(r) ⊕ m' });
          outputKey32 = (rcpa.ciphertext || key32).slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRP' && to === 'PRF') {
          const r = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'PRP_k(x)', fn: 'AES eval', value: r.output, desc: 'PRP ≈ PRF (switching lemma adv ≤ q²/2ⁿ⁺¹)' });
          steps.push({ label: 'F_k(x)', fn: 'PRF oracle', value: r.output, desc: 'PRP indistinguishable from PRF on super-poly domain' });
          outputKey32 = r.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRP' && to === 'MAC') {
          const r = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'PRP_k(m)', fn: 'AES eval', value: r.output, desc: 'PRP/PRF switching lemma' });
          steps.push({ label: 'MAC_k(m)', fn: 'F_k(m)', value: r.output, desc: 'PRF-MAC with PRP as PRF oracle' });
          outputKey32 = r.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRP' && to === 'PRG') {
          const r0 = await api.prf.evaluate(key32, '0'.repeat(32));
          const r1 = await api.prf.evaluate(key32, '1'.repeat(32));
          steps.push({ label: 'PRP_k(0)', fn: 'AES_k(0)', value: r0.output, desc: 'PRP at 0 (indist. from PRF by switching lemma)' });
          steps.push({ label: 'PRP_k(1)', fn: 'AES_k(1)', value: r1.output, desc: 'PRP at 1' });
          steps.push({ label: 'G(k)', fn: 'PRP(0)‖PRP(1)', value: r0.output + r1.output, desc: 'PRP ≈ PRF → length-doubling PRG' });
          outputKey32 = (r0.output + r1.output).slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRP' && to === 'OWF') {
          const r = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'PRP_k(x)', fn: 'AES_k(x)', value: r.output, desc: 'PRP is bijective OWF (OWP)' });
          steps.push({ label: 'OWF(x)', fn: 'PRP = OWP ⊇ OWF', value: r.output, desc: 'Any PRP inverter is an OWF inverter' });
          outputKey32 = r.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'PRP' && to === 'OWP') {
          const r = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'PRP_k(x)', fn: 'AES_k(x)', value: r.output, desc: 'PRP with fixed key k is a bijection on {0,1}ⁿ' });
          steps.push({ label: 'OWP(x)', fn: 'PRP = OWP', value: r.output, desc: 'Bijective PRP is an OWP: any PRP-inverter finds preimages' });
          outputKey32 = r.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'MAC' && to === 'PRF') {
          const r = await api.mac.sign(key32, qPad.slice(0, 32));
          steps.push({ label: 'MAC_k(m)', fn: 'PRF oracle', value: r.tag, desc: 'EUF-CMA MAC on uniform messages is a PRF' });
          outputKey32 = r.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'MAC' && to === 'PRG') {
          const r0 = await api.mac.sign(key32, '0'.repeat(32));
          const r1 = await api.mac.sign(key32, '1'.repeat(32));
          steps.push({ label: 'MAC_k(0)', fn: 'F_k(0)', value: r0.tag, desc: 'MAC as PRF oracle at 0' });
          steps.push({ label: 'MAC_k(1)', fn: 'F_k(1)', value: r1.tag, desc: 'MAC as PRF oracle at 1' });
          steps.push({ label: 'G(k)', fn: 'F_k(0)‖F_k(1)', value: r0.tag + r1.tag, desc: 'MAC → PRG via PRF → length-doubling' });
          outputKey32 = (r0.tag + r1.tag).slice(0, 32).padEnd(32, '0');
        } else if (from === 'MAC' && to === 'OWF') {
          const r = await api.mac.sign(key32, qPad.slice(0, 32));
          steps.push({ label: 'MAC_k(m)', fn: 'F_k(m)', value: r.tag, desc: 'EUF-CMA MAC is one-way' });
          steps.push({ label: 'OWF(m)', fn: 'MAC = OWF', value: r.tag, desc: 'Inverting MAC_k(m)→m would break EUF-CMA' });
          outputKey32 = r.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'MAC' && to === 'PRP') {
          const rm = await api.mac.sign(key32, qPad.slice(0, 32));
          const rp = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'MAC_k(m)', fn: 'CBC-MAC tag', value: rm.tag, desc: 'MAC uses AES (PRP) as block cipher' });
          steps.push({ label: 'PRP_k(m)', fn: 'AES eval', value: rp.output, desc: 'MAC forgery ⇒ PRP distinguisher' });
          steps.push({ label: 'PRP break', fn: 'adv ≥ ε_MAC', value: `adv ≥ ε_MAC`, stub: true });
          outputKey32 = rp.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'MAC' && to === 'HMAC') {
          const tag = await api.hmac.sign(key16, qShort);
          steps.push({ label: 'MAC inner', fn: 'F_k(m)', value: tag.tag.slice(0, 24) + '…', desc: 'MAC as inner compression step' });
          steps.push({ label: 'HMAC_k(m)', fn: 'double-hash', value: tag.tag, desc: 'MAC → HMAC double-hash structure' });
          outputKey32 = tag.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'MAC' && to === 'OWP') {
          const rmOP = await api.mac.sign(key32, qPad.slice(0, 32));
          steps.push({ label: 'MAC_k(m)', fn: 'PRF-MAC', value: rmOP.tag, desc: 'MAC as PRF oracle' });
          const roOP = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'OWP(x)', fn: 'PRF = OWP', value: roOP.output, desc: 'PRF with fixed key is bijective OWP (PRP with fixed key)' });
          outputKey32 = roOP.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'MAC' && to === 'CRHF') {
          steps.push({ label: 'MAC key k', fn: 'compression key', value: key32, desc: 'MAC key as MD compression function key' });
          const rmd = await api.hash.md(qShort);
          steps.push({ label: 'h(cv, block)', fn: 'MAC compress', value: rmd.digest.slice(0, 16) + '…', desc: 'MAC as MD compression function' });
          steps.push({ label: 'MD[MAC](m)', fn: 'Merkle-Damgård', value: rmd.digest, desc: 'MD transform → CRHF' });
          outputKey32 = rmd.digest.slice(0, 32).padEnd(32, '0');
        } else if (from === 'CRHF' && to === 'HMAC') {
          const tag = await api.hmac.sign(key16, qShort);
          steps.push({ label: 'inner', fn: 'H(k⊕ipad‖m)', value: tag.tag.slice(0, 24) + '…', desc: 'Inner hash with ipad' });
          steps.push({ label: 'HMAC_k(m)', fn: 'H(k⊕opad‖inner)', value: tag.tag, desc: 'CRHF → HMAC construction' });
          outputKey32 = tag.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'CRHF' && to === 'PRF') {
          const rmd = await api.hash.md(qShort);
          const chain = rmd?.chain || [];
          chain.forEach((entry, i) => {
            if (i === 0) steps.push({ label: 'IV = 0ⁿ', fn: 'init', value: entry[1], desc: 'MD init' });
            else steps.push({ label: `z${i}`, fn: `h(z${i-1},M${i})`, value: entry[2] || entry[1], desc: `Compress block ${i}` });
          });
          steps.push({ label: 'collision ⇒ PRF break', fn: 'h=PRF', value: rmd.digest, stub: true, desc: 'CRHF compression → PRF' });
          outputKey32 = rmd.digest.slice(0, 32).padEnd(32, '0');
        } else if (from === 'CRHF' && to === 'MAC') {
          const tag = await api.hmac.sign(key16, qShort);
          steps.push({ label: 'HMAC_k(m)', fn: 'CRHF → HMAC → MAC', value: tag.tag, desc: 'CRHF → HMAC → MAC chain' });
          outputKey32 = tag.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'HMAC' && to === 'MAC') {
          const tag = await api.hmac.sign(key16, qShort);
          steps.push({ label: 'HMAC_k(m)', fn: 'EUF-CMA MAC', value: tag.tag, desc: 'HMAC is directly a secure MAC' });
          outputKey32 = tag.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'HMAC' && to === 'CRHF') {
          const tag = await api.hmac.sign(key16, qShort);
          steps.push({ label: "H'(m)", fn: 'HMAC_k(m)', value: tag.tag, desc: "Fix key k; H'(m) = HMAC_k(m) is CR" });
          outputKey32 = tag.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'HMAC' && to === 'OWF') {
          const tagOF = await api.hmac.sign(key16, qShort);
          steps.push({ label: 'HMAC_k(m)', fn: 'double-hash', value: tagOF.tag, desc: 'HMAC_k(m) — EUF-CMA secure MAC' });
          steps.push({ label: 'OWF(m)', fn: 'HMAC = OWF', value: tagOF.tag, desc: 'Inverting HMAC_k(m)→m would break EUF-CMA security' });
          outputKey32 = tagOF.tag.slice(0, 32).padEnd(32, '0');
        } else if (from === 'HMAC' && to === 'OWP') {
          const tagOP = await api.hmac.sign(key16, qShort);
          steps.push({ label: 'HMAC_k(m)', fn: 'double-hash', value: tagOP.tag, desc: 'HMAC → MAC → PRF chain' });
          const rOP = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'OWP(x)', fn: 'PRF=OWP', value: rOP.output, desc: 'PRF with fixed key is bijective OWP (PRP = OWP)' });
          outputKey32 = rOP.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'OWP' && to === 'OWF') {
          if (foundation === 'AES') {
            const r = await api.prf.evaluate(key32, qPad.slice(0, 32));
            steps.push({ label: 'OWP(x)=AES_k(x)', fn: 'AES-128 PRP', value: r.output, desc: 'AES OWP at query x' });
            steps.push({ label: 'OWF(x)', fn: 'OWP ⊆ OWF', value: r.output, desc: 'Any OWP inverter is an OWF inverter' });
            outputKey32 = r.output.slice(0, 32).padEnd(32, '0');
          } else {
            const r = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owfOut = r.output.replace(/^0x/, '');
            steps.push({ label: 'OWP(x)=g^x mod p', fn: 'DLP OWP', value: owfOut, desc: 'DLP OWP = bijective OWF on Z_q' });
            steps.push({ label: 'OWF(x)', fn: 'OWP ⊆ OWF', value: owfOut, desc: 'Same hardness: OWP inverter ⇒ OWF inverter' });
            outputKey32 = owfOut.slice(0, 32).padEnd(32, '0');
          }
        } else if (from === 'OWP' && to === 'PRG') {
          if (foundation === 'AES') {
            steps.push({ label: 'OWP key', fn: 'AES-128 PRP', value: key32, desc: 'AES OWP from Leg 1' });
            const r0 = await api.prf.evaluate(key32, '0'.repeat(32));
            const r1 = await api.prf.evaluate(key32, '1'.repeat(32));
            steps.push({ label: 'G(k)', fn: 'F_k(0)‖F_k(1)', value: r0.output + r1.output, desc: 'OWP → PRF → PRG' });
            outputKey32 = (r0.output + r1.output).slice(0, 32).padEnd(32, '0');
          } else {
            const rc = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owfOut = rc.output.replace(/^0x/, '');
            steps.push({ label: 'OWP(x)', fn: 'g^x mod p', value: owfOut, desc: 'DLP OWP' });
            const rpC = await api.prg.generate(key32.slice(0, 8), 32);
            steps.push({ label: 'PRG(s)', fn: 'HILL', value: rpC.output_hex, desc: 'HILL PRG from OWP' });
            outputKey32 = rpC.output_hex.slice(0, 32).padEnd(32, '0');
          }
        } else if (from === 'OWP' && to === 'PRF') {
          if (foundation === 'DLP') {
            const rd = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owfOut = rd.output.replace(/^0x/, '');
            steps.push({ label: 'OWP(x)', fn: 'g^x mod p', value: owfOut, desc: 'DLP OWP evaluated at query x' });
          } else {
            steps.push({ label: 'OWP=AES', fn: 'AES-128 PRP', value: key32, desc: 'AES OWP = PRP with fixed key' });
          }
          const treeD = await api.prf.ggm_tree(key32, qShort.slice(0, 8));
          let lcD = 0;
          (treeD.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWP key' });
            } else {
              lcD++;
              steps.push({ label: `Level ${lcD}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM bit ${p.bit}` });
            }
          });
          steps.push({ label: 'F_k(x)', fn: 'GGM leaf = PRF', value: treeD.output, desc: 'PRF via GGM from OWP' });
          outputKey32 = treeD.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'CPA_ENC' && to === 'CCA_ENC') {
          const rcca = await api.cca.encrypt(key32, key32, qPad.slice(0, 32));
          steps.push({ label: 'r', fn: 'CPA nonce', value: rcca.r, desc: 'Random nonce for CPA layer' });
          steps.push({ label: 'c', fn: 'CPA_Enc_kE(m)', value: rcca.ciphertext, desc: 'CPA ciphertext' });
          steps.push({ label: 't', fn: 'MAC_kM(r‖c)', value: rcca.tag, desc: 'Encrypt-then-MAC → IND-CCA2' });
          outputKey32 = (rcca.tag || key32).slice(0, 32).padEnd(32, '0');
        } else if (from === 'CPA_ENC' && to === 'PRF') {
          const rcpa = await api.enc.cpa(key32, qPad.slice(0, 32));
          steps.push({ label: 'r', fn: 'CPA nonce', value: rcpa.r, desc: 'Nonce r ← {0,1}ⁿ' });
          steps.push({ label: 'c', fn: 'CPA ciphertext', value: rcpa.ciphertext, desc: 'IND-CPA break → PRF distinguisher' });
          steps.push({ label: 'PRF break', fn: 'adv ≥ ε_CPA−q²/2ⁿ', value: `adv ≥ ε_CPA − q²/2ⁿ`, stub: true });
          outputKey32 = key32;
        } else if (from === 'CCA_ENC' && to === 'CPA_ENC') {
          const rcca = await api.cca.encrypt(key32, key32, qPad.slice(0, 32));
          steps.push({ label: 'r', fn: 'inner nonce', value: rcca.r, desc: 'CPA layer nonce (inside CCA)' });
          steps.push({ label: 'c', fn: 'CPA_Enc(m)', value: rcca.ciphertext, desc: 'CCA2 ⊃ CPA — dropping MAC reveals CPA layer' });
          steps.push({ label: 't', fn: 'MAC tag', value: rcca.tag, desc: 'MAC tag (visible in CCA game)' });
          outputKey32 = key32;
        } else if (from === 'CCA_ENC' && to === 'OWF') {
          const rCCAowf = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'F_k(x)', fn: 'AES_k(x)', value: rCCAowf.output, desc: 'CCA-secure enc ⊃ PRF: use inner PRF key as OWF' });
          steps.push({ label: 'OWF(x)', fn: 'F_k = OWF', value: rCCAowf.output, desc: 'Inverting CCA-secure key would invert the underlying OWF' });
          outputKey32 = rCCAowf.output.slice(0, 32).padEnd(32, '0');
        } else if (from === 'CCA_ENC' && to === 'OWP') {
          const rCCAowp = await api.prf.evaluate(key32, qPad.slice(0, 32));
          steps.push({ label: 'F_k(x)', fn: 'AES_k(x)', value: rCCAowp.output, desc: 'CCA-secure enc ⊃ PRF ⊃ PRP: use AES as OWP' });
          steps.push({ label: 'OWP(x)', fn: 'PRF = OWP', value: rCCAowp.output, desc: 'AES PRP with fixed key k is bijective → OWP' });
          outputKey32 = rCCAowp.output.slice(0, 32).padEnd(32, '0');
        } else {
          steps.push({ label: `${from}→${to}`, fn: 'reduction', value: `${from} → ${to}`, stub: true });
          outputKey32 = key32;
        }

        return { steps, outputKey32 };
      };

      const steps2 = [];
      try {
        if (srcN === 'PRG' && tgtN === 'PRF') {
          const bits = effQuery || '0'.repeat(8);
          const tree = await api.prf.ggm_tree(srcKey32, bits.slice(0, 8).padEnd(8, '0'));
          let levelCounter = 0;
          (tree.path || []).forEach((p) => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root seeded from Leg 1 PRG output' });
            } else {
              levelCounter++;
              steps2.push({ label: `Level ${levelCounter}`, fn: `G_${p.bit}`, value: p.node, desc: `Traverse bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'F_k(x)', fn: 'GGM leaf', value: tree.output, desc: 'PRF output at leaf' });

        } else if (srcN === 'PRF' && tgtN === 'MAC') {
          const r = await api.mac.sign(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'Mac_k(m)', fn: 'F_k(m)', value: r.tag, desc: 'PRF-MAC: tag = F_k(m)' });

        } else if (srcN === 'OWF' && tgtN === 'PRG') {
          const seedH = k32.slice(0, 8);
          const rp = await api.prg.generate(seedH, 32);
          steps2.push({ label: 'seed s = k', fn: 'OWF input key', value: k32, desc: 'HILL seed = Leg 1 OWF input key k — same seed used in Build panel' });
          steps2.push({ label: 's₁=f(s), s₂=f(s₁)…', fn: 'OWF iterations', value: rp.output_hex.slice(0, 32) + '…', desc: 'Apply OWF repeatedly to build sequence s₁, s₂, …' });
          steps2.push({ label: 'PRG(s)', fn: 'b(s₁)‖b(s₂)‖…', value: rp.output_hex, desc: `HILL: extract hard-core bit b(sᵢ) per iteration (${(rp.ones_ratio*100).toFixed(1)}% ones)` });

        } else if (srcN === 'PRF' && tgtN === 'PRP') {
          const L0 = qPad.slice(0, 16), R0 = qPad.slice(16, 32) || '0'.repeat(16);
          const r1 = await api.prf.evaluate(srcKey32, L0.padEnd(32, '0'));
          const R1 = xorHex(R0, r1.output.slice(0, 16));
          const r2 = await api.prf.evaluate(srcKey32, R1.padEnd(32, '0'));
          const L1 = xorHex(L0, r2.output.slice(0, 16));
          const r3 = await api.prf.evaluate(srcKey32, L1.padEnd(32, '0'));
          const R2 = xorHex(R1, r3.output.slice(0, 16));
          steps2.push({ label: 'Round 1', fn: `R₁ = R₀ ⊕ F_k(L₀)`, value: `L₀=${L0.slice(0,8)}… R₁=${R1.slice(0,8)}…`, desc: 'Feistel round 1: swap & XOR with PRF output' });
          steps2.push({ label: 'Round 2', fn: `L₁ = L₀ ⊕ F_k(R₁)`, value: `L₁=${L1.slice(0,8)}… R₁=${R1.slice(0,8)}…`, desc: 'Feistel round 2' });
          steps2.push({ label: 'Round 3', fn: `R₂ = R₁ ⊕ F_k(L₁)`, value: `L₁=${L1.slice(0,8)}… R₂=${R2.slice(0,8)}…`, desc: 'Feistel round 3 — Luby-Rackoff: 3 rounds → secure PRP' });
          steps2.push({ label: 'PRP_k(x)', fn: 'L₁ ‖ R₂', value: L1 + R2, desc: '3-round Luby-Rackoff PRP output' });

        } else if (srcN === 'PRF' && tgtN === 'CPA_ENC') {
          const rcpa = await api.enc.cpa(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'r', fn: 'random nonce', value: rcpa.r, desc: 'r ← {0,1}ⁿ chosen uniformly at random' });
          steps2.push({ label: 'CPA_Enc_k(m)', fn: 'F_k(r) ⊕ m', value: rcpa.ciphertext, desc: 'PRF → IND-CPA: breaking CPA with advantage ε implies PRF distinguisher with ε − q²/2ⁿ' });

        } else if (srcN === 'PRP' && tgtN === 'MAC') {
          const r = await api.prf.evaluate(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'PRP_k(m)', fn: 'AES eval', value: r.output, desc: 'PRP/PRF switching lemma (adv ≤ q²/2ⁿ⁺¹)' });
          steps2.push({ label: 'MAC_k(m)', fn: 'F_k(m)', value: r.output, desc: 'PRF-MAC with AES as PRP≈PRF' });

        } else if (srcN === 'PRF' && tgtN === 'CRHF') {
          steps2.push({ label: 'PRF key k', fn: 'compression key', value: srcKey32, desc: 'PRF key from Leg 1 — acts as the Merkle-Damgård compression function key' });
          const rmd = await api.hash.md(qShort);
          const chain = rmd?.chain || [];
          chain.forEach((entry, i) => {
            if (i === 0) steps2.push({ label: 'IV = 0ⁿ', fn: 'init', value: entry[1], desc: 'Merkle-Damgård initialisation vector' });
            else steps2.push({ label: `z${i}`, fn: `h(z${i-1},M${i})`, value: entry[2] || entry[1], desc: `PRF(k, zᵢ₋₁ ‖ Mᵢ) = compress block ${i}` });
          });
          steps2.push({ label: 'H(m)', fn: 'MD[PRF] output', value: rmd.digest, desc: 'CRHF: collision in H → collision in compression fn h → breaks PRF' });

        } else if (srcN === 'CRHF' && tgtN === 'HMAC') {
          const tag = await api.hmac.sign(srcKey16, qShort);
          steps2.push({ label: 'inner', fn: 'H(k⊕ipad‖m)', value: tag.tag.slice(0, 24) + '…', desc: 'Inner hash with ipad' });
          steps2.push({ label: 'HMAC_k(m)', fn: 'H(k⊕opad‖inner)', value: tag.tag, desc: 'CRHF → HMAC construction (PA#10)' });

        } else if (srcN === 'HMAC' && tgtN === 'MAC') {
          const tag = await api.hmac.sign(srcKey16, qShort);
          steps2.push({ label: 'HMAC_k(m)', fn: 'EUF-CMA MAC', value: tag.tag, desc: 'HMAC is directly a secure MAC' });

        } else if (srcN === 'PRF' && tgtN === 'PRG') {
          // backward: G(s) = F_s(0ⁿ) ‖ F_s(1ⁿ); key is the PRF key from Leg 1
          const r0 = await api.prf.evaluate(srcKey32, '0'.repeat(32));
          const r1 = await api.prf.evaluate(srcKey32, '1'.repeat(32));
          steps2.push({ label: 'F_s(0ⁿ)', fn: 'PRF eval 0', value: r0.output, desc: 'Left half' });
          steps2.push({ label: 'F_s(1ⁿ)', fn: 'PRF eval 1', value: r1.output, desc: 'Right half' });
          steps2.push({ label: 'G(s)', fn: 'F_s(0)‖F_s(1)', value: r0.output + r1.output, desc: 'Length-doubling PRG from PRF' });

        } else if (srcN === 'PRP' && tgtN === 'PRF') {
          const r = await api.prf.evaluate(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'PRP_k(x)', fn: 'AES eval', value: r.output, desc: 'PRP/PRF switching lemma (adv ≤ q²/2ⁿ⁺¹)' });
          steps2.push({ label: 'F_k(x)', fn: 'PRF oracle', value: r.output, desc: 'PRP ≈ PRF on super-poly domain' });

        } else if (srcN === 'MAC' && tgtN === 'PRF') {
          const r = await api.mac.sign(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'MAC_k(m)', fn: 'PRF oracle', value: r.tag, desc: 'EUF-CMA MAC on uniform messages is a PRF' });

        } else if (srcN === 'HMAC' && tgtN === 'CRHF') {
          const tag = await api.hmac.sign(srcKey16, qShort);
          steps2.push({ label: "H'(m)", fn: 'HMAC_k(m)', value: tag.tag, desc: "Fix key k; H'(m)=HMAC_k(m) is collision-resistant" });

        } else if (srcN === 'MAC' && tgtN === 'CRHF') {
          steps2.push({ label: 'MAC key k', fn: 'compression key', value: srcKey32, desc: 'MAC key from Leg 1 — MAC acts as compression function h(cv, block) = F_k(cv ‖ block)' });
          const rmd = await api.hash.md(qShort);
          steps2.push({ label: 'h(cv, block)', fn: 'MAC compress', value: rmd.digest.slice(0, 16) + '…', desc: 'MAC compression function applied to chaining value + message block' });
          steps2.push({ label: 'MD[MAC](m)', fn: 'Merkle-Damgård', value: rmd.digest, desc: 'Apply MD transform to MAC compression function → CRHF (PA#7)' });

        } else if (srcN === 'MAC' && tgtN === 'HMAC') {
          const tag = await api.hmac.sign(srcKey16, qShort);
          steps2.push({ label: 'MAC inner', fn: 'F_k(m)', value: tag.tag.slice(0, 24) + '…', desc: 'PRF-MAC as inner compression step' });
          steps2.push({ label: 'HMAC_k(m)', fn: 'double-hash', value: tag.tag, desc: 'PRF-MAC fits HMAC double-hash structure' });

        } else if (srcN === 'PRG' && tgtN === 'OWF') {
          steps2.push({ label: 'G(s)', fn: 'PRG output', value: srcKey32, desc: 'Leg 1 PRG output G(s) — same value computed in Build panel' });
          steps2.push({ label: 'OWF hardness', fn: 'G(s) is one-way', value: 'recovering seed s from G(s) ⇒ inverting the underlying OWF', stub: true, desc: 'Contrapositive of HILL: if OWF is hard to invert, G is hard to invert → PRG is a OWF' });

        } else if (srcN === 'OWP' && tgtN === 'OWF') {
          if (foundation === 'AES') {
            const r = await api.prf.evaluate(srcKey32, qPad.slice(0, 32));
            steps2.push({ label: 'OWP(x)=AES_k(x)', fn: 'AES-128 PRP', value: r.output, desc: 'AES OWP (Leg 1 key) evaluated at query x — bijective block cipher' });
            steps2.push({ label: 'OWF(x)', fn: 'OWP ⊆ OWF', value: r.output, desc: 'OWP is a bijective OWF: any OWP inverter is an OWF inverter' });
          } else {
            const r = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owfOut = r.output.replace(/^0x/, '');
            steps2.push({ label: 'OWP(x) = g^x mod p', fn: 'DLP OWP', value: owfOut, desc: 'OWP is bijective on Z_q — already a one-way function by definition' });
            steps2.push({ label: 'OWF(x)', fn: 'OWP ⊆ OWF', value: owfOut, desc: 'Any OWP inverter is an OWF inverter: same function, same hardness' });
          }

        } else if (srcN === 'CPA_ENC' && tgtN === 'PRF') {
          const rcpa = await api.enc.cpa(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'r', fn: 'CPA nonce', value: rcpa.r, desc: 'Nonce r chosen uniformly at random' });
          steps2.push({ label: 'c = F_k(r) ⊕ m', fn: 'CPA ciphertext', value: rcpa.ciphertext, desc: 'IND-CPA adversary distinguishes c from uniform → PRF distinguisher' });
          steps2.push({ label: 'PRF break', fn: 'dist(F_k(r), U)', value: `adv ≥ ε_CPA − q²/2ⁿ`, stub: true, desc: 'CPA distinguisher feeds queries to PRF oracle and detects non-randomness' });

        } else if (srcN === 'CCA_ENC' && tgtN === 'CPA_ENC') {
          const rcca = await api.cca.encrypt(srcKey32, srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'r', fn: 'inner CPA nonce', value: rcca.r, desc: 'CPA layer nonce inside CCA scheme' });
          steps2.push({ label: 'c', fn: 'CPA_Enc_kE(m)', value: rcca.ciphertext, desc: 'CPA ciphertext — IND-CCA2 ⊃ IND-CPA: dropping MAC reveals CPA layer' });
          steps2.push({ label: 't', fn: 'MAC_kM(r‖c)', value: rcca.tag, desc: 'CCA adversary (who has dec oracle) simulates CPA game with equal advantage' });

        } else if (srcN === 'CRHF' && tgtN === 'PRF') {
          const rmd = await api.hash.md(qShort);
          const chain = rmd?.chain || [];
          chain.forEach((entry, i) => {
            if (i === 0) steps2.push({ label: 'IV = 0ⁿ', fn: 'init', value: entry[1], desc: 'Merkle-Damgård start' });
            else steps2.push({ label: `z${i}`, fn: `h(z${i-1},M${i})`, value: entry[2] || entry[1], desc: `Compress block ${i}` });
          });
          steps2.push({ label: 'collision ⇒ PRF break', fn: 'h(cv,b₁)=h(cv,b₂)', value: rmd.digest, stub: true, desc: 'CRHF collision in compression function h implies PRF distinguisher for h' });

        } else if (srcN === 'MAC' && tgtN === 'PRP') {
          const rm = await api.mac.sign(srcKey32, qPad.slice(0, 32));
          const rp = await api.prf.evaluate(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'MAC_k(m)', fn: 'CBC-MAC tag', value: rm.tag, desc: 'CBC-MAC uses AES (PRP) as its block cipher' });
          steps2.push({ label: 'PRP_k(m)', fn: 'AES eval', value: rp.output, desc: 'Underlying PRP — MAC forgery implies PRP distinguisher' });
          steps2.push({ label: 'PRP break', fn: 'MAC-forge ⇒ PRP-dist', value: `adv ≥ ε_MAC`, stub: true, desc: 'EUF-CMA MAC forger distinguishes PRP from random permutation' });

        } else if (srcN === 'OWF' && tgtN === 'OWP') {
          if (foundation === 'AES') {
            const r = await api.prf.evaluate(srcKey32, qPad.slice(0, 32));
            steps2.push({ label: 'AES_k(x)', fn: 'AES-128 PRP', value: r.output, desc: 'AES with fixed key k is a bijection on {0,1}^128 — a PRP is always a permutation' });
            steps2.push({ label: 'OWP(x)', fn: 'PRP = bijective OWF', value: r.output, desc: 'AES_k is one-way (AES hardness) and bijective → it is an OWP. Davies-Meyer uses AES as OWF, but AES itself is OWP.' });
          } else {
            const r = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owfOut = r.output.replace(/^0x/, '');
            steps2.push({ label: 'x (input)', fn: 'domain Z_q', value: qShort.padEnd(16, '0'), desc: 'Input x ∈ Z_q — DLP OWF domain equals its range' });
            steps2.push({ label: 'f(x) = g^x mod p', fn: 'DLP OWF eval', value: owfOut, desc: 'Evaluating g^x mod p at x — DLP makes this one-way' });
            steps2.push({ label: 'OWP(x)', fn: 'bijection on Z_q', value: owfOut, desc: 'g^x is a bijection on Z_q → OWF whose domain equals range = OWP' });
          }

        } else if (srcN === 'CPA_ENC' && tgtN === 'CCA_ENC') {
          const rcca = await api.cca.encrypt(srcKey32, srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'r', fn: 'fresh nonce', value: rcca.r, desc: 'Random nonce r ← {0,1}ⁿ for CPA encryption layer' });
          steps2.push({ label: 'c = CPA_Enc_kE(m)', fn: 'F_kE(r) ⊕ m', value: rcca.ciphertext, desc: 'CPA ciphertext — IND-CPA secure under PRF assumption' });
          steps2.push({ label: 't = MAC_kM(r‖c)', fn: 'Encrypt-then-MAC', value: rcca.tag, desc: 'MAC over (r‖c) adds integrity: Enc-then-MAC → IND-CCA2 (PA#6)' });

        // ── Multi-hop chains with live computation ─────────────────────────

        } else if (srcN === 'OWF' && tgtN === 'PRF') {
          // OWF → PRG (HILL) → PRF (GGM)
          const seedH = k32.slice(0, 8);
          const rp = await api.prg.generate(seedH, 32);
          steps2.push({ label: 'OWF→PRG', fn: 'HILL hardcore', value: rp.output_hex, desc: `HILL: iterate OWF on key k to extract pseudorandom bits (${(rp.ones_ratio*100).toFixed(1)}% ones)` });
          const tree = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lc1 = 0;
          (tree.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = Leg 1 OWF output (concrete OWF instance)' });
            } else {
              lc1++;
              steps2.push({ label: `Level ${lc1}`, fn: `G_${p.bit}`, value: p.node, desc: `PRG expand bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'F_k(x)', fn: 'GGM leaf = PRF', value: tree.output, desc: 'PRF output via OWF-seeded GGM construction' });

        } else if (srcN === 'OWF' && tgtN === 'PRP') {
          // OWF → PRG (HILL) → PRF (GGM) → PRP (Luby-Rackoff)
          const seedH2 = k32.slice(0, 8);
          const rp2 = await api.prg.generate(seedH2, 32);
          steps2.push({ label: 'OWF→PRG', fn: 'HILL hardcore', value: rp2.output_hex, desc: 'HILL: iterate OWF on key k to extract pseudorandom bits' });
          const treeOWFPRP = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lcOWFPRP = 0;
          (treeOWFPRP.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = Leg 1 OWF output' });
            } else {
              lcOWFPRP++;
              steps2.push({ label: `Level ${lcOWFPRP}`, fn: `G_${p.bit}`, value: p.node, desc: `PRG expand bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'PRG→PRF', fn: 'GGM leaf', value: treeOWFPRP.output, desc: 'GGM tree: OWF output → PRF evaluation' });
          const L0a = qPad.slice(0, 16), R0a = (qPad.slice(16, 32) || '').padEnd(16, '0');
          const ra1 = await api.prf.evaluate(srcKey32, L0a.padEnd(32, '0'));
          const R1a = xorHex(R0a, ra1.output.slice(0, 16));
          const ra2 = await api.prf.evaluate(srcKey32, R1a.padEnd(32, '0'));
          const L1a = xorHex(L0a, ra2.output.slice(0, 16));
          const ra3 = await api.prf.evaluate(srcKey32, L1a.padEnd(32, '0'));
          const R2a = xorHex(R1a, ra3.output.slice(0, 16));
          steps2.push({ label: 'Round 1', fn: `R₁ = R₀ ⊕ F_k(L₀)`, value: `L₀=${L0a.slice(0,8)}… R₁=${R1a.slice(0,8)}…`, desc: 'Luby-Rackoff Feistel round 1' });
          steps2.push({ label: 'Round 2', fn: `L₁ = L₀ ⊕ F_k(R₁)`, value: `L₁=${L1a.slice(0,8)}… R₁=${R1a.slice(0,8)}…`, desc: 'Luby-Rackoff Feistel round 2' });
          steps2.push({ label: 'Round 3', fn: `R₂ = R₁ ⊕ F_k(L₁)`, value: `L₁=${L1a.slice(0,8)}… R₂=${R2a.slice(0,8)}…`, desc: 'Luby-Rackoff Feistel round 3 → secure PRP' });
          steps2.push({ label: 'PRP_k(x)', fn: 'L₁ ‖ R₂', value: L1a + R2a, desc: '3-round Luby-Rackoff PRP output' });

        } else if (srcN === 'OWF' && tgtN === 'MAC') {
          // OWF → PRG (HILL) → PRF (GGM) → MAC
          const seedH3 = k32.slice(0, 8);
          const rp3 = await api.prg.generate(seedH3, 32);
          steps2.push({ label: 'OWF→PRG', fn: 'HILL hardcore', value: rp3.output_hex, desc: 'HILL: iterate OWF on key k → pseudorandom bits' });
          const tree3 = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lc3 = 0;
          (tree3.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWF output from Leg 1' });
            } else {
              lc3++;
              steps2.push({ label: `Level ${lc3}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM expand bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'PRG→PRF', fn: 'GGM leaf = F_k(x)', value: tree3.output, desc: 'GGM leaf = PRF evaluation at query x' });
          const rm3 = await api.mac.sign(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'MAC_k(m)', fn: 'PRF-MAC: F_k(m)', value: rm3.tag, desc: 'PRF-MAC: tag = F_k(m), key k from Leg 1 OWF output' });

        } else if (srcN === 'OWF' && tgtN === 'CCA_ENC') {
          // OWF → PRG (HILL) → PRF (GGM) → CPA-Enc → CCA-Enc (Encrypt-then-MAC)
          const seedCC = k32.slice(0, 8);
          const rpCC = await api.prg.generate(seedCC, 32);
          steps2.push({ label: 'OWF→PRG', fn: 'HILL hardcore', value: rpCC.output_hex, desc: `HILL: iterate OWF on key k → pseudorandom bits (${(rpCC.ones_ratio*100).toFixed(1)}% ones)` });
          const treeCC = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lcCC = 0;
          (treeCC.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWF output from Leg 1' });
            } else {
              lcCC++;
              steps2.push({ label: `Level ${lcCC}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM expand bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'PRG→PRF', fn: 'GGM leaf', value: treeCC.output, desc: 'GGM leaf = PRF at query x' });
          const rcpaCC = await api.enc.cpa(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'r', fn: 'CPA nonce', value: rcpaCC.r, desc: 'Random nonce r ← {0,1}ⁿ for CPA layer' });
          steps2.push({ label: 'CPA_Enc(m)', fn: 'F_k(r)⊕m', value: rcpaCC.ciphertext, desc: 'PRF → IND-CPA: ciphertext = F_k(r) ⊕ m' });
          const rccaCC = await api.cca.encrypt(srcKey32, srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 't=MAC_k(r‖c)', fn: 'Enc-then-MAC', value: rccaCC.tag, desc: 'Encrypt-then-MAC: MAC tag authenticates (r‖c) → IND-CCA2 (PA#6)' });

        } else if (srcN === 'OWF' && tgtN === 'HMAC') {
          // OWF → PRG (HILL) → PRF (GGM) → MAC → HMAC
          const seedHH = k32.slice(0, 8);
          const rpHH = await api.prg.generate(seedHH, 32);
          steps2.push({ label: 'OWF→PRG', fn: 'HILL hardcore', value: rpHH.output_hex, desc: `HILL: iterate OWF on key k → pseudorandom bits (${(rpHH.ones_ratio*100).toFixed(1)}% ones)` });
          const treeHH = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lcHH = 0;
          (treeHH.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWF output from Leg 1' });
            } else {
              lcHH++;
              steps2.push({ label: `Level ${lcHH}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM expand bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'PRG→PRF', fn: 'GGM leaf', value: treeHH.output, desc: 'GGM leaf = PRF at query x' });
          const rmHH = await api.mac.sign(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'MAC_k(m)', fn: 'PRF-MAC', value: rmHH.tag, desc: 'PRF-MAC: tag = F_k(m) — MAC built from PRF' });
          const tagHH = await api.hmac.sign(srcKey16, qShort);
          steps2.push({ label: 'HMAC_k(m)', fn: 'H(k⊕opad‖H(k⊕ipad‖m))', value: tagHH.tag, desc: 'MAC fits HMAC double-hash structure → HMAC_k(m) (PA#10)' });

        } else if (srcN === 'PRG' && tgtN === 'MAC') {
          // PRG → PRF (GGM) → MAC
          const tree4 = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lc4 = 0;
          (tree4.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = Leg 1 PRG output (srcKey32)' });
            } else {
              lc4++;
              steps2.push({ label: `Level ${lc4}`, fn: `G_${p.bit}`, value: p.node, desc: `PRG expand bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'PRG→PRF', fn: 'GGM leaf = F_k(x)', value: tree4.output, desc: 'PRF evaluation at query x using PRG output as key' });
          const rm4 = await api.mac.sign(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'MAC_k(m)', fn: 'PRF-MAC: F_k(m)', value: rm4.tag, desc: 'PRF-MAC: tag = F_k(m), key k = Leg 1 PRG output' });

        } else if (srcN === 'PRG' && tgtN === 'PRP') {
          // PRG → PRF (GGM) → PRP (Luby-Rackoff)
          const tree5 = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lc5 = 0;
          (tree5.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = Leg 1 PRG output' });
            } else {
              lc5++;
              steps2.push({ label: `Level ${lc5}`, fn: `G_${p.bit}`, value: p.node, desc: `PRG expand bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'PRG→PRF', fn: 'GGM leaf = F_k(x)', value: tree5.output, desc: 'GGM construction: PRG → PRF evaluation' });
          const L0b = qPad.slice(0, 16), R0b = (qPad.slice(16, 32) || '').padEnd(16, '0');
          const rb1 = await api.prf.evaluate(srcKey32, L0b.padEnd(32, '0'));
          const R1b = xorHex(R0b, rb1.output.slice(0, 16));
          const rb2 = await api.prf.evaluate(srcKey32, R1b.padEnd(32, '0'));
          const L1b = xorHex(L0b, rb2.output.slice(0, 16));
          const rb3 = await api.prf.evaluate(srcKey32, L1b.padEnd(32, '0'));
          const R2b = xorHex(R1b, rb3.output.slice(0, 16));
          steps2.push({ label: 'Round 1', fn: `R₁ = R₀ ⊕ F_k(L₀)`, value: `L₀=${L0b.slice(0,8)}… R₁=${R1b.slice(0,8)}…`, desc: 'Luby-Rackoff Feistel round 1' });
          steps2.push({ label: 'Round 2', fn: `L₁ = L₀ ⊕ F_k(R₁)`, value: `L₁=${L1b.slice(0,8)}… R₁=${R1b.slice(0,8)}…`, desc: 'Luby-Rackoff Feistel round 2' });
          steps2.push({ label: 'Round 3', fn: `R₂ = R₁ ⊕ F_k(L₁)`, value: `L₁=${L1b.slice(0,8)}… R₂=${R2b.slice(0,8)}…`, desc: 'Luby-Rackoff Feistel round 3 → secure PRP' });
          steps2.push({ label: 'PRP_k(x)', fn: 'L₁ ‖ R₂', value: L1b + R2b, desc: '3-round Luby-Rackoff PRP output' });

        } else if (srcN === 'OWP' && tgtN === 'PRG') {
          // OWP → PRG; foundation-aware: AES OWP uses switching lemma, DLP OWP uses HILL
          if (foundation === 'AES') {
            steps2.push({ label: 'OWP instance', fn: 'AES-128 PRP/OWP', value: srcKey32, desc: 'AES OWP from Leg 1 (PRP with fixed key = bijective OWF)' });
            const r0 = await api.prf.evaluate(srcKey32, '0'.repeat(32));
            const r1 = await api.prf.evaluate(srcKey32, '1'.repeat(32));
            steps2.push({ label: 'G(k)', fn: 'F_k(0)‖F_k(1)', value: r0.output + r1.output, desc: 'OWP (AES PRP) → PRF (switching lemma) → length-doubling PRG' });
          } else {
            const rc = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owfOutC = rc.output.replace(/^0x/, '');
            steps2.push({ label: 'OWP=OWF(x)', fn: 'g^x mod p', value: owfOutC, desc: 'DLP OWP ⊆ OWF: permutation is a one-way function' });
            const rpC = await api.prg.generate(srcKey32.slice(0, 8), 32);
            steps2.push({ label: 'PRG(s)', fn: 'HILL hardcore', value: rpC.output_hex, desc: `HILL: iterate OWF/OWP to extract bits (${(rpC.ones_ratio*100).toFixed(1)}% ones)` });
          }

        } else if (srcN === 'OWP' && tgtN === 'PRF') {
          // OWP → PRF via GGM rooted at Leg 1 OWP output; foundation-aware OWP display
          if (foundation === 'AES') {
            steps2.push({ label: 'OWP instance', fn: 'AES-128 PRP/OWP', value: srcKey32, desc: 'Leg 1 AES OWP output — AES with fixed key is bijective (PRP = OWP)' });
          } else {
            const rd = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owfOutD = rd.output.replace(/^0x/, '');
            steps2.push({ label: 'OWP(x)=g^x mod p', fn: 'DLP OWP', value: owfOutD, desc: 'DLP OWP evaluated at query x — bijective OWF on Z_q' });
          }
          const treeD = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lcD = 0;
          (treeD.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWP output from Leg 1 (concrete source primitive)' });
            } else {
              lcD++;
              steps2.push({ label: `Level ${lcD}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'F_k(x)', fn: 'GGM leaf = PRF', value: treeD.output, desc: 'PRF output via OWP-seeded GGM construction' });

        } else if (srcN === 'OWP' && tgtN === 'PRP') {
          // OWP → PRF (GGM) → PRP (Luby-Rackoff 3-round Feistel)
          if (foundation === 'AES') {
            steps2.push({ label: 'OWP instance', fn: 'AES-128 PRP/OWP', value: srcKey32, desc: 'Leg 1 AES OWP — AES with fixed key is bijective (PRP = OWP)' });
          } else {
            const rdOWP = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owfOutDP = rdOWP.output.replace(/^0x/, '');
            steps2.push({ label: 'OWP(x)=g^x mod p', fn: 'DLP OWP', value: owfOutDP, desc: 'DLP OWP — bijective OWF on Z_q' });
          }
          const treeOP = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lcOP = 0;
          (treeOP.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWP key' });
            } else {
              lcOP++;
              steps2.push({ label: `Level ${lcOP}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'OWP→PRF', fn: 'GGM leaf', value: treeOP.output, desc: 'PRF via OWP-seeded GGM' });
          const L0op = qPad.slice(0, 16), R0op = (qPad.slice(16, 32) || '').padEnd(16, '0');
          const rop1 = await api.prf.evaluate(srcKey32, L0op.padEnd(32, '0'));
          const R1op = xorHex(R0op, rop1.output.slice(0, 16));
          const rop2 = await api.prf.evaluate(srcKey32, R1op.padEnd(32, '0'));
          const L1op = xorHex(L0op, rop2.output.slice(0, 16));
          const rop3 = await api.prf.evaluate(srcKey32, L1op.padEnd(32, '0'));
          const R2op = xorHex(R1op, rop3.output.slice(0, 16));
          steps2.push({ label: 'Round 1', fn: 'R₁=R₀⊕F_k(L₀)', value: `L₀=${L0op.slice(0,8)}… R₁=${R1op.slice(0,8)}…`, desc: 'Luby-Rackoff Feistel round 1' });
          steps2.push({ label: 'Round 2', fn: 'L₁=L₀⊕F_k(R₁)', value: `L₁=${L1op.slice(0,8)}… R₁=${R1op.slice(0,8)}…`, desc: 'Luby-Rackoff Feistel round 2' });
          steps2.push({ label: 'Round 3', fn: 'R₂=R₁⊕F_k(L₁)', value: `L₁=${L1op.slice(0,8)}… R₂=${R2op.slice(0,8)}…`, desc: 'Feistel round 3 → Luby-Rackoff secure PRP' });
          steps2.push({ label: 'PRP_k(x)', fn: 'L₁‖R₂', value: L1op + R2op, desc: '3-round PRP built from OWP via GGM PRF' });

        } else if (srcN === 'OWP' && tgtN === 'MAC') {
          // OWP → PRF (GGM) → MAC (PRF-MAC)
          if (foundation === 'AES') {
            steps2.push({ label: 'OWP instance', fn: 'AES-128 PRP/OWP', value: srcKey32, desc: 'AES OWP from Leg 1 — bijective PRP with fixed key' });
          } else {
            const rdM = await api.owf.evaluate(qShort.padEnd(16, '0'));
            steps2.push({ label: 'OWP(x)=g^x mod p', fn: 'DLP OWP', value: rdM.output.replace(/^0x/, ''), desc: 'DLP OWP — bijective OWF on Z_q' });
          }
          const treeMac = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lcMac = 0;
          (treeMac.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWP key' });
            } else {
              lcMac++;
              steps2.push({ label: `Level ${lcMac}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'OWP→PRF', fn: 'GGM leaf', value: treeMac.output, desc: 'PRF via OWP-seeded GGM construction' });
          const rmMac = await api.mac.sign(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'MAC_k(m)', fn: 'PRF-MAC: F_k(m)', value: rmMac.tag, desc: 'PRF-MAC: tag = F_k(m) — EUF-CMA secure' });

        } else if (srcN === 'OWP' && tgtN === 'HMAC') {
          // OWP → PRF (GGM) → MAC (PRF-MAC) → HMAC
          if (foundation === 'AES') {
            steps2.push({ label: 'OWP instance', fn: 'AES-128 PRP/OWP', value: srcKey32, desc: 'AES OWP from Leg 1 — bijective PRP with fixed key' });
          } else {
            const rdH = await api.owf.evaluate(qShort.padEnd(16, '0'));
            steps2.push({ label: 'OWP(x)=g^x mod p', fn: 'DLP OWP', value: rdH.output.replace(/^0x/, ''), desc: 'DLP OWP — bijective OWF on Z_q' });
          }
          const treeHmac = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lcHmac = 0;
          (treeHmac.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWP key' });
            } else {
              lcHmac++;
              steps2.push({ label: `Level ${lcHmac}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'OWP→PRF', fn: 'GGM leaf', value: treeHmac.output, desc: 'PRF via OWP-seeded GGM construction' });
          const rmHmac = await api.mac.sign(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'MAC_k(m)', fn: 'PRF-MAC', value: rmHmac.tag, desc: 'PRF-MAC: tag = F_k(m) — MAC built from OWP → PRF' });
          const tagOwpHmac = await api.hmac.sign(srcKey16, qShort);
          steps2.push({ label: 'HMAC_k(m)', fn: 'H(k⊕opad‖H(k⊕ipad‖m))', value: tagOwpHmac.tag, desc: 'MAC fits HMAC double-hash structure → HMAC_k(m) (PA#10)' });

        } else if (srcN === 'OWP' && tgtN === 'CCA_ENC') {
          // OWP → PRF (GGM) → CPA-Enc → CCA-Enc (Encrypt-then-MAC)
          if (foundation === 'AES') {
            steps2.push({ label: 'OWP instance', fn: 'AES-128 PRP/OWP', value: srcKey32, desc: 'AES OWP from Leg 1 — bijective PRP with fixed key' });
          } else {
            const rdC = await api.owf.evaluate(qShort.padEnd(16, '0'));
            steps2.push({ label: 'OWP(x)=g^x mod p', fn: 'DLP OWP', value: rdC.output.replace(/^0x/, ''), desc: 'DLP OWP — bijective OWF on Z_q' });
          }
          const treeCca = await api.prf.ggm_tree(srcKey32, qShort.slice(0, 8));
          let lcCca = 0;
          (treeCca.path || []).forEach(p => {
            if (p.bit === null || p.bit === undefined) {
              steps2.push({ label: 'Root k', fn: 'GGM seed', value: p.node, desc: 'GGM root = OWP key' });
            } else {
              lcCca++;
              steps2.push({ label: `Level ${lcCca}`, fn: `G_${p.bit}`, value: p.node, desc: `GGM bit ${p.bit}` });
            }
          });
          steps2.push({ label: 'OWP→PRF', fn: 'GGM leaf', value: treeCca.output, desc: 'PRF via OWP-seeded GGM construction' });
          const rcpaCca = await api.enc.cpa(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'r', fn: 'CPA nonce', value: rcpaCca.r, desc: 'Random nonce r ← {0,1}ⁿ for CPA layer' });
          steps2.push({ label: 'CPA_Enc(m)', fn: 'F_k(r)⊕m', value: rcpaCca.ciphertext, desc: 'PRF → IND-CPA: ciphertext = F_k(r) ⊕ m (PA#3)' });
          const rccaCca = await api.cca.encrypt(srcKey32, srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 't=MAC_k(r‖c)', fn: 'Enc-then-MAC', value: rccaCca.tag, desc: 'Encrypt-then-MAC: MAC tag authenticates (r‖c) → IND-CCA2 (PA#6)' });

        } else if (srcN === 'CRHF' && tgtN === 'MAC') {
          // CRHF → HMAC → MAC
          const tagE = await api.hmac.sign(srcKey16, qShort);
          steps2.push({ label: 'inner', fn: 'H(k⊕ipad‖m)', value: tagE.tag.slice(0, 24) + '…', desc: 'HMAC inner hash — CRHF compression function' });
          steps2.push({ label: 'HMAC_k(m)', fn: 'H(k⊕opad‖inner)', value: tagE.tag, desc: 'CRHF → HMAC construction (PA#10)' });
          steps2.push({ label: 'MAC_k(m)', fn: 'HMAC is MAC', value: tagE.tag, desc: 'HMAC is directly EUF-CMA secure → MAC' });

        // ── Reverse-direction reductions: stronger → weaker primitive ──
        // Each shows X→Y steps (matching the column label direction).

        } else if (srcN === 'PRF' && tgtN === 'OWF') {
          const rPRFowf = await api.prf.evaluate(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'F_k(x)', fn: 'AES_k(x)', value: rPRFowf.output, desc: 'Evaluate PRF at input x with key k' });
          steps2.push({ label: 'OWF(x)', fn: 'F_k = OWF', value: rPRFowf.output, desc: 'PRF with fixed key k is one-way: guessing x from F_k(x) would break PRF security' });

        } else if (srcN === 'PRP' && tgtN === 'OWF') {
          const rPRPowf = await api.prf.evaluate(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'PRP_k(x)', fn: 'AES_k(x)', value: rPRPowf.output, desc: 'Evaluate PRP at input x — AES is a block cipher (PRP)' });
          steps2.push({ label: 'OWF(x)', fn: 'PRP = OWP ⊇ OWF', value: rPRPowf.output, desc: 'PRP with fixed key is a bijective one-way function (OWP): any PRP-inverter is an OWF-inverter' });

        } else if (srcN === 'MAC' && tgtN === 'OWF') {
          const rMACowf = await api.mac.sign(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'MAC_k(m)', fn: 'F_k(m)', value: rMACowf.tag, desc: 'Evaluate MAC (PRF-MAC) at message m' });
          steps2.push({ label: 'OWF(m)', fn: 'MAC = OWF', value: rMACowf.tag, desc: 'EUF-CMA MAC is one-way: inverting MAC_k(m)→m would break MAC security' });

        } else if (srcN === 'MAC' && tgtN === 'PRG') {
          const rMACprg0 = await api.mac.sign(srcKey32, '0'.repeat(32));
          const rMACprg1 = await api.mac.sign(srcKey32, '1'.repeat(32));
          steps2.push({ label: 'MAC_k(0)', fn: 'F_k(0)', value: rMACprg0.tag, desc: 'MAC used as PRF oracle at input 0' });
          steps2.push({ label: 'MAC_k(1)', fn: 'F_k(1)', value: rMACprg1.tag, desc: 'MAC used as PRF oracle at input 1' });
          steps2.push({ label: 'G(k)', fn: 'F_k(0)‖F_k(1)', value: rMACprg0.tag + rMACprg1.tag, desc: 'MAC implies PRF implies PRG: length-doubling with MAC as PRF oracle' });

        } else if (srcN === 'PRP' && tgtN === 'PRG') {
          const rPRPprg0 = await api.prf.evaluate(srcKey32, '0'.repeat(32));
          const rPRPprg1 = await api.prf.evaluate(srcKey32, '1'.repeat(32));
          steps2.push({ label: 'PRP_k(0)', fn: 'AES_k(0)', value: rPRPprg0.output, desc: 'PRP evaluation at 0 — indistinguishable from PRF by switching lemma' });
          steps2.push({ label: 'PRP_k(1)', fn: 'AES_k(1)', value: rPRPprg1.output, desc: 'PRP evaluation at 1' });
          steps2.push({ label: 'G(k)', fn: 'PRP_k(0)‖PRP_k(1)', value: rPRPprg0.output + rPRPprg1.output, desc: 'PRP ≈ PRF (switching lemma adv ≤ q²/2ⁿ⁺¹) → PRF → length-doubling PRG' });

        } else if (srcN === 'PRG' && tgtN === 'OWP') {
          if (foundation === 'AES') {
            steps2.push({ label: 'G(s)', fn: 'PRG output', value: srcKey32, desc: 'Leg 1 PRG output (AES PRF evaluations F_k(0)‖F_k(1)) — same as Build panel' });
            const rOWP = await api.prf.evaluate(srcKey32, qPad.slice(0, 32));
            steps2.push({ label: 'PRG→PRF→PRP', fn: 'switching lemma', value: rOWP.output, desc: 'AES PRG → GGM PRF → PRP via switching lemma; AES with fixed key is bijective' });
            steps2.push({ label: 'OWP(x)', fn: 'AES_k(x)', value: rOWP.output, desc: 'AES PRP with fixed key k is a one-way permutation — bijective and hard to invert' });
          } else {
            steps2.push({ label: 'G(s)', fn: 'HILL PRG output', value: srcKey32, desc: 'Leg 1 HILL PRG output — same value computed in Build panel' });
            const rcOWP = await api.owf.evaluate(qShort.padEnd(16, '0'));
            const owpOutPRG = rcOWP.output.replace(/^0x/, '');
            steps2.push({ label: 'OWP(x)=g^x mod p', fn: 'DLP OWP', value: owpOutPRG, desc: 'DLP: g^x mod p is bijective on Z_q — any OWP inverter breaks DLP, which would break PRG too' });
          }

        } else if (srcN === 'PRF' && tgtN === 'OWP') {
          const rPRFowp = await api.prf.evaluate(srcKey32, qPad.slice(0, 32));
          steps2.push({ label: 'F_k(x)', fn: 'AES_k(x)', value: rPRFowp.output, desc: 'Evaluate PRF at input x — AES is a PRP (bijection) with fixed key' });
          steps2.push({ label: 'OWP(x)', fn: 'F_k = OWP', value: rPRFowp.output, desc: 'AES-based PRF is a one-way permutation: bijective and hard to invert (PRP → OWP)' });

        } else {
          // Multi-hop: chain hops using route.path with live computation
          if (route && route.path && route.path.length > 1) {
            const path = route.path;
            // For OWF source, HILL uses the raw OWF input key (k32), not the OWF output
            let currentKey32 = (path[0] === 'OWF') ? k32 : srcKey32;
            for (let i = 0; i < path.length - 1; i++) {
              const hop = await computeHop(path[i], path[i + 1], currentKey32, k32);
              hop.steps.forEach(s => steps2.push(s));
              currentKey32 = hop.outputKey32;
            }
          } else {
            steps2.push({
              label: `${srcN}→${tgtN}`, fn: 'Reduction',
              value: route?.supported === false
                ? `No path from ${srcN} to ${tgtN}`
                : `Not yet implemented`,
              stub: true,
            });
          }
        }
      } catch (e) {
        steps2.push({ label: 'Error', fn: `${srcN}→${tgtN}`, value: e.message, stub: true });
      }
      setReduceSteps(steps2);
    } finally {
      setLoading(false);
    }
  };

  // Ref always points to the freshest runComputations (updated each render).
  // This lets stable callbacks and effects call through it without stale closures.
  const runRef = useRef(null);
  runRef.current = runComputations;

  // Stable callback for button clicks — never goes stale.
  const onRun = useCallback(() => runRef.current(), []);

  // Auto-run only when primitives / direction change, NOT when key/query change.
  useEffect(() => { runRef.current(); }, [foundation, source, target, direction]);

  const handleKeyChange = (v) => { setKeyHex(v); };
  const handleQueryChange = (v) => { setQueryHex(v); };

  return (
    <div className="main-layout">
      {/* Top Bar */}
      <div className="top-bar">
        <h1>
          CS8.401 · Minicrypt Clique Explorer
          {activeDemo.id !== 'home' && (
            <span className="top-bar-breadcrumb"> / {activeDemo.id} {activeDemo.label}</span>
          )}
          {loading && <span className="spinner" style={{ marginLeft: 10, verticalAlign: 'middle' }} />}
        </h1>
        <div className="top-bar-spacer" />
        {/* Foundation toggle in top bar */}
        <div className="foundation-toggle">
          <button className={foundation==='AES'?'active':''} onClick={()=>setFoundation('AES')}>AES-128</button>
          <button className={foundation==='DLP'?'active':''} onClick={()=>setFoundation('DLP')}>DLP</button>
        </div>
        {/* Direction toggle */}
        <div className="direction-toggle">
          <button className={direction==='forward'?'active':''} onClick={()=>setDirection('forward')}>A→B</button>
          <button className={direction==='backward'?'active':''} onClick={()=>setDirection('backward')}>B→A</button>
        </div>
        <button className="btn btn-secondary theme-toggle" onClick={() => setDarkMode(d => !d)}>
          {darkMode ? '☀ Light' : '☾ Dark'}
        </button>
      </div>

      {/* Full playground — DemoSection owns the PA nav sidebar */}
      <div className="app-body">
        <DemoSection
          foundation={foundation}
          source={source}
          setSource={setSource}
          target={target}
          setTarget={setTarget}
          primitives={PRIMITIVES}
          keyHex={keyHex}
          setKeyHex={handleKeyChange}
          queryHex={queryHex}
          setQueryHex={handleQueryChange}
          buildSteps={buildSteps}
          reduceSteps={reduceSteps}
          routeInfo={routeInfo}
          proofOpen={proofOpen}
          setProofOpen={setProofOpen}
          direction={direction}
          loading={loading}
          onRun={onRun}
          onActiveChange={(id, label) => setActiveDemo({ id, label })}
        />
      </div>
    </div>
  );
}
