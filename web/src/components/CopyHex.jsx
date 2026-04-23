import React, { useState } from 'react';

export default function CopyHex({ value, className = '', style }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="hex-copy-wrap">
      <div className={`hex-display ${className}`} style={style}>{value}</div>
      {value && (
        <button
          className={`copy-btn${copied ? ' copied' : ''}`}
          onClick={copy}
          title="Copy to clipboard"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      )}
    </div>
  );
}
