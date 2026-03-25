'use client';
import React, { useState } from 'react';

const FOCUS_OPTIONS = [
  { key: 'offense', label: 'Offense', cost: 2, desc: '+OC scheme bonus to Q1 win probability' },
  { key: 'defense', label: 'Defense', cost: 2, desc: '+DC scheme bonus to Q1 win probability' },
  { key: 'conditioning', label: 'Conditioning', cost: 3, desc: '25% injury reduction through Q2' },
];

export default function TrainingCampScreen({ franchise, onSelectFocus }) {
  const [selectedFocus, setSelectedFocus] = useState('offense');
  const cash = franchise?.cash || 0;
  const selectedOption = FOCUS_OPTIONS.find(o => o.key === selectedFocus);
  const canAfford = cash >= (selectedOption?.cost || 0);

  function handleStart() {
    if (!canAfford) return;
    if (onSelectFocus) onSelectFocus(selectedFocus);
  }

  return (
    <section className="card-elevated fade-in" style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ marginBottom: 20 }}>
        <h2 className="section-header" style={{ marginBottom: 4 }}>Training Camp</h2>
        <p className="font-body" style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
          {franchise ? `${franchise.city} ${franchise.name} — ` : ''}Choose one focus area before opening night.
        </p>
        <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 6 }}>
          Budget: <span style={{ color: cash > 5 ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>${Math.round(cash * 10) / 10}M</span> liquid cash
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FOCUS_OPTIONS.map(option => {
          const isSelected = selectedFocus === option.key;
          const affordable = cash >= option.cost;
          return (
            <label
              key={option.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 6, cursor: affordable ? 'pointer' : 'not-allowed',
                border: isSelected ? '2px solid var(--ink)' : '1px solid var(--cream-darker)',
                background: isSelected ? 'rgba(26,18,8,0.04)' : 'transparent',
                opacity: affordable ? 1 : 0.5,
              }}
            >
              <input
                type="radio"
                name="trainingFocus"
                value={option.key}
                checked={isSelected}
                disabled={!affordable}
                onChange={() => setSelectedFocus(option.key)}
                style={{ accentColor: 'var(--ink)' }}
              />
              <div style={{ flex: 1 }}>
                <div className="font-display" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {option.label}
                  <span className="font-mono" style={{ marginLeft: 8, fontSize: '0.72rem', color: affordable ? 'var(--ink-muted)' : 'var(--red)' }}>
                    ${option.cost}M
                  </span>
                </div>
                <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{option.desc}</span>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ paddingTop: 16 }}>
        <button
          type="button"
          onClick={handleStart}
          disabled={!canAfford}
          style={{
            width: '100%', padding: '12px 16px', background: canAfford ? 'var(--ink)' : 'var(--cream-darker)',
            color: canAfford ? 'var(--cream)' : 'var(--ink-muted)', border: 'none',
            cursor: canAfford ? 'pointer' : 'not-allowed',
            fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
          className="font-display"
        >
          {canAfford ? `Start Season (−$${selectedOption?.cost || 0}M)` : 'Insufficient Cash'}
        </button>
      </div>
    </section>
  );
}
