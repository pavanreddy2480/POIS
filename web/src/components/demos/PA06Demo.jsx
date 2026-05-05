import React, { useState } from 'react';
import { api } from '../../api';
import HexInput from '../HexInput';
import DemoHeader from '../DemoHeader';

const KE = '0123456789abcdef0123456789abcdef';
const KM = 'fedcba9876543210fedcba9876543210';
const K_SAME = '55555555555555555555555555555555';

function MalleabilityTab() {
  const [msg, setMsg] = useState('deadbeef00112233');
  const [cpa, setCpa] = useState(null);
  const [cca, setCca] = useState(null);
  const [flipBit, setFlipBit] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const encrypt = async () => {
    setLoading(true);
    setError(null);
    try {
      const m = msg.padEnd(32,'0').slice(0,32);
      const [cpaEnc, ccaEnc] = await Promise.all([
        api.enc.cpa(KE, m),
        api.cca.encrypt(KE, KM, m),
      ]);
      setCpa(cpaEnc);
      setCca(ccaEnc);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const flipAndDecrypt = async (mode) => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'cpa' && cpa) {
        const ct = cpa.ciphertext;
        const idx = flipBit % (ct.length/2);
        const flipped = ct.slice(0,idx*2) + ((parseInt(ct.slice(idx*2,idx*2+2),16)^1).toString(16).padStart(2,'0')) + ct.slice(idx*2+2);
        const dec = await api.enc.dec(KE, cpa.r, flipped);
        setCpa(p => ({ ...p, flippedDec: dec?.plaintext, flipped: true }));
      } else if (mode === 'cca' && cca) {
        const ct = cca.ciphertext;
        const idx = flipBit % (ct.length/2);
        const flipped = ct.slice(0,idx*2) + ((parseInt(ct.slice(idx*2,idx*2+2),16)^1).toString(16).padStart(2,'0')) + ct.slice(idx*2+2);
        
        // Actually call the backend!
        const dec = await api.cca.decrypt(KE, KM, cca.r, flipped, cca.tag);
        if (!dec.valid) {
          setCca(p => ({ ...p, rejected: true, flippedDec: null }));
        } else {
          setCca(p => ({ ...p, rejected: false, flippedDec: dec.plaintext }));
        }
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <HexInput label="Plaintext (hex)" value={msg} onChange={setMsg} onEnter={encrypt} disabled={loading} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={encrypt} disabled={loading}>{'Encrypt Both'}</button>
        <span style={{ fontSize: '0.8rem', alignSelf: 'center', color: 'var(--text-secondary)' }}>
          Bit to flip: <input type="number" value={flipBit} onChange={e=>setFlipBit(+e.target.value)} style={{ width: 60, display: 'inline' }} />
        </span>
      </div>
      <div className="demo-row">
        <div className="demo-half broken">
          <h5>⚠ CPA-Only (malleable)</h5>
          {cpa && <div className="hex-display dim" style={{ marginBottom: 8, fontSize: '0.7rem' }}>CT: {cpa.ciphertext?.slice(0,32)}…</div>}
          <button className="btn btn-danger" onClick={()=>flipAndDecrypt('cpa')} disabled={!cpa || loading}>{'Flip bit & Decrypt'}</button>
          {cpa?.flippedDec && <div style={{ marginTop: 8 }}><div className="hex-display red">Corrupted PT: {cpa.flippedDec}</div><span className="badge badge-broken" style={{ marginTop: 6 }}>Malleability demonstrated!</span></div>}
        </div>
        <div className="demo-half secure">
          <h5>✓ CCA / Encrypt-then-MAC</h5>
          {cca && <div className="hex-display dim" style={{ marginBottom: 8, fontSize: '0.7rem' }}>CT: {cca.ciphertext?.slice(0,32)}… | Tag: {cca.tag?.slice(0,16)}…</div>}
          <button className="btn btn-success" onClick={()=>flipAndDecrypt('cca')} disabled={!cca || loading}>{'Flip bit & Try Decrypt'}</button>
          {cca?.rejected && <div style={{ marginTop: 8 }}><div className="hex-display blue">Result: ⊥ (MAC verification failed)</div><span className="badge badge-secure" style={{ marginTop: 6 }}>CCA attack rejected!</span></div>}
          {cca?.flippedDec && <div style={{ marginTop: 8 }}><div className="hex-display red">Decrypted: {cca.flippedDec}</div></div>}
        </div>
      </div>
      {error && <div className="hex-display red" style={{ marginTop: 8 }}>Error: {error}</div>}
    </>
  );
}

function KeySeparationTab() {
  const [msg, setMsg] = useState('Secret message!!!!');
  const [encResult, setEncResult] = useState(null);
  const [macResult, setMacResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runDemo = async () => {
    setLoading(true);
    setMacResult(null);
    try {
      const m = Array.from(msg).map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('').padEnd(32,'0');
      const cca = await api.cca.encrypt(K_SAME, K_SAME, m);
      setEncResult({ r: cca.r, c: cca.ciphertext, m_hex: m });
    } finally { setLoading(false); }
  };

  const runAttack = async () => {
    if (!encResult) return;
    setLoading(true);
    try {
      const mac = await api.mac.sign(K_SAME, encResult.r);
      const ks = mac.tag;
      const c1 = encResult.c.slice(0, 32);
      let m1 = '';
      for(let i=0; i<32; i+=2) {
        m1 += (parseInt(c1.slice(i,i+2),16) ^ parseInt(ks.slice(i,i+2),16)).toString(16).padStart(2,'0');
      }
      setMacResult({ ks, m1_hex: m1, m1_str: m1.match(/.{2}/g).map(h=>String.fromCharCode(parseInt(h,16))).join('') });
    } finally { setLoading(false); }
  };

  return (
    <>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
        If kE = kM, the CTR mode encryption $C = m \oplus F_k(r)$ shares a key with the PRF-MAC $t = F_k(r||c)$. 
        An attacker can query the MAC oracle on just $r$ to receive $F_k(r)$, completely revealing the first block of the keystream!
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <input type="text" value={msg} onChange={e=>setMsg(e.target.value)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)' }} />
        <button className="btn btn-primary" onClick={runDemo} disabled={loading}>1. Encrypt (kE=kM)</button>
      </div>
      {encResult && (
        <div style={{ background: 'var(--bg-well)', padding: 12, borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>r: {encResult.r}</div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>c: {encResult.c}</div>
          <button className="btn btn-danger" onClick={runAttack} disabled={loading} style={{ marginTop: 10 }}>2. Query MAC Oracle on 'r'</button>
        </div>
      )}
      {macResult && (
        <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8, borderLeft: '3px solid var(--accent-red)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>MAC Oracle returned F_k(r) (keystream!):</div>
          <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-red)', marginBottom: 8 }}>{macResult.ks}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Recovered Plaintext (c ⊕ keystream):</div>
          <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>Hex: {macResult.m1_hex}</div>
          <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>Str: {macResult.m1_str}</div>
        </div>
      )}
    </>
  );
}

function IndCca2Tab() {
  const [m0, setM0] = useState('11111111111111111111111111111111');
  const [m1, setM1] = useState('22222222222222222222222222222222');
  const [pendingRound, setPendingRound] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [advantage, setAdvantage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [decQuery, setDecQuery] = useState('');
  const [decResult, setDecResult] = useState(null);

  const requestChallenge = async () => {
    if (m0.length !== m1.length) return;
    setLoading(true);
    setDecResult(null);
    try {
      const b = Math.random() < 0.5 ? 0 : 1;
      const msg = b === 0 ? m0 : m1;
      const cca = await api.cca.encrypt(KE, KM, msg);
      setPendingRound({ b, r: cca.r, c: cca.ciphertext, t: cca.tag });
    } finally { setLoading(false); }
  };

  const queryDecryption = async () => {
    if (!pendingRound || !decQuery) return;
    setLoading(true);
    try {
      // Must not query the exact challenge ciphertext
      if (decQuery.includes(pendingRound.c) && decQuery.includes(pendingRound.t)) {
        setDecResult('⊥ (Cannot query exact challenge ciphertext)');
        return;
      }
      
      // Parse query assuming format r:c:t
      const parts = decQuery.split(':');
      if (parts.length !== 3) {
        setDecResult('⊥ (Invalid format. Use r:c:t)');
        return;
      }
      
      const dec = await api.cca.decrypt(KE, KM, parts[0], parts[1], parts[2]);
      if (!dec.valid) setDecResult('⊥ (MAC Invalid)');
      else setDecResult(dec.plaintext);
    } finally { setLoading(false); }
  };

  const submitGuess = (guess) => {
    const b = pendingRound.b;
    const correct = guess === b;
    setRounds(prev => {
      const next = [...prev, { b, guess, correct, ct: pendingRound.c.slice(0,16)+'…' }].slice(-20);
      const wins = next.filter(rd=>rd.correct).length;
      setAdvantage(Math.abs(wins/next.length - 0.5));
      return next;
    });
    setPendingRound(null);
    setDecResult(null);
  };

  return (
    <>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
        IND-CCA2 Game: You have access to a Decryption Oracle, but you cannot query it on the exact challenge ciphertext (r, c, t). Since the scheme is CCA-secure, any tampered ciphertext will be rejected.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <HexInput label="m₀ (hex)" value={m0} onChange={setM0} disabled={!!pendingRound} />
        <HexInput label="m₁ (hex)" value={m1} onChange={setM1} disabled={!!pendingRound} />
      </div>
      
      {!pendingRound ? (
        <button className="btn btn-primary" onClick={requestChallenge} disabled={loading || m0.length !== m1.length}>
          Request Challenge
        </button>
      ) : (
        <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
            <div>Challenger sent (r, c, t):</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginTop: 4 }}>
              r: {pendingRound.r}<br/>c: {pendingRound.c}<br/>t: {pendingRound.t}
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>Decryption Oracle (r:c:t)</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={decQuery} onChange={e=>setDecQuery(e.target.value)} placeholder="r:c:t" style={{ flex: 1, fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }} />
              <button className="btn btn-secondary" onClick={queryDecryption} disabled={loading}>Query</button>
            </div>
            {decResult && <div style={{ marginTop: 6, fontSize: '0.75rem', color: decResult.includes('⊥') ? 'var(--accent-red)' : 'var(--accent-green)' }}>Result: {decResult}</div>}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
            <span style={{ fontSize: '0.85rem', marginRight: 10 }}>Your guess:</span>
            <button className="btn btn-primary" style={{ marginRight: 6 }} onClick={() => submitGuess(0)}>m₀</button>
            <button className="btn btn-primary" onClick={() => submitGuess(1)}>m₁</button>
          </div>
        </div>
      )}
      
      <div style={{ marginTop: 14, fontSize: '0.78rem' }}>
        Advantage: {(advantage*100).toFixed(1)}% | Rounds: {rounds.length}
      </div>
    </>
  );
}

export default function PA6Demo({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('malleability');

  const tabStyle = (t) => ({
    padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem',
    background: activeTab === t ? 'var(--accent-blue-bg)' : 'var(--bg-well)',
    color: activeTab === t ? 'var(--accent-blue)' : 'var(--text-secondary)',
    border: `1px solid ${activeTab === t ? 'var(--accent-blue)' : 'var(--border)'}`,
    fontWeight: activeTab === t ? 600 : 400,
  });

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={6} title="CCA Encrypt-then-MAC" tag="IND-CCA2" onReset={() => {}} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button style={tabStyle('malleability')} onClick={() => setActiveTab('malleability')}>Malleability Attack</button>
          <button style={tabStyle('keysep')} onClick={() => setActiveTab('keysep')}>Key Separation</button>
          <button style={tabStyle('cca2')} onClick={() => setActiveTab('cca2')}>IND-CCA2 Game</button>
        </div>
        
        {activeTab === 'malleability' && <MalleabilityTab />}
        {activeTab === 'keysep' && <KeySeparationTab />}
        {activeTab === 'cca2' && <IndCca2Tab />}

        {onNavigate && (
          <div className="demo-related" style={{ marginTop: 16 }}>
            <span className="demo-related-label">Related:</span>
            <button className="demo-xlink" onClick={() => onNavigate('PA3')}>PA3 IND-CPA Enc →</button>
          </div>
        )}
      </div>
    </div>
  );
}
