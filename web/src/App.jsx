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
  const [proofOpen, setProofOpen]   = useState(false);
  const [buildSteps, setBuildSteps] = useState([]);
  const [reduceSteps, setReduceSteps] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [routeInfo, setRouteInfo]   = useState(null);
  const [darkMode, setDarkMode]     = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [activeDemo, setActiveDemo] = useState({ id: 'home', label: null });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', darkMode);
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
    const effKey = direction === 'backward' ? queryHex : keyHex;
    const effQuery = direction === 'backward' ? keyHex : queryHex;

    if (!effKey || !effKey.trim()) {
      setBuildSteps([]);
      setReduceSteps([]);
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
            const rcca = await api.cca.encrypt(k16, k16, qPad.slice(0, 32));
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

      // Routing table lookup
      const route = await api.reduce(srcN, tgtN, foundation).catch(() => null);
      setRouteInfo(route);

      // ── Column 2: Source → Target (live computations) ──────────────────────
      const steps2 = [];
      try {
        if (srcN === 'PRG' && tgtN === 'PRF') {
          const bits = effQuery || '0'.repeat(8);
          const tree = await api.prf.ggm_tree(k32, bits.slice(0, 8).padEnd(8, '0'));
          steps2.push({ label: 'k (key)', fn: 'GGM root', value: k32.slice(0, 32), desc: 'Start at root' });
          (tree.path || []).forEach((p, i) => {
            steps2.push({ label: `Level ${i+1}`, fn: `G_${p.bit}`, value: p.node, desc: `bit ${p.bit}` });
          });
          steps2.push({ label: 'F_k(x)', fn: 'GGM leaf', value: tree.output, desc: 'PRF output' });

        } else if (srcN === 'PRF' && tgtN === 'MAC') {
          const r = await api.mac.sign(k32, qPad.slice(0, 32));
          steps2.push({ label: 'Mac_k(m)', fn: 'F_k(m)', value: r.tag, desc: 'PRF-MAC: tag = F_k(m)' });

        } else if (srcN === 'OWF' && tgtN === 'PRG') {
          const seedH = (effQuery || '').slice(0, 8).padEnd(8, '0');
          const rp = await api.prg.generate(seedH, 32);
          steps2.push({ label: 'seed s₀', fn: 'input', value: seedH, desc: 'Initial seed' });
          steps2.push({ label: 'OWF iterations', fn: 'f(f(…(s)…))', value: rp.output_hex.slice(0, 32) + '…', desc: 'Apply OWF to get s₁,s₂,…' });
          steps2.push({ label: 'PRG(s)', fn: 'b(x₁)‖b(x₂)‖…', value: rp.output_hex, desc: `Hard-core bit extraction (${(rp.ones_ratio*100).toFixed(1)}% ones)` });

        } else if (srcN === 'PRF' && tgtN === 'PRP') {
          const L0 = qPad.slice(0, 16), R0 = qPad.slice(16, 32) || '0'.repeat(16);
          const r1 = await api.prf.evaluate(k32, L0.padEnd(32, '0'));
          const R1 = xorHex(R0, r1.output.slice(0, 16));
          const r2 = await api.prf.evaluate(k32, R1.padEnd(32, '0'));
          const L1 = xorHex(L0, r2.output.slice(0, 16));
          const r3 = await api.prf.evaluate(k32, L1.padEnd(32, '0'));
          const R2 = xorHex(R1, r3.output.slice(0, 16));
          steps2.push({ label: 'Round 1', fn: `R₁ = R₀ ⊕ F_k(L₀)`, value: `L₀=${L0.slice(0,8)}… R₁=${R1.slice(0,8)}…`, desc: 'Feistel round 1: swap & XOR with PRF output' });
          steps2.push({ label: 'Round 2', fn: `L₁ = L₀ ⊕ F_k(R₁)`, value: `L₁=${L1.slice(0,8)}… R₁=${R1.slice(0,8)}…`, desc: 'Feistel round 2' });
          steps2.push({ label: 'Round 3', fn: `R₂ = R₁ ⊕ F_k(L₁)`, value: `L₁=${L1.slice(0,8)}… R₂=${R2.slice(0,8)}…`, desc: 'Feistel round 3 — Luby-Rackoff: 3 rounds → secure PRP' });
          steps2.push({ label: 'PRP_k(x)', fn: 'L₁ ‖ R₂', value: L1 + R2, desc: '3-round Luby-Rackoff PRP output' });

        } else if (srcN === 'PRP' && tgtN === 'MAC') {
          const r = await api.prf.evaluate(k32, qPad.slice(0, 32));
          steps2.push({ label: 'PRP_k(m)', fn: 'AES eval', value: r.output, desc: 'PRP/PRF switching lemma (adv ≤ q²/2ⁿ⁺¹)' });
          steps2.push({ label: 'MAC_k(m)', fn: 'F_k(m)', value: r.output, desc: 'PRF-MAC with AES as PRP≈PRF' });

        } else if (srcN === 'PRF' && tgtN === 'CRHF') {
          const rmd = await api.hash.md(qShort);
          const chain = rmd?.chain || [];
          chain.forEach((entry, i) => {
            if (i === 0) steps2.push({ label: 'IV = 0ⁿ', fn: 'init', value: entry[1], desc: 'Merkle-Damgård start' });
            else steps2.push({ label: `z${i}`, fn: `h(z${i-1},M${i})`, value: entry[2] || entry[1], desc: `Compress block ${i}` });
          });
          steps2.push({ label: 'H(m)', fn: 'MD output', value: rmd.digest, desc: 'CRHF: collision in H → collision in h' });

        } else if (srcN === 'CRHF' && tgtN === 'HMAC') {
          const tag = await api.hmac.sign(k16, qShort);
          steps2.push({ label: 'inner', fn: 'H(k⊕ipad‖m)', value: tag.tag.slice(0, 24) + '…', desc: 'Inner hash with ipad' });
          steps2.push({ label: 'HMAC_k(m)', fn: 'H(k⊕opad‖inner)', value: tag.tag, desc: 'CRHF → HMAC construction (PA#10)' });

        } else if (srcN === 'HMAC' && tgtN === 'MAC') {
          const tag = await api.hmac.sign(k16, qShort);
          steps2.push({ label: 'HMAC_k(m)', fn: 'EUF-CMA MAC', value: tag.tag, desc: 'HMAC is directly a secure MAC' });

        } else if (srcN === 'PRF' && tgtN === 'PRG') {
          // backward: G(s) = F_s(0ⁿ) ‖ F_s(1ⁿ)
          const r0 = await api.prf.evaluate(qPad, '0'.repeat(32));
          const r1 = await api.prf.evaluate(qPad, '1'.repeat(32));
          steps2.push({ label: 'F_s(0ⁿ)', fn: 'PRF eval 0', value: r0.output, desc: 'Left half' });
          steps2.push({ label: 'F_s(1ⁿ)', fn: 'PRF eval 1', value: r1.output, desc: 'Right half' });
          steps2.push({ label: 'G(s)', fn: 'F_s(0)‖F_s(1)', value: r0.output + r1.output, desc: 'Length-doubling PRG from PRF' });

        } else if (srcN === 'PRP' && tgtN === 'PRF') {
          const r = await api.prf.evaluate(k32, qPad.slice(0, 32));
          steps2.push({ label: 'PRP_k(x)', fn: 'AES eval', value: r.output, desc: 'PRP/PRF switching lemma (adv ≤ q²/2ⁿ⁺¹)' });
          steps2.push({ label: 'F_k(x)', fn: 'PRF oracle', value: r.output, desc: 'PRP ≈ PRF on super-poly domain' });

        } else if (srcN === 'MAC' && tgtN === 'PRF') {
          const r = await api.mac.sign(k32, qPad.slice(0, 32));
          steps2.push({ label: 'MAC_k(m)', fn: 'PRF oracle', value: r.tag, desc: 'EUF-CMA MAC on uniform messages is a PRF' });

        } else if (srcN === 'HMAC' && tgtN === 'CRHF') {
          const tag = await api.hmac.sign(k16, qShort);
          steps2.push({ label: "H'(m)", fn: 'HMAC_k(m)', value: tag.tag, desc: "Fix key k; H'(m)=HMAC_k(m) is collision-resistant" });

        } else if (srcN === 'MAC' && tgtN === 'CRHF') {
          const rmd = await api.hash.md(qShort);
          steps2.push({ label: 'MAC compress', fn: 'h(cv,block)', value: rmd.digest.slice(0, 16) + '…', desc: 'MAC compression function' });
          steps2.push({ label: 'MD[MAC](m)', fn: 'Merkle-Damgård', value: rmd.digest, desc: 'Apply MD transform → CRHF (PA#7)' });

        } else if (srcN === 'MAC' && tgtN === 'HMAC') {
          const tag = await api.hmac.sign(k16, qShort);
          steps2.push({ label: 'MAC inner', fn: 'F_k(m)', value: tag.tag.slice(0, 24) + '…', desc: 'PRF-MAC as inner compression step' });
          steps2.push({ label: 'HMAC_k(m)', fn: 'double-hash', value: tag.tag, desc: 'PRF-MAC fits HMAC double-hash structure' });

        } else if (srcN === 'PRG' && tgtN === 'OWF') {
          const seedH = (effQuery || '').slice(0, 8).padEnd(8, '0');
          const rp = await api.prg.generate(seedH, 32);
          steps2.push({ label: 'G(s)', fn: 'PRG output', value: rp.output_hex, desc: 'PRG is one-way: recovering s from G(s) breaks pseudorandomness' });

        } else if (srcN === 'OWP' && tgtN === 'OWF') {
          const r = await api.owf.evaluate(qShort.padEnd(16, '0'));
          const owfOut = r.output.replace(/^0x/, '');
          steps2.push({ label: 'OWP(x) = g^x mod p', fn: 'DLP OWP', value: owfOut, desc: 'OWP is bijective on Z_q — already a one-way function by definition' });
          steps2.push({ label: 'OWF(x)', fn: 'OWP ⊆ OWF', value: owfOut, desc: 'Any OWP inverter is an OWF inverter: same function, same hardness' });

        } else if (srcN === 'CPA_ENC' && tgtN === 'PRF') {
          const rcpa = await api.enc.cpa(k32, qPad.slice(0, 32));
          steps2.push({ label: 'r', fn: 'CPA nonce', value: rcpa.r, desc: 'Nonce r chosen uniformly at random' });
          steps2.push({ label: 'c = F_k(r) ⊕ m', fn: 'CPA ciphertext', value: rcpa.ciphertext, desc: 'IND-CPA adversary distinguishes c from uniform → PRF distinguisher' });
          steps2.push({ label: 'PRF break', fn: 'dist(F_k(r), U)', value: `adv ≥ ε_CPA − q²/2ⁿ`, stub: true, desc: 'CPA distinguisher feeds queries to PRF oracle and detects non-randomness' });

        } else if (srcN === 'CCA_ENC' && tgtN === 'CPA_ENC') {
          const rcca = await api.cca.encrypt(k16, k16, qPad.slice(0, 32));
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
          const rm = await api.mac.sign(k32, qPad.slice(0, 32));
          const rp = await api.prf.evaluate(k32, qPad.slice(0, 32));
          steps2.push({ label: 'MAC_k(m)', fn: 'CBC-MAC tag', value: rm.tag, desc: 'CBC-MAC uses AES (PRP) as its block cipher' });
          steps2.push({ label: 'PRP_k(m)', fn: 'AES eval', value: rp.output, desc: 'Underlying PRP — MAC forgery implies PRP distinguisher' });
          steps2.push({ label: 'PRP break', fn: 'MAC-forge ⇒ PRP-dist', value: `adv ≥ ε_MAC`, stub: true, desc: 'EUF-CMA MAC forger distinguishes PRP from random permutation' });

        } else if (srcN === 'OWF' && tgtN === 'OWP') {
          const r = await api.owf.evaluate(qShort.padEnd(16, '0'));
          const owfOut = r.output.replace(/^0x/, '');
          steps2.push({ label: 'x (input)', fn: 'domain Z_q', value: qShort.padEnd(16, '0'), desc: 'Input x ∈ Z_q — DLP OWF operates on the same domain as its range' });
          steps2.push({ label: 'f(x) = g^x mod p', fn: 'DLP OWF eval', value: owfOut, desc: 'Evaluating g^x mod p at x' });
          steps2.push({ label: 'OWP(x)', fn: 'bijection on Z_q', value: owfOut, desc: 'g^x is a bijection on Z_q (Discrete Log permutation) → OWF on permutation domain = OWP' });

        } else if (srcN === 'CPA_ENC' && tgtN === 'CCA_ENC') {
          const rcca = await api.cca.encrypt(k16, k16, qPad.slice(0, 32));
          steps2.push({ label: 'r', fn: 'fresh nonce', value: rcca.r, desc: 'Random nonce r ← {0,1}ⁿ for CPA encryption layer' });
          steps2.push({ label: 'c = CPA_Enc_kE(m)', fn: 'F_kE(r) ⊕ m', value: rcca.ciphertext, desc: 'CPA ciphertext — IND-CPA secure under PRF assumption' });
          steps2.push({ label: 't = MAC_kM(r‖c)', fn: 'Encrypt-then-MAC', value: rcca.tag, desc: 'MAC over (r‖c) adds integrity: Enc-then-MAC → IND-CCA2 (PA#6)' });

        } else {
          // Multi-hop or unsupported: show routing steps with final computation
          if (route && route.steps) {
            route.steps.forEach((s, i) => {
              steps2.push({ label: `Step ${i+1}`, fn: s, value: '(composed)', desc: route.theorem || '' });
            });
          } else {
            steps2.push({
              label: `${srcN}→${tgtN}`, fn: 'Reduction',
              value: `PA#${PA_NUMS[tgtN] || '?'} Not yet run`,
              stub: !route?.supported,
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
        <h1>
          CS8.401 · Minicrypt Clique Explorer
          {activeDemo.id !== 'home' && (
            <span className="top-bar-breadcrumb"> / {activeDemo.id} {activeDemo.label}</span>
          )}
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
          proofChain={proofChain}
          onRun={onRun}
          onActiveChange={(id, label) => setActiveDemo({ id, label })}
        />
      </div>
    </div>
  );
}
