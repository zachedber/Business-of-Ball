'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MathTooltip — Shows a breakdown of how a stat value was calculated.
 * Click/tap to toggle. Positions above or below to avoid viewport overflow.
 *
 * @param {object} breakdown - { baseValue, factors: [{ label, impact }], finalValue }
 * @param {string} label - The stat name
 * @param {React.ReactNode} [children] - Optional custom display content
 */
export default function MathTooltip({ breakdown, label, children }) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const reposition = useCallback(() => {
    if (!triggerRef.current || !panelRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    setAbove(spaceBelow < panelHeight + 8 && triggerRect.top > panelHeight + 8);

    // Prevent horizontal overflow on mobile
    const panelRect = panelRef.current.getBoundingClientRect();
    if (panelRect.right > window.innerWidth - 8) {
      panelRef.current.style.left = 'auto';
      panelRef.current.style.right = '0';
    }
    if (panelRect.left < 8) {
      panelRef.current.style.left = '0';
      panelRef.current.style.right = 'auto';
    }
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(reposition);
    }
  }, [open, reposition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [open]);

  if (!breakdown) {
    return children || null;
  }

  const displayValue = breakdown.finalValue !== undefined
    ? Math.round(breakdown.finalValue * 100) / 100
    : '—';

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 'inherit', color: 'inherit', textDecoration: 'underline dotted',
          textDecorationColor: 'var(--ink-muted)',
          padding: 0, lineHeight: 'inherit',
        }}
        title={`View ${label} breakdown`}
        className="font-mono"
      >
        {children || displayValue}
      </button>
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            [above ? 'bottom' : 'top']: '100%',
            left: 0,
            zIndex: 200,
            background: 'var(--cream, #f8f4eb)',
            border: '1px solid var(--ink, #1a1208)',
            borderRadius: 4,
            padding: '10px 12px',
            minWidth: 220,
            maxWidth: 'min(300px, calc(100vw - 24px))',
            fontSize: '0.72rem',
            lineHeight: 1.5,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            marginTop: above ? 0 : 4,
            marginBottom: above ? 4 : 0,
          }}
        >
          {/* Arrow caret */}
          <div style={{
            position: 'absolute',
            [above ? 'bottom' : 'top']: -6,
            left: 16,
            width: 10, height: 10,
            background: 'var(--cream, #f8f4eb)',
            border: '1px solid var(--ink, #1a1208)',
            borderRight: 'none', borderBottom: above ? '1px solid var(--ink)' : 'none',
            borderTop: above ? 'none' : '1px solid var(--ink)',
            transform: above ? 'rotate(-45deg)' : 'rotate(45deg)',
            transformOrigin: 'center',
          }} />

          <div className="font-display" style={{
            fontWeight: 700, marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            fontSize: '0.65rem', color: 'var(--ink)',
            borderBottom: '1px solid var(--cream-darker, #ddd)',
            paddingBottom: 4,
          }}>
            {label} Breakdown
          </div>
          <div className="font-mono" style={{ marginBottom: 4, color: 'var(--ink-muted)' }}>
            Base: {breakdown.baseValue !== undefined ? Math.round(breakdown.baseValue * 1000) / 1000 : '—'}
          </div>
          {(breakdown.factors || []).map((f, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', gap: 8,
              padding: '1px 0',
            }}>
              <span className="font-mono" style={{ color: 'var(--ink-soft, #555)' }}>{f.label}</span>
              <span className="font-mono" style={{
                fontWeight: 600, whiteSpace: 'nowrap',
                color: f.impact > 0 ? 'var(--green, #1a6b3a)' : f.impact < 0 ? 'var(--red, #c8202a)' : 'var(--ink-muted, #999)',
              }}>
                {f.impact > 0 ? '+' : ''}{Math.round(f.impact * 1000) / 1000}
              </span>
            </div>
          ))}
          <div className="font-mono" style={{
            borderTop: '1px solid var(--ink, #1a1208)',
            marginTop: 6, paddingTop: 4,
            fontWeight: 700, display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>Final</span>
            <span>{breakdown.finalValue !== undefined ? Math.round(breakdown.finalValue * 1000) / 1000 : '—'}</span>
          </div>
        </div>
      )}
    </span>
  );
}
