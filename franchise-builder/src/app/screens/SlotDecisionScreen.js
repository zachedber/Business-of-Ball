'use client';
import { useState, useEffect } from 'react';
import { releaseSlot, r1 } from '@/lib/engine';

// ============================================================
// SLOT DECISION SCREEN — 1.5
// Appears between DraftFlowScreen and FreeAgencyScreen when at least
// one franchise slot is vacant and there are eligible depth players.
// Props: { fr, setFr, onDone }
// ============================================================

const SLOT_DEFS = [
  { key: 'star1', label: 'Star 1' },
  { key: 'star2', label: 'Star 2' },
  { key: 'corePiece', label: 'Core Piece' },
];

export default function SlotDecisionScreen({ fr, setFr, onDone }) {
  // Identify vacant slots
  const vacantSlots = SLOT_DEFS.filter(({ key }) => !fr[key]);

  // Eligible depth candidates: rookieSlots not already occupying a slot,
  // plus any players in fr.players not in a slot. Ranked by rating desc.
  const slotIds = new Set(
    ['star1', 'star2', 'corePiece'].map(k => fr[k]?.id).filter(Boolean)
  );
  const candidates = [
    ...(fr.rookieSlots || []),
    ...(fr.players || []).filter(p => !slotIds.has(p.id)),
  ]
    .filter(p => p && !slotIds.has(p.id))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

  // If nothing to decide, fire onDone immediately
  useEffect(() => {
    if (vacantSlots.length === 0 || candidates.length === 0) {
      onDone();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track which slots have been resolved
  const [resolved, setResolved] = useState({});

  if (vacantSlots.length === 0 || candidates.length === 0) {
    return null;
  }

  const allResolved = vacantSlots.every(({ key }) => resolved[key]);

  function handlePromote(slotKey, player) {
    setFr(prev => {
      // Move player into slot on current contract
      const updated = {
        ...prev,
        [slotKey]: { ...player, slotType: slotKey },
      };
      // Remove from rookieSlots if present
      updated.rookieSlots = (prev.rookieSlots || []).filter(p => p.id !== player.id);
      updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
      updated.totalSalary = r1(updated.players.reduce((s, p) => s + (p.salary || 0), 0));
      return updated;
    });
    setResolved(prev => ({ ...prev, [slotKey]: 'promote' }));
  }

  function handleRelease(slotKey) {
    // Slot is already null — apply dead cap as if releasing from an empty slot is a no-op
    // If there was a player pending for this slot (already null), just mark resolved
    setResolved(prev => ({ ...prev, [slotKey]: 'release' }));
  }

  function handleReleaseExisting(slotKey, player) {
    // Release a depth player (remove from roster, add dead cap 60/40, log it)
    setFr(prev => {
      const remainingValue = player.yearsLeft > 0 ? r1(player.salary * player.yearsLeft) : 0;
      const dead60 = r1(remainingValue * 0.6);
      const dead40 = r1(remainingValue * 0.4);
      const updated = {
        ...prev,
        capDeadMoney: r1((prev.capDeadMoney || 0) + dead60),
        deferredDeadCap: r1((prev.deferredDeadCap || 0) + dead40),
        rookieSlots: (prev.rookieSlots || []).filter(p => p.id !== player.id),
        players: (prev.players || []).filter(p => p.id !== player.id),
        deadCapLog: [
          ...(prev.deadCapLog || []),
          { name: player.name, reason: 'Released (Slot Decision)', amount: r1(dead60 + dead40), season: prev.season || 1 },
        ],
      };
      return updated;
    });
    setResolved(prev => ({ ...prev, [slotKey]: 'release' }));
  }

  function handleSkip(slotKey) {
    setResolved(prev => ({ ...prev, [slotKey]: 'skip' }));
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 12px' }}>
      <h2
        className="font-display section-header"
        style={{ fontSize: '1.2rem', borderBottomColor: fr.primaryColor || 'var(--red)' }}
      >
        Roster Decisions
      </h2>
      <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 20 }}>
        You have vacant franchise slots. Promote a depth player, release them, or leave the slot open for Free Agency.
      </p>

      {vacantSlots.map(({ key, label }) => {
        const isResolved = !!resolved[key];
        // Top 2–3 candidates not already used in a resolved promote
        const promotedIds = new Set(
          Object.entries(resolved)
            .filter(([, v]) => v === 'promote')
            .map(([k]) => fr[k]?.id)
            .filter(Boolean)
        );
        // Re-check current fr slot ids after promotions
        const currentSlotIds = new Set(
          ['star1', 'star2', 'corePiece'].map(k => fr[k]?.id).filter(Boolean)
        );
        const slotCandidates = candidates
          .filter(p => !currentSlotIds.has(p.id) && !promotedIds.has(p.id))
          .slice(0, 3);

        return (
          <div key={key} className="card" style={{ padding: 16, marginBottom: 16, opacity: isResolved ? 0.65 : 1 }}>
            {/* Slot header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span
                className="font-display"
                style={{
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'var(--ink-muted)',
                  background: 'var(--cream-dark)', padding: '2px 8px', borderRadius: 3,
                }}
              >
                {label}
              </span>
              <span className="font-body" style={{ fontSize: '0.75rem', color: 'var(--red)', fontStyle: 'italic' }}>
                Vacant
              </span>
              {isResolved && (
                <span className="badge badge-ink" style={{ marginLeft: 'auto' }}>
                  {resolved[key] === 'promote' ? 'Promoted' : resolved[key] === 'release' ? 'Released' : 'Skipped'}
                </span>
              )}
            </div>

            {!isResolved && slotCandidates.length === 0 && (
              <p className="font-body" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', fontStyle: 'italic', marginBottom: 10 }}>
                No depth candidates available. This slot will remain vacant for Free Agency.
              </p>
            )}

            {!isResolved && slotCandidates.map(player => (
              <div
                key={player.id}
                className="card-elevated"
                style={{ padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}
              >
                {/* Player info */}
                <div style={{ flex: '1 1 180px' }}>
                  <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                    {player.name}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                    {player.position} · Age {player.age} · {player.rating} rtg
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                    ${player.salary}M · {player.yearsLeft}yr left
                  </div>
                  {player.trait && (
                    <span className="badge badge-ink" style={{ fontSize: '0.65rem', marginTop: 4 }}>
                      {player.trait}
                    </span>
                  )}
                  {player.isRookie && (
                    <span className="badge" style={{ fontSize: '0.65rem', marginTop: 4, marginLeft: 4, background: 'var(--amber)', color: '#fff' }}>
                      Rookie
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className="btn-primary"
                    style={{ fontSize: '0.72rem', padding: '6px 14px' }}
                    onClick={() => handlePromote(key, player)}
                  >
                    Promote
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '6px 14px', borderColor: 'var(--red)', color: 'var(--red)' }}
                    onClick={() => handleReleaseExisting(key, player)}
                  >
                    Release
                  </button>
                </div>
              </div>
            ))}

            {/* Skip / leave vacant button */}
            {!isResolved && (
              <div style={{ marginTop: 4 }}>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '5px 12px' }}
                  onClick={() => handleSkip(key)}
                >
                  Skip — Leave vacant for FA
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Continue button — shown once all vacant slots have a decision */}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button
          className="btn-gold"
          style={{
            padding: '12px 32px', fontSize: '0.9rem',
            opacity: allResolved ? 1 : 0.45,
            cursor: allResolved ? 'pointer' : 'not-allowed',
          }}
          disabled={!allResolved}
          onClick={onDone}
        >
          Continue to Free Agency →
        </button>
        {!allResolved && (
          <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 6 }}>
            Make a decision for each vacant slot to continue.
          </p>
        )}
      </div>
    </div>
  );
}
