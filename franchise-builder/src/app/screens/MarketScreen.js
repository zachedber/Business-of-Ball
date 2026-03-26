'use client';
import { useState, useEffect } from 'react';
import { generateStakeOffers, calcStakeIncome, calcStakeValue, generateId, r1, calculateValuation } from '@/lib/engine';
import { getMarketTier } from '@/data/leagues';

// ============================================================
// MARKET SCREEN
// ============================================================
export default function MarketScreen({ lt, cash, stakes, season, setStakes, setCash, playerLeague }) {
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (lt) setOffers(generateStakeOffers(lt, cash, season, playerLeague, stakes));
  }, [lt, season, playerLeague, cash, stakes]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const totalIncome = calcStakeIncome(stakes, lt || { ngl: [], abl: [] });

  function buyStake(offer) {
    try {
      if (cash < offer.price) {
        setError('Insufficient liquid capital for this purchase.');
        return;
      }
      // Same-league restriction
      if (offer.league === playerLeague) {
        setError('Cannot invest in teams in the same league as your franchise.');
        return;
      }
      // One team per sport cap: check if player already has a stake in this league
      const hasStakeInLeague = stakes.some(s => s.league === offer.league && s.teamId !== offer.teamId);
      if (hasStakeInLeague) {
        setError('Already invested in a team in this league. Sell your existing stake first.');
        return;
      }
      // 49% cap
      const existingPct = stakes.filter(s => s.teamId === offer.teamId).reduce((sum, s) => sum + s.stakePct, 0);
      if (existingPct + offer.stakePct > 49) {
        setError(`Cannot exceed 49% ownership. You already own ${existingPct}% of this team.`);
        return;
      }
      // Check if increasing existing stake — merge into existing entry
      const existingIdx = stakes.findIndex(s => s.teamId === offer.teamId);
      if (existingIdx >= 0) {
        const updated = stakes.map((s, i) => i === existingIdx ? {
          ...s,
          stakePct: s.stakePct + offer.stakePct,
          purchasePrice: r1(s.purchasePrice + offer.price),
        } : s);
        setCash(r1(cash - offer.price));
        setStakes(updated);
      } else {
        const newStake = {
          id: generateId(),
          teamId: offer.teamId,
          teamName: offer.teamName,
          league: offer.league,
          stakePct: offer.stakePct,
          purchasePrice: offer.price,
          purchaseSeason: season,
        };
        setCash(r1(cash - offer.price));
        setStakes([...stakes, newStake]);
      }
      setOffers(prev => prev.filter(x => x.id !== offer.id));
      setError(null);
    } catch (e) {
      console.error('buyStake error:', e);
      setError('An error occurred while processing the purchase.');
    }
  }

  function sellStake(stake) {
    const sellPrice = calcStakeValue(stake, lt || { ngl: [], abl: [] });
    setCash(r1(cash + sellPrice));
    setStakes(stakes.filter(s => s.id !== stake.id));
  }

  function handleBuyMore(stake) {
    // Generate a one-off increase offer for an existing stake
    const allTeams = [...(lt?.ngl || []), ...(lt?.abl || [])];
    const team = allTeams.find(t => t.id === stake.teamId);
    if (!team) return;
    const currentPct = stake.stakePct;
    if (currentPct >= 49) {
      setError('Already at maximum 49% ownership.');
      return;
    }
    const increment = Math.min(10, 49 - currentPct);
    const v = calculateValuation(team);
    const price = Math.round(v * (increment / 100) * 1.05); // slight premium for targeted buy
    const increaseOffer = {
      id: generateId(),
      teamId: stake.teamId,
      teamName: stake.teamName,
      league: stake.league,
      stakePct: increment,
      price,
      valuation: v,
      record: `${team.wins}-${team.losses}`,
      market: team.market,
      isIncrease: true,
    };
    // Add to offers if not already there
    setOffers(prev => {
      const existing = prev.find(o => o.teamId === stake.teamId && o.isIncrease);
      if (existing) return prev;
      return [...prev, increaseOffer];
    });
  }

  return (
    <div style={{ maxWidth: 750, margin: '0 auto', padding: '16px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Investment Market</h2>

      {/* Error display */}
      {error && (
        <div
          className="card"
          style={{ padding: '10px 14px', marginBottom: 12, background: '#fde8e8', border: '1px solid var(--red)', cursor: 'pointer' }}
          onClick={() => setError(null)}
        >
          <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--red)', margin: 0 }}>{error}</p>
        </div>
      )}

      {stakes.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
            <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Your Stakes</h3>
            <div className="stat-label">
              Season Income: <span className="stat-value" style={{ color: totalIncome > 0 ? 'var(--green)' : 'var(--red)' }}>${Math.round(totalIncome * 10) / 10}M</span>
            </div>
          </div>
          {stakes.map((stake, i) => {
            const currentValue = calcStakeValue(stake, lt || { ngl: [], abl: [] });
            const gain = currentValue - stake.purchasePrice;
            const canBuyMore = stake.stakePct < 49;
            return (
              <div key={stake.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--cream-dark)', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <span className="font-body" style={{ fontSize: '0.85rem', fontWeight: 500 }}>{stake.teamName}</span>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                    {stake.stakePct}% · Paid ${stake.purchasePrice}M · Now ${currentValue}M
                    <span style={{ color: gain >= 0 ? 'var(--green)' : 'var(--red)', marginLeft: 4 }}>({gain >= 0 ? '+' : ''}{gain}M)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {canBuyMore && (
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                      onClick={() => handleBuyMore(stake)}
                      title={`Increase stake (max 49%)`}
                    >
                      Buy More
                    </button>
                  )}
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '4px 10px', color: 'var(--green)', borderColor: 'var(--green)' }}
                    onClick={() => sellStake(stake)}
                  >
                    Sell ${currentValue}M
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Stake Offers</h3>
        {offers.length === 0
          ? <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
              {season < 3 ? 'Investment market unlocks in Season 3.' : cash < 15 ? 'Need $15M+ liquid capital to invest.' : 'No offers available this season.'}
            </p>
          : offers.map(offer => {
              const hasStakeInLeague = stakes.some(s => s.league === offer.league && s.teamId !== offer.teamId);
              const existingPct = stakes.filter(s => s.teamId === offer.teamId).reduce((sum, s) => sum + s.stakePct, 0);
              const wouldExceedCap = existingPct + offer.stakePct > 49;
              const blocked = cash < offer.price || hasStakeInLeague || wouldExceedCap;
              const blockReason = hasStakeInLeague ? 'Already invested in this league' : wouldExceedCap ? `Would exceed 49% cap (own ${existingPct}%)` : cash < offer.price ? 'Insufficient liquid capital' : '';
              return (
                <div key={offer.id} className="card" style={{ padding: '12px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {offer.teamName}
                      {offer.isIncrease && <span className="badge badge-amber" style={{ marginLeft: 6, fontSize: '0.6rem' }}>Increase</span>}
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                      {(offer.league || '').toUpperCase()} · {offer.record} · T{getMarketTier(offer.market)} · {offer.stakePct}% stake
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ fontSize: '0.7rem', padding: '5px 12px', opacity: blocked ? 0.4 : 1 }}
                    disabled={blocked}
                    onClick={() => buyStake(offer)}
                    title={blockReason}
                  >
                    Buy ${offer.price}M
                  </button>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}
