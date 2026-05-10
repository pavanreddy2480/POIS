import React, { useState } from 'react';
import { post } from '../../api';
import DemoHeader from '../DemoHeader';

const M_PRESETS = ['7', '42', '1337', '9999'];

function KeyRow({ label, val, accent }) {
  const s = String(val ?? '');
  return (
    <div style={{ fontSize: '0.61rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 3, display: 'flex', gap: 6 }}>
      <span style={{ color: 'var(--text-secondary)', minWidth: 56, flexShrink: 0 }}>{label} =</span>
      <span style={{ color: accent || 'var(--text-primary)', wordBreak: 'break-all' }}>
        {s}
      </span>
    </div>
  );
}

function GroupPanel({ label, data, good }) {
  const color = good ? 'var(--accent-green)' : 'var(--accent-red)';
  const adv = typeof data.advantage === 'number' ? data.advantage.toFixed(4) : '—';
  return (
    <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 10, border: `1px solid ${color}44` }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', lineHeight: 1.9 }}>
        <div>
          Group order |q| = <span style={{ color: 'var(--text-primary)' }}>{data.q_bits} bits</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>(p = 2q+1 is {data.q_bits + 1}-bit safe prime)</span>
        </div>
        <div>{data.rounds} rounds · {data.correct} correct</div>
        <div>Adversary advantage: <span style={{ color, fontWeight: 700 }}>{adv}</span></div>
      </div>
      <div style={{ marginTop: 6 }}>
        <span className={`badge ${good ? 'badge-secure' : 'badge-danger'}`} style={{ fontSize: '0.59rem' }}>
          {good ? '✓ CPA-secure (DDH hard)' : '⚡ DLP brute-force breaks it'}
        </span>
      </div>
    </div>
  );
}

export default function PA16Demo() {
  const [m, setM]           = useState('42');
  const [k, setK]           = useState('2');
  const [step, setStep]     = useState(0);   // 0=idle 1=enc 2=multiplied 3=decrypted
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [counter, setCounter] = useState({ success: 0, total: 0 });
  const [cpaResult, setCpaResult] = useState(null);
  const [cpaLoading, setCpaLoading] = useState(false);

  function reset() { setStep(0); setResult(null); setError(null); }

  async function encrypt() {
    const mInt = parseInt(m, 10);
    const kInt = parseInt(k, 10);
    if (isNaN(mInt) || isNaN(kInt)) return;
    setLoading(true); setError(null); setStep(0); setResult(null);
    try {
      const r = await post('/elgamal/demo', { message: mInt, multiplier: kInt });
      setResult(r);
      setStep(1);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function doMultiply() { setStep(2); }

  function doDecrypt() {
    setStep(3);
    setCounter(c => ({
      success: c.success + (result?.success ? 1 : 0),
      total: c.total + 1,
    }));
  }

  async function runCpaGame() {
    setCpaLoading(true);
    try {
      const r = await post('/elgamal/cpa_game', {});
      setCpaResult(r);
    } catch (e) {
      setCpaResult({ error: e.message });
    }
    setCpaLoading(false);
  }

  function trunc(s) {
    return String(s ?? '');
  }

  const kLabel = result?.multiplier ?? k;

  return (
    <div>
      <style>{`
        @keyframes pa16In {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pa16-in { animation: pa16In 0.28s ease forwards; }
      `}</style>

      <div className="demo-card">
        <DemoHeader num={16} title="ElGamal Public-Key Cryptosystem" tag="PKC" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          ElGamal: <code>Enc(pk, m) = (g^r, m·h^r)</code> — CPA-secure under the DDH assumption.
          Multiplicatively malleable: multiplying <code>c₂</code> by <code>k</code> yields a
          ciphertext decrypting to <code>k·m</code>, proving it is <strong>not</strong> CCA-secure.
        </p>

        {/* ── Inputs ── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Plaintext m (integer)
            </label>
            <div style={{ display: 'flex', gap: 4, marginBottom: 5, flexWrap: 'wrap' }}>
              {M_PRESETS.map(v => (
                <button key={v} className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  onClick={() => { setM(v); reset(); }}>
                  {v}
                </button>
              ))}
            </div>
            <input type="text" value={m}
              onChange={e => { setM(e.target.value); reset(); }}
              onKeyDown={e => e.key === 'Enter' && !loading && encrypt()}
              placeholder="e.g. 42" />
          </div>
          <div style={{ width: 100 }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Multiplier k
            </label>
            <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
              {['2', '3', '5'].map(v => (
                <button key={v} className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  onClick={() => { setK(v); reset(); }}>
                  {v}
                </button>
              ))}
            </div>
            <input type="text" value={k}
              onChange={e => { setK(e.target.value); reset(); }} />
          </div>
        </div>

        <button className="btn btn-primary" onClick={encrypt}
          disabled={loading || !m || !k}
          style={{ marginBottom: 14 }}>
          {loading ? '⏳ Generating keys & encrypting…' : '▶ Encrypt'}
        </button>
        {error && <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: 10 }}>{error}</p>}

        {/* ── Step 1: Keys + Ciphertext ── */}
        {step >= 1 && result && (
          <div className="pa16-in">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {/* Public key */}
              <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 6 }}>
                  Public Key (pk)
                </div>
                <KeyRow label="p" val={result.p} />
                <KeyRow label="g" val={result.g} />
                <KeyRow label="q" val={result.q} />
                <KeyRow label="h = g^x" val={result.h} accent="var(--accent-blue)" />
              </div>
              {/* Private key + m */}
              <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-orange)', marginBottom: 6 }}>
                  Private Key (sk)
                </div>
                <KeyRow label="sk = x" val={result.sk} accent="var(--accent-orange)" />
                <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  <KeyRow label="m (mod q)" val={result.m} accent="var(--accent-green)" />
                </div>
              </div>
            </div>

            {/* Ciphertext + honest decrypt */}
            <div style={{ background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.25)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 8 }}>
                Enc(pk, m) = (c₁, c₂)
              </div>
              <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                <div style={{ wordBreak: 'break-all' }}>c₁ = g^r mod p &nbsp;= <span style={{ color: 'var(--text-primary)' }}>{trunc(result.c1)}</span></div>
                <div style={{ wordBreak: 'break-all' }}>c₂ = m·h^r mod p = <span style={{ color: 'var(--text-primary)' }}>{trunc(result.c2)}</span></div>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.72rem' }}>
                Honest Dec(sk, c₁, c₂) ={' '}
                <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {result.decrypted}
                </span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginLeft: 6 }}>(= m ✓)</span>
              </div>
            </div>

            {step === 1 && (
              <button className="btn btn-secondary" onClick={doMultiply}
                style={{ marginBottom: 12 }}>
                ×{kLabel} &nbsp;Multiply c₂ by {kLabel}
              </button>
            )}
          </div>
        )}

        {/* ── Step 2: Modified ciphertext ── */}
        {step >= 2 && result && (
          <div className="pa16-in" style={{ marginBottom: 12 }}>
            <div style={{ background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>
                Attacker: c₂' = {kLabel}·c₂ mod p
              </div>
              <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                <div style={{ wordBreak: 'break-all' }}>c₁' = c₁ = <span style={{ color: 'var(--text-primary)' }}>{trunc(result.c1)}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>(unchanged)</span></div>
                <div style={{ wordBreak: 'break-all' }}>c₂' = {kLabel}·c₂ mod p = <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>{trunc(result.c2_prime)}</span></div>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                (c₁', c₂') is a valid ElGamal ciphertext — constructed without knowing sk or r.
              </div>
            </div>
            {step === 2 && (
              <button className="btn btn-primary" onClick={doDecrypt}
                style={{ marginTop: 10, background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}>
                🔓 Decrypt Modified Ciphertext
              </button>
            )}
          </div>
        )}

        {/* ── Step 3: Malleability result ── */}
        {step >= 3 && result && (
          <div className="pa16-in" style={{ marginBottom: 12 }}>
            <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.35)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>
                Decryption Oracle returns:
              </div>
              <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', fontWeight: 700, marginBottom: 6 }}>
                Dec(sk, c₁, {kLabel}·c₂) ={' '}
                <span style={{ color: 'var(--accent-orange)' }}>{result.malleable_decrypted}</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                = {kLabel} × {result.m} = {result.expected_malleable}
              </div>

              <span className={`badge ${result.success ? 'badge-danger' : 'badge-secure'}`}>
                {result.success
                  ? `⚡ Malleability confirmed: Dec(c₁, ${kLabel}c₂) = ${kLabel}·m`
                  : '? Result mismatch — check parameters'}
              </span>

              {/* Math proof */}
              <div style={{ marginTop: 10, fontSize: '0.66rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'var(--bg-well)', padding: '8px 10px', borderRadius: 6, lineHeight: 1.8 }}>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 2 }}>Why this works:</div>
                <div>Dec(c₁, k·c₂) = k·c₂ / c₁^x</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= k·(m·h^r) / (g^r)^x</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= k·m · g^(xr) / g^(xr)</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= k·m &nbsp;✓</div>
              </div>
            </div>

            {/* Success counter */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Malleability success rate:&nbsp;
                <span style={{ fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                  {counter.success}/{counter.total}
                  {counter.total > 0 && ` (${Math.round(100 * counter.success / counter.total)}%)`}
                </span>
              </div>
              <button className="btn btn-secondary"
                style={{ fontSize: '0.72rem', padding: '3px 12px' }}
                onClick={encrypt}>
                Run Again
              </button>
            </div>
          </div>
        )}

        {/* ── CPA Game + CCA Oracle ── */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            IND-CPA Game &amp; CCA Oracle Demo
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
            With a large group DDH is hard → random adversary has advantage ≈ 0.
            With a tiny group (q ≈ 2¹⁰) brute-force DLP solves every round.
            The CCA oracle shows that a decryption query on a modified ciphertext leaks m.
          </p>

          <button className="btn btn-secondary" onClick={runCpaGame} disabled={cpaLoading}
            style={{ marginBottom: 14 }}>
            {cpaLoading ? '⏳ Running…' : '▶ Run IND-CPA Game'}
          </button>

          {cpaResult?.error && (
            <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: 10 }}>{cpaResult.error}</p>
          )}

          {cpaResult && !cpaResult.error && (
            <div className="pa16-in">
              {/* Large vs Small comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <GroupPanel label="Large Group (DDH hard)" data={cpaResult.large_group} good />
                <GroupPanel label="Small Group (DDH easy)" data={cpaResult.small_group} good={false} />
              </div>

              {/* CCA oracle */}
              {cpaResult.cca_demo && (
                <div style={{ background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.28)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>
                    CCA Oracle: ElGamal Fails CCA Security
                  </div>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                    <div>Challenge m = <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{cpaResult.cca_demo.m}</span></div>
                    <div style={{ wordBreak: 'break-all' }}>Enc(pk, m) → c₁ = {trunc(cpaResult.cca_demo.c1)}</div>
                    <div>Attacker submits (c₁, 2·c₂) to oracle:</div>
                    <div style={{ paddingLeft: 12, wordBreak: 'break-all' }}>
                      c₂' = 2·c₂ mod p = {trunc(cpaResult.cca_demo.c2_modified)}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      Oracle returns:{' '}
                      <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>
                        {cpaResult.cca_demo.oracle_returned}
                      </span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                        = 2·{cpaResult.cca_demo.m}{' '}
                        {cpaResult.cca_demo.equals_2m ? '✓' : '?'}
                      </span>
                    </div>
                    <div>
                      Attacker recovers m = oracle / 2 ={' '}
                      <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>
                        {cpaResult.cca_demo.recovered_m}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: '0.68rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    Confirm: Dec(c₁, 2c₂) = 2 · Dec(c₁, c₂) = 2·m for <em>any</em> message.
                    Without AEAD/signature on the ciphertext, the decryption oracle leaks the plaintext.
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span className="badge badge-danger">⚡ CCA security broken — oracle reveals m</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
