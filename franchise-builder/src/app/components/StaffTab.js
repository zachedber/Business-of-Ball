'use client';
import { useState } from 'react';
import { STAFF_SALARIES } from '@/data/leagues';
import {
  generateStaffCandidates, fireCoordinator, hireCoordinator, calculateSchemeFit,
} from '@/lib/engine';

function schemeLabel(s) {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function levelBar(level, max = 3) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{ width: 14, height: 5, borderRadius: 2, background: level > i ? 'var(--red)' : 'var(--cream-darker)' }} />
      ))}
    </div>
  );
}

function CoordCard({ title, coord, role, fr, setFr, gmRep }) {
  const [hiring, setHiring] = useState(false);
  const [confirmFire, setConfirmFire] = useState(false);
  const [candidates, setCandidates] = useState(null);

  const salary = coord ? (STAFF_SALARIES[role.toLowerCase()]?.[coord.level] || coord.salary) : null;
  const scheme = coord?.scheme || coord?.specialty;

  function handleFire() {
    const result = fireCoordinator(fr, role);
    setFr(() => result);
    setConfirmFire(false);
    setCandidates(generateStaffCandidates(role, gmRep, 4));
    setHiring(true);
  }

  function handleHire(candidate) {
    const result = hireCoordinator(fr, role, candidate);
    if (result !== fr) { setFr(() => result); setHiring(false); setCandidates(null); }
    else { alert('Not enough cash to hire this coordinator.'); }
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div>
          <div className="stat-label" style={{ fontSize: '0.65rem' }}>{title}</div>
          {coord
            ? <>
                <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: 2 }}>{coord.name}</div>
                <div className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: 2 }}>
                  {schemeLabel(scheme)} · ${salary}M/yr · {coord.seasonsWithTeam || 0}yr tenure
                </div>
                {levelBar(coord.level)}
              </>
            : <div className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: 4, fontStyle: 'italic' }}>Vacant</div>
          }
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {coord && !confirmFire && (
            <button className="btn-secondary" style={{ fontSize: '0.65rem', borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => setConfirmFire(true)}>
              Fire
            </button>
          )}
          {coord && confirmFire && (
            <>
              <button className="btn-primary" style={{ fontSize: '0.65rem', padding: '4px 8px' }} onClick={handleFire}>Confirm (-${salary}M)</button>
              <button className="btn-secondary" style={{ fontSize: '0.65rem', padding: '4px 8px' }} onClick={() => setConfirmFire(false)}>Cancel</button>
            </>
          )}
          {!coord && !hiring && (
            <button className="btn-secondary" style={{ fontSize: '0.65rem' }} onClick={() => { setCandidates(generateStaffCandidates(role, gmRep, 4)); setHiring(true); }}>
              Hire
            </button>
          )}
        </div>
      </div>

      {/* Hiring pool */}
      {hiring && candidates && (
        <div style={{ borderTop: '1px solid var(--cream-darker)', paddingTop: 10, marginTop: 4 }}>
          <div className="stat-label" style={{ fontSize: '0.65rem', marginBottom: 6 }}>Candidates</div>
          {candidates.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--cream-darker)', flexWrap: 'wrap', gap: 6 }}>
              <div>
                <div className="font-body" style={{ fontSize: '0.78rem', fontWeight: 600 }}>{c.name}</div>
                <div className="font-body" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
                  Lvl {c.level} · {schemeLabel(c.scheme || c.specialty)} · ${c.salary}M/yr
                </div>
              </div>
              <button className="btn-primary" style={{ fontSize: '0.62rem', padding: '4px 10px' }} onClick={() => handleHire(c)}>
                Hire
              </button>
            </div>
          ))}
          <button className="btn-secondary" style={{ fontSize: '0.62rem', marginTop: 8 }} onClick={() => { setHiring(false); setCandidates(null); }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STAFF TAB
// ============================================================
export default function StaffTab({ fr, setFr, gmRep }) {
  const schemeFitScore = fr.schemeFit || calculateSchemeFit(fr);
  const staffChem = fr.staffChemistry || 65;

  const fitColor = schemeFitScore >= 75 ? 'var(--green)' : schemeFitScore >= 50 ? 'var(--amber)' : 'var(--red)';
  const chemColor = staffChem >= 75 ? 'var(--green)' : staffChem >= 50 ? 'var(--amber)' : 'var(--red)';

  const fitBonus = schemeFitScore >= 75 ? '+3% WP' : schemeFitScore >= 50 ? '0%' : schemeFitScore >= 25 ? '-2% WP' : '-5% WP';
  const chemBonus = `${staffChem >= 65 ? '+' : ''}${Math.round((staffChem - 65) * 0.1)}% WP`;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Scores summary */}
      <div className="card-elevated" style={{ padding: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div className="stat-label">Scheme Fit</div>
          <div className="font-display" style={{ fontSize: '1.3rem', fontWeight: 700, color: fitColor }}>{schemeFitScore}</div>
          <div className="font-body" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>{fitBonus}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div className="stat-label">Staff Chemistry</div>
          <div className="font-display" style={{ fontSize: '1.3rem', fontWeight: 700, color: chemColor }}>{staffChem}</div>
          <div className="font-body" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>{chemBonus}</div>
        </div>
        {fr.dynastyCohesionBonus && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="badge badge-green" style={{ fontSize: '0.6rem' }}>DYNASTY COHESION</span>
          </div>
        )}
      </div>

      {/* Head Coach (read-only here — managed via Coach tab) */}
      <div className="card" style={{ padding: 14 }}>
        <div className="stat-label" style={{ fontSize: '0.65rem' }}>HEAD COACH</div>
        <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: 2 }}>{fr.coach?.name}</div>
        <div className="font-body" style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: 2 }}>
          {fr.coach?.personality}
          {fr.coach?.developmentFocus ? ` · Focus: ${schemeLabel(fr.coach.developmentFocus)}` : ''}
          {fr.coach?.lockerRoomStyle ? ` · Style: ${schemeLabel(fr.coach.lockerRoomStyle)}` : ''}
        </div>
        <div className="font-body" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', marginTop: 2 }}>
          Manage via Coach tab
        </div>
      </div>

      {/* 2×2 Coordinator grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        <CoordCard
          title="OFFENSIVE COORDINATOR"
          coord={fr.offensiveCoordinator}
          role="OC"
          fr={fr} setFr={setFr} gmRep={gmRep}
        />
        <CoordCard
          title="DEFENSIVE COORDINATOR"
          coord={fr.defensiveCoordinator}
          role="DC"
          fr={fr} setFr={setFr} gmRep={gmRep}
        />
        <CoordCard
          title="PLAYER DEV COACH"
          coord={fr.playerDevCoach}
          role="PDC"
          fr={fr} setFr={setFr} gmRep={gmRep}
        />
      </div>

      <p className="font-body" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', fontStyle: 'italic', padding: '0 2px' }}>
        Coordinators can only be hired/fired in the offseason. Scheme fit and staff chemistry update each season.
      </p>
    </div>
  );
}
