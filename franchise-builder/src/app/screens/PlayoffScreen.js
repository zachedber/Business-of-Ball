'use client';
import { useState } from 'react';

// ============================================================
// PLAYOFF BRACKET SCREEN
// ============================================================
export default function PlayoffBracketScreen({ playoffResult, playerFranchise, season, onContinue, onDone }) {
  const [roundIdx, setRoundIdx] = useState(0);
  const { eastSeeds, westSeeds, rounds, champion, playerMadePlayoffs, playerEliminated, playerWonChampionship } = playoffResult;

  const currentRound = rounds[roundIdx];
  const isLastRound = roundIdx >= rounds.length - 1;

  const pId = playerFranchise?.id;

  function playerGameInRound(round) {
    return round?.games.find(g => g.teamA?.id === pId || g.teamB?.id === pId) || null;
  }

  const playerGame = playerGameInRound(currentRound);
  const playerElimThisRound = playerGame && playerGame.loser?.id === pId;
  const playerWonThisRound = playerGame && playerGame.winner?.id === pId;

  const isChampionshipRound = currentRound?.name === 'NGL Championship';

  function advanceRound() {
    if (isLastRound) {
      onDone();
    } else {
      setRoundIdx(r => r + 1);
    }
  }

  // Seed badge helper
  function SeedBadge({ team, winnerOf }) {
    const isPlayer = team?.id === pId;
    const isChamp = champion?.id === team?.id;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
        fontWeight: isPlayer ? 700 : 400,
        color: isChamp ? 'var(--gold)' : isPlayer ? 'var(--red)' : 'var(--ink)',
      }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>#{team?.seed}</span>
        {' '}{team?.city} {team?.name}
        {isPlayer && <span style={{ color: 'var(--red)', fontSize: '0.7rem' }}>YOU</span>}
      </span>
    );
  }

  // Seeds table (top 6 per conf) for reference
  function SeedsPanel({ seeds, label }) {
    return (
      <div style={{ flex: '1 1 200px' }}>
        <div className="font-display" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>
          {label} Conference
        </div>
        {seeds.map(t => (
          <div key={t.id} style={{
            display: 'flex', justifyContent: 'space-between', padding: '4px 6px',
            borderBottom: '1px solid var(--cream-dark)',
            background: t.id === pId ? '#fef5f5' : 'transparent',
            borderLeft: t.id === pId ? '3px solid var(--red)' : '3px solid transparent',
          }}>
            <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', minWidth: 14 }}>#{t.seed}</span>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: t.primaryColor || 'var(--ink-muted)', marginLeft: 6, marginRight: 4, flexShrink: 0 }} />
            <span className="font-body" style={{ fontSize: '0.7rem', flex: 1 }}>{t.city} {t.name}</span>
            <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{t.wins}-{t.losses}</span>
          </div>
        ))}
      </div>
    );
  }

  // Championship celebration
  if (isLastRound && playerWonChampionship) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '30px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
        <h2 className="font-display" style={{ fontSize: 'clamp(1.4rem,5vw,2.2rem)', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          NGL Champions!
        </h2>
        <div style={{ width: 60, height: 3, background: 'var(--gold)', margin: '10px auto 14px' }} />
        <p className="font-body" style={{ fontSize: '0.95rem', color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 20 }}>
          The {playerFranchise.city} {playerFranchise.name} have won the NGL Championship in Season {season}.
          A dynasty is being built.
        </p>
        <div className="card" style={{ padding: '12px 16px', display: 'inline-block', marginBottom: 20, borderLeft: '4px solid var(--gold)' }}>
          <div className="font-mono" style={{ fontSize: '0.75rem' }}>
            {playerFranchise.city} {playerFranchise.name} defeated {currentRound.games[0]?.loser?.city} {currentRound.games[0]?.loser?.name}
          </div>
          <div className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 4 }}>
            {currentRound.games[0]?.narrative}
          </div>
        </div>
        <div>
          <button className="btn-gold" style={{ padding: '12px 32px' }} onClick={onContinue}>
            Continue to Offseason
          </button>
        </div>
      </div>
    );
  }

  // Player eliminated
  if (playerMadePlayoffs && playerElimThisRound) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '30px 16px' }}>
        <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Season Over — {currentRound.name} Exit</h2>
        <div className="card" style={{ padding: 16, marginBottom: 12, borderLeft: '4px solid var(--red)' }}>
          <p className="font-body" style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            {playerGame.narrative}
          </p>
          <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
            <div><span className="stat-label">Final Record</span><div className="stat-value">{playerFranchise.wins}-{playerFranchise.losses}</div></div>
            <div><span className="stat-label">Playoff Exit</span><div className="stat-value" style={{ color: 'var(--red)' }}>{currentRound.name}</div></div>
          </div>
        </div>
        {/* Show remaining bracket results */}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>Full {currentRound.name} Results</h3>
          {currentRound.games.map((g, i) => (
            <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--cream-dark)', fontSize: '0.72rem' }}>
              <span className="font-body" style={{ color: 'var(--green)' }}>{g.winner?.city} {g.winner?.name}</span>
              <span className="font-mono" style={{ color: 'var(--ink-muted)', margin: '0 6px' }}>def.</span>
              <span className="font-body" style={{ color: 'var(--ink-muted)', textDecoration: 'line-through' }}>{g.loser?.city} {g.loser?.name}</span>
              {g.isUpset && <span className="badge badge-amber" style={{ fontSize: '0.7rem', marginLeft: 6 }}>UPSET</span>}
            </div>
          ))}
        </div>
        <button className="btn-gold" style={{ padding: '12px 28px' }} onClick={onContinue}>
          Continue to Offseason
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 12px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>
        NGL Playoffs — {currentRound?.name}
      </h2>
      <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 14 }}>
        Season {season} · Round {roundIdx + 1} of {rounds.length}
      </p>

      {/* Seedings reference — only show on first round */}
      {roundIdx === 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 10 }}>Playoff Field (12 Teams)</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <SeedsPanel seeds={eastSeeds} label="East" />
            <SeedsPanel seeds={westSeeds} label="West" />
          </div>
          <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 8 }}>
            Seeds 1-2 per conference have a bye. Seeds 3-6 play Wild Card round.
          </p>
        </div>
      )}

      {/* Player's game highlight */}
      {playerGame && playerMadePlayoffs && (
        <div className="card" style={{ padding: 14, marginBottom: 12, borderLeft: '4px solid var(--red)' }}>
          <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>
            Your Matchup — {currentRound.name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <SeedBadge team={playerGame.teamA} />
            <span className="font-mono" style={{ color: 'var(--ink-muted)' }}>vs</span>
            <SeedBadge team={playerGame.teamB} />
          </div>
          <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 6 }}>
            {playerGame.narrative}
          </p>
          {playerWonThisRound && (
            <span className="badge badge-green">ADVANCE</span>
          )}
          {playerElimThisRound && (
            <span className="badge badge-red">ELIMINATED</span>
          )}
        </div>
      )}

      {/* All games this round */}
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <h3 className="font-display" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>
          {currentRound?.name} Results
        </h3>
        {['East', 'West', 'Neutral'].map(conf => {
          const confGames = currentRound?.games.filter(g => g.conf === conf);
          if (!confGames || confGames.length === 0) return null;
          return (
            <div key={conf} style={{ marginBottom: 10 }}>
              {conf !== 'Neutral' && (
                <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em' }}>
                  {conf} Conference
                </div>
              )}
              {confGames.map((g, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0',
                  borderBottom: '1px solid var(--cream-dark)', flexWrap: 'wrap',
                }}>
                  <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', minWidth: 70 }}>{g.label}</span>
                  <span className="font-body" style={{ fontSize: '0.72rem', color: 'var(--green)', fontWeight: 600, flex: '1 1 120px' }}>
                    {g.winner?.city} {g.winner?.name}
                    {g.winner?.id === pId && <span style={{ color: 'var(--red)', marginLeft: 4, fontSize: '0.7rem' }}>YOU</span>}
                  </span>
                  <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>def.</span>
                  <span className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', flex: '1 1 100px', textDecoration: 'line-through' }}>
                    {g.loser?.city} {g.loser?.name}
                  </span>
                  {g.isUpset && <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>UPSET</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Championship reveal */}
      {isLastRound && !playerWonChampionship && (
        <div className="card" style={{ padding: 14, marginBottom: 14, borderLeft: '4px solid var(--gold)' }}>
          <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gold)' }}>
            NGL Champion: {champion?.city} {champion?.name}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {!isLastRound && !playerElimThisRound && (
          <button className="btn-primary" style={{ padding: '10px 24px' }} onClick={advanceRound}>
            Next Round →
          </button>
        )}
        {isLastRound && !playerWonChampionship && (
          <button className="btn-gold" style={{ padding: '12px 28px' }} onClick={onContinue}>
            Continue to Offseason
          </button>
        )}
      </div>
    </div>
  );
}
