'use client';
import React, { useState } from 'react';

export default function TrainingCampScreen({ franchise, onSelectFocus }) {
  const facilityLevel = franchise?.trainingFacility || 1;
  const totalBudget = 6 + facilityLevel * 2;

  const [offense, setOffense] = useState(0);
  const [defense, setDefense] = useState(0);
  const [conditioning, setConditioning] = useState(0);

  const used = offense + defense + conditioning;
  const remaining = totalBudget - used;
  const overallocated = remaining < 0;
  const allAllocated = remaining === 0;

  function handleSlider(setter, currentVal, newVal, otherVals) {
    const otherSum = otherVals.reduce((s, v) => s + v, 0);
    const maxAllowed = totalBudget - otherSum;
    setter(Math.min(newVal, maxAllowed));
  }

  function handleStart() {
    if (!allAllocated || overallocated) return;
    if (onSelectFocus) onSelectFocus({ offense, defense, conditioning });
  }

  return (
    <section className="card-elevated fade-in" style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ marginBottom: 20 }}>
        <h2 className="section-header" style={{ marginBottom: 4 }}>Training Camp</h2>
        <p className="font-body" style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
          {franchise ? `${franchise.city} ${franchise.name} — ` : ''}Allocate training points before opening night.
        </p>
      </header>

      {/* Budget display */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="stat-label" style={{ fontSize: '0.7rem' }}>Training Camp Budget</div>
            <div className="font-display" style={{ fontSize: '1.3rem', fontWeight: 700 }}>{totalBudget} points</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="stat-label" style={{ fontSize: '0.7rem' }}>Facility Level</div>
            <div className="font-mono" style={{ fontSize: '0.85rem' }}>
              Lvl {facilityLevel} <span style={{ color: 'var(--ink-muted)', fontSize: '0.7rem' }}>(+{facilityLevel * 2} bonus pts)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Remaining counter */}
      <div style={{
        textAlign: 'center', marginBottom: 16, padding: '8px 0',
        color: overallocated ? 'var(--red)' : remaining === 0 ? 'var(--green)' : 'var(--amber)',
      }}>
        <span className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
          {overallocated ? `${Math.abs(remaining)} over budget` : `${remaining} points remaining`}
        </span>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Offense */}
        <div style={{ padding: '12px 14px', border: '1px solid var(--cream-darker)', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="font-display" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Offense
            </div>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: offense > 0 ? 'var(--green)' : 'var(--ink-muted)' }}>
              {offense > 0 ? `+${(offense * 0.3).toFixed(1)}% WP bonus` : 'No bonus'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="font-mono" style={{ fontSize: '0.75rem', minWidth: 16 }}>{offense}</span>
            <input
              type="range"
              min={0}
              max={totalBudget}
              value={offense}
              onChange={e => handleSlider(setOffense, offense, Number(e.target.value), [defense, conditioning])}
              style={{ flex: 1, minWidth: 120, accentColor: 'var(--ink)' }}
            />
          </div>
          <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginTop: 4 }}>
            Each point adds +0.3% win probability via OC scheme bonus
          </div>
        </div>

        {/* Defense */}
        <div style={{ padding: '12px 14px', border: '1px solid var(--cream-darker)', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="font-display" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Defense
            </div>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: defense > 0 ? 'var(--green)' : 'var(--ink-muted)' }}>
              {defense > 0 ? `+${(defense * 0.3).toFixed(1)}% WP bonus` : 'No bonus'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="font-mono" style={{ fontSize: '0.75rem', minWidth: 16 }}>{defense}</span>
            <input
              type="range"
              min={0}
              max={totalBudget}
              value={defense}
              onChange={e => handleSlider(setDefense, defense, Number(e.target.value), [offense, conditioning])}
              style={{ flex: 1, minWidth: 120, accentColor: 'var(--ink)' }}
            />
          </div>
          <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginTop: 4 }}>
            Each point adds +0.3% win probability via DC scheme bonus
          </div>
        </div>

        {/* Conditioning */}
        <div style={{ padding: '12px 14px', border: '1px solid var(--cream-darker)', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="font-display" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Conditioning
            </div>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: conditioning > 0 ? 'var(--green)' : 'var(--ink-muted)' }}>
              {conditioning > 0 ? `${Math.min(50, conditioning * 5)}% injury reduction through Q2` : 'No reduction'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="font-mono" style={{ fontSize: '0.75rem', minWidth: 16 }}>{conditioning}</span>
            <input
              type="range"
              min={0}
              max={totalBudget}
              value={conditioning}
              onChange={e => handleSlider(setConditioning, conditioning, Number(e.target.value), [offense, defense])}
              style={{ flex: 1, minWidth: 120, accentColor: 'var(--ink)' }}
            />
          </div>
          <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginTop: 4 }}>
            Each point adds 5% injury reduction (max 50% at 10 points)
          </div>
        </div>
      </div>

      {/* Start button */}
      <div style={{ paddingTop: 16 }}>
        <button
          type="button"
          onClick={handleStart}
          disabled={!allAllocated || overallocated}
          style={{
            width: '100%', padding: '12px 16px',
            background: allAllocated && !overallocated ? 'var(--ink)' : 'var(--cream-darker)',
            color: allAllocated && !overallocated ? 'var(--cream)' : 'var(--ink-muted)',
            border: 'none', cursor: allAllocated && !overallocated ? 'pointer' : 'not-allowed',
            fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
          className="font-display"
        >
          {overallocated ? 'Over Budget' : !allAllocated ? `Allocate ${remaining} More Point${remaining !== 1 ? 's' : ''}` : 'Start Season'}
        </button>
      </div>
    </section>
  );
}
