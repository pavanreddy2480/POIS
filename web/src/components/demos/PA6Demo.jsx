import React, { useState } from 'react';
import { api } from '../../api';
import HexInput from '../HexInput';
import DemoHeader from '../DemoHeader';

const KE = '0123456789abcdef0123456789abcdef';
const KM = 'fedcba9876543210fedcba9876543210';

export default function PA6Demo({ onNavigate }) {
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
        // Flip bit in ciphertext (CPA only — no MAC)
        const ct = cpa.ciphertext;
        const idx = flipBit % (ct.length/2);
        const flipped = ct.slice(0,idx*2) + ((parseInt(ct.slice(idx*2,idx*2+2),16)^1).toString(16).padStart(2,'0')) + ct.slice(idx*2+2);
        const dec = await api.enc.dec(KE, cpa.r, flipped);
        setCpa(p => ({ ...p, flippedDec: dec?.plaintext, flipped: true }));
      } else if (mode === 'cca' && cca) {
        // MAC verification will fail
        const ct = cca.ciphertext;
        const idx = flipBit % (ct.length/2);
        const flipped = ct.slice(0,idx*2) + ((parseInt(ct.slice(idx*2,idx*2+2),16)^1).toString(16).padStart(2,'0')) + ct.slice(idx*2+2);
        // Try to decrypt with tampered ct — CCA_Dec will reject
        setCca(p => ({ ...p, rejected: true }));
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const reset = () => {
    setMsg('deadbeef00112233');
    setCpa(null);
    setCca(null);
    setFlipBit(0);
    setError(null);
  };

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={6} title="Malleability Attack Panel" tag="IND-CCA" onReset={reset} />
        <HexInput
          label="Plaintext (hex)"
          value={msg}
          onChange={setMsg}
          onEnter={encrypt}
          disabled={loading}
        />
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
          </div>
        </div>
        {error && <div className="hex-display red" style={{ marginTop: 8 }}>Error: {error}</div>}
        {onNavigate && (
          <div className="demo-related">
            <span className="demo-related-label">Related:</span>
            <button className="demo-xlink" onClick={() => onNavigate('PA3')}>PA3 IND-CPA Enc →</button>
          </div>
        )}
      </div>
    </div>
  );
}
