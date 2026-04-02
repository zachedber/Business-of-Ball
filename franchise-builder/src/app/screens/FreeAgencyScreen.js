'use client';
import { useState } from 'react';
import { SLOT_BUDGET, signToSlot, releaseSlot, addPendingEffect } from '@/lib/engine';
import { appendLogEntry } from '@/lib/economy';
import { RATING_TOOLTIP } from '@/app/components/SharedComponents';

// ============================================================
// FREE AGENCY FLOW SCREEN
// ============================================================
export default function FreeAgencyFlowScreen({ fr, setFr, offseasonFAPool, aiSigningsLog, onDone, gmRep, dispatch, currentSeason }) {
  const [pool, setPool] = useState(offseasonFAPool || []);
  const [biddingWar, setBiddingWar] = useState(null); // { player, slotName, aiSalary, aiTeamName }
  const [showTransactions, setShowTransactions] = useState(false);
  const budget = SLOT_BUDGET[fr.league] || 80;
  const usedBudget = ['star1', 'star2', 'corePiece'].reduce((s, k) => s + (fr[k]?.salary || 0), 0);
  const budgetDelta = Math.round((budget - usedBudget) * 10) / 10;

  const slotDefs = [
    { key: 'star1', label: 'Star 1' },
    { key: 'star2', label: 'Star 2' },
    { key: 'corePiece', label: 'Core Piece' },
  ];

  const aiTeamNames = ['Dallas Lone Stars', 'Bay City Gold', 'New York Titans', 'Chicago Wolves', 'Los Angeles Crown', 'Seattle Rain', 'Miami Surge'];

  function doSign(player, slotName) {
    const signedFranchise = signToSlot(fr, slotName, player);
    if (!signedFranchise) return; // Bugfix: failed free-agency bids now stop before mutating the pool or slot state.
    let logged = appendLogEntry(signedFranchise, {
      season: fr.season || 1,
      quarter: null,
      type: 'signing',
      headline: `${player.name} signed to ${slotName} slot, ${player.yearsLeft || 1}yr/$${player.salary || 0}M`.slice(0, 80),
      detail: null,
      impact: 'positive',
    });
    // Phase 3A: marquee FA signing boosts sponsor interest
    if ((player.rating || 0) >= 82) {
      logged = addPendingEffect(logged, {
        id: `bigSigning_s${fr.season || 1}_${Date.now()}`,
        triggerSeason: (fr.season || 1) + 1,
        type: 'sponsorInterest',
        delta: 1,
        source: `Signed ${player.name} (Rtg ${player.rating}) — sponsor visibility up next season`,
      });
    }
    setFr(() => logged);
    setPool(prev => prev.filter(p => p.id !== player.id));
  }

  function attemptSign(player, slotName) {
    // 25% chance another team is also interested — trigger bidding war
    if (Math.random() < 0.25) {
      const boostPct = 0.10 + Math.random() * 0.10;
      const aiSalary = Math.round(player.salary * (1 + boostPct) * 10) / 10;
      const aiTeamName = aiTeamNames[Math.floor(Math.random() * aiTeamNames.length)];
      setBiddingWar({ player, slotName, aiSalary, aiTeamName });
    } else {
      doSign(player, slotName);
    }
  }

  function acceptBid(matchBoost) {
    if (!biddingWar) return;
    const newSalary = Math.round(biddingWar.aiSalary * (1 + matchBoost) * 10) / 10;
    const adjustedPlayer = { ...biddingWar.player, salary: newSalary };
    doSign(adjustedPlayer, biddingWar.slotName);
    setBiddingWar(null);
  }

  function walkAway() {
    // AI gets the player — remove from pool
    setPool(prev => prev.filter(p => p.id !== biddingWar?.player?.id));
    setBiddingWar(null);
  }

  function doRelease(slotName) {
    setFr(prev => {
      const player = prev[slotName];
      const released = releaseSlot(prev, slotName);
      if (!player) return released;
      let result = appendLogEntry(released, {
        season: prev.season || 1,
        quarter: null,
        type: 'release',
        headline: `${player.name} released from ${slotName} slot`.slice(0, 80),
        detail: null,
        impact: 'neutral',
      });
      // Phase 3A: fan backlash for releasing long-tenure or local legend players
      if (player.isLocalLegend === true || (player.seasonsWithTeam || 0) >= 4) {
        result = addPendingEffect(result, {
          id: `cutFav_s${prev.season || 1}_${Date.now()}`,
          triggerSeason: (prev.season || 1) + 1,
          type: 'fanRating',
          delta: player.isLocalLegend ? -15 : -8,
          source: `Released ${player.name} (${player.seasonsWithTeam || 0} seasons) — fan backlash next year`,
        });
      }
      return result;
    });
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem', borderBottomColor: fr.primaryColor || 'var(--red)' }}>Free Agency</h2>
      <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: fr.primaryColor || 'var(--ink-muted)', marginRight: 6, verticalAlign: 'middle' }} />
        {fr.city} {fr.name} — Sign players to your 3 franchise slots. Budget: ${budget}M/season.
      </p>

      {/* Current slots */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, marginBottom: 16 }}>
        {slotDefs.map(({ key, label }) => {
          const player = fr[key];
          return (
            <div key={key} className="card-elevated" style={{ padding: 14 }}>
              <div className="font-display" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>{label}</div>
              {player ? (
                <>
                  <div className="font-display" style={{ fontSize: '0.95rem', fontWeight: 700 }}>{player.name}</div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{player.position} · {player.rating} rtg · ${player.salary}M{player.developmentPhase ? ` · ${player.developmentPhase}` : ''}</div>
                  <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '3px 8px', marginTop: 6, borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => doRelease(key)} aria-label={`Release player from ${label} slot`}>
                    Release
                  </button>
                </>
              ) : (
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>Empty Slot</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Budget bar */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
          <span className="stat-label">Slot Budget</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span className="font-mono" style={{ fontSize: '0.75rem', textAlign: 'right' }}>
              ${usedBudget}M / ${budget}M
            </span>
            <span className="font-mono" style={{ fontSize: '0.68rem', color: budgetDelta < 0 ? 'var(--red)' : 'var(--green)', textAlign: 'right' }}>
              {budgetDelta < 0 ? `$${Math.abs(budgetDelta)}M over` : `$${budgetDelta}M free`}
            </span>
          </div>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${Math.min(100, (usedBudget / budget) * 100)}%`, background: usedBudget > budget ? 'var(--red)' : 'var(--green)' }} />
        </div>
      </div>

      {/* FA pool */}
      {pool.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10 }}>Available Free Agents</h3>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                  {['Name', 'Pos', 'Age', 'Rtg', 'Dev', '$M', 'Trait', 'Sign To'].map(h => (
                    <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...pool].sort((a, b) => b.rating - a.rating).map(p => {
                  const canAfford = (fr.cash || 0) >= p.salary;
                  const wouldOverBudget = usedBudget + p.salary > budget;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--cream-dark)' }}>
                      <td className="font-body" style={{ padding: '6px 8px', fontWeight: 500 }}>{p.name}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{p.position}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{p.age}</td>
                      <td className="font-mono" title={RATING_TOOLTIP} style={{ padding: '6px 8px', fontWeight: 600, cursor: 'help', color: p.rating >= 85 ? 'var(--green)' : p.rating >= 70 ? 'var(--ink)' : 'var(--ink-muted)' }}>{p.rating}</td>
                      <td style={{ padding: '6px 8px' }}>{p.developmentPhase && <span style={{ fontSize: '0.65rem', color: p.developmentPhase === 'Rising' ? 'var(--green)' : p.developmentPhase === 'Peak' ? 'var(--amber)' : 'var(--red)' }}>{p.developmentPhase}</span>}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>${p.salary}M</td>
                      <td>{p.trait && <span className="badge badge-ink">{p.trait}</span>}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {slotDefs.map(({ key, label }) => {
                            const slotFull = !!fr[key];
                            return (
                              <button
                                key={key}
                                className="btn-secondary"
                                style={{ fontSize: '0.7rem', padding: '3px 6px', opacity: (!canAfford || wouldOverBudget || slotFull) ? 0.4 : 1 }}
                                disabled={!canAfford || wouldOverBudget || slotFull}
                                onClick={() => attemptSign(p, key)}
                                title={slotFull ? 'Slot full' : !canAfford ? 'Insufficient cash' : wouldOverBudget ? 'Over budget' : `Sign to ${label}`}
                                aria-label={`Sign ${p.name} to ${label} slot`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pool.length === 0 && (
        <div className="card" style={{ padding: 14, textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.8rem' }}>
          Free agent pool exhausted.
        </div>
      )}

      {/* Bidding War Modal */}
      {biddingWar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(30,26,20,0.55)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
        }}>
          <div className="card-elevated" style={{ maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20, border: '2px solid var(--amber)' }}>
            <h3 className="font-display" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>
              Bidding War!
            </h3>
            <p className="font-body" style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 12 }}>
              <strong>{biddingWar.aiTeamName}</strong> is also pursuing <strong>{biddingWar.player.name}</strong> and has
              offered <strong>${biddingWar.aiSalary}M/yr</strong>.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn-primary"
                style={{ fontSize: '0.72rem', padding: '7px 14px' }}
                disabled={(fr.cash || 0) < biddingWar.aiSalary}
                onClick={() => acceptBid(0)}
                aria-label="Match competing offer"
              >
                Match — ${biddingWar.aiSalary}M/yr
              </button>
              <button
                className="btn-secondary"
                style={{ fontSize: '0.72rem', padding: '7px 14px', borderColor: 'var(--green)', color: 'var(--green)' }}
                disabled={(fr.cash || 0) < Math.round(biddingWar.aiSalary * 1.10 * 10) / 10}
                onClick={() => acceptBid(0.10)}
                aria-label="Outbid competing offer by 10 percent"
              >
                Outbid (+10%) — ${Math.round(biddingWar.aiSalary * 1.10 * 10) / 10}M/yr
              </button>
              <button
                className="btn-secondary"
                style={{ fontSize: '0.72rem', padding: '7px 14px', borderColor: 'var(--red)', color: 'var(--red)' }}
                onClick={walkAway}
                aria-label="Let AI team sign player"
              >
                Walk Away
              </button>
            </div>
            <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 8 }}>
              Walk away = {biddingWar.aiTeamName} signs {biddingWar.player.name}.
            </p>
          </div>
        </div>
      )}

      {/* League Transactions Feed */}
      {aiSigningsLog && aiSigningsLog.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h3 className="font-display" style={{ fontSize: '0.78rem', fontWeight: 700 }}>League Transactions</h3>
            <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '3px 8px' }} onClick={() => setShowTransactions(t => !t)}>
              {showTransactions ? 'Hide' : 'Show'}
            </button>
          </div>
          {showTransactions && (
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              {aiSigningsLog.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--cream-dark)', fontSize: '0.7rem' }}>
                  <span className="font-body">{s.teamName}</span>
                  <span className="font-mono" style={{ color: 'var(--ink-muted)' }}>signed {s.player.name} · {s.player.rating} rtg · ${s.player.salary}M</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button className="btn-gold" style={{ padding: '12px 32px', fontSize: '0.9rem' }} onClick={onDone}>
          Done — Start Next Season
        </button>
      </div>
    </div>
  );
}
