import React, { useState, useRef } from 'react';
import { api } from '../../api';
import DemoHeader from '../DemoHeader';

const ANIM_MS = 950;

const sh = (hex, n = 14) =>
  hex ? (hex.length > n + 2 ? hex.slice(0, n) + '…' : hex) : '–';

export default function PA11Demo({ onNavigate }) {
  const [alicePriv, setAlicePriv] = useState('');
  const [bobPriv, setBobPriv]     = useState('');
  const [eveEnabled, setEveEnabled] = useState(false);
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [animPhase, setAnimPhase] = useState(0); // 0 idle | 1 animating | 2 done
  const [cdhResult, setCdhResult] = useState(null);
  const [cdhLoading, setCdhLoading] = useState(false);
  const timerRef = useRef(null);

  const hexOnly = s => s.replace(/[^0-9a-fA-F]/g, '');

  const reset = () => {
    clearTimeout(timerRef.current);
    setResult(null);
    setAnimPhase(0);
  };

  const runExchange = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    setAnimPhase(1);
    try {
      const [r] = await Promise.all([
        eveEnabled
          ? api.dh.mitm(alicePriv || null, bobPriv || null, 32)
          : api.dh.exchangeCustom(alicePriv || null, bobPriv || null, 32),
        new Promise(res => { timerRef.current = setTimeout(res, ANIM_MS); }),
      ]);
      setResult(r);
      setAnimPhase(2);
    } catch (e) {
      setResult({ error: e.message });
      setAnimPhase(0);
    } finally {
      setLoading(false);
    }
  };

  const runCdh = async () => {
    setCdhLoading(true);
    setCdhResult(null);
    try {
      const r = await api.dh.cdhHardness();
      setCdhResult(r);
    } catch (e) {
      setCdhResult({ error: e.message });
    } finally {
      setCdhLoading(false);
    }
  };

  const hasResult = animPhase === 2 && result && !result.error;

  return (
    <div>
      <style>{`
        @keyframes dhFlyRight {
          0%   { left: -15%; opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { left: 115%; opacity: 0; }
        }
        @keyframes dhFlyLeft {
          0%   { right: -15%; opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { right: 115%; opacity: 0; }
        }
        @keyframes evePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        @keyframes dhFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dh-result-appear {
          animation: dhFadeIn 0.35s ease-out forwards;
        }
        .dh-packet-right {
          animation: dhFlyRight ${ANIM_MS}ms ease-in-out forwards;
        }
        .dh-packet-left {
          animation: dhFlyLeft ${ANIM_MS}ms ease-in-out forwards;
        }
        .eve-intercepting {
          animation: evePulse 0.55s ease-in-out 4;
        }
      `}</style>

      <div className="demo-card">
        <DemoHeader num={11} title="Live Diffie-Hellman Key Exchange" tag="DH" onReset={reset} />

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          Alice and Bob establish a shared secret K = g<sup>ab</sup> mod p over a public channel.
          Eve sees g<sup>a</sup> and g<sup>b</sup> but cannot compute g<sup>ab</sup> (CDH hardness).
          Enable Eve to see the MITM attack.
        </p>

        {/* ── Controls ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={runExchange} disabled={loading}
                  style={{ minWidth: 120 }}>
            {loading ? '…' : '▶ Exchange'}
          </button>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
            fontSize: '0.8rem', padding: '5px 14px', borderRadius: 6,
            border: `1px solid ${eveEnabled ? 'var(--accent-red)' : 'var(--border)'}`,
            background: eveEnabled ? 'var(--accent-red-bg)' : 'transparent',
            color: eveEnabled ? 'var(--accent-red)' : 'var(--text-secondary)',
            transition: 'all 0.25s ease', userSelect: 'none',
          }}>
            <input type="checkbox" checked={eveEnabled}
              onChange={e => { setEveEnabled(e.target.checked); reset(); }} />
            ☠ Enable Eve (MITM)
          </label>
        </div>

        {/* ── Group params strip ── */}
        {hasResult && (
          <div className="dh-result-appear" style={{
            fontSize: '0.67rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
            padding: '5px 12px', background: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 14,
          }}>
            p = {sh(result.p, 22)} &nbsp;|&nbsp; q = {sh(result.q, 22)} &nbsp;|&nbsp; g = {result.g}
            &nbsp;(32-bit safe prime, p = 2q+1)
          </div>
        )}

        {/* ── Main 3-panel grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: eveEnabled ? '1fr 170px 1fr' : '1fr 100px 1fr',
          gap: 10, marginBottom: 14, alignItems: 'stretch',
          transition: 'grid-template-columns 0.3s ease',
        }}>

          {/* ── Alice panel ── */}
          <div style={{
            padding: 14, borderRadius: 10,
            border: '2px solid var(--accent-blue)', background: 'var(--accent-blue-bg)',
          }}>
            <div style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: '0.87rem', marginBottom: 10 }}>
              👤 Alice
            </div>
            <div className="form-group" style={{ marginBottom: 6 }}>
              <label style={{ fontSize: '0.68rem' }}>Private exponent a (hex)</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="text" value={alicePriv}
                  onChange={e => setAlicePriv(hexOnly(e.target.value))}
                  placeholder="random" style={{ flex: 1, fontSize: '0.7rem' }} />
                <button className="btn btn-secondary"
                  style={{ fontSize: '0.68rem', padding: '2px 8px', whiteSpace: 'nowrap' }}
                  onClick={() => { setAlicePriv(''); reset(); }}
                  title="Randomise">↺</button>
              </div>
            </div>
            {hasResult && (
              <div className="dh-result-appear" style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.67rem', lineHeight: 1.9, marginTop: 10,
              }}>
                <div style={{ color: 'var(--text-muted)' }}>
                  a = <span style={{ color: 'var(--text-secondary)' }}>{sh(result.alice_private)}</span>
                </div>
                <div style={{ color: 'var(--accent-blue)' }}>
                  A = g^a = {sh(result.alice_public)}
                </div>
                <div style={{
                  marginTop: 6, padding: '5px 8px', borderRadius: 5, fontWeight: 600,
                  background: eveEnabled ? 'var(--accent-red-bg)' : 'var(--accent-green-bg)',
                  color:      eveEnabled ? 'var(--accent-red)'    : 'var(--accent-green)',
                }}>
                  K = {sh(eveEnabled ? result.alice_mitm_secret : result.alice_shared_secret)}
                </div>
                {eveEnabled && (
                  <div style={{ fontSize: '0.62rem', color: 'var(--accent-red)', marginTop: 3 }}>
                    ⚠ Alice computed E^a — thinks it's g^ab
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Channel / Eve ── */}
          {eveEnabled ? (
            <div className={animPhase === 1 ? 'eve-intercepting' : ''} style={{
              padding: 12, borderRadius: 10,
              border: '2px solid var(--accent-red)', background: 'var(--accent-red-bg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 6,
            }}>
              <div style={{ color: 'var(--accent-red)', fontWeight: 700, fontSize: '0.82rem' }}>
                ☠ Eve
              </div>
              {animPhase === 1 && (
                <div style={{
                  fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5,
                }}>
                  Intercepting<br/>A &amp; B…<br/>
                  <span style={{ color: 'var(--accent-red)' }}>Sending g^e →</span>
                </div>
              )}
              {hasResult && (
                <div className="dh-result-appear" style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.63rem', lineHeight: 1.8,
                  textAlign: 'center', width: '100%',
                }}>
                  <div style={{ color: 'var(--text-muted)' }}>
                    e = {sh(result.eve_private, 8)}
                  </div>
                  <div style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
                    E = g^e =<br/>{sh(result.eve_public, 10)}
                  </div>
                  <div style={{
                    marginTop: 6, padding: '4px 6px', borderRadius: 4,
                    background: 'rgba(239,68,68,0.18)', fontSize: '0.6rem',
                  }}>
                    <div style={{ color: 'var(--accent-red)', fontWeight: 600 }}>K with Alice</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{sh(result.eve_key_with_alice, 10)}</div>
                  </div>
                  <div style={{
                    marginTop: 4, padding: '4px 6px', borderRadius: 4,
                    background: 'rgba(239,68,68,0.18)', fontSize: '0.6rem',
                  }}>
                    <div style={{ color: 'var(--accent-red)', fontWeight: 600 }}>K with Bob</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{sh(result.eve_key_with_bob, 10)}</div>
                  </div>
                  <div style={{
                    marginTop: 6, fontSize: '0.6rem', color: 'var(--accent-orange)', fontWeight: 700,
                  }}>
                    Reads all traffic!
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Normal public channel with animated packets */
            <div style={{
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', minHeight: 100,
            }}>
              {animPhase === 0 && (
                <div style={{
                  fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7,
                }}>
                  public<br/>channel
                </div>
              )}
              {animPhase >= 1 && (
                <>
                  {/* Wire lines */}
                  <div style={{
                    position: 'absolute', top: '35%', left: 0, right: 0,
                    height: 1, background: 'rgba(79,108,247,0.35)',
                  }} />
                  <div style={{
                    position: 'absolute', top: '65%', left: 0, right: 0,
                    height: 1, background: 'rgba(245,158,11,0.35)',
                  }} />
                  {/* g^a packet: Alice → Bob */}
                  <div className={animPhase === 1 ? 'dh-packet-right' : ''} style={{
                    position: 'absolute', top: 'calc(35% - 11px)',
                    padding: '2px 6px', borderRadius: 4,
                    background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
                    border: '1px solid var(--accent-blue)',
                    fontSize: '0.6rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                    ...(animPhase === 2 ? { left: '50%', transform: 'translateX(-50%)', opacity: 0.25 } : {}),
                  }}>
                    g^a →
                  </div>
                  {/* g^b packet: Bob → Alice */}
                  <div className={animPhase === 1 ? 'dh-packet-left' : ''} style={{
                    position: 'absolute', top: 'calc(65% - 11px)',
                    padding: '2px 6px', borderRadius: 4,
                    background: 'var(--accent-orange-bg)', color: 'var(--accent-orange)',
                    border: '1px solid var(--accent-orange)',
                    fontSize: '0.6rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                    ...(animPhase === 2 ? { right: '50%', transform: 'translateX(50%)', opacity: 0.25 } : {}),
                  }}>
                    ← g^b
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Bob panel ── */}
          <div style={{
            padding: 14, borderRadius: 10,
            border: '2px solid var(--accent-orange)', background: 'var(--accent-orange-bg)',
          }}>
            <div style={{ color: 'var(--accent-orange)', fontWeight: 700, fontSize: '0.87rem', marginBottom: 10 }}>
              👤 Bob
            </div>
            <div className="form-group" style={{ marginBottom: 6 }}>
              <label style={{ fontSize: '0.68rem' }}>Private exponent b (hex)</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="text" value={bobPriv}
                  onChange={e => setBobPriv(hexOnly(e.target.value))}
                  placeholder="random" style={{ flex: 1, fontSize: '0.7rem' }} />
                <button className="btn btn-secondary"
                  style={{ fontSize: '0.68rem', padding: '2px 8px', whiteSpace: 'nowrap' }}
                  onClick={() => { setBobPriv(''); reset(); }}
                  title="Randomise">↺</button>
              </div>
            </div>
            {hasResult && (
              <div className="dh-result-appear" style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.67rem', lineHeight: 1.9, marginTop: 10,
              }}>
                <div style={{ color: 'var(--text-muted)' }}>
                  b = <span style={{ color: 'var(--text-secondary)' }}>{sh(result.bob_private)}</span>
                </div>
                <div style={{ color: 'var(--accent-orange)' }}>
                  B = g^b = {sh(result.bob_public)}
                </div>
                <div style={{
                  marginTop: 6, padding: '5px 8px', borderRadius: 5, fontWeight: 600,
                  background: eveEnabled ? 'var(--accent-red-bg)' : 'var(--accent-green-bg)',
                  color:      eveEnabled ? 'var(--accent-red)'    : 'var(--accent-green)',
                }}>
                  K = {sh(eveEnabled ? result.bob_mitm_secret : result.bob_shared_secret)}
                </div>
                {eveEnabled && (
                  <div style={{ fontSize: '0.62rem', color: 'var(--accent-red)', marginTop: 3 }}>
                    ⚠ Bob computed E^b — thinks it's g^ab
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Result banner ── */}
        {hasResult && (
          <div className="dh-result-appear" style={{ textAlign: 'center', marginBottom: 14 }}>
            {eveEnabled ? (
              <>
                <span className="badge badge-broken">
                  ☠ MITM Active — Alice and Bob have different keys. Eve reads all traffic.
                </span>
                <div style={{
                  marginTop: 7, fontSize: '0.68rem', color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)', lineHeight: 1.7,
                }}>
                  Alice K = {sh(result.alice_mitm_secret, 20)} &nbsp;≠<br />
                  Bob &nbsp;K = {sh(result.bob_mitm_secret, 20)}
                </div>
              </>
            ) : (
              <>
                <span className="badge badge-secure">
                  ✓ K_A = K_B — Shared secret established!
                </span>
                <div style={{
                  marginTop: 7, fontSize: '0.68rem', color: 'var(--accent-green)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  K = g^ab = {sh(result.alice_shared_secret, 30)}
                </div>
              </>
            )}
          </div>
        )}

        {result?.error && (
          <div className="hex-display red" style={{ marginBottom: 12 }}>{result.error}</div>
        )}

        {/* ── CDH Hardness Demo ── */}
        <div style={{
          marginTop: 16, padding: 14, borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.83rem', marginBottom: 6 }}>
            CDH Hardness Demo (q ≈ 2<sup>20</sup>)
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
            With tiny parameters (q ≈ 2<sup>20</sup>), Eve can brute-force find a from g<sup>a</sup>
            and then compute (g<sup>b</sup>)<sup>a</sup> = g<sup>ab</sup>.
            For real DH (q ≈ 2<sup>256</sup>) this takes longer than the age of the universe.
          </p>
          <button className="btn btn-secondary" onClick={runCdh} disabled={cdhLoading}
                  style={{ fontSize: '0.78rem' }}>
            {cdhLoading ? '⏳ Brute-forcing…' : '▶ Run Brute-Force CDH'}
          </button>
          {cdhResult && !cdhResult.error && (
            <div className="dh-result-appear" style={{
              marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
              lineHeight: 2.1, padding: '10px 14px',
              background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border)',
            }}>
              <div>
                Group: {cdhResult.q_bits}-bit q &nbsp;
                <span style={{ color: 'var(--text-muted)' }}>
                  (p = {cdhResult.p}, g = {cdhResult.g})
                </span>
              </div>
              <div>
                A = g^a = <span style={{ color: 'var(--accent-blue)' }}>{cdhResult.A}</span>
              </div>
              <div>
                B = g^b = <span style={{ color: 'var(--accent-orange)' }}>{cdhResult.B}</span>
              </div>
              <div>
                Brute-forced a = <span style={{ color: 'var(--accent-purple)' }}>{cdhResult.found_a}</span>
                &nbsp; after <span style={{ color: 'var(--accent-teal)' }}>
                  {cdhResult.evaluations?.toLocaleString()}
                </span> evaluations
              </div>
              <div>
                Time: <span style={{ color: 'var(--accent-orange)' }}>{cdhResult.time_sec}s</span>
                &nbsp;(q ≈ 2<sup>{cdhResult.q_bits}</sup> = {(2 ** (cdhResult.q_bits || 0)).toLocaleString()})
              </div>
              <div>
                K = (g^b)^a = <span style={{ color: 'var(--accent-green)' }}>{cdhResult.K_found}</span>
              </div>
              <div style={{ marginTop: 4 }}>
                <span className={`badge ${cdhResult.correct ? 'badge-secure' : 'badge-broken'}`}>
                  {cdhResult.correct
                    ? '✓ Recovered g^ab — brute force works for small q!'
                    : '✗ Verification failed'}
                </span>
              </div>
            </div>
          )}
          {cdhResult?.error && (
            <div className="hex-display red" style={{ marginTop: 8 }}>{cdhResult.error}</div>
          )}
        </div>

        {onNavigate && (
          <div className="demo-related" style={{ marginTop: 14 }}>
            <span className="demo-related-label">Related:</span>
            <button className="demo-xlink" onClick={() => onNavigate('PA12')}>PA12 RSA →</button>
            <button className="demo-xlink" onClick={() => onNavigate('PA15')}>PA15 Signatures →</button>
          </div>
        )}
      </div>
    </div>
  );
}
