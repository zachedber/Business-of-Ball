'use client';
import { useState, useMemo } from 'react';
import { getMarketTier, getMarketTierInfo } from '@/data/leagues';

// ============================================================
// LEAGUE SCREEN
// ============================================================
export default function LeagueScreen({ lt, fr }) {
  const [viewLeague, setViewLeague] = useState('ngl');
  const standings = useMemo(() => [...(lt?.[viewLeague] || [])].sort((a, b) => b.wins - a.wins), [lt, viewLeague]);
  const playerIds = fr.map(f => f.id);
  return (
    <div style={{ maxWidth: 850, margin: '0 auto', padding: '16px 12px' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button className={viewLeague === 'ngl' ? 'btn-primary' : 'btn-secondary'} onClick={() => setViewLeague('ngl')}>NGL — Football</button>
        <button className={viewLeague === 'abl' ? 'btn-primary' : 'btn-secondary'} onClick={() => setViewLeague('abl')}>ABL — Basketball</button>
      </div>
      <div className="card table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
              {['#', 'Team', 'Tier', 'W', 'L', 'Win%', 'Fan', 'Mkt'].map(h => (
                <th key={h} className="stat-label" style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((t, i) => {
              const isPlayer = playerIds.includes(t.id);
              const tierInfo = getMarketTierInfo(t.market);
              return (
                <tr key={t.id} className={isPlayer ? 'table-player-row' : ''} style={{ borderBottom: '1px solid var(--cream-dark)', fontWeight: isPlayer ? 600 : 400 }}>
                  <td className="font-mono" style={{ padding: '10px 12px' }}>{i + 1}</td>
                  <td className="font-body" style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: t.primaryColor || 'var(--ink-muted)', marginRight: 6, verticalAlign: 'middle' }} />
                    {t.city} {t.name}
                    {isPlayer && <span style={{ color: 'var(--red)', marginLeft: 4, fontSize: '0.7rem' }}>YOU</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}><span className="font-mono" style={{ fontSize: '0.72rem', color: tierInfo?.color || 'var(--ink-muted)' }}>T{getMarketTier(t.market)}</span></td>
                  <td className="font-mono" style={{ padding: '10px 12px' }}>{t.wins}</td>
                  <td className="font-mono" style={{ padding: '10px 12px' }}>{t.losses}</td>
                  <td className="font-mono" style={{ padding: '10px 12px' }}>
                    {t.wins + t.losses > 0 ? ((t.wins / (t.wins + t.losses)) * 100).toFixed(0) : '—'}
                  </td>
                  <td className="font-mono" style={{ padding: '10px 12px' }}>{t.fanRating}</td>
                  <td className="font-mono" style={{ padding: '10px 12px' }}>{t.market}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
