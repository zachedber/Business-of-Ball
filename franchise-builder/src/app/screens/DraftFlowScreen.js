'use client';
import { useState, useMemo, useEffect } from 'react';
import { draftPlayer, generateDraftProspects } from '@/lib/engine';
import { RATING_TOOLTIP } from '@/app/components/SharedComponents';

// ============================================================
// DRAFT FLOW SCREEN
// ============================================================
export default function DraftFlowScreen({ fr, lt, draftPicks, draftProspects, onPickMade, onAutoPick, onDone, gmRep, rosterFullAlert, onDismissRosterAlert, tradeUpOffers, onAcceptTradeUp }) {
  const [pickedPlayers, setPickedPlayers] = useState([]);
  const [remainingPicks, setRemainingPicks] = useState(draftPicks || []);
  const [availableProspects, setAvailableProspects] = useState(draftProspects || []);
  const currentRound = remainingPicks[0]?.round || draftPicks?.[draftPicks.length - 1]?.round || 1;

  useEffect(() => {
    setRemainingPicks(draftPicks || []);
    setAvailableProspects(draftProspects || []);
    setPickedPlayers([]);
  }, [draftPicks, draftProspects]);

  useEffect(() => {
    if (remainingPicks.length === 0 || availableProspects.length > 0) return;
    setAvailableProspects(
      generateDraftProspects(fr.league, 20, fr.scoutingStaff, currentRound)
        .map(({ trueRating, ...rest }) => rest) // strip trueRating — never reaches UI
    );
  }, [availableProspects.length, currentRound, fr.league, fr.scoutingStaff, remainingPicks.length]);

  const prospects = useMemo(
    () => [...availableProspects].sort((a, b) => {
      const aMid = a.projectedRange ? (a.projectedRange.high + a.projectedRange.low) / 2 : (a.projectedRating || 0);
      const bMid = b.projectedRange ? (b.projectedRange.high + b.projectedRange.low) / 2 : (b.projectedRating || 0);
      return bMid - aMid;
    }).slice(0, 15),
    [availableProspects],
  );

  const allPicksDone = remainingPicks.length === 0;

  function handlePick(prospect) {
    if (remainingPicks.length === 0 || !prospect) return; // Bugfix: the draft flow now stops cleanly when no picks remain on the board.
    const usedPick = remainingPicks[0];
    const player = draftPlayer(prospect, fr.league);
    if (!player) return;
    setPickedPlayers(prev => [...prev, { ...player, round: usedPick.round, pick: usedPick.pickPos ?? usedPick.pick }]);
    setRemainingPicks(prev => prev.slice(1));
    setAvailableProspects(prev => prev.filter(p => p.id !== prospect.id)); // Bugfix: drafted prospects are now removed immediately so they cannot be selected twice.
    onPickMade(player, usedPick);
  }

  function handleAutoPickAction() {
    if (remainingPicks.length === 0) return;
    const topProspect = prospects.find(p => !pickedPlayers.some(x => x.id === p.id));
    if (topProspect) handlePick(topProspect);
    else onAutoPick();
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem', borderBottomColor: fr.primaryColor || 'var(--red)' }}>Round {currentRound} Draft</h2>
      <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: fr.primaryColor || 'var(--ink-muted)', marginRight: 6, verticalAlign: 'middle' }} />
        {fr.city} {fr.name} — Round {currentRound} · {remainingPicks.length} pick{remainingPicks.length !== 1 ? 's' : ''} remaining
      </p>

      {/* Pick positions */}
      {draftPicks && draftPicks.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <h3 className="font-display" style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Your Draft Picks</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {draftPicks.map((p, i) => {
              const used = i >= remainingPicks.length && pickedPlayers.length > (draftPicks.length - remainingPicks.length - 1 - (draftPicks.length - i - 1));
              const isNext = i === draftPicks.length - remainingPicks.length;
              return (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 2, background: isNext ? 'var(--red)' : used ? 'var(--cream-darker)' : 'var(--cream-dark)', color: isNext ? '#fff' : 'var(--ink)', minWidth: 80, textAlign: 'center' }}>
                  <div className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 700 }}>Round {p.round}</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem' }}>Pick #{p.pick}</div>
                  {p.aiPicksBefore > 0 && <div className="font-mono" style={{ fontSize: '0.7rem', marginTop: 2, opacity: 0.7 }}>{p.aiPicksBefore} before</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Roster full alert */}
      {rosterFullAlert && (
        <div className="card" style={{ padding: 14, marginBottom: 12, border: '2px solid var(--red)', background: 'var(--cream-dark)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Roster Full</h4>
              <p className="font-body" style={{ fontSize: '0.78rem', color: 'var(--ink)', margin: 0 }}>
                Roster is full. Release a player from your roster to make room for {rosterFullAlert.name}.
              </p>
            </div>
            <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 10px', flexShrink: 0, marginLeft: 12 }} onClick={onDismissRosterAlert}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Trade-up offers */}
      {!allPicksDone && tradeUpOffers && tradeUpOffers.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 12, border: '1px solid var(--amber)' }}>
          <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, color: 'var(--amber)' }}>Trade-Up Offers</h3>
          {tradeUpOffers.map(offer => (
            <div key={offer.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--cream-dark)' }}>
              <div>
                <span className="font-body" style={{ fontSize: '0.78rem', fontWeight: 500 }}>{offer.aiTeam.city} {offer.aiTeam.name}</span>
                <span className="font-mono" style={{ fontSize: '0.72rem', marginLeft: 8, color: 'var(--ink-muted)' }}>
                  {offer.draftCompensation.map(d => `R${d.round} '${String(d.season).slice(-2)}`).join(' + ')}
                  {offer.cashComponent > 0 && ` + $${offer.cashComponent}M`}
                </span>
              </div>
              <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 10px' }} onClick={() => onAcceptTradeUp && onAcceptTradeUp(offer)}>Accept</button>
            </div>
          ))}
        </div>
      )}

      {/* Draft board */}
      {!allPicksDone && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700 }}>Top Prospects · Round {currentRound}</h3>
            <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '5px 12px' }} onClick={handleAutoPickAction}>Auto-Pick</button>
          </div>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                  {['#', 'Name', 'Pos', 'Proj', 'Upside', 'Trait', ''].map(h => (
                    <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prospects.map((p, i) => {
                  const alreadyPicked = pickedPlayers.some(x => x.name === p.name);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--cream-dark)', opacity: alreadyPicked ? 0.4 : 1 }}>
                      <td className="font-mono" style={{ padding: '6px 8px', fontWeight: 600 }}>{i + 1}</td>
                      <td className="font-body" style={{ padding: '6px 8px', fontWeight: 500 }}>{p.name}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{p.position}</td>
                      <td className="font-mono" title={RATING_TOOLTIP} style={{ padding: '6px 8px', fontWeight: 600, cursor: 'help', color: (p.projectedRange ? p.projectedRange.high : p.projectedRating) >= 75 ? 'var(--green)' : 'var(--ink)' }}>
                        {p.projectedRange ? `${p.projectedRange.low}–${p.projectedRange.high}` : p.projectedRating}
                      </td>
                      <td><span className={`badge ${p.upside === 'high' ? 'badge-green' : p.upside === 'mid' ? 'badge-amber' : 'badge-ink'}`}>{p.upside}</span></td>
                      <td>{p.trait && <span className="badge badge-ink">{p.trait}</span>}</td>
                      <td>
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '0.7rem', padding: '3px 8px', opacity: alreadyPicked ? 0.3 : 1 }}
                          disabled={alreadyPicked || remainingPicks.length === 0}
                          onClick={() => handlePick(p)}
                        >
                          Draft
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary card when picks done */}
      {allPicksDone && pickedPlayers.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Draft Summary</h3>
          {pickedPlayers.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dark)' }}>
              <span className="font-body" style={{ fontSize: '0.85rem' }}>
                R{p.round} P{p.pick} — {p.name} ({p.position})
              </span>
              <span className="font-mono" title={RATING_TOOLTIP} style={{ fontSize: '0.75rem', color: p.rating >= 75 ? 'var(--green)' : 'var(--ink-muted)', cursor: 'help' }}>
                {p.rating} rtg
              </span>
            </div>
          ))}
        </div>
      )}

      {allPicksDone && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn-gold" style={{ padding: '12px 32px', fontSize: '0.9rem' }} onClick={onDone}>
            Continue to Free Agency
          </button>
        </div>
      )}
    </div>
  );
}
