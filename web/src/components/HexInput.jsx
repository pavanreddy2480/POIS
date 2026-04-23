import React from 'react';

const isValidHex = v => /^[0-9a-fA-F]*$/.test(v);

export default function HexInput({ label, value, onChange, onEnter, placeholder, maxLength, disabled, style }) {
  const invalid = value.length > 0 && !isValidHex(value);

  const handleKey = e => {
    if (e.key === 'Enter' && onEnter && !disabled) onEnter();
  };

  return (
    <div className="form-group" style={style}>
      {label && <label>{label}</label>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        style={invalid ? { borderColor: 'var(--accent-red)', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' } : undefined}
      />
      {invalid && (
        <div style={{ fontSize: '0.68rem', color: 'var(--accent-red)', marginTop: 3 }}>
          Invalid hex — use 0–9, a–f only
        </div>
      )}
    </div>
  );
}
