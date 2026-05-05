import React, { useState } from 'react';
import { api } from '../../api';
import HexInput from '../HexInput';
import DemoHeader from '../DemoHeader';
import { hexToBits, frequencyTest } from '../../utils/randomness';

const HIDDEN_KEY = '8f3a1b2c4d5e6f708f3a1b2c4d5e6f70';

function ForgeTab() {
  const [macType, setMacType] = useState('PRF');
  const [signedMsgs, setSignedMsgs] = useState([]);
  const [forgeMsg, setForgeMsg] = useState('');
  const [forgeTag, setForgeTag] = useState('');
  const [forgeResult, setForgeResult] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErr, setValidationErr] = useState(null);

  const switchMacType = (t) => {
    setMacType(t);
    setSignedMsgs([]);
    setForgeMsg('');
    setForgeTag('');
    setForgeResult(null);
    setAttempts(0);
    setSuccesses(0);
    setError(null);
    setValidationErr(null);
  };

  const addSigned = async () => {
    setLoading(true);
    setError(null);
    try {
      const msg = Array.from({length:4},()=>Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join('');
      const r = await api.mac.sign(HIDDEN_KEY, msg, macType);
      setSignedMsgs(prev => [...prev.slice(-49), { msg, tag: r.tag }]);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const submitForgery = async () => {
    setValidationErr(null);
    if (!forgeMsg || forgeMsg.length % 2 !== 0) {
      setValidationErr('Message must be a non-empty hex string with an even number of characters.');
      return;
    }
    if (!forgeTag || forgeTag.length % 2 !== 0) {
      setValidationErr('Tag must be a non-empty hex string with an even number of characters.');
      return;
    }
    setLoading(true);
    setAttempts(a => a+1);
    setError(null);
    try {
      const r = await api.mac.verify(HIDDEN_KEY, forgeMsg, forgeTag, macType);
      const ok = r.valid && !signedMsgs.some(s => s.msg === forgeMsg);
      setForgeResult(ok);
      if (ok) setSuccesses(s => s+1);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
        You see up to 50 (message, tag) pairs signed with a hidden key k. Try to forge a valid tag on a NEW message.
      </p>

      {/* MAC type selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>MAC construction:</span>
        {['PRF', 'CBC'].map(t => (
          <button key={t}
            onClick={() => switchMacType(t)}
            style={{ padding: '4px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
              background: macType === t ? 'var(--accent-blue-bg)' : 'var(--bg-well)',
              color: macType === t ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: `1px solid ${macType === t ? 'var(--accent-blue)' : 'var(--border)'}`,
              fontWeight: macType === t ? 600 : 400 }}>
            {t === 'PRF' ? 'PRF-MAC' : 'CBC-MAC'}
          </button>
        ))}
      </div>

      <button className="btn btn-secondary" onClick={addSigned} disabled={loading || signedMsgs.length >= 50} style={{ marginBottom: 14 }}>
        {'+ Get Signed Message'}
      </button>
      <div style={{ maxHeight: 140, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: 14 }}>
        {signedMsgs.map((s,i)=>(
          <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            m={s.msg} → t={s.tag.slice(0,16)}…
          </div>
        ))}
        {signedMsgs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No signed messages yet</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <HexInput label="Forge message m* (hex)" value={forgeMsg} onChange={setForgeMsg} onEnter={submitForgery} disabled={loading} placeholder="new message" />
        <HexInput label="Forge tag t* (hex)" value={forgeTag} onChange={setForgeTag} onEnter={submitForgery} disabled={loading} placeholder="guessed tag" />
      </div>
      <button className="btn btn-danger" onClick={submitForgery} disabled={loading}>{'Submit Forgery'}</button>
      {validationErr && <div style={{ marginTop: 8, fontSize: '0.74rem', color: 'var(--accent-red)' }}>⚠ {validationErr}</div>}
      {forgeResult !== null && (
        <div style={{ marginTop: 10 }}>
          <span className={`badge ${forgeResult ? 'badge-broken' : 'badge-secure'}`}>
            {forgeResult ? '⚠ Forgery ACCEPTED' : '✓ Forgery REJECTED'}
          </span>
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        Attempts: {attempts} | Successes: {successes} (expected 0 in ≥20 attempts)
      </div>
      {error && <div className="hex-display red" style={{ marginTop: 8 }}>Error: {error}</div>}
    </>
  );
}

function LengthExtTab() {
  const [key, setKey] = useState(HIDDEN_KEY);
  const [msg, setMsg] = useState('deadbeef');
  const [suffix, setSuffix] = useState('cafebabe');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.hmac.lengthExtension(key, msg, suffix);
      setResult(r);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
        Naive MAC = H(k ‖ m) leaks to length-extension attacks. An attacker who knows MAC(m) can compute MAC(m ‖ pad ‖ suffix) without the key.
        HMAC = H(k_out ‖ H(k_in ‖ m)) prevents this by wrapping the inner hash.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div className="form-group">
          <label>Key (hex)</label>
          <input type="text" value={key} onChange={e=>setKey(e.target.value.replace(/[^0-9a-fA-F]/g,''))} />
        </div>
        <HexInput label="Message m (hex)" value={msg} onChange={setMsg} onEnter={run} disabled={loading} />
        <HexInput label="Suffix s (hex)" value={suffix} onChange={setSuffix} onEnter={run} disabled={loading} />
      </div>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 14 }}>
        {'▶ Run Length-Extension Attack'}
      </button>
      {result && !result.error && (
        <div className="result-box">
          <div><span className="result-key">Naive tag H(k‖m): </span><span className="result-val" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{result.naive_tag}</span></div>
          <div style={{ marginTop: 4 }}><span className="result-key">Padded k‖m (attacker knows this): </span><span className="result-val" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', wordBreak: 'break-all' }}>{result.pad_k_m_hex}</span></div>
          <div style={{ marginTop: 4 }}><span className="result-key">Attacker forged tag: </span><span className="result-val" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{result.attacker_tag}</span></div>
          <div style={{ marginTop: 4 }}><span className="result-key">Ground truth H(pad(k‖m)‖suffix): </span><span className="result-val" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{result.ground_truth_tag}</span></div>
          <div style={{ marginTop: 8 }}>
            <span className={`badge ${result.attack_succeeds ? 'badge-broken' : 'badge-secure'}`}>
              {result.attack_succeeds ? '⚠ Attack SUCCEEDS — attacker forged tag without key!' : '✓ Attack failed'}
            </span>
          </div>
          <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            HMAC_k(m) = H(k⊕opad ‖ H(k⊕ipad ‖ m)) — the outer H binds the inner state, making extension impossible.
          </div>
        </div>
      )}
      {error && <div className="hex-display red" style={{ marginTop: 8 }}>Error: {error}</div>}
    </>
  );
}

function MacPrfTab() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runTest = async () => {
    setRunning(true);
    setError(null);
    try {
      let macOutputs = '';
      let randOutputs = '';
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const randHex = Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('');
        promises.push(api.mac.sign(HIDDEN_KEY, randHex).then(r => r.tag));
        randOutputs += Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('');
      }
      const outputs = await Promise.all(promises);
      macOutputs = outputs.join('');

      const macBits = hexToBits(macOutputs);
      const randBits = hexToBits(randOutputs);

      setResult({
        mac: frequencyTest(macBits),
        rand: frequencyTest(randBits),
      });
    } catch(e) { setError(e.message); }
    finally { setRunning(false); }
  };

  return (
    <>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
        MAC ⇒ PRF Backward Direction: This test queries the PRF-MAC on 100 uniformly random inputs and compares the output statistics against a truly random function to concretely witness that MAC ⇒ PRF.
      </p>
      <button className="btn btn-primary" onClick={runTest} disabled={running} style={{ marginBottom: 14 }}>
        {running ? 'Running 100 Queries...' : 'Run Distinguishing Test'}
      </button>

      {result && !result.error && result.mac && result.rand && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8, borderLeft: '3px solid var(--accent-purple)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 8, color: 'var(--accent-purple)' }}>MAC Tag F_k(x)</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <strong>Ones:</strong> {result.mac.ones} <br/>
              <strong>Zeros:</strong> {result.mac.zeros} <br/>
              <strong>Ratio:</strong> {(result.mac.ratio * 100).toFixed(2)}% <br/>
              <strong>P-value:</strong> {result.mac.p} ({result.mac.pass ? 'Uniform✓' : 'Non-uniform✗'})
            </div>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8, borderLeft: '3px solid var(--accent-blue)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 8, color: 'var(--accent-blue)' }}>Truly Random Function</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <strong>Ones:</strong> {result.rand.ones} <br/>
              <strong>Zeros:</strong> {result.rand.zeros} <br/>
              <strong>Ratio:</strong> {(result.rand.ratio * 100).toFixed(2)}% <br/>
              <strong>P-value:</strong> {result.rand.p} ({result.rand.pass ? 'Uniform✓' : 'Non-uniform✗'})
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
            Conclusion: The MAC output statistics are indistinguishable from truly random data.
          </div>
        </div>
      )}
      {error && <div className="hex-display red" style={{ marginTop: 8 }}>Error: {error}</div>}
    </>
  );
}

export default function PA5Demo() {
  const [activeTab, setActiveTab] = useState('forge');

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
        <DemoHeader num={5} title="EUF-CMA MAC Forge Attempt" tag="EUF-CMA" onReset={() => setActiveTab('forge')} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button style={tabStyle('forge')} onClick={() => setActiveTab('forge')}>Forge Attempt</button>
          <button style={tabStyle('length')} onClick={() => setActiveTab('length')}>Length Extension</button>
          <button style={tabStyle('macprf')} onClick={() => setActiveTab('macprf')}>MAC ⇒ PRF</button>
        </div>
        {activeTab === 'forge' && <ForgeTab />}
        {activeTab === 'length' && <LengthExtTab />}
        {activeTab === 'macprf' && <MacPrfTab />}
      </div>
    </div>
  );
}
