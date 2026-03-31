import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOwnerReport } from '@/lib/economy/ownerReport';

// Minimal franchise fixture that mirrors post-season state
function makeFranchise(overrides = {}) {
  const base = {
    city: 'Chicago',
    name: 'Bulls',
    league: 'ngl',
    market: 85,
    wins: 42,
    losses: 40,
    rosterQuality: 72,
    fanRating: 65,
    stadiumCondition: 75,
    mediaRep: 55,
    lockerRoomChemistry: 60,
    schemeFit: 55,
    ticketPrice: 90,
    totalSalary: 80,
    sponsorLevel: 2,
    championships: 0,
    cash: 35,
    debt: 0,
    coach: { name: 'Test Coach', level: 2, personality: 'Tactician', seasonsWithTeam: 2, age: 48 },
    players: [
      { name: 'Player A', rating: 80, salary: 20, injured: false },
      { name: 'Player B', rating: 70, salary: 15, injured: true, injurySeverity: 'minor' },
      { name: 'Player C', rating: 65, salary: 12, injured: false },
    ],
    finances: { revenue: 120, expenses: 105, profit: 15 },
    history: [],
    ...overrides,
  };
  // Push a current-season history entry matching franchise state
  base.history = [
    ...(overrides.history || []),
    {
      season: (overrides.history?.length || 0) + 1,
      wins: base.wins,
      losses: base.losses,
      winPct: base.wins / (base.wins + base.losses),
      rosterQuality: base.rosterQuality,
      revenue: base.finances.revenue,
      expenses: base.finances.expenses,
      profit: base.finances.profit,
      fanRating: base.fanRating,
      cash: base.cash,
      chemistry: base.lockerRoomChemistry,
      mediaRep: base.mediaRep,
      economy: 'stable',
      injuries: base.players.filter(p => p.injured).map(p => ({ name: p.name, severity: p.injurySeverity })),
    },
  ];
  return base;
}

test('buildOwnerReport returns all five sections', () => {
  const fr = makeFranchise();
  const report = buildOwnerReport(fr, null);

  assert.ok(report.onField, 'missing onField section');
  assert.ok(report.fanSentiment, 'missing fanSentiment section');
  assert.ok(report.finances, 'missing finances section');
  assert.ok(report.valuation, 'missing valuation section');
  assert.ok(report.verdict, 'missing verdict section');
});

test('onField section has correct shape', () => {
  const fr = makeFranchise();
  const { onField } = buildOwnerReport(fr, null);

  assert.equal(typeof onField.record, 'string');
  assert.ok(['above', 'below', 'met'].includes(onField.expectation));
  assert.equal(typeof onField.primaryDriver, 'string');
  assert.equal(typeof onField.injuryNote, 'string');
  assert.equal(onField.record, '42-40');
});

test('fanSentiment tracks delta from previous season', () => {
  const prev = {
    season: 1, wins: 30, losses: 52, winPct: 0.37,
    rosterQuality: 60, revenue: 100, expenses: 90, profit: 10,
    fanRating: 50, cash: 40, chemistry: 55, mediaRep: 45, economy: 'stable', injuries: [],
  };
  const fr = makeFranchise({ fanRating: 65, history: [prev] });
  const { fanSentiment } = buildOwnerReport(fr, prev);

  assert.equal(fanSentiment.current, 65);
  assert.equal(fanSentiment.delta, 15);
  assert.equal(typeof fanSentiment.primaryDriver, 'string');
});

test('finances flags cash warning below $20M', () => {
  const fr = makeFranchise({ cash: 10 });
  const { finances } = buildOwnerReport(fr, null);

  assert.equal(finances.cashWarning, true);
});

test('finances does not flag cash warning at $20M+', () => {
  const fr = makeFranchise({ cash: 25 });
  const { finances } = buildOwnerReport(fr, null);

  assert.equal(finances.cashWarning, false);
});

test('valuation section includes current value and delta', () => {
  const fr = makeFranchise();
  const { valuation } = buildOwnerReport(fr, null);

  assert.equal(typeof valuation.current, 'number');
  assert.ok(valuation.current > 0, 'valuation should be positive');
  assert.equal(typeof valuation.delta, 'number');
  assert.equal(typeof valuation.primaryDriver, 'string');
});

test('verdict contains grade and reasoning', () => {
  const fr = makeFranchise();
  const { verdict } = buildOwnerReport(fr, null);

  assert.equal(typeof verdict.success, 'string');
  assert.equal(typeof verdict.failure, 'string');
  assert.equal(typeof verdict.grade, 'string');
  assert.ok(verdict.grade.length <= 2, 'grade should be a letter like A, B+, C-');
  assert.equal(typeof verdict.gradeReason, 'string');
  assert.ok(verdict.gradeReason.length > 10, 'grade reason should be a meaningful sentence');
});

test('winning + profitable franchise gets A-tier grade', () => {
  const fr = makeFranchise({ wins: 65, losses: 17, finances: { revenue: 150, expenses: 100, profit: 50 } });
  const { verdict } = buildOwnerReport(fr, null);

  assert.ok(verdict.grade.startsWith('A'), `expected A-tier grade, got ${verdict.grade}`);
});

test('losing + unprofitable franchise gets D grade', () => {
  const fr = makeFranchise({ wins: 15, losses: 67, finances: { revenue: 60, expenses: 90, profit: -30 } });
  const { verdict } = buildOwnerReport(fr, null);

  assert.equal(verdict.grade, 'D');
});

test('report section headings match spec for smoke test', () => {
  // Verify that the five section names exist in the report
  const fr = makeFranchise();
  const report = buildOwnerReport(fr, null);

  const sectionNames = ['onField', 'fanSentiment', 'finances', 'valuation', 'verdict'];
  for (const name of sectionNames) {
    assert.ok(report[name] !== undefined, `report should have ${name} section`);
    assert.ok(report[name] !== null, `report.${name} should not be null`);
  }
});
