'use client';
import React, { useState } from 'react';

/**
 * MathTooltip — Shows a breakdown of how a stat value was calculated.
 * Click to toggle the breakdown panel.
 *
 * @param {object} breakdown - { baseValue, factors: [{ label, impact }], finalValue }
 * @param {string} label - The stat name
 */
export default function MathTooltip({ breakdown, label }) {
  const [open, setOpen] = useState(false);

  if (!breakdown) return null;

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.7rem', color: 'var(--ink-muted)', textDecoration: 'underline dotted',
          padding: 0,
        }}
        title={`View ${label} breakdown`}
        className="font-mono"
      >
        {breakdown.finalValue !== undefined ? Math.round(breakdown.finalValue * 100) / 100 : '—'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100,
          background: 'var(--cream, #fff)', border: '1px solid var(--ink-muted, #999)',
          padding: '8px 10px', minWidth: 200, maxWidth: 300,
          fontSize: '0.7rem', lineHeight: 1.4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <div className="font-display" style={{ fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.65rem' }}>
            {label} Breakdown
          </div>
          <div className="font-mono" style={{ marginBottom: 4 }}>
            Base: {breakdown.baseValue !== undefined ? Math.round(breakdown.baseValue * 1000) / 1000 : '—'}
          </div>
          {(breakdown.factors || []).map((f, i) => (
            <div key={i} className="font-mono" style={{ color: f.impact >= 0 ? 'var(--green, #1a6b3a)' : 'var(--red, #c8202a)' }}>
              {f.impact >= 0 ? '+' : ''}{Math.round(f.impact * 1000) / 1000} {f.label}
            </div>
          ))}
          <div className="font-mono" style={{ borderTop: '1px solid var(--ink-muted)', marginTop: 4, paddingTop: 4, fontWeight: 700 }}>
            Final: {breakdown.finalValue !== undefined ? Math.round(breakdown.finalValue * 1000) / 1000 : '—'}
          </div>
        </div>
      )}
    </span>
  );
}
