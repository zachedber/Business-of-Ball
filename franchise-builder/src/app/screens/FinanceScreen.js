'use client';
import { calculateValuation, calcStakeValue, calcStakeIncome, projectRevenue, r1 } from '@/lib/engine';
import { calculateDebtPayment } from '@/lib/engine/finance';
import { MiniSparkline } from '@/app/components/SharedComponents';

// ============================================================
// EMPIRE FINANCE SCREEN
// ============================================================
export default function EmpireFinanceScreen({ af, fr, stakes, lt, season, onPayOffDebt }) {
  const ltSafe = lt || { ngl: [], abl: [] };

  // Empire summary
  const liquidCash = af.cash || 0;
  const franchiseValue = calculateValuation(af);
  const stakeValue = stakes.reduce((sum, s) => sum + calcStakeValue(s, ltSafe), 0);
  const netWorth = Math.round((franchiseValue + liquidCash + stakeValue) * 10) / 10;
  const totalRevenue = af.finances?.revenue || 0;
  const totalExpenses = af.finances?.expenses || 0;
  const netProfit = af.finances?.profit || 0;
  const stakeIncome = calcStakeIncome(stakes, ltSafe);
  const debt = af.debt || 0;
  const interestCost = Math.round(debt * 0.08 * 10) / 10;

  // Prior season deltas
  const prevH = af.history && af.history.length > 0 ? af.history[af.history.length - 1] : null;
  const cashDelta = prevH ? Math.round((liquidCash - (prevH.cash || 0)) * 10) / 10 : null;
  const profitDelta = prevH ? Math.round((netProfit - (prevH.profit || 0)) * 10) / 10 : null;
  const revDelta = prevH ? Math.round((totalRevenue - (prevH.revenue || 0)) * 10) / 10 : null;

  function delta(val) {
    if (val === null) return null;
    return (
      <span style={{ fontSize: '0.7rem', color: val > 0 ? 'var(--green)' : val < 0 ? 'var(--red)' : 'var(--ink-muted)', marginLeft: 4 }}>
        {val > 0 ? '+' : ''}{val}M
      </span>
    );
  }

  // Sell timing: compare valuation history
  const valHistory = af.history ? af.history.map(h => h.valuation || franchiseValue) : [];
  const avgVal = valHistory.length > 0 ? valHistory.reduce((a, b) => a + b, 0) / valHistory.length : franchiseValue;
  const sellSignal = franchiseValue > avgVal * 1.15 ? 'GOOD TIME TO SELL' : franchiseValue < avgVal * 0.9 ? 'BELOW AVERAGE' : 'HOLD';
  const sellColor = sellSignal === 'GOOD TIME TO SELL' ? 'var(--green)' : sellSignal === 'BELOW AVERAGE' ? 'var(--red)' : 'var(--amber)';

  // Projected end-of-season cash
  const proj = projectRevenue(af);
  const projCash = Math.round((liquidCash + (proj.projectedProfit || 0) - interestCost) * 10) / 10;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 12px', fontFamily: 'var(--font-mono)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="font-display section-header" style={{ fontSize: '1.2rem', borderBottomColor: af.primaryColor || 'var(--red)' }}>Empire Finances</h2>
        <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>Season {season}</span>
      </div>

      {/* Section 1: Empire Summary */}
      <div className="card" style={{ padding: 16, marginBottom: 12, borderLeft: '4px solid var(--gold)' }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)' }}>
          Empire Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {[
            ['Net Worth', `$${netWorth}M`, 'var(--gold)', null],
            ['Liquid Capital', `$${Math.round(liquidCash * 10) / 10}M`, liquidCash > 5 ? 'var(--green)' : 'var(--red)', cashDelta],
            ['Total Revenue', `$${totalRevenue}M`, 'var(--green)', revDelta],
            ['Total Expenses', `$${totalExpenses}M`, 'var(--red)', null],
            ['Net Profit', `$${netProfit}M`, netProfit > 0 ? 'var(--green)' : 'var(--red)', profitDelta],
            ['Stake Income', `$${Math.round(stakeIncome * 10) / 10}M`, stakeIncome > 0 ? 'var(--green)' : 'var(--ink-muted)', null],
            ['Debt', `$${debt}M`, debt > 0 ? 'var(--red)' : 'var(--ink)', null],
            ['Interest/yr', `$${interestCost}M`, debt > 0 ? 'var(--red)' : 'var(--ink-muted)', null],
          ].map(([label, value, color, d]) => (
            <div key={label} className="card" style={{ padding: '10px 12px', background: 'var(--cream-dark)' }}>
              <div className="stat-label" style={{ fontSize: '0.7rem' }}>{label}</div>
              <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: color || 'var(--ink)' }}>
                {value}{delta(d)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Franchise Breakdown */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Franchise Breakdown
        </h3>
        {fr.map((f) => {
          const fVal = calculateValuation(f);
          const prevFH = f.history && f.history.length > 0 ? f.history[f.history.length - 1] : null;
          const prevVal = prevFH?.valuation || fVal;
          const valChangePct = prevVal > 0 ? Math.round(((fVal - prevVal) / prevVal) * 1000) / 10 : 0;
          const valSparkData = f.history ? f.history.slice(-5).map(h => h.valuation || fVal) : [fVal];
          return (
            <div key={f.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--cream-darker)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ minWidth: 160 }}>
                <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700 }}>{f.city} {f.name}</div>
                <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{f.league === 'ngl' ? 'NGL' : 'ABL'} · S{f.season}</div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Revenue</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--green)' }}>${f.finances?.revenue || 0}M</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Profit</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: (f.finances?.profit || 0) > 0 ? 'var(--green)' : 'var(--red)' }}>${f.finances?.profit || 0}M</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Valuation</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700 }}>${fVal}M</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: '0.7rem' }}>Val Change</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: valChangePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {valChangePct >= 0 ? '+' : ''}{valChangePct}%
                  </div>
                </div>
                <div>
                  <div className="stat-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>5yr Trend</div>
                  <MiniSparkline data={valSparkData} width={80} height={24} color={valChangePct >= 0 ? 'var(--green)' : 'var(--red)'} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 3: Stake Portfolio */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Stake Portfolio
        </h3>
        {stakes.length === 0 ? (
          <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No stakes held. Buy stakes from the Market screen.</p>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                  {['Team', 'League', 'Owned%', 'Est. Value', 'Passive Income', 'Acq. Cost', 'Gain/Loss'].map(h => (
                    <th key={h} className="stat-label" style={{ padding: '6px 8px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stakes.map((s, i) => {
                  const cv = calcStakeValue(s, ltSafe);
                  const income = calcStakeIncome([s], ltSafe);
                  const gain = Math.round((cv - s.purchasePrice) * 10) / 10;
                  return (
                    <tr key={s.id || i} style={{ borderBottom: '1px solid var(--cream-dark)' }}>
                      <td className="font-body" style={{ padding: '6px 8px', fontWeight: 500 }}>{s.teamName}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{(s.league || '').toUpperCase()}</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>{s.stakePct}%</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>${cv}M</td>
                      <td className="font-mono" style={{ padding: '6px 8px', color: 'var(--green)' }}>${Math.round(income * 10) / 10}M</td>
                      <td className="font-mono" style={{ padding: '6px 8px' }}>${s.purchasePrice}M</td>
                      <td className="font-mono" style={{ padding: '6px 8px', color: gain >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {gain >= 0 ? '+' : ''}{gain}M
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: Capital Planning */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Capital Planning
        </h3>
        <div style={{ marginBottom: 16 }}>
          <h4 className="font-display" style={{ fontSize: '0.75rem', marginBottom: 8, color: 'var(--ink-muted)' }}>Cash Flow Projection</h4>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem' }}>
            <span className="font-mono" style={{ color: 'var(--ink)' }}>Current: ${Math.round(liquidCash * 10) / 10}M</span>
            <span style={{ color: 'var(--ink-muted)' }}>+</span>
            <span className="font-mono" style={{ color: proj.projectedProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>Profit: ${proj.projectedProfit}M</span>
            {interestCost > 0 && <>
              <span style={{ color: 'var(--ink-muted)' }}>-</span>
              <span className="font-mono" style={{ color: 'var(--red)' }}>Interest: ${interestCost}M</span>
            </>}
            <span style={{ color: 'var(--ink-muted)' }}>=</span>
            <span className="font-mono" style={{ fontWeight: 700, fontSize: '0.85rem', color: projCash > 0 ? 'var(--green)' : 'var(--red)' }}>
              Projected: ${projCash}M
            </span>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <h4 className="font-display" style={{ fontSize: '0.75rem', marginBottom: 8, color: 'var(--ink-muted)' }}>Franchise Sell Timing</h4>
          {fr.map(f => {
            const fVal = calculateValuation(f);
            const fPrevH = f.history && f.history.length > 0 ? f.history[f.history.length - 1] : null;
            const fAvg = f.history && f.history.length > 0 ? f.history.reduce((a, h) => a + (h.valuation || fVal), 0) / f.history.length : fVal;
            const fSignal = fVal > fAvg * 1.15 ? 'SELL' : fVal < fAvg * 0.9 ? 'HOLD LOW' : 'HOLD';
            const fColor = fSignal === 'SELL' ? 'var(--green)' : fSignal === 'HOLD LOW' ? 'var(--red)' : 'var(--amber)';
            return (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--cream-dark)' }}>
                <span className="font-body" style={{ fontSize: '0.8rem' }}>{f.city} {f.name}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="font-mono" style={{ fontSize: '0.7rem' }}>${fVal}M vs avg ${Math.round(fAvg)}M</span>
                  <span className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 700, color: fColor }}>{fSignal}</span>
                </div>
              </div>
            );
          })}
        </div>
        {debt > 0 && (
          <div style={{ padding: '10px 12px', background: '#fef5f5', border: '1px solid var(--red)', borderRadius: 2 }}>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--red)', fontWeight: 700 }}>
              Debt: ${debt}M @ 8% = ${interestCost}M interest this season
            </div>
            <div className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 3 }}>
              Repay debt from BizTab to reduce interest burden.
            </div>
          </div>
        )}
      </div>

      {/* Section 5: Debt Meter */}
      {af.debtObject && af.debtObject.principal > 0 && (() => {
        const debtObj = af.debtObject;
        const missed = debtObj.consecutiveMissedPayments || 0;
        const meterColor = missed === 0 ? 'var(--green)' : missed === 1 ? 'var(--amber)' : 'var(--red)';
        const meterLabel = missed === 0 ? 'HEALTHY' : missed === 1 ? 'WARNING' : 'CRITICAL';
        const principal = debtObj.principal || 0;
        const payment = calculateDebtPayment(debtObj);
        const canPayOff = (af.cash || 0) >= principal;

        return (
          <div className="card" style={{ padding: 16, marginBottom: 12, borderLeft: `4px solid ${meterColor}` }}>
            <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: meterColor }}>
              Debt Meter
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div>
                <div className="stat-label" style={{ fontSize: '0.68rem' }}>Principal</div>
                <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--red)' }}>${r1(principal)}M</div>
              </div>
              <div>
                <div className="stat-label" style={{ fontSize: '0.68rem' }}>Rate</div>
                <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{(debtObj.interestRate * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="stat-label" style={{ fontSize: '0.68rem' }}>Seasonal Payment</div>
                <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--amber)' }}>${r1(payment)}M</div>
              </div>
              <div>
                <div className="stat-label" style={{ fontSize: '0.68rem' }}>Remaining Term</div>
                <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{debtObj.termSeasons} seasons</div>
              </div>
              <div>
                <div className="stat-label" style={{ fontSize: '0.68rem' }}>Status</div>
                <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: meterColor }}>{meterLabel}</div>
              </div>
              <div>
                <div className="stat-label" style={{ fontSize: '0.68rem' }}>Missed Payments</div>
                <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: missed > 0 ? 'var(--red)' : 'var(--ink)' }}>{missed}</div>
              </div>
            </div>
            {/* Debt health bar */}
            <div style={{ height: 8, background: 'var(--cream-darker)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (missed / 2) * 100)}%`,
                background: meterColor,
                borderRadius: 4,
                transition: 'width 0.3s, background 0.3s',
              }} />
            </div>
            {onPayOffDebt && (
              <button
                className="btn-secondary"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 16px',
                  opacity: canPayOff ? 1 : 0.4,
                  borderColor: 'var(--green)',
                  color: 'var(--green)',
                }}
                disabled={!canPayOff}
                onClick={() => onPayOffDebt(principal)}
              >
                Pay Off Early (${r1(principal)}M)
              </button>
            )}
            {!canPayOff && (
              <p className="font-body" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                Insufficient cash to pay off the full principal of ${r1(principal)}M.
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
