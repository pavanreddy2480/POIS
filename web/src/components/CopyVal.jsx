import React, { useState } from 'react';

export default function CopyVal({ value, children, className = '', style }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const text = value != null ? String(value) : (typeof children === 'string' ? children : '');
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <span className="copy-val-wrap">
      <span className={`result-val${className ? ' ' + className : ''}`} style={style}>
        {children ?? value}
      </span>
      <button
        className={`copy-val-btn${copied ? ' copied' : ''}`}
        onClick={copy}
        title="Copy to clipboard"
      >
        {copied ? '✓' : 'copy'}
      </button>
    </span>
  );
}
