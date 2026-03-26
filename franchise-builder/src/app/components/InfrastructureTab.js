'use client';
import { useState } from 'react';
import { UPGRADE_COSTS } from '@/data/leagues';
import { canAfford, r1 } from '@/lib/engine';
import StadiumManagementSection from '@/app/components/StadiumManagementSection';

// ============================================================
// INFRASTRUCTURE TAB — Stadium + Facilities merged
// ============================================================
export default function InfrastructureTab({ fr, setFr, season, onCashChange }) {
  const [section, setSection] = useState('stadium');

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="tab-nav" style={{ marginBottom: 0 }}>
        {[['stadium', 'Stadium'], ['facilities', 'Facilities']].map(([k, label]) => (
          <button key={k} className={`tab-btn ${section === k ? 'active' : ''}`} onClick={() => setSection(k)}>{label}</button>
        ))}
      </div>
      {section === 'stadium' && <StadiumManagementSection fr={fr} setFr={setFr} season={season} />}
      {section === 'facilities' && <FacilitiesSection fr={fr} setFr={setFr} onCashChange={onCashChange} />}
    </div>
  );
}

// --- Facilities Section ---
export function FacilitiesSection({ fr, setFr, onCashChange }) {
  function upgrade(field) {
    const current = fr[field];
    if (current >= 3) return;
    const cost = UPGRADE_COSTS[current] || 15;
    if (!canAfford(fr.cash, cost)) return;
    const newCash = r1((fr.cash || 0) - cost); // Round facility spend before syncing both cash stores.
    setFr(prev => ({ ...prev, [field]: current + 1, cash: newCash }));
    if (onCashChange) onCashChange(newCash);
  }

  const facilities = [
    ['scoutingStaff', 'Scouting', 'Draft eval accuracy'],
    ['developmentStaff', 'Player Dev', 'Player growth rate'],
    ['medicalStaff', 'Medical', 'Injury reduction'],
    ['marketingStaff', 'Marketing', 'Fan rating boost'],
    ['trainingFacility', 'Training Facility', `Training camp budget: ${6 + (fr.trainingFacility || 1) * 2} pts (base 6 + Lvl×2)`],
    ['weightRoom', 'Weight Room', 'Conditioning & durability — reduces injury severity'],
    ['filmRoom', 'Film Room', 'Tactical edge — boosts scheme fit effectiveness'],
  ];

  return (
    <>
      <div className="card" style={{ padding: '8px 14px' }}>
        <span className="stat-label">Liquid Capital: </span>
        <span className="stat-value" style={{ color: (fr.cash || 0) > 5 ? 'var(--green)' : 'var(--red)' }}>
          ${Math.round((fr.cash || 0) * 10) / 10}M
        </span>
      </div>
      {facilities.map(([key, label, desc]) => {
        const current = fr[key];
        const cost = UPGRADE_COSTS[current];
        const affordable = canAfford(fr.cash, cost || 999);
        return (
          <div key={key} className="card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="font-display" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>{desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3].map(l => <div key={l} style={{ width: 18, height: 6, borderRadius: 2, background: current >= l ? 'var(--red)' : 'var(--cream-darker)' }} />)}
              </div>
              {current < 3 && (
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.6rem', padding: '3px 8px', opacity: affordable ? 1 : 0.4, minHeight: 28 }}
                  disabled={!affordable}
                  onClick={() => upgrade(key)}
                  title={!affordable ? 'Insufficient cash' : `Upgrade for $${cost}M`}
                >
                  ${cost}M
                </button>
              )}
              {current >= 3 && <span className="badge badge-green" style={{ fontSize: '0.55rem' }}>MAX</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}
