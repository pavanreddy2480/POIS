import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import CopyHex from '../CopyHex';
import DemoHeader from '../DemoHeader';

const DEFAULT_MSG = 'Hello MD!';
const IV_HEX = '00000000';
const BLOCK_SIZE = 8;   // bytes
const STATE_SIZE = 4;   // bytes

// ── Hex input helpers ─────────────────────────────────────────────────────
function isValidHex(s) { return /^[0-9a-fA-F]*$/.test(s); }
function hexToBytes(h) {
  const clean = h.replace(/\s/g, '');
  if (!isValidHex(clean) || clean.length % 2 !== 0) return null;
  const out = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i+2), 16));
  return out;
}

// ── Toy compression function (mirrors server) ──────────────────────────────
// state XOR block[0:4]  — block[4:8] is ignored
function toyCompress(stateHex, blockHex) {
  const state = stateHex.padEnd(STATE_SIZE * 2, '0').slice(0, STATE_SIZE * 2);
  const block = blockHex.padEnd(BLOCK_SIZE * 2, '0').slice(0, BLOCK_SIZE * 2);
  let out = '';
  for (let i = 0; i < STATE_SIZE * 2; i += 2) {
    const s = parseInt(state.slice(i, i + 2), 16);
    const b = parseInt(block.slice(i, i + 2), 16);
    out += (s ^ b).toString(16).padStart(2, '0');
  }
  return out;
}

