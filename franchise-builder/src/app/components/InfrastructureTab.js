'use client';
import { useState } from 'react';
import {
  STADIUM_TIERS, STADIUM_TIER_ORDER, getStadiumTierFromCapacity,
  UPGRADE_COSTS,
} from '@/data/leagues';
import {
  applyStadiumUpgrade, startStadiumProject, calculatePublicFundingApproval,
  purchasePremiumSeating, generateNewStadiumNamingRightsOffer, canAfford, clamp,
} from '@/lib/engine';

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
      {section === 'stadium' && <StadiumSection fr={fr} setFr={setFr} season={season} />}
      {section === 'facilities' && <FacilitiesSection fr={fr} setFr={setFr} onCashChange={onCashChange} />}
    </div>
  );
}

// --- Stadium Section ---
function StadiumSection({ fr, setFr, season }) {
  const [projectModal, setProjectModal] = useState(false);
  const [fundingTier, setFundingTier] = useState(0);
  const [projectTarget, setProjectTarget] = useState('mid');
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);

  const currentTierKey = fr.stadiumTier || getStadiumTierFromCapacity(fr.stadiumCapacity || 50000);
  const currentTierData = STADIUM_TIERS[currentTierKey];
  const currentTierIdx = STADIUM_TIER_ORDER.indexOf(currentTierKey);
  const nextTierKey = STADIUM_TIER_ORDER[currentTierIdx + 1];
  const nextTierData = nextTierKey ? STADIUM_TIERS[nextTierKey] : null;

  const stadiumDisplayName = fr.stadiumDisplayName || fr.stadiumName || `${fr.city} Stadium`;
  const proj = fr.stadiumProject;

  function handleUpgrade() {
    const result = applyStadiumUpgrade(fr, season);
    if (result) { setFr(() => result); setConfirmUpgrade(false); }
  }

  function handleStartProject() {
    const pct = fundingTier === 1 ? 15 : fundingTier === 2 ? 30 : fundingTier === 3 ? 50 : 0;
    if (fundingTier > 0) {
      const approval = calculatePublicFundingApproval(fr, fundingTier);
      if (Math.random() > approval) {
        alert(`Public funding request denied. (${Math.round(approval * 100)}% approval chance)`);
        return;
      }
    }
    const result = startStadiumProject(fr, projectTarget, pct, season);
    if (result !== fr) { setFr(() => result); setProjectModal(false); }
    else { alert('Cannot afford down payment for this project.'); }
  }

  function handleBuyBoxes() {
    if (!canAfford(fr.cash, 2)) return;
    const result = purchasePremiumSeating(fr, 'luxury_box', 1);
    if (result) setFr(() => result);
  }

  function handleBuyClubSeats() {
    if (!canAfford(fr.cash, 0.5)) return;
    const result = purchasePremiumSeating(fr, 'club_section', 1);
    if (result) setFr(() => result);
  }

  const maintBase = (fr.stadiumAge || 0) > 15 ? (fr.stadiumAge * 0.3) : 1;
  const maintAnnual = Math.round(maintBase * (currentTierData?.maintMultiplier || 1) * 10) / 10;
  const gateBoost = currentTierData ? Math.round((currentTierData.gateMultiplier - 1) * 100) : 0;

  return (
    <>
      {/* Stadium Overview */}
      <div className="card-elevated" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 className="font-display" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              {stadiumDisplayName}
            </h3>
            <div className="font-body" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', marginTop: 3 }}>
              {currentTierData?.label} tier · {(fr.stadiumCapacity || 0).toLocaleString()} cap
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {fr.stadiumUnderConstruction && <span className="badge badge-amber">UNDER CONSTRUCTION</span>}
            {(fr.newStadiumHoneymoon || 0) > 0 && <span className="badge badge-green">HONEYMOON +25%</span>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginTop: 12 }}>
          {[
            ['Tier', currentTierData?.label || '—'],
            ['Capacity', (fr.stadiumCapacity || 0).toLocaleString()],
            ['Condition', `${fr.stadiumCondition || 80}%`],
            ['Age', `${fr.stadiumAge || 0}yr`],
            ['Gate Bonus', gateBoost > 0 ? `+${gateBoost}%` : 'Base'],
            ['Maint/yr', `$${maintAnnual}M`],
          ].map(([label, val]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div className="stat-label">{label}</div>
              <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Project */}
      {proj && (
        <div className="card" style={{ padding: 14, borderLeft: '3px solid var(--amber)' }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.85rem' }}>
            Stadium Project — {STADIUM_TIERS[proj.targetTier]?.label} · Phase: {proj.currentPhase}
          </h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
            <div><span className="stat-label">Total Cost</span><div className="font-mono" style={{ fontSize: '0.85rem' }}>${proj.totalCost}M</div></div>
            <div><span className="stat-label">Paid</span><div className="font-mono" style={{ fontSize: '0.85rem' }}>${proj.paidSoFar}M</div></div>
            <div><span className="stat-label">Public Funding</span><div className="font-mono" style={{ fontSize: '0.85rem' }}>{proj.publicFundingPct}%</div></div>
            <div><span className="stat-label">Started</span><div className="font-mono" style={{ fontSize: '0.85rem' }}>S{proj.seasonStarted}</div></div>
          </div>
          <p className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 6, fontStyle: 'italic' }}>
            Project is in progress. Fan rating and attendance impacted during construction.
          </p>
        </div>
      )}

      {/* Upgrade Section */}
      {!proj && nextTierData && (
        <div className="card" style={{ padding: 14 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.85rem' }}>Stadium Upgrade</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div className="font-body" style={{ fontSize: '0.8rem' }}>
                Upgrade to <strong>{nextTierData.label}</strong> tier — ${nextTierData.upgradeCost}M
              </div>
              <div className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 3 }}>
                Gate ×{nextTierData.gateMultiplier} · Maint ×{nextTierData.maintMultiplier} · Requires S{nextTierData.minSeason}+
              </div>
              {season < nextTierData.minSeason && (
                <div style={{ fontSize: '0.65rem', color: 'var(--red)', marginTop: 2 }}>
                  Available from Season {nextTierData.minSeason}
                </div>
              )}
            </div>
            {!confirmUpgrade
              ? <button
                  className="btn-primary"
                  style={{ fontSize: '0.7rem', opacity: !canAfford(fr.cash, nextTierData.upgradeCost) || season < nextTierData.minSeason ? 0.4 : 1 }}
                  disabled={!canAfford(fr.cash, nextTierData.upgradeCost) || season < nextTierData.minSeason}
                  onClick={() => setConfirmUpgrade(true)}
                >
                  Upgrade (${nextTierData.upgradeCost}M)
                </button>
              : <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-primary" style={{ fontSize: '0.7rem', padding: '5px 10px' }} onClick={handleUpgrade}>Confirm</button>
                  <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '5px 10px' }} onClick={() => setConfirmUpgrade(false)}>Cancel</button>
                </div>
            }
          </div>
        </div>
      )}

      {/* New Stadium Construction */}
      {!proj && (
        <div className="card" style={{ padding: 14 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.85rem' }}>Build New Stadium</h3>
          <p className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 4 }}>
            Multi-season construction project. New stadium opens with condition 100, fan rating +15, and 2-season honeymoon +25% gate.
          </p>
          <button className="btn-secondary" style={{ fontSize: '0.7rem', marginTop: 10 }} onClick={() => setProjectModal(true)}>
            Plan New Stadium
          </button>
        </div>
      )}

      {/* Premium Seating */}
      <div className="card" style={{ padding: 14 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.85rem' }}>Premium Seating</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: '10px 14px', flex: 1, minWidth: 140 }}>
            <div className="font-body" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Luxury Boxes</div>
            <div className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2 }}>
              $2M install · $0.8M/yr revenue each
            </div>
            <div style={{ marginTop: 6 }}>
              <span className="stat-label">Owned: </span>
              <span className="font-mono" style={{ fontSize: '0.85rem' }}>{fr.luxuryBoxes || 0}</span>
            </div>
            <button
              className="btn-secondary"
              style={{ fontSize: '0.65rem', marginTop: 8, opacity: !canAfford(fr.cash, 2) ? 0.4 : 1 }}
              disabled={!canAfford(fr.cash, 2)}
              onClick={handleBuyBoxes}
            >
              Buy Box ($2M)
            </button>
          </div>
          <div className="card" style={{ padding: '10px 14px', flex: 1, minWidth: 140 }}>
            <div className="font-body" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Club Seat Sections</div>
            <div className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2 }}>
              $0.5M/section · $0.15M/yr (win-adjusted)
            </div>
            <div style={{ marginTop: 6 }}>
              <span className="stat-label">Sections: </span>
              <span className="font-mono" style={{ fontSize: '0.85rem' }}>{fr.clubSeatSections || 0}</span>
            </div>
            <button
              className="btn-secondary"
              style={{ fontSize: '0.65rem', marginTop: 8, opacity: !canAfford(fr.cash, 0.5) ? 0.4 : 1 }}
              disabled={!canAfford(fr.cash, 0.5)}
              onClick={handleBuyClubSeats}
            >
              Buy Section ($0.5M)
            </button>
          </div>
        </div>
        {((fr.luxuryBoxes || 0) > 0 || (fr.clubSeatSections || 0) > 0) && (
          <div className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 8 }}>
            Est. premium rev: ${Math.round(((fr.luxuryBoxes || 0) * 0.8 + (fr.clubSeatSections || 0) * 0.15) * 10) / 10}M/yr
          </div>
        )}
      </div>

      {/* Build New Stadium Modal */}
      {projectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card-elevated" style={{ maxWidth: 400, width: '100%', padding: 20 }}>
            <h3 className="font-display" style={{ fontSize: '1rem', marginBottom: 12 }}>Plan New Stadium</h3>

            <div style={{ marginBottom: 12 }}>
              <label className="stat-label">Target Tier</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {['mid', 'large', 'mega'].map(t => (
                  <button
                    key={t}
                    className={`tab-btn ${projectTarget === t ? 'active' : ''}`}
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => setProjectTarget(t)}
                  >
                    {STADIUM_TIERS[t]?.label}
                  </button>
                ))}
              </div>
              <div className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 6 }}>
                Base cost: ${({ mid: 120, large: 200, mega: 280 })[projectTarget]}M ·{' '}
                {projectTarget === 'mega' ? '3 seasons' : '2 seasons'}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="stat-label">Public Funding</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {[
                  { label: 'None', val: 0 },
                  { label: '15%', val: 1 },
                  { label: '30%', val: 2 },
                  { label: '50%', val: 3 },
                ].map(({ label, val }) => {
                  const prob = val > 0 ? Math.round(calculatePublicFundingApproval(fr, val) * 100) : null;
                  return (
                    <button
                      key={val}
                      className={`tab-btn ${fundingTier === val ? 'active' : ''}`}
                      style={{ fontSize: '0.68rem' }}
                      onClick={() => setFundingTier(val)}
                    >
                      {label}{prob !== null ? ` (${prob}%)` : ''}
                    </button>
                  );
                })}
              </div>
              {fundingTier > 0 && (
                <div className="font-body" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginTop: 4, fontStyle: 'italic' }}>
                  Approval is probabilistic. Factors: community rating, media rep, championships, losing seasons.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-primary" style={{ fontSize: '0.7rem' }} onClick={handleStartProject}>
                Start Project (30% down)
              </button>
              <button className="btn-secondary" style={{ fontSize: '0.7rem' }} onClick={() => setProjectModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Facilities Section ---
function FacilitiesSection({ fr, setFr, onCashChange }) {
  function upgrade(field) {
    const current = fr[field];
    if (current >= 3) return;
    const cost = UPGRADE_COSTS[current] || 15;
    if (!canAfford(fr.cash, cost)) return;
    const newCash = Math.round(((fr.cash || 0) - cost) * 10) / 10;
    setFr(prev => ({ ...prev, [field]: current + 1, cash: newCash }));
    if (onCashChange) onCashChange(newCash);
  }

  const facilities = [
    ['scoutingStaff', 'Scouting', 'Draft eval accuracy'],
    ['developmentStaff', 'Player Dev', 'Player growth rate'],
    ['medicalStaff', 'Medical', 'Injury reduction'],
    ['marketingStaff', 'Marketing', 'Fan rating boost'],
    ['trainingFacility', 'Training Facility', 'Win probability'],
    ['weightRoom', 'Weight Room', 'Conditioning & durability'],
    ['filmRoom', 'Film Room', 'Tactical edge'],
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
