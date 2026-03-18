'use client';
import { useState, useMemo } from 'react';
import { draftPlayer, generateDraftProspects } from '@/lib/engine';

// ============================================================
// DRAFT FLOW SCREEN
// ============================================================
export default function DraftFlowScreen({ fr, lt, draftPicks, draftProspects, onPickMade, onAutoPick, onDone, gmRep }) {
  const [pickedPlayers, setPickedPlayers] = useState([]);
  const [remainingPicks, setRemainingPicks] = useState(draftPicks || []);
  const currentRound = remainingPicks[0]?.round || draftPicks?.[draftPicks.length - 1]?.round || 1;
  const prospects = useMemo(() => {
    const roundProspects = generateDraftProspects(fr.league, Math.max((draftProspects || []).length, 20), fr.scoutingStaff, currentRound);
    return roundProspects.sort((a, b) => b.projectedRating - a.projectedRating).slice(0, 15);
  }, [currentRound, draftProspects, fr.league, fr.scoutingStaff]);

  const allPicksDone = remainingPicks.length === 0;

  function handlePick(prospect) {
    if (remainingPicks.length === 0) return;
    const usedPick = remainingPicks[0];
    const player = draftPlayer(prospect, fr.league);
    setPickedPlayers(prev => [...prev, { ...player, round: usedPick.round, pick: usedPick.pick }]);
    setRemainingPicks(prev => prev.slice(1));
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
                      <td className="font-mono" style={{ padding: '6px 8px', fontWeight: 600, color: p.projectedRating >= 75 ? 'var(--green)' : 'var(--ink)' }}>{p.projectedRating}</td>
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
              <span className="font-mono" style={{ fontSize: '0.75rem', color: p.rating >= 75 ? 'var(--green)' : 'var(--ink-muted)' }}>
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
