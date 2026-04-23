import React from 'react';

export default function DemoHeader({ num, title, tag, tagType = 'secondary', onReset }) {
  return (
    <div className="demo-card-header">
      <span className="demo-hdr-num">PA#{num}</span>
      <h4 className="demo-hdr-title">{title}</h4>
      {tag && <span className={`badge badge-${tagType}`}>{tag}</span>}
      {onReset && (
        <button className="demo-reset-btn" onClick={onReset} title="Reset to defaults">
          ↺
        </button>
      )}
    </div>
  );
}
