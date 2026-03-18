'use client';
import { useState, useMemo } from 'react';
import { HELP_TEXT } from './HelpTooltip';

// ============================================================
// HELP CATEGORIES
// ============================================================
const CATEGORIES = {
  'Team & Roster': ['fanRating', 'lockerRoomChemistry', 'rosterQuality', 'slotBudget', 'capSpace'],
  'Finance': ['cash', 'revenue', 'profit', 'debt', 'valuation', 'ticketPrice', 'economyCycle'],
  'Stadium': ['stadiumCondition', 'stadiumCapacity', 'luxuryBoxes', 'clubSeatSections', 'attendance'],
  'Staff': ['schemeFit', 'staffChemistry', 'gmRep'],
  'Facilities': ['scoutingStaff', 'developmentStaff', 'medicalStaff', 'marketingStaff', 'trainingFacility'],
  'Reputation': ['mediaRep', 'communityRating'],
};

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

// ============================================================
// HELP PANEL — slide-in reference panel
// ============================================================
export default function HelpPanel({ open, onClose }) {
  const [search, setSearch] = useState('');
  const [expandedCat, setExpandedCat] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results = [];
    for (const [key, text] of Object.entries(HELP_TEXT)) {
      if (key.toLowerCase().includes(q) || text.toLowerCase().includes(q) || formatKey(key).toLowerCase().includes(q)) {
        results.push({ key, text });
      }
    }
    return results;
  }, [search]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div
        className="fade-in"
        style={{
          position: 'relative', width: '100%', maxWidth: 380,
          background: 'var(--cream)', borderLeft: '2px solid var(--ink)',
          overflowY: 'auto', padding: '20px 16px',
          boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Help & Reference</h2>
          <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 10px' }} onClick={onClose}>Close</button>
        </div>

        <input
          type="text"
          placeholder="Search stats..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', fontSize: '0.8rem',
            border: '1px solid var(--cream-darker)', borderRadius: 4,
            background: 'var(--cream)', color: 'var(--ink)',
            marginBottom: 16, fontFamily: 'var(--font-body)',
          }}
        />

        {filtered ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.length === 0 && (
              <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No results found.</p>
            )}
            {filtered.map(({ key, text }) => (
              <div key={key} className="card" style={{ padding: '10px 12px' }}>
                <div className="font-display" style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>{formatKey(key)}</div>
                <div className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{text}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(CATEGORIES).map(([cat, keys]) => (
              <div key={cat}>
                <button
                  className="font-display"
                  onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '8px 12px', background: 'none', border: 'none',
                    borderBottom: '1px solid var(--cream-darker)', cursor: 'pointer',
                    fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)',
                    textAlign: 'left',
                  }}
                >
                  {cat}
                  <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{expandedCat === cat ? '−' : '+'}</span>
                </button>
                {expandedCat === cat && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0 4px 8px' }}>
                    {keys.map(key => (
                      <div key={key} style={{ paddingBottom: 6, borderBottom: '1px solid var(--cream-darker)' }}>
                        <div className="font-display" style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2 }}>{formatKey(key)}</div>
                        <div className="font-body" style={{ fontSize: '0.68rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{HELP_TEXT[key]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20, padding: '12px', background: 'var(--cream-darker)', borderRadius: 4 }}>
          <div className="font-display" style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>Quick Tips</div>
          <ul className="font-body" style={{ fontSize: '0.68rem', color: 'var(--ink-soft)', lineHeight: 1.6, paddingLeft: 16, margin: 0 }}>
            <li>Hover or tap the <strong>?</strong> icon next to any stat for a tooltip explanation.</li>
            <li>All spending requires sufficient liquid capital (cash).</li>
            <li>Borrow from the Biz tab if cash is low, but watch debt interest.</li>
            <li>Stadium upgrades and new construction are multi-season investments.</li>
            <li>Higher GM reputation unlocks better coaches and free agents.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