// ── MD padding (mirrors server) ────────────────────────────────────────────
function mdPad(msgBytes) {
  const msgLenBits = msgBytes.length * 8;
  let padded = [...msgBytes, 0x80];
  while (padded.length % BLOCK_SIZE !== BLOCK_SIZE - 8) padded.push(0x00);
  // 64-bit big-endian length
  const hi = Math.floor(msgLenBits / 0x100000000);
  const lo = msgLenBits >>> 0;
  padded.push(
    (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
    (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff,
  );
  return padded;
}

function textToHex(t) {
  return Array.from(new TextEncoder().encode(t)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Compute full MD chain from raw block hex array ─────────────────────────
function computeChain(blockHexes, stateHex = IV_HEX) {
  const states = [stateHex];
  for (const blk of blockHexes) {
    stateHex = toyCompress(stateHex, blk);
    states.push(stateHex);
  }
  return states; // states[0]=IV, states[i+1] = after block i
}

// ── Split padded message into 8-byte (16 hex char) blocks ─────────────────
function msgToBlocks(msgText) {
  const bytes = Array.from(new TextEncoder().encode(msgText));
  const padded = mdPad(bytes);
  const blocks = [];
  for (let i = 0; i < padded.length; i += BLOCK_SIZE) {
    blocks.push(
      padded.slice(i, i + BLOCK_SIZE).map(b => b.toString(16).padStart(2, '0')).join('')
    );
  }
  return { blocks, paddedHex: padded.map(b => b.toString(16).padStart(2, '0')).join('') };
}

// ═══════════════════════════════════════════════════════════════════════════
// EditableChainFlow — the core avalanche viewer
// ═══════════════════════════════════════════════════════════════════════════
function EditableChainFlow({ blocks, setBlocks, states, changedFrom }) {
  if (!blocks.length) return null;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 0,
        minWidth: 'max-content', padding: '8px 4px',
      }}>
        {/* IV box */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <div style={{
            padding: '6px 10px', borderRadius: 6, minWidth: 90, textAlign: 'center',
            background: 'rgba(230,126,34,0.12)', border: '1px solid var(--accent-orange)',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>IV</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{IV_HEX}</div>
          </div>
        </div>

        {blocks.map((blkHex, i) => {
          const stateAfter = states[i + 1];
          const changed = changedFrom !== null && i >= changedFrom;
          const isFirst = changedFrom !== null && i === changedFrom;
          const isLast = i === blocks.length - 1;

          return (
            <React.Fragment key={i}>
              {/* Arrow + h(·,·) label */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '0 4px', minWidth: 52,
                marginTop: 10,
              }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>h(·,·)</div>
                <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>→</div>
              </div>

              {/* Block (Mᵢ) + state (zᵢ) column */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {/* Mᵢ editable block */}
                <div style={{
                  borderRadius: 6, minWidth: 130, textAlign: 'center',
                  background: isFirst
                    ? 'rgba(255,59,48,0.13)'
                    : changed
                    ? 'rgba(255,149,0,0.1)'
                    : 'var(--accent-blue-bg)',
                  border: `1.5px solid ${isFirst ? 'var(--accent-red)' : changed ? 'var(--accent-orange)' : 'var(--accent-blue)'}`,
                  padding: '4px 6px',
                  transition: 'background 0.3s, border-color 0.3s',
                }}>
                  <div style={{
                    fontSize: '0.68rem', fontWeight: 700,
                    color: isFirst ? 'var(--accent-red)' : changed ? 'var(--accent-orange)' : 'var(--accent-blue)',
                    fontFamily: 'var(--font-mono)', marginBottom: 4,
                  }}>M{i + 1}</div>
                  <input
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                      background: 'transparent', border: 'none',
                      borderBottom: '1px dashed var(--border)',
                      color: 'var(--text-primary)', width: '100%',
                      textAlign: 'center', outline: 'none', padding: '1px 2px',
                    }}
                    maxLength={BLOCK_SIZE * 2}
                    value={blkHex}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, BLOCK_SIZE * 2);
                      const next = [...blocks];
                      next[i] = v.padEnd(BLOCK_SIZE * 2, '0');
                      setBlocks(next, i);
                    }}
                    title={`Edit block M${i + 1} (hex). Changes cascade from z${i + 1} onwards.`}
                  />
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    ✎ {BLOCK_SIZE * 2} hex chars
                  </div>
                </div>

                {/* zᵢ state box */}
                <div style={{
                  borderRadius: 6, minWidth: 90, textAlign: 'center',
                  background: changed ? 'rgba(255,59,48,0.1)' : 'var(--accent-green-bg)',
                  border: `1.5px solid ${changed ? 'var(--accent-red)' : 'var(--accent-green)'}`,
                  padding: '4px 8px',
                  transition: 'background 0.3s, border-color 0.3s',
                }}>
                  <div style={{
                    fontSize: '0.68rem', fontWeight: 700,
                    color: changed ? 'var(--accent-red)' : 'var(--accent-green)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    z{i + 1} {isLast ? '= digest' : ''}
                    {changed && ' 🔴'}
                  </div>
                  <div style={{
                    fontSize: '0.65rem', color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)', marginTop: 2, wordBreak: 'break-all',
                  }}>{stateAfter || '…'}</div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {changedFrom !== null && (
        <div style={{
          marginTop: 4, padding: '6px 10px', borderRadius: 6,
          background: 'rgba(255,59,48,0.08)', border: '1px solid var(--accent-red)',
          fontSize: '0.75rem', color: 'var(--accent-red)', fontFamily: 'var(--font-mono)',
        }}>
          ⚡ Avalanche: editing M{changedFrom + 1} changed z{changedFrom + 1}
          {changedFrom + 1 < blocks.length ? `…z${blocks.length}` : ''} ({blocks.length - changedFrom} state{blocks.length - changedFrom > 1 ? 's' : ''} affected)
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Collision Propagation Panel
// ═══════════════════════════════════════════════════════════════════════════
function CollisionPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.hash.collisionDemo();
      setData(r);
    } catch (e) {
      setData({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); }, []); // eslint-disable-line

  const Tag = ({ ok }) => (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem',
      fontWeight: 700, fontFamily: 'var(--font-mono)',
      background: ok ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)',
      color: ok ? 'var(--accent-green)' : 'var(--accent-red)',
      border: `1px solid ${ok ? 'var(--accent-green)' : 'var(--accent-red)'}`,
    }}>
      {ok ? '✓ COLLISION' : '✗ NO MATCH'}
    </span>
  );

  return (
    <div className="demo-card">
      <h4>Collision Propagation Demo</h4>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
        The toy compression function{' '}
        <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-well)', padding: '1px 4px', borderRadius: 3 }}>
          h(state, block) = state ⊕ block[0:4]
        </code>{' '}
        <strong>ignores bytes 4–7</strong>. Two blocks sharing the same first 4 bytes always collide
        in <em>h</em>, and that collision propagates through the full MD chain.
      </p>

      {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Computing…</div>}
      {data?.error && <div className="hex-display red">{data.error}</div>}
      {data && !data.error && (
        <>
          {/* Step 1: Compression function collision */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Step 1 — Compression function collision
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8,
            }}>
              {[
                { label: 'Block A', blk: data.single_block_A, out: data.compress_A, color: 'var(--accent-blue)' },
                { label: 'Block B', blk: data.single_block_B, out: data.compress_B, color: 'var(--accent-orange)' },
              ].map(({ label, blk, out, color }) => (
                <div key={label} style={{
                  padding: '8px 10px', borderRadius: 6,
                  background: 'var(--bg-well)', border: `1px solid ${color}`,
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    block: <span style={{ color: 'var(--text-primary)' }}>{blk.slice(0,8)}</span>
                    <span style={{ color: 'var(--accent-red)', textDecoration: 'line-through', opacity: 0.7 }}>{blk.slice(8)}</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    h(IV, block) = <span style={{ color: 'var(--accent-green)' }}>{out}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag ok={data.single_collision} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                h(IV, A) {data.single_collision ? '=' : '≠'} h(IV, B)  — bytes 4–7 (red) are ignored by XOR compress
              </span>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

          {/* Step 2: Full MD chain collision */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Step 2 — Full MD chain collision (reduction)
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10,
            }}>
              {[
                { label: 'Message A', msg: data.msg_A, chain: data.chain_A, digest: data.digest_A, color: 'var(--accent-blue)' },
                { label: 'Message B', msg: data.msg_B, chain: data.chain_B, digest: data.digest_B, color: 'var(--accent-orange)' },
              ].map(({ label, msg, chain, digest, color }) => (
                <div key={label} style={{
                  padding: '8px 10px', borderRadius: 6,
                  background: 'var(--bg-well)', border: `1px solid ${color}`,
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{label}</div>
                  {chain.slice(1).map((entry, idx) => {
                    const blockHex = entry[1];
                    const stateHex = entry[2];
                    const isColliding = idx === 0; // first data block is where they differ
                    return (
                      <div key={idx} style={{
                        fontSize: '0.65rem', fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)', marginBottom: 2,
                      }}>
                        M{idx+1}:{' '}
                        <span style={{ color: isColliding ? color : 'var(--text-primary)' }}>
                          {blockHex.slice(0,8)}
                        </span>
                        <span style={{ color: isColliding ? 'var(--accent-red)' : 'var(--text-primary)', textDecoration: isColliding ? 'underline' : 'none' }}>
                          {blockHex.slice(8)}
                        </span>
                        {' → z'}{idx+1}: <span style={{ color: 'var(--accent-green)' }}>{stateHex}</span>
                      </div>
                    );
                  })}
                  <div style={{
                    marginTop: 6, padding: '4px 6px', borderRadius: 4,
                    background: 'rgba(52,199,89,0.08)', border: '1px solid var(--accent-green)',
                    fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
                  }}>
                    digest = <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{digest}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag ok={data.collision} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                MD(A) {data.collision ? '=' : '≠'} MD(B) — compression-fn collision ⟹ full-hash collision
              </span>
            </div>
            <div style={{
              marginTop: 10, padding: '8px 10px', borderRadius: 6,
              background: 'var(--bg-well)', border: '1px solid var(--border)',
              fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Why this matters:</strong> The MD security proof
              says "if <em>h</em> is collision-resistant then <em>H</em> is collision-resistant."
              This demo shows the <em>contrapositive</em>: a collision in <em>h</em> immediately gives a
              collision in <em>H</em> — confirming the reduction is tight.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main PA7 Demo
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// Boundary Case Panel
// ═══════════════════════════════════════════════════════════════════════════
function BoundaryPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setData(await api.hash.mdBoundary()); }
    catch (e) { setData({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="demo-card">
      <h4>Boundary Case Tests</h4>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
        Verify the MD framework produces correct-length outputs for edge cases:
        empty message, short message, and multi-block message.
      </p>
      <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginBottom: 12 }}>
        {loading ? '⏳ Running…' : '▶ Run Boundary Tests'}
      </button>
      {data?.error && <div className="hex-display red">{data.error}</div>}
      {data && !data.error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.results.map((r, i) => (
            <div key={i} style={{
              background: 'var(--bg-well)', borderRadius: 6, padding: '8px 12px',
              border: `1px solid ${r.aligned ? 'var(--accent-green)' : 'var(--accent-red)'}`,
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.75rem', color: r.aligned ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                {r.aligned ? '✓' : '✗'}
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>{r.label}</span>
              <span />
              <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                msg={r.msg_len}B → padded={r.padded_len}B ({r.num_blocks} block{r.num_blocks !== 1 ? 's' : ''})
                {' · '}digest=<span style={{ color: 'var(--accent-green)' }}>{r.digest}</span>
                {' · '}digest_len={r.digest_len}B
              </div>
            </div>
          ))}
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Block size: {data.block_size}B · State size: {data.state_size}B (toy params)
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main PA7 Demo
// ═══════════════════════════════════════════════════════════════════════════
export default function PA7Demo() {
  const [inputMode, setInputMode] = useState('text');  // 'text' | 'hex'
  const [msg, setMsg] = useState(DEFAULT_MSG);
  const [hexInput, setHexInput] = useState('');
  const [hexError, setHexError] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [states, setStates] = useState([]);
  const [paddedHex, setPaddedHex] = useState('');
  const [changedFrom, setChangedFrom] = useState(null);
  const [origStates, setOrigStates] = useState([]);
  const changedTimer = useRef(null);

  // Rebuild blocks from raw bytes array
  const rebuildFromBytes = (bytesArr) => {
    const padded = mdPad(bytesArr);
    const blks = [];
    for (let i = 0; i < padded.length; i += BLOCK_SIZE) {
      blks.push(padded.slice(i, i + BLOCK_SIZE).map(b => b.toString(16).padStart(2, '0')).join(''));
    }
    const ph = padded.map(b => b.toString(16).padStart(2, '0')).join('');
    setBlocks(blks);
    setPaddedHex(ph);
    const st = computeChain(blks);
    setStates(st);
    setOrigStates(st);
    setChangedFrom(null);
  };

  // Rebuild blocks from message text
  const rebuildFromMsg = (text) => {
    const bytes = Array.from(new TextEncoder().encode(text));
    rebuildFromBytes(bytes);
  };

  useEffect(() => { rebuildFromMsg(DEFAULT_MSG); }, []); // eslint-disable-line

  const handleMsgChange = (v) => {
    setMsg(v);
    rebuildFromMsg(v);
  };

  const handleHexChange = (v) => {
    setHexInput(v);
    const clean = v.replace(/\s/g, '');
    if (!isValidHex(clean)) { setHexError('Invalid hex characters'); return; }
    if (clean.length % 2 !== 0) { setHexError('Odd number of hex digits'); return; }
    setHexError('');
    const bytes = hexToBytes(clean) || [];
    rebuildFromBytes(bytes);
  };

  const switchMode = (mode) => {
    setInputMode(mode);
    setHexError('');
    if (mode === 'hex') {
      // Convert current text to hex
      const h = Array.from(new TextEncoder().encode(msg)).map(b => b.toString(16).padStart(2, '0')).join('');
      setHexInput(h);
    } else {
      // Try to decode hex back to text
      const bytes = hexToBytes(hexInput);
      if (bytes) {
        try { const t = new TextDecoder().decode(new Uint8Array(bytes)); setMsg(t); }
        catch { setMsg(''); }
      }
    }
  };

  // Called when user edits a block hex directly
  const handleBlockEdit = (newBlocks, editedIdx) => {
    setBlocks(newBlocks);
    // Recompute chain from editedIdx onwards
    const newStates = [...states];
    let state = newStates[editedIdx]; // state before the edited block
    for (let i = editedIdx; i < newBlocks.length; i++) {
      state = toyCompress(state, newBlocks[i]);
      newStates[i + 1] = state;
    }
    setStates(newStates);

    // Mark which block changed (for highlighting)
    setChangedFrom(editedIdx);

    // Auto-clear highlight after 8s of no edits
    if (changedTimer.current) clearTimeout(changedTimer.current);
    changedTimer.current = setTimeout(() => setChangedFrom(null), 8000);
  };

  const reset = () => {
    setInputMode('text');
    setMsg(DEFAULT_MSG);
    setHexInput('');
    setHexError('');
    rebuildFromMsg(DEFAULT_MSG);
  };

  const digest = states[states.length - 1] || '';

  return (
    <div>
      {/* ── Chain Viewer ── */}
      <div className="demo-card">
        <DemoHeader num={7} title="Merkle-Damgård Chain Viewer" tag="CRHF" onReset={reset} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Type a message to see the MD chain. Then <strong>edit any block Mᵢ directly</strong> to
          watch the avalanche: zᵢ and all subsequent states change immediately.
          Toy params: block&nbsp;=&nbsp;8&nbsp;B, state&nbsp;=&nbsp;4&nbsp;B,
          h(state,&nbsp;block)&nbsp;=&nbsp;state&nbsp;⊕&nbsp;block[0:4].
        </p>

        {/* Input mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['text', 'hex'].map(m => (
            <button key={m} onClick={() => switchMode(m)} style={{
              padding: '3px 12px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
              background: inputMode === m ? 'var(--accent-blue)' : 'var(--bg-well)',
              color: inputMode === m ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${inputMode === m ? 'var(--accent-blue)' : 'var(--border)'}`,
            }}>{m.toUpperCase()}</button>
          ))}
        </div>

        {inputMode === 'text' ? (
          <div className="form-group">
            <label>Message (text)</label>
            <input type="text" value={msg} onChange={e => handleMsgChange(e.target.value)} />
          </div>
        ) : (
          <div className="form-group">
            <label>Message (hex)</label>
            <input
              type="text" value={hexInput}
              onChange={e => handleHexChange(e.target.value)}
              placeholder="e.g. 48656c6c6f"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
            />
            {hexError && <div style={{ fontSize: '0.72rem', color: 'var(--accent-red)', marginTop: 4 }}>{hexError}</div>}
          </div>
        )}

        {digest && (
          <div className="form-group">
            <label>Digest</label>
            <CopyHex value={digest} />
          </div>
        )}

        {/* Chain */}
        {blocks.length > 0 && (
          <div style={{
            background: 'var(--bg-well)', borderRadius: 8, padding: '12px 10px',
            border: '1px solid var(--border)', marginBottom: 12,
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
              Chain: IV → h(IV,M₁) = z₁ → h(z₁,M₂) = z₂ → …
            </div>
            <EditableChainFlow
              blocks={blocks}
              setBlocks={handleBlockEdit}
              states={states}
              changedFrom={changedFrom}
            />
          </div>
        )}

        {changedFrom !== null && (
          <div style={{
            padding: '6px 10px', borderRadius: 6, marginBottom: 12,
            background: 'rgba(255,149,0,0.08)', border: '1px solid var(--accent-orange)',
            fontSize: '0.75rem', color: 'var(--accent-orange)',
          }}>
            ℹ️ Blocks before M{changedFrom + 1} are unchanged (z₀…z{changedFrom} are intact). 
            Only z{changedFrom + 1} onwards were re-computed.{' '}
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-orange)', textDecoration: 'underline', fontSize: 'inherit', padding: 0 }}
              onClick={reset}
            >Restore original</button>
          </div>
        )}
      </div>

      {/* ── MD Padding ── */}
      <div className="demo-card">
        <h4>MD-Strengthening Padding</h4>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
          <div>EM = M ‖ <span style={{ color: 'var(--accent-orange)' }}>1</span> ‖ <span style={{ color: 'var(--text-muted)' }}>0*</span> ‖ <span style={{ color: 'var(--accent-blue)' }}>⟨|M|⟩₆₄</span></div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            Append 0x80 (1-bit + zeros), pad until length ≡ block_size−8 (mod block_size), then 64-bit big-endian length.
          </div>
          {paddedHex && (
            <div style={{ marginTop: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Padded hex ({paddedHex.length / 2}B = {blocks.length} block{blocks.length > 1 ? 's' : ''}): </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{paddedHex}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Boundary Cases ── */}
      <BoundaryPanel />

      {/* ── Collision Propagation ── */}
      <CollisionPanel />
    </div>
  );
}
