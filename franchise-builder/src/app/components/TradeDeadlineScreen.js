'use client';
import { useState, useMemo } from 'react';
import { calculateCapSpace, generateDeadlineFreeAgents } from '@/lib/engine';

// ============================================================
// TRADE DEADLINE SCREEN
// Shows mid-season pause: roster, free agents, sign/release
// ============================================================

/**
 * TradeDeadlineScreen — Appears at the mid-season trade deadline.
 * Player can sign free agents or release players before the second half.
 *
 * @param {object}   fr              - Current franchise state
 * @param {function} setFr           - Franchise state setter
 * @param {function} onContinue      - Called when player clicks "Continue Season"
 * @param {number}   cash            - Global liquid cash
 * @param {function} setCash         - Global cash setter
 */
export default function TradeDeadlineScreen({ fr, setFr, onContinue, cash, setCash }) {
  const [deadlineFAs] = useState(() => generateDeadlineFreeAgents(fr.league, 6));
  const [error, setError] = useState(null);
  const [released, setReleased] = useState([]);

  const cap = useMemo(() => calculateCapSpace(fr), [fr]);
  const halfWins = fr.halfWins ?? 0;
  const halfLosses = fr.halfLosses ?? 0;
  const totalHalfGames = halfWins + halfLosses;

  /** Sign a free agent if cap space and cash allow */
  function signPlayer(fa) {
    setError(null);
    if (cap.space < fa.salary) {
      setError(`Insufficient cap space — need $${fa.salary}M, have $${cap.space}M.`);
      return;
    }
    const contractCost = fa.salary * 0.1; // signing bonus costs liquid cash
    if ((fr.cash || 0) < contractCost) {
      setError(`Insufficient cash for signing bonus ($${contractCost.toFixed(1)}M needed).`);
      return;
    }
    const newPlayer = { ...fa, yearsLeft: fa.yearsLeft || 2 };
    const newCash = Math.round(((fr.cash || 0) - contractCost) * 10) / 10;
    setFr(prev => ({
      ...prev,
      players: [...prev.players, newPlayer],
      totalSalary: Math.round((prev.totalSalary + fa.salary) * 10) / 10,
      rosterQuality: Math.round([...prev.players, newPlayer].reduce((s, p) => s + p.rating, 0) / (prev.players.length + 1)),
      cash: newCash,
    }));
    setCash(newCash);
  }

  /** Release a player (adds dead money equal to remaining salary / 4) */
  function releasePlayer(playerId) {
    setError(null);
    const player = fr.players.find(p => p.id === playerId);
    if (!player) return;
    if (player.trait === 'hometown') {
      setError(`Warning: Releasing ${player.name} (Hometown) will hurt fan and reputation.`);
    }
    const deadMoney = Math.round((player.salary * 0.25) * 10) / 10;
    setReleased(prev => [...prev, player.name]);
    setFr(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== playerId),
      totalSalary: Math.round((prev.totalSalary - player.salary) * 10) / 10,
      capDeadMoney: Math.round(((prev.capDeadMoney || 0) + deadMoney) * 10) / 10,
      rosterQuality: Math.round(prev.players.filter(p => p.id !== playerId).reduce((s, p) => s + p.rating, 0) / Math.max(1, prev.players.length - 1)),
    }));
  }

  const sortedRoster = useMemo(
    () => [...fr.players].sort((a, b) => b.rating - a.rating),
    [fr.players]
  );

  const availableFAs = deadlineFAs.filter(
    fa => !fr.players.some(p => p.id === fa.id)
  );

  return (
    <div className="fade-in" style={{ maxWidth: 860, margin: '0 auto', padding: '16px 12px' }}>

      {/* ── HEADER BANNER ── */}
      <div style={{
        background: 'var(--ink)',
        color: 'var(--cream)',
        padding: '20px 24px',
        textAlign: 'center',
        marginBottom: 16,
        borderBottom: `4px solid ${fr.primaryColor || 'var(--red)'}`,
      }}>
        <div className="font-display" style={{
          fontSize: 'clamp(1.6rem, 6vw, 2.4rem)',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: fr.primaryColor || 'var(--red)',
        }}>
          TRADE DEADLINE
        </div>
        <div className="font-mono" style={{ fontSize: '0.8rem', marginTop: 6, color: '#ccc' }}>
          The season pauses. Make your moves before the second half begins.
        </div>
      </div>

      {/* ── HALF-SEASON RECORD ── */}
      <div className="card-elevated" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="stat-label">First Half Record</div>
            <div className="font-display" style={{ fontSize: '2rem', fontWeight: 700 }}>
              {halfWins}–{halfLosses}
            </div>
            <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              {totalHalfGames > 0
                ? `${((halfWins / totalHalfGames) * 100).toFixed(0)}% win rate`
                : 'Season paused'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">Roster Quality</div>
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>{fr.rosterQuality}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">Cap Space</div>
              <div className="stat-value" style={{
                fontSize: '1.1rem',
                color: cap.space > 5 ? 'var(--green)' : cap.space > 0 ? 'var(--amber)' : 'var(--red)',
              }}>
                ${cap.space}M
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">Liquid Cash</div>
              <div className="stat-value" style={{
                fontSize: '1.1rem',
                color: (fr.cash || 0) > 5 ? 'var(--green)' : 'var(--amber)',
              }}>
                ${Math.round((fr.cash || 0) * 10) / 10}M
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div style={{
          background: '#fde8e8',
          border: '1px solid var(--red)',
          color: 'var(--red)',
          padding: '8px 14px',
          borderRadius: 6,
          fontSize: '0.8rem',
          marginBottom: 10,
          fontFamily: 'var(--font-body)',
        }}>
          {error}
        </div>
      )}

      {/* ── RELEASED NOTIFICATION ── */}
      {released.length > 0 && (
        <div style={{
          background: '#fff3e0',
          border: '1px solid var(--amber)',
          padding: '8px 14px',
          borderRadius: 6,
          fontSize: '0.8rem',
          color: 'var(--ink-soft)',
          marginBottom: 10,
          fontFamily: 'var(--font-mono)',
        }}>
          Released: {released.join(', ')}
        </div>
      )}

      {/* ── CURRENT ROSTER ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Current Roster</h3>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--cream-darker)' }}>
                {['Player', 'Pos', 'Age', 'Rtg', '$M/yr', 'Yrs', 'Trait', ''].map(h => (
                  <th key={h} className="stat-label" style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRoster.map(player => (
                <tr key={player.id} style={{
                  borderBottom: '1px solid var(--cream-dark)',
                  background: player.injured ? 'rgba(200,32,42,0.06)' : 'transparent',
                }}>
                  <td className="font-body" style={{ padding: '10px 12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {player.name}
                    {player.isLocalLegend && <span className="badge" style={{ background: 'var(--gold)', color: 'var(--ink)', marginLeft: 4, fontSize: '0.6rem' }}>Legend</span>}
                    {player.injured && <span style={{ color: 'var(--red)', marginLeft: 4, fontSize: '0.7rem' }}>INJ</span>}
                  </td>
                  <td className="font-mono" style={{ padding: '10px 12px' }}>{player.position}</td>
                  <td className="font-mono" style={{ padding: '10px 12px' }}>{player.age}</td>
                  <td className="font-mono" style={{
                    padding: '10px 12px',
                    fontWeight: 600,
                    color: player.rating >= 85 ? 'var(--green)' : player.rating >= 70 ? 'var(--ink)' : 'var(--ink-muted)',
                  }}>
                    {player.rating}
                  </td>
                  <td className="font-mono" style={{ padding: '10px 12px' }}>{player.salary}</td>
                  <td className="font-mono" style={{
                    padding: '10px 12px',
                    color: player.yearsLeft <= 1 ? 'var(--red)' : 'var(--ink)',
                  }}>
                    {player.yearsLeft}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {player.trait && (
                      <span className={`badge ${player.trait === 'leader' ? 'badge-green' : player.trait === 'mercenary' ? 'badge-amber' : ['volatile', 'injury_prone'].includes(player.trait) ? 'badge-red' : 'badge-ink'}`}>
                        {player.trait}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.72rem', borderColor: 'var(--red)', color: 'var(--red)' }}
                      onClick={() => releasePlayer(player.id)}
                    >
                      Release
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FREE AGENT POOL ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <h3 className="font-display section-header" style={{ fontSize: '0.9rem', marginBottom: 0 }}>Deadline Free Agents</h3>
          <div className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
            Mid-season pool — lower quality than offseason
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {availableFAs.map(fa => {
            const canSign = cap.space >= fa.salary;
            return (
              <div key={fa.id} className="card" style={{
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                <div>
                  <div className="font-body" style={{ fontWeight: 500, fontSize: '0.9rem' }}>{fa.name}</div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                    {fa.position} · Age {fa.age} · Rtg {fa.rating} · ${fa.salary}M/yr · {fa.yearsLeft}yr
                    {fa.trait && ` · ${fa.trait}`}
                  </div>
                </div>
                <button
                  className={canSign ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '0.78rem', opacity: canSign ? 1 : 0.5, minHeight: 36 }}
                  disabled={!canSign}
                  onClick={() => signPlayer(fa)}
                  title={!canSign ? `Need $${fa.salary}M cap space, have $${cap.space}M` : ''}
                >
                  {canSign ? `Sign $${fa.salary}M` : 'No Cap'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CONTINUE BUTTON ── */}
      <div style={{ textAlign: 'center', paddingBottom: 20 }}>
        <div className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 12 }}>
          Roster locked after this point. The second half begins now.
        </div>
        <button
          className="btn-gold"
          style={{ padding: '14px 40px', fontSize: '1rem', letterSpacing: '0.06em' }}
          onClick={onContinue}
        >
          CONTINUE SEASON →
        </button>
      </div>
    </div>
  );
}
