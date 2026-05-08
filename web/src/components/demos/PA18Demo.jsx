import React, { useState } from 'react';
import { post } from '../../api';
import DemoHeader from '../DemoHeader';

function StepBox({ num, color, title, children }) {
  const c = color || 'var(--accent-blue)';
  return (
    <div style={{ background: 'var(--bg-well)', border: `1px solid ${c}33`, borderLeft: `3px solid ${c}`,
      borderRadius: 8, padding: 10, marginBottom: 8 }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: c, marginBottom: 6 }}>
        Step {num} — {title}
      </div>
      {children}
    </div>
  );
}

export default function PA18Demo() {
  const [m0, setM0] = useState('42');
  const [m1, setM1] = useState('99');
  const [chosenB, setChosenB] = useState(null);
  const [step, setStep] = useState(0);   // 0=idle 1=ran 2=cheated
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function reset() { setStep(0); setResult(null); setError(null); setChosenB(null); }

  async function runOT(b) {
    const m0i = parseInt(m0, 10);
    const m1i = parseInt(m1, 10);
    if (isNaN(m0i) || isNaN(m1i)) { setError('Enter valid integers for m₀ and m₁'); return; }
    setChosenB(b);
    setLoading(true); setError(null); setStep(0); setResult(null);
    try {
      const r = await post('/ot/demo', { b, m0: m0i, m1: m1i });
      setResult(r);
      setStep(1);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function trunc(s, n = 18) {
    s = String(s ?? '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  const m0i = parseInt(m0, 10) || 42;
  const m1i = parseInt(m1, 10) || 99;
  const b = chosenB;

  return (
    <div>
      <style>{`
        @keyframes pa18In {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pa18-in { animation: pa18In 0.28s ease forwards; }
      `}</style>

      <div className="demo-card">
        <DemoHeader num={18} title="1-of-2 Oblivious Transfer (Bellare-Micali)" tag="OT" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Receiver learns <code>m_b</code> and <em>nothing</em> about <code>m_{'{1-b}'}</code>.
          Sender learns <em>nothing</em> about <code>b</code>.
          Built on PA#16 ElGamal: receiver generates an honest <code>pk_b</code> (keeps <code>sk_b</code>)
          and a trapdoor-free <code>pk_{'{1-b}'}</code> (random group element — no secret key known).
        </p>

        {/* ── Alice / Bob panels ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>

          {/* Alice's panel — muted */}
          <div style={{ background: 'rgba(100,100,100,0.06)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)',
              marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Alice (Sender)
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 3 }}>m₀</div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                {[7, 42, 100].map(v => (
                  <button key={v} className="btn btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '2px 7px' }}
                    onClick={() => { setM0(String(v)); reset(); }}>
                    {v}
                  </button>
                ))}
              </div>
              <input type="text" value={m0} onChange={e => { setM0(e.target.value); reset(); }}
                placeholder="integer" style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 3 }}>m₁</div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                {[13, 99, 200].map(v => (
                  <button key={v} className="btn btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '2px 7px' }}
                    onClick={() => { setM1(String(v)); reset(); }}>
                    {v}
                  </button>
                ))}
              </div>
              <input type="text" value={m1} onChange={e => { setM1(e.target.value); reset(); }}
                placeholder="integer" style={{ width: '100%' }} />
            </div>

            <div style={{ marginTop: 8, fontSize: '0.62rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Alice's messages are hidden from Bob during the protocol.
            </div>
          </div>

          {/* Bob's panel — interactive */}
          <div style={{ background: 'rgba(52,152,219,0.05)', border: '1px solid rgba(52,152,219,0.3)',
            borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-blue)',
              marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Bob (Receiver) — you play this role
            </div>

            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
              Choose which message to receive:
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[0, 1].map(v => (
                <button key={v}
                  className={`btn ${b === v && step > 0 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }}
                  onClick={() => runOT(v)} disabled={loading}>
                  {loading && b === v ? '⏳' : `Choose ${v}`}
                </button>
              ))}
            </div>

            {/* Bob's message view */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[0, 1].map(i => {
                const chosen = result !== null && b === i;
                const other  = result !== null && b !== i;
                return (
                  <div key={i} style={{
                    textAlign: 'center', padding: '10px 4px', borderRadius: 6,
                    background: chosen ? 'rgba(39,174,96,0.12)' : 'rgba(100,100,100,0.06)',
                    border: `1px solid ${chosen ? 'rgba(39,174,96,0.4)' : 'var(--border)'}`,
                  }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 4 }}>m{i}</div>
                    <div style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: chosen ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                      {chosen ? result.m_b : other ? '??' : '—'}
                    </div>
                    <div style={{ fontSize: '0.58rem', marginTop: 3,
                      color: chosen ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                      {chosen ? 'received ✓' : other ? 'hidden' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {error && <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: 10 }}>{error}</p>}

        {/* ── Protocol trace ── */}
        {step >= 1 && result && (
          <div className="pa18-in">
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)',
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Protocol Trace (b = {b})
            </div>

            <StepBox num={1} color="var(--accent-blue)" title="Bob: Generate Key Pairs">
              <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.9 }}>
                <div>
                  pk₀.h = <span style={{ color: b === 0 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                    {trunc(result.pk0_h)}
                  </span>
                  <span style={{ marginLeft: 8 }}>
                    {b === 0
                      ? <span style={{ color: 'var(--accent-green)' }}>← honest key (has sk₀)</span>
                      : <span style={{ color: 'var(--text-muted)' }}>← random (no trapdoor)</span>}
                  </span>
                </div>
                <div>
                  pk₁.h = <span style={{ color: b === 1 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                    {trunc(result.pk1_h)}
                  </span>
                  <span style={{ marginLeft: 8 }}>
                    {b === 1
                      ? <span style={{ color: 'var(--accent-green)' }}>← honest key (has sk₁)</span>
                      : <span style={{ color: 'var(--text-muted)' }}>← random (no trapdoor)</span>}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                Both pk₀ and pk₁ look like uniform group elements to Alice — b is computationally hidden (receiver privacy).
              </div>
            </StepBox>

            <StepBox num={2} color="var(--accent-orange)" title="Alice: Encrypt Both Messages">
              <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.9 }}>
                <div>C₀ = Enc(pk₀, m₀={m0i}) = ({trunc(result.C0[0])}, {trunc(result.C0[1])})</div>
                <div>C₁ = Enc(pk₁, m₁={m1i}) = ({trunc(result.C1[0])}, {trunc(result.C1[1])})</div>
              </div>
              <div style={{ marginTop: 6, fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                Alice sends (C₀, C₁) to Bob. She cannot tell which ciphertext Bob will be able to decrypt.
              </div>
            </StepBox>

            <StepBox num={3} color="var(--accent-green)" title={'Bob: Decrypt C' + b}>
              <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.9 }}>
                <div>
                  Dec(sk{b}, C{b}) ={' '}
                  <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.82rem' }}>
                    {result.m_b}
                  </span>
                  {result.m_b_correct && <span style={{ color: 'var(--accent-green)', marginLeft: 6 }}>= m{b} ✓</span>}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  C{1 - b}: no sk{1 - b} → cannot decrypt → m{1 - b} = <strong style={{ color: 'var(--accent-red)' }}>??</strong>
                </div>
              </div>
            </StepBox>

            {/* Cheat attempt button */}
            {step === 1 && (
              <button className="btn btn-secondary" onClick={() => setStep(2)}
                style={{ marginBottom: 12, fontSize: '0.8rem' }}>
                💀 Cheat Attempt: Bob tries to decrypt C{1 - b}
              </button>
            )}

            {step >= 2 && (
              <div className="pa18-in" style={{ marginBottom: 12 }}>
                <div style={{ background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.28)',
                  borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>
                    Cheat: Bob applies sk{b} to C{1 - b}
                  </div>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                    <div>
                      Dec(sk{b}, C{1 - b}) ={' '}
                      <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>{result.cheat_dec}</span>
                    </div>
                    <div>Expected m{1 - b} = <span style={{ color: 'var(--text-primary)' }}>{result.m_other}</span></div>
                    <div>
                      Match:{' '}
                      <span style={{ color: result.cheat_matches ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                        {result.cheat_matches ? 'yes (coincidence!)' : 'NO — garbage output'}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    pk{1 - b} is a random group element with no known discrete log.
                    Applying sk{b} (the wrong key) decrypts to a random group element, not m{1 - b}.
                    Recovering m{1 - b} from C{1 - b} requires solving DLP — computationally hard.
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span className="badge badge-secure">✓ Sender privacy holds — m{1 - b} is computationally protected</span>
                  </div>
                </div>
              </div>
            )}

            {/* Correctness + privacy summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <div style={{ background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.25)',
                borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-green)', marginBottom: 6 }}>
                  Correctness — 100 Trials
                </div>
                <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.9rem' }}>
                    {result.correctness_pass}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>/{result.correctness_trials} passed</span>
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
                  Random b ∈ {'{'} 0, 1 {'}'} and random (m₀, m₁) each trial.
                  Receiver always recovers m_b correctly.
                </div>
              </div>

              <div style={{ background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.25)',
                borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 6 }}>
                  Privacy Guarantees
                </div>
                <div style={{ fontSize: '0.61rem', color: 'var(--text-muted)', lineHeight: 1.75 }}>
                  <div>
                    <strong style={{ color: 'var(--text-secondary)' }}>Receiver:</strong>{' '}
                    Sender sees (pk₀, pk₁) — both uniform group elements. b is computationally hidden.
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Sender:</strong>{' '}
                    Receiver holds only sk_b. Decrypting C_{'{1-b}'} requires solving DLP — infeasible.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
