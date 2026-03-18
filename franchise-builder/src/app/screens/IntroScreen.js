'use client';

// ============================================================
// INTRO
// ============================================================
export default function Intro({ onNew, onLoad, hasSv }) {
  return (
    <div className="intro-shell">
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem,8vw,3.5rem)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Business of Ball
      </h1>
      <div style={{ width: 84, height: 4, background: 'var(--red)', margin: '12px auto 16px', boxShadow: '0 8px 18px rgba(200,32,42,0.18)' }} />
      <p className="font-body" style={{ fontSize: 'clamp(1rem,3vw,1.12rem)', color: 'var(--ink-soft)', maxWidth: 520, lineHeight: 1.7, marginBottom: 28, letterSpacing: '0.02em' }}>
        Build a sports empire. Manage franchises across a football league and a basketball league. Draft, negotiate, compete.
      </p>
      <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginBottom: 24, letterSpacing: '0.08em', textTransform: 'uppercase' }}>More features coming soon</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn-gold" onClick={onNew} style={{ minWidth: 220, minHeight: 52, fontSize: '1rem', paddingInline: 28 }}>New Empire</button>
        {hasSv && <button className="btn-secondary" onClick={onLoad}>Continue</button>}
      </div>
    </div>
  );
}
