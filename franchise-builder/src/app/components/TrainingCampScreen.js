'use client';
import React, { useState } from 'react';

export default function TrainingCampScreen({ franchise, onSelectFocus }) {
  const [offense, setOffense] = useState(50);
  const [defense, setDefense] = useState(50);
  const [conditioning, setConditioning] = useState(50);

  function handleStart() {
    // Extract dominant focus (highest slider value)
    const values = { offense, defense, conditioning };
    const dominant = Object.entries(values).sort((a, b) => b[1] - a[1])[0][0];
    if (onSelectFocus) onSelectFocus(dominant);
  }

  return (
    <section className="card-elevated fade-in" style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ marginBottom: 20 }}>
        <h2 className="section-header" style={{ marginBottom: 4 }}>Training Camp</h2>
        <p className="font-body" style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
          {franchise ? `${franchise.city} ${franchise.name} — ` : ''}Choose a focus area before opening night.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <label style={{ display: 'block' }}>
          <span className="font-display" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-muted)' }}>
            Offense Focus — {offense}
          </span>
          <input type="range" min={0} max={100} value={offense} onChange={e => setOffense(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--ink)' }} />
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>+OC scheme bonus to Q1 win probability</span>
        </label>

        <label style={{ display: 'block' }}>
          <span className="font-display" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-muted)' }}>
            Defense Focus — {defense}
          </span>
          <input type="range" min={0} max={100} value={defense} onChange={e => setDefense(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--ink)' }} />
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>+DC scheme bonus to Q1 win probability</span>
        </label>

        <label style={{ display: 'block' }}>
          <span className="font-display" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-muted)' }}>
            Conditioning — {conditioning}
          </span>
          <input type="range" min={0} max={100} value={conditioning} onChange={e => setConditioning(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--amber, #c47b18)' }} />
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>25% injury reduction through Q2</span>
        </label>
      </div>

      <div style={{ paddingTop: 16 }}>
        <button
          type="button"
          onClick={handleStart}
          style={{
            width: '100%', padding: '12px 16px', background: 'var(--ink)',
            color: 'var(--cream)', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
          className="font-display"
        >
          Start Season
        </button>
      </div>
    </section>
  );
}
