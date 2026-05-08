import React, { useState } from 'react';
import { api } from '../../api';
import DemoHeader from '../DemoHeader';

function StepBox({ num, color, title, children }) {
  const c = color || 'var(--accent-blue)';
  return (
    <div style={{ background: 'var(--bg-well)', border: `1px solid ${c}33`,
      borderLeft: `3px solid ${c}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: c, marginBottom: 8 }}>
        Step {num} — {title}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value, valueColor, sub }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 6,
      fontSize: '0.65rem', fontFamily: 'var(--font-mono)', lineHeight: 1.9 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div>
        <span style={{ color: valueColor || 'var(--text-primary)' }}>{value}</span>
        {sub && <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.58rem' }}>{sub}</span>}
      </div>
    </div>
  );
}

function trunc(s, n = 16) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const COMBOS = [{ a: 0, b: 0 }, { a: 0, b: 1 }, { a: 1, b: 0 }, { a: 1, b: 1 }];

export default function PA19Demo() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [result, setResult] = useState(null);
  const [allResult, setAllResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [error, setError] = useState(null);

  function reset() { setResult(null); setError(null); }

  async function runDemo() {
    setLoading(true); setError(null); setResult(null); setAllResult(null);
    try {
      const r = await api.secureAnd.demo(a, b);
      setResult(r);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function runAll() {
    setLoadingAll(true); setError(null);
    try {
      const r = await api.secureAnd.runAll();
      setAllResult(r);
    } catch (e) { setError(e.message); }
    setLoadingAll(false);
  }

  return (
    <div>
      <style>{`
        @keyframes pa19In { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .pa19-in { animation: pa19In 0.3s ease forwards; }
      `}</style>

      <div className="demo-card">
        <DemoHeader num={19} title="Secure AND Gate via OT" tag="MPC" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          AND + XOR form a <strong>functionally complete</strong> basis. <strong>AND</strong> uses 1
          OT call (PA#18). <strong>XOR</strong> and <strong>NOT</strong> are free via additive secret sharing.
        </p>

        {/* ── Input panels ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {/* Alice */}
          <div style={{ background: 'rgba(52,152,219,0.06)', border: '1px solid rgba(52,152,219,0.3)',
            borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-blue)',
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Alice — OT Sender
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              Bit a
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1].map(v => (
                <button key={v}
                  className={`btn ${a === v ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: '1.2rem', padding: '10px',
                    fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                  onClick={() => { setA(v); reset(); }}>
                  {v}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.62rem', color: 'var(--text-muted)' }}>
              Sends OT messages (m₀, m₁) = (0, a) — her bit is hidden from Bob.
            </div>
          </div>

          {/* Bob */}
          <div style={{ background: 'rgba(243,156,18,0.06)', border: '1px solid rgba(243,156,18,0.3)',
            borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-orange)',
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Bob — OT Receiver
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              Bit b (choice index)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1].map(v => (
                <button key={v}
                  className={`btn ${b === v ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: '1.2rem', padding: '10px',
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                    ...(b === v ? { background: 'var(--accent-orange)', borderColor: 'var(--accent-orange)' } : {}) }}
                  onClick={() => { setB(v); reset(); }}>
                  {v}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.62rem', color: 'var(--text-muted)' }}>
              Chooses index b — learns only m_b = a{'∧'}b. Alice learns nothing about b.
            </div>
          </div>
        </div>

        {/* Expected values row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14,
          padding: '10px 14px', background: 'var(--bg-well)', border: '1px solid var(--border)',
          borderRadius: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            With a={a}, b={b}:
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>a{'∧'}b = </span>
            <strong style={{ color: 'var(--accent-green)', fontSize: '1rem' }}>{a & b}</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>a{'⊕'}b = </span>
            <strong style={{ color: 'var(--accent-blue)', fontSize: '1rem' }}>{a ^ b}</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{'¬'}a = </span>
            <strong style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>{1 - a}</strong>
          </span>
        </div>

        <button className="btn btn-primary" onClick={runDemo}
          disabled={loading} style={{ marginBottom: 14, fontSize: '0.9rem' }}>
          {loading ? '⏳ Running secure AND…' : '▶ Compute Secure AND'}
        </button>

        {error && (
          <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: 10 }}>{error}</p>
        )}

        {/* ── RESULT BANNER ── */}
        {result && (
          <div className="pa19-in">
            {/* Big result box */}
            <div style={{ background: result.AND_correct
                ? 'rgba(39,174,96,0.1)' : 'rgba(231,76,60,0.1)',
              border: `2px solid ${result.AND_correct ? 'rgba(39,174,96,0.5)' : 'rgba(231,76,60,0.5)'}`,
              borderRadius: 10, padding: '14px 18px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                  Secure AND Result
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 800,
                  color: result.AND_correct ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {a} {'∧'} {b} = {result.AND}
                </div>
                <div style={{ fontSize: '0.7rem', color: result.AND_correct
                  ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: 2 }}>
                  {result.AND_correct
                    ? '✓ Correct — matches expected value'
                    : '✗ ERROR — unexpected result'}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16, display: 'flex',
                flexDirection: 'column', gap: 4 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>XOR: </span>
                  <strong style={{ color: 'var(--accent-blue)' }}>
                    {a} {'⊕'} {b} = {result.XOR}
                  </strong>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>NOT a: </span>
                  <strong style={{ color: 'var(--text-secondary)' }}>
                    {'¬'}{a} = {result.NOT_a}
                  </strong>
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span className="badge badge-secure" style={{ fontSize: '0.68rem' }}>
                  Via OT (PA#18)
                </span>
              </div>
            </div>

            {/* Protocol step-log */}
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)',
              marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Protocol Step-Log
            </div>

            {/* Step 1 */}
            <StepBox num={1} color="var(--accent-blue)" title="Alice: Set Up OT Sender Messages">
              <div style={{ marginBottom: 8, fontSize: '0.65rem', color: 'var(--text-muted)',
                padding: '6px 10px', background: 'rgba(52,152,219,0.06)', borderRadius: 6 }}>
                Alice acts as OT <em>sender</em> with messages (m₀, m₁) = (0, a).
                She picks m₀=0 so Bob gets 0 if b=0, and m₁=a so Bob gets a if b=1.
                This makes m_b = a{'∧'}b for any choice b.
              </div>
              <KV label="m₀ (choice b=0):" value={`${result.m0_sent}   ← always 0`} />
              <KV label="m₁ (choice b=1):" value={`${result.m1_sent}   ← = a = ${a}`}
                valueColor="var(--accent-blue)" />
              <div style={{ margin: '8px 0 4px', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                Alice encrypts both under Bob's public keys and sends (C₀, C₁):
              </div>
              <KV label="C₀ = Enc(pk₀, m₀):"
                value={`(${trunc(result.C0[0])},  ${trunc(result.C0[1])})`} />
              <KV label="C₁ = Enc(pk₁, m₁):"
                value={`(${trunc(result.C1[0])},  ${trunc(result.C1[1])})`} />
            </StepBox>

            {/* Step 2 */}
            <StepBox num={2} color="var(--accent-orange)"
              title={`Bob: Generate Key Pairs, Choose Index b = ${b}`}>
              <div style={{ marginBottom: 8, fontSize: '0.65rem', color: 'var(--text-muted)',
                padding: '6px 10px', background: 'rgba(243,156,18,0.06)', borderRadius: 6 }}>
                Bob generates an <em>honest</em> key pair for index b={b} (keeps sk_{b})
                and a <em>random trapdoor-free</em> key for index {1 - b} (no secret key).
                Alice sees both public keys but cannot tell which is honest — b is hidden.
              </div>
              <KV
                label={`pk${0}.h =`}
                value={trunc(result.pk0_h, 20)}
                valueColor={b === 0 ? 'var(--accent-green)' : 'var(--text-secondary)'}
                sub={b === 0 ? '← honest key (has sk₀)' : '← random, no trapdoor'}
              />
              <KV
                label={`pk${1}.h =`}
                value={trunc(result.pk1_h, 20)}
                valueColor={b === 1 ? 'var(--accent-green)' : 'var(--text-secondary)'}
                sub={b === 1 ? '← honest key (has sk₁)' : '← random, no trapdoor'}
              />
              <div style={{ marginTop: 6, fontSize: '0.6rem', color: 'var(--text-muted)',
                fontStyle: 'italic' }}>
                Under DDH, pk₀ and pk₁ look like two uniform group elements to Alice
                regardless of which index Bob chose.
              </div>
            </StepBox>

            {/* Step 3 */}
            <StepBox num={3} color="var(--accent-green)"
              title={`Bob: Decrypt C₂ = C${b} → Receive m${b} = a∧b`}>
              <div style={{ marginBottom: 8, fontSize: '0.65rem', color: 'var(--text-muted)',
                padding: '6px 10px', background: 'rgba(39,174,96,0.06)', borderRadius: 6 }}>
                Bob uses his secret key sk_{b} to decrypt only C_{b}.
                He <strong style={{ color: 'var(--text-secondary)' }}>cannot decrypt</strong> C_{1-b}
                because he has no sk_{'{' + (1 - b) + '}'}.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Dec(sk{b}, C{b}) =
                  </span>
                  {' '}
                  <span style={{ color: 'var(--accent-green)', fontWeight: 800, fontSize: '1.4rem' }}>
                    {result.AND}
                  </span>
                </div>
                <span className={`badge ${result.AND_correct ? 'badge-secure' : 'badge-danger'}`}>
                  {result.AND_correct
                    ? `✓ = ${a}∧${b} = ${a & b} correct`
                    : `✗ expected ${a & b}`}
                </span>
              </div>
              <KV
                label={`C${1 - b} (other):`}
                value={`locked — no sk${1 - b} available`}
                valueColor="var(--accent-red)"
                sub={`m${1 - b} stays hidden from Bob`}
              />
            </StepBox>

            {/* XOR & NOT box */}
            <div style={{ background: 'var(--bg-well)', border: '1px solid rgba(52,152,219,0.3)',
              borderLeft: '3px solid var(--accent-blue)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-blue)',
                marginBottom: 8 }}>
                XOR (Free — No OT) &amp; NOT (Free — Local Only)
              </div>
              <div style={{ marginBottom: 8, fontSize: '0.65rem', color: 'var(--text-muted)',
                padding: '6px 10px', background: 'rgba(52,152,219,0.05)', borderRadius: 6 }}>
                XOR uses additive secret sharing over Z₂. Alice picks random r, computes share a{'⊕'}r,
                sends r to Bob. Bob's share is b{'⊕'}r. The XOR of both shares equals a{'⊕'}b —
                no party's input is revealed.
                NOT is free: Alice locally flips her own share. Zero communication needed.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <KV label="random r =" value={String(result.xor_r)} />
                  <KV label="Alice share:" value={`a⊕r = ${a}⊕${result.xor_r} = ${result.alice_share}`} />
                  <KV label="Bob share:" value={`b⊕r = ${b}⊕${result.xor_r} = ${result.bob_share}`} />
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>a{'⊕'}b = </span>
                      <strong style={{ color: 'var(--accent-blue)', fontSize: '1.1rem' }}>
                        {result.XOR}
                      </strong>
                    </span>
                    <span className="badge badge-secure" style={{ fontSize: '0.6rem' }}>
                      {'✓'} = {a ^ b}
                    </span>
                  </div>
                </div>
                <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
                  <KV label="NOT a =" value={`1 − ${a} = ${result.NOT_a}`} />
                  <div style={{ marginTop: 4, fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Alice flips locally: 1{'−'}a = {result.NOT_a}.
                    No message to Bob needed. Zero OT cost.
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span className="badge badge-secure" style={{ fontSize: '0.6rem' }}>
                      {'✓'} = {1 - a}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ background: 'rgba(52,152,219,0.05)', border: '1px solid rgba(52,152,219,0.25)',
                borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-blue)',
                  marginBottom: 5 }}>
                  What does Alice learn?
                </div>
                <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  Alice sees (pk₀, pk₁). Both are uniform group elements under DDH.
                  She <strong style={{ color: 'var(--text-secondary)' }}>cannot tell which
                  is the honest key</strong> — b is computationally hidden (OT sender privacy).
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="badge badge-secure" style={{ fontSize: '0.6rem' }}>
                    {'✓'} Alice learns nothing about b
                  </span>
                </div>
              </div>
              <div style={{ background: 'rgba(243,156,18,0.05)', border: '1px solid rgba(243,156,18,0.25)',
                borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-orange)',
                  marginBottom: 5 }}>
                  What does Bob learn?
                </div>
                <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  Bob receives m_b = a{'∧'}b = {result.AND}.
                  C_{1-b} is encrypted under a key Bob has no trapdoor for.
                  Bob learns <strong style={{ color: 'var(--text-secondary)' }}>only a{'∧'}b,
                  not a itself</strong> (OT receiver privacy).
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="badge badge-secure" style={{ fontSize: '0.6rem' }}>
                    {'✓'} Bob learns nothing beyond a{'∧'}b
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Run All 4 Combinations ── */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
            flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Truth Table — All 4 Combinations
            </div>
            <button className="btn btn-secondary" onClick={runAll}
              disabled={loadingAll} style={{ fontSize: '0.75rem', padding: '5px 14px' }}>
              {loadingAll ? '⏳ Running 10 runs each…' : '▶ Run All 4 Combinations'}
            </button>
          </div>

          {allResult ? (
            <div className="pa19-in">
              <table style={{ width: '100%', fontSize: '0.74rem', borderCollapse: 'collapse',
                marginBottom: 8 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['a', 'b', 'a∧b (expected)', 'AND result (10 runs)', 'a⊕b (expected)', 'XOR result'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px',
                        fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allResult.combos.map((c, i) => {
                    const active = c.a === a && c.b === b;
                    return (
                      <tr key={i} style={{
                        background: active ? 'rgba(162,155,254,0.1)' : 'transparent',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)',
                          fontWeight: 800, fontSize: '1rem', color: 'var(--accent-blue)' }}>{c.a}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)',
                          fontWeight: 800, fontSize: '1rem', color: 'var(--accent-orange)' }}>{c.b}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)',
                          fontWeight: 700, color: 'var(--accent-green)' }}>{c.expected_and}</td>
                        <td style={{ padding: '7px 10px' }}>
                          <span className={`badge ${c.and_correct ? 'badge-secure' : 'badge-danger'}`}
                            style={{ fontSize: '0.65rem' }}>
                            {c.and_correct
                              ? `✓ ${c.and_pass}/${c.runs} correct`
                              : `✗ ${c.and_pass}/${c.runs} correct`}
                          </span>
                        </td>
                        <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)',
                          fontWeight: 700, color: 'var(--accent-blue)' }}>{c.expected_xor}</td>
                        <td style={{ padding: '7px 10px' }}>
                          <span className={`badge ${c.xor_correct ? 'badge-secure' : 'badge-danger'}`}
                            style={{ fontSize: '0.65rem' }}>
                            {c.xor_correct
                              ? `✓ ${c.xor_pass}/${c.runs} correct`
                              : `✗ ${c.xor_pass}/${c.runs} correct`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <span className={`badge ${allResult.all_and_correct ? 'badge-secure' : 'badge-danger'}`}>
                  {allResult.all_and_correct ? '✓ AND: all combinations correct' : '✗ AND: errors found'}
                </span>
                <span className={`badge ${allResult.all_xor_correct ? 'badge-secure' : 'badge-danger'}`}>
                  {allResult.all_xor_correct ? '✓ XOR: all combinations correct' : '✗ XOR: errors found'}
                </span>
              </div>
              <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
                Transcript reveals only (pk₀, pk₁, C₀, C₁). Neither party can recover the
                other's input from these values alone: b is hidden by DDH hardness; a is hidden
                because decrypting C_{'{1−b}'} requires solving DLP.
              </div>
            </div>
          ) : (
            /* Static truth table preview before running */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {COMBOS.map(({ a: ai, b: bi }) => (
                <div key={`${ai}${bi}`} style={{ textAlign: 'center', padding: '10px 6px',
                  borderRadius: 8, background: 'var(--bg-well)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                    color: 'var(--text-muted)', marginBottom: 4 }}>
                    a={ai}, b={bi}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem',
                    color: 'var(--text-secondary)', fontWeight: 700 }}>
                    AND={ai & bi}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem',
                    color: 'var(--text-secondary)', fontWeight: 700 }}>
                    XOR={ai ^ bi}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lineage */}
        <div style={{ marginTop: 12, padding: '7px 12px', background: 'var(--bg-well)',
          border: '1px solid var(--border)', borderRadius: 6,
          fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Lineage: PA#19 {'→'} PA#18 (OT) {'→'} PA#16 (ElGamal) {'→'} PA#11 (DH) + PA#13 (Miller-Rabin)
        </div>
      </div>
    </div>
  );
}
