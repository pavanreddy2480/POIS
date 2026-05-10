import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import DemoHeader from '../DemoHeader';

const MODES = ['CBC', 'OFB', 'CTR'];
const MSG_DEFAULT = '48656c6c6f20576f726c642120426c6f636b';
const MSG2_DEFAULT = '48656c6c6f20576f726c642120426c6f4841434b4544';

function Box({ label, sub, value, color, style }) {
  return (
    <div style={{ textAlign: 'center', ...style }}>
      {label && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>}
      <div style={{
        background: color || 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 4, padding: '3px 7px',
        fontSize: '0.62rem', fontFamily: 'var(--font-mono)',
        minWidth: 64, maxWidth: 100,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Arrow() {
  return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center', margin: '0 2px' }}>→</span>;
}

function OpBox({ label, sub, color }) {
  return (
    <div style={{
      background: color || 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 4, padding: '3px 6px',
      fontSize: '0.65rem', fontFamily: 'var(--font-mono)',
      textAlign: 'center', minWidth: 36,
    }}>
      <div>{label}</div>
      {sub && <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function BlockChain({ mode, result, onFlip, flipResult, matchingBlocks }) {
  if (!result?.blocks?.length) return null;
  const blocks = result.blocks;
  const ivLabel = mode === 'CTR' ? 'Nonce r' : 'IV';
  const ivVal = (result.iv || result.nonce || '').slice(0, 8) + '…';

  return (
    <div style={{ overflowX: 'auto', padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 'max-content' }}>
        <Box label={ivLabel} value={ivVal} color="rgba(231,76,60,0.15)" style={{ border: '1px solid var(--accent-red)' }} />

        {blocks.map((block, i) => {
          const isCorrupted = flipResult?.corrupted_blocks?.includes(i);
          const isMatching = matchingBlocks?.includes(i);
          const ctColor = isCorrupted
            ? 'rgba(231,76,60,0.2)'
            : isMatching
              ? 'rgba(231,76,60,0.15)'
              : 'rgba(46,204,113,0.1)';
          const ctBorder = isCorrupted || isMatching ? 'var(--accent-red)' : 'var(--border)';

          return (
            <React.Fragment key={i}>
              <Arrow />
              {mode === 'CBC' && (
                <>
                  <OpBox label="⊕" sub={`M${i+1}`} color="var(--bg-secondary)" />
                  <Arrow />
                  <OpBox label="Eₖ" color="rgba(74,158,255,0.12)" />
                  <Arrow />
                </>
              )}
              {mode === 'OFB' && (
                <>
                  <OpBox label="Eₖ" color="rgba(74,158,255,0.12)" />
                  <Arrow />
                  <OpBox label="⊕" sub={`M${i+1}`} color="var(--bg-secondary)" />
                  <Arrow />
                </>
              )}
              {mode === 'CTR' && (
                <>
                  <OpBox label="Eₖ" sub={`r+${i}`} color="rgba(74,158,255,0.12)" />
                  <Arrow />
                  <OpBox label="⊕" sub={`M${i+1}`} color="var(--bg-secondary)" />
                  <Arrow />
                </>
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 2 }}>C{i+1}</div>
                <div style={{
                  background: ctColor, border: `1px solid ${ctBorder}`,
                  borderRadius: 4, padding: '3px 7px',
                  fontSize: '0.62rem', fontFamily: 'var(--font-mono)', minWidth: 72,
                }}>
                  {block.ciphertext.slice(0, 8)}…
                </div>
                {onFlip && (
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: 3, fontSize: '0.55rem', padding: '1px 6px' }}
                    onClick={() => onFlip(i)}
                  >
                    Flip
                  </button>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Intermediate value table */}
      <div style={{ marginTop: 10, fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
        {blocks.map((block, i) => (
          <div key={i} style={{ padding: '2px 0', borderTop: i === 0 ? '1px solid var(--border)' : 'none' }}>
            {mode === 'CBC' && (
              <span>Block {i+1}: M={block.plaintext.slice(0,8)}… ⊕ prev={block.prev.slice(0,8)}… → xor={block.xor_input.slice(0,8)}… → C={block.ciphertext.slice(0,8)}…</span>
            )}
            {mode === 'OFB' && (
              <span>Block {i+1}: ks={block.keystream_state.slice(0,8)}… ⊕ M={block.plaintext.slice(0,8)}… → C={block.ciphertext.slice(0,8)}…</span>
            )}
            {mode === 'CTR' && (
              <span>Block {i+1}: ctr={block.counter.slice(0,8)}… → ks={block.keystream.slice(0,8)}… ⊕ M={block.plaintext.slice(0,8)}… → C={block.ciphertext.slice(0,8)}…</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PA4Demo() {
  const [mode, setMode] = useState('CBC');
  const [key] = useState('0123456789abcdef0123456789abcdef');
  const [msg, setMsg] = useState(MSG_DEFAULT);
  const [msg2, setMsg2] = useState(MSG2_DEFAULT);
  const [result, setResult] = useState(null);
  const [result2, setResult2] = useState(null);
  const [reuseIV, setReuseIV] = useState(false);
  const [flipResult, setFlipResult] = useState(null);
  const [flippedBlock, setFlippedBlock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const alignHex = (h) => {
    const padded = h.length < 32 ? h.padEnd(32, '0') : h;
    return padded.length % 2 ? padded + '0' : padded;
  };

  const hexXor = (a, b) => {
    const len = Math.min(a.length, b.length);
    let out = '';
    for (let i = 0; i < len; i += 2) {
      out += ((parseInt(a.slice(i, i+2), 16) ^ parseInt(b.slice(i, i+2), 16))
        .toString(16).padStart(2, '0'));
    }
    return out;
  };

  const run = async (overrideMode) => {
    const m = overrideMode || mode;
    setLoading(true);
    setError(null);
    setFlipResult(null);
    setFlippedBlock(null);
    setResult2(null);
    try {
      const r1 = await api.modes.encryptBlocks(m, key, alignHex(msg));
      setResult(r1);
      if (reuseIV && m === 'CBC') {
        const r2 = await api.modes.encryptBlocks('CBC', key, alignHex(msg2), r1.iv);
        setResult2(r2);
      }
      if (reuseIV && m === 'OFB') {
        const iv = r1.iv;
        const r2 = await api.modes.encryptBlocks('OFB', key, alignHex(msg2), iv);
        setResult2({ ...r2, xorResult: hexXor(r1.ciphertext, r2.ciphertext) });
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  const switchMode = (newMode) => {
    setMode(newMode);
    setResult(null);
    setResult2(null);
    setFlipResult(null);
    setFlippedBlock(null);
    setError(null);
    run(newMode);
  };

  const handleFlip = async (blockIdx) => {
    if (!result) return;
    setFlippedBlock(blockIdx);
    setFlipResult(null);
    try {
      const ivOrNonce = result.iv || result.nonce || '';
      const fr = await api.modes.flipAndDecrypt(mode, key, ivOrNonce, result.ciphertext, blockIdx);
      setFlipResult(fr);
    } catch(e) { setError(e.message); }
  };

  const matchingBlocks = result && result2
    ? result.blocks
        .map((b, i) => (result2.blocks[i]?.ciphertext === b.ciphertext ? i : -1))
        .filter(i => i >= 0)
    : [];

  const reset = () => {
    setMsg(MSG_DEFAULT); setMsg2(MSG2_DEFAULT);
    setResult(null); setResult2(null);
    setFlipResult(null); setFlippedBlock(null);
    setReuseIV(false); setError(null);
  };

  return (
    <div>
      <div className="demo-card">
        <DemoHeader num={4} title="Block Cipher Mode Animator" tag="PRP" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          See how CBC, OFB, and CTR chain blocks together. Click any ciphertext block to flip a bit
          and observe error propagation. In CBC, one flipped block corrupts two plaintext blocks.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {MODES.map(m => (
            <button key={m} className={`btn ${mode===m?'btn-primary':'btn-secondary'}`}
              onClick={() => switchMode(m)}>{m}</button>
          ))}
        </div>

        <div className="form-group">
          <label>Message (hex)</label>
          <input type="text" value={msg} onChange={e => { setMsg(e.target.value); setResult(null); }}
            onKeyDown={e => e.key === 'Enter' && !loading && run()} />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <button className="btn btn-primary" onClick={() => run()} disabled={loading}>
            {`▶ Encrypt with ${mode}`}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={reuseIV} onChange={e => setReuseIV(e.target.checked)} />
            {mode === 'OFB' ? 'Reuse IV (OFB — keystream reuse)' : mode === 'CTR' ? 'Reuse IV (CTR — broken)' : 'Reuse IV (CBC — broken)'}
          </label>
          {reuseIV && <span className="badge badge-broken">⚠ BROKEN</span>}
        </div>

        {result && (
          <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 12, border: '1px solid var(--border)', marginBottom: 12 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
              {mode} Block Chain — {result.blocks.length} block{result.blocks.length !== 1 ? 's' : ''} — click a block to flip a bit
            </div>
            <BlockChain
              mode={mode}
              result={result}
              onFlip={handleFlip}
              flipResult={flipResult}
              matchingBlocks={[]}
            />
          </div>
        )}

        {flipResult && (
          <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 12, border: '1px solid var(--accent-red)', marginBottom: 12 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-red)', marginBottom: 6 }}>
              ⚡ Bit-flip on C{flippedBlock + 1} — error propagation ({mode})
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              Corrupted blocks: {flipResult.corrupted_blocks.map(i => `C${i+1}`).join(', ')}
              {mode === 'CBC' && ' (CBC propagates to 2 blocks)'}
              {(mode === 'OFB' || mode === 'CTR') && ' (stream mode — only 1 block affected)'}
            </div>
            {flipResult.decrypted
              ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  Decrypted: {flipResult.decrypted}
                </div>
              : <div style={{ fontSize: '0.72rem', color: 'var(--accent-red)' }}>Padding error on decryption (CBC padding check failed)</div>
            }
          </div>
        )}

        {reuseIV && mode === 'CBC' && (
          <div style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Message 2 (hex) — encrypted with same IV</label>
              <input type="text" value={msg2} onChange={e => { setMsg2(e.target.value); setResult2(null); }}
                onKeyDown={e => e.key === 'Enter' && !loading && run()} />
            </div>
            {result2 && (
              <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 12, border: '1px solid var(--accent-red)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                  CBC with reused IV — matching ciphertext blocks (red = identical plaintext blocks leaked)
                </div>
                <BlockChain
                  mode="CBC"
                  result={result2}
                  onFlip={null}
                  flipResult={null}
                  matchingBlocks={matchingBlocks}
                />
                {matchingBlocks.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--accent-red)' }}>
                    ⚠ Block{matchingBlocks.length > 1 ? 's' : ''} {matchingBlocks.map(i => i+1).join(', ')} have identical ciphertexts
                    — IV reuse reveals which plaintext blocks match between messages!
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {reuseIV && mode === 'OFB' && (
          <div style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Message 2 (hex) — encrypted with same IV (OFB keystream reuse)</label>
              <input type="text" value={msg2} onChange={e => { setMsg2(e.target.value); setResult2(null); }}
                onKeyDown={e => e.key === 'Enter' && !loading && run()} />
            </div>
            {result2 && (
              <div style={{ background: 'var(--bg-well)', borderRadius: 8, padding: 12, border: '1px solid var(--accent-red)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-red)', fontWeight: 700, marginBottom: 6 }}>
                  ⚡ OFB Keystream Reuse Attack
                </div>
                <BlockChain mode="OFB" result={result2} onFlip={null} flipResult={null} matchingBlocks={matchingBlocks} />
                {matchingBlocks.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--accent-red)' }}>
                    ⚠ Block{matchingBlocks.length > 1 ? 's' : ''} {matchingBlocks.map(i => i+1).join(', ')} have identical ciphertexts
                    — IV reuse reveals which plaintext blocks match between messages!
                  </div>
                )}
                {result2.xorResult && (
                  <div style={{ marginTop: 10, padding: 10, background: 'rgba(231,76,60,0.06)',
                    border: '1px solid rgba(231,76,60,0.25)', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
                      C₁ ⊕ C₂ = M₁ ⊕ M₂ (plaintext XOR recovered without the key)
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', wordBreak: 'break-all',
                      color: 'var(--accent-red)' }}>
                      {result2.xorResult}
                    </div>
                    <div style={{ marginTop: 6, fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Both messages share the same keystream (same IV → same OFB state). XOR cancels the keystream:
                      (M₁ ⊕ ks) ⊕ (M₂ ⊕ ks) = M₁ ⊕ M₂. An attacker who knows M₁ recovers M₂ entirely.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && <div className="hex-display red" style={{ marginBottom: 8 }}>Error: {error}</div>}
      </div>

      <div className="demo-card" style={{ background: 'rgba(46,204,113,0.04)', borderColor: 'rgba(46,204,113,0.2)' }}>
        <h4>Mode Comparison</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead><tr style={{ color: 'var(--text-secondary)' }}>
            <th align="left" style={{ padding: 6 }}>Mode</th>
            <th align="center" style={{ padding: 6 }}>Par. Enc</th>
            <th align="center" style={{ padding: 6 }}>Par. Dec</th>
            <th align="center" style={{ padding: 6 }}>Error Prop</th>
            <th align="center" style={{ padding: 6 }}>IV Reuse</th>
          </tr></thead>
          <tbody>
            {[['CBC','✗','✓','2 blocks','Fatal'],['OFB','✗','✗','None','Fatal'],['CTR','✓','✓','None','Fatal']].map(([m,...r])=>(
              <tr key={m} style={{ borderTop: '1px solid var(--border)', background: mode===m?'rgba(74,158,255,0.05)':'' }}>
                <td style={{ padding: 6, color: 'var(--accent-blue)', fontWeight: 700 }}>{m}</td>
                {r.map((v,i)=><td key={i} align="center" style={{ padding: 6, color: v==='✓'?'var(--accent-green)':v==='Fatal'?'var(--accent-red)':'var(--text-secondary)' }}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
