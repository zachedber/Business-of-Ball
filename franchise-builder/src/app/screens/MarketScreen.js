'use client';
import { useState, useEffect } from 'react';
import { generateStakeOffers, calcStakeIncome, calcStakeValue, generateId, r1 } from '@/lib/engine';
import { getMarketTier } from '@/data/leagues';

// ============================================================
// MARKET SCREEN
// ============================================================
export default function MarketScreen({ lt, cash, stakes, season, setStakes, setCash }) {
  const [offers, setOffers] = useState([]);
  useEffect(() => {
    if (lt) setOffers(generateStakeOffers(lt, cash, season));
  }, [lt, season]);

  const totalIncome = calcStakeIncome(stakes, lt || { ngl: [], abl: [] });

  function buyStake(offer) {
    if (cash < offer.price) return;
    if (stakes.length >= 3) return; // Phase 3: max 3 stakes
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
    setOffers(prev => prev.filter(x => x.id !== offer.id));
  }

  function sellStake(stake) {
    const sellPrice = calcStakeValue(stake, lt || { ngl: [], abl: [] });
    setCash(r1(cash + sellPrice));
    setStakes(stakes.filter(s => s.id !== stake.id));
  }

  return (
    <div style={{ maxWidth: 750, margin: '0 auto', padding: '16px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Investment Market</h2>
      {stakes.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Your Stakes</h3>
            <div className="stat-label">
              Season Income: <span className="stat-value" style={{ color: totalIncome > 0 ? 'var(--green)' : 'var(--red)' }}>${Math.round(totalIncome * 10) / 10}M</span>
            </div>
          </div>
          {stakes.map((stake, i) => {
            const currentValue = calcStakeValue(stake, lt || { ngl: [], abl: [] });
            const gain = currentValue - stake.purchasePrice;
            return (
              <div key={stake.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--cream-dark)', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <span className="font-body" style={{ fontSize: '0.85rem', fontWeight: 500 }}>{stake.teamName}</span>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                    {stake.stakePct}% · Paid ${stake.purchasePrice}M · Now ${currentValue}M
                    <span style={{ color: gain >= 0 ? 'var(--green)' : 'var(--red)', marginLeft: 4 }}>({gain >= 0 ? '+' : ''}{gain}M)</span>
                  </div>
                </div>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '4px 10px', color: 'var(--green)', borderColor: 'var(--green)' }}
                  onClick={() => sellStake(stake)}
                >
                  Sell ${currentValue}M
                </button>
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
          : offers.map(offer => (
              <div key={offer.id} className="card" style={{ padding: '12px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{offer.teamName}</div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                    {offer.league.toUpperCase()} · {offer.record} · T{getMarketTier(offer.market)} · {offer.stakePct}% stake
                  </div>
                </div>
                <button
                  className="btn-primary"
                  style={{ fontSize: '0.7rem', padding: '5px 12px' }}
                  disabled={cash < offer.price || stakes.length >= 3}
                  onClick={() => buyStake(offer)}
                  title={stakes.length >= 3 ? 'Max 3 stakes allowed' : cash < offer.price ? 'Insufficient liquid capital' : ''}
                >
                  Buy ${offer.price}M
                </button>
              </div>
            ))
        }
      </div>
    </div>
  );
}
