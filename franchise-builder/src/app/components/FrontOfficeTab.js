'use client';
import { useState } from 'react';
import { canAfford, formatMoney, r1 } from '@/lib/engine';

// ============================================================
// FRONT OFFICE INVESTMENTS
// ============================================================

const INVESTMENTS = [
  {
    key: 'sportsScienceDept',
    name: 'Sports Science Department',
    tiers: [
      { level: 1, cost: 5, upkeep: 1, desc: 'Reduces injury probability slightly.' },
      { level: 2, cost: 10, upkeep: 2, desc: 'Further reduces injury probability.' },
      { level: 3, cost: 20, upkeep: 4, desc: 'Maximally reduces injury probability.' },
    ],
  },
  {
    key: 'scoutingNetwork',
    name: 'Advanced Scouting Network',
    tiers: [
      { level: 1, cost: 4, upkeep: 0, desc: 'Reveals if a player is injury prone.' },
      { level: 2, cost: 8, upkeep: 0, desc: 'Narrows hidden potential ranges.' },
      { level: 3, cost: 15, upkeep: 0, desc: 'Reveals exact hidden potential integers.' },
    ],
  },
  {
    key: 'globalMarketing',
    name: 'Global Marketing Agency',
    tiers: [
      { level: 1, cost: 5, upkeep: 0, desc: '+1 media rep per season.' },
      { level: 2, cost: 12, upkeep: 0, desc: '+3 media rep per season.' },
      { level: 3, cost: 25, upkeep: 0, desc: '+6 media rep per season.' },
    ],
  },
  {
    key: 'recoveryCenter',
    name: 'Premium Recovery Center',
    tiers: [
      { level: 1, cost: 18, upkeep: 0, desc: 'Speeds up injury recovery times.' },
    ],
  },
  {
    key: 'privateJets',
    name: 'Private Jet Fleet',
    tiers: [
      { level: 1, cost: 25, upkeep: 0, desc: '+4 player morale, +3 GM rep.' },
    ],
  },
  {
    key: 'nutritionStaff',
    name: 'Nutrition & Culinary Staff',
    tiers: [
      { level: 1, cost: 3, upkeep: 0, desc: '+2 player morale, slight stamina bonus.' },
    ],
  },
  {
    key: 'stadiumDistrict',
    name: 'Stadium Real Estate District',
    tiers: [
      { level: 1, cost: 40, upkeep: 0, desc: '+$4M passive seasonal income.' },
      { level: 2, cost: 80, upkeep: 0, desc: '+$10M passive seasonal income.' },
      { level: 3, cost: 150, upkeep: 0, desc: '+$22M passive seasonal income.' },
    ],
  },
  {
    key: 'overseasStakes',
    name: 'Overseas Stakes',
    stackable: true,
    tiers: [
      { level: 1, cost: 10, upkeep: 0, desc: 'Returns random $0.5M–$2M per season. Stackable.' },
    ],
  },
];

export default function FrontOfficeTab({ fr, setFr }) {
  const [confirmPurchase, setConfirmPurchase] = useState(null);
  const investments = fr.investments || {};

  function purchaseInvestment(key, level, cost) {
    setFr(prev => {
      if (!canAfford(prev.cash, cost)) return prev;
      const updated = { ...prev };
      updated.cash = r1(updated.cash - cost);
      updated.investments = { ...(updated.investments || {}) };

      if (key === 'overseasStakes') {
        updated.investments.overseasStakes = (updated.investments.overseasStakes || 0) + 1;
      } else {
        updated.investments[key] = level;
      }

      return updated;
    });
    setConfirmPurchase(null);
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid var(--gold)' }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold)', marginBottom: 4 }}>
          Front Office Investments
        </h3>
        <p className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
          Strategic investments that provide lasting competitive advantages. Upkeep costs are deducted each season.
        </p>
      </div>

      {INVESTMENTS.map(inv => {
        const currentLevel = inv.stackable
          ? (investments[inv.key] || 0)
          : (investments[inv.key] || 0);
        const isStackable = inv.stackable;

        return (
          <div key={inv.key} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{inv.name}</div>
                {!isStackable && currentLevel > 0 && (
                  <span className="badge badge-green" style={{ fontSize: '0.62rem', marginTop: 2 }}>
                    Tier {currentLevel}
                  </span>
                )}
                {isStackable && currentLevel > 0 && (
                  <span className="badge badge-blue" style={{ fontSize: '0.62rem', marginTop: 2 }}>
                    {currentLevel} owned
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {inv.tiers.map(tier => {
                const alreadyOwned = !isStackable && currentLevel >= tier.level;
                const nextTier = !isStackable && tier.level === currentLevel + 1;
                const available = isStackable || nextTier;
                const affordable = canAfford(fr.cash, tier.cost);

                return (
                  <div
                    key={tier.level}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: alreadyOwned ? 'rgba(34,197,94,0.06)' : 'var(--cream-dark)',
                      borderRadius: 4,
                      border: alreadyOwned ? '1px solid rgba(34,197,94,0.2)' : '1px solid var(--border)',
                      opacity: (!available && !alreadyOwned) ? 0.5 : 1,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div className="font-body" style={{ fontSize: '0.75rem', color: 'var(--ink)' }}>{tier.desc}</div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                        <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--red)' }}>Cost: ${tier.cost}M</span>
                        {tier.upkeep > 0 && (
                          <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--amber)' }}>Upkeep: ${tier.upkeep}M/season</span>
                        )}
                      </div>
                    </div>
                    {alreadyOwned ? (
                      <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 700 }}>OWNED</span>
                    ) : available ? (
                      confirmPurchase === `${inv.key}-${tier.level}` ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn-primary"
                            style={{ fontSize: '0.65rem', padding: '3px 8px' }}
                            onClick={() => purchaseInvestment(inv.key, tier.level, tier.cost)}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '0.65rem', padding: '3px 8px' }}
                            onClick={() => setConfirmPurchase(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn-secondary"
                          style={{
                            fontSize: '0.68rem',
                            padding: '4px 10px',
                            opacity: affordable ? 1 : 0.4,
                          }}
                          disabled={!affordable}
                          onClick={() => setConfirmPurchase(`${inv.key}-${tier.level}`)}
                        >
                          {isStackable ? 'Buy Stake' : `Buy Tier ${tier.level}`}
                        </button>
                      )
                    ) : (
                      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>LOCKED</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
