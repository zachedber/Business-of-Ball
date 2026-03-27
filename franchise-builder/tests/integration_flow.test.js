import test from 'node:test';
import assert from 'node:assert/strict';

import { initializeLeague, createPlayerFranchise, simulateLeagueQuarter, rollForInjuries, r1 } from '@/lib/engine';
import { applyDebtPenalty, calculateDebtPayment, calculateDynamicInterestRate } from '@/lib/engine/finance';

function runFullSeason(leagueTeams, franchise, season = 1) {
  let lt = leagueTeams;
  let pf = [franchise];
  for (let q = 1; q <= 4; q += 1) {
    const out = simulateLeagueQuarter(lt, pf, season, q);
    lt = out.leagueTeams;
    pf = out.franchises;
  }
  return { leagueTeams: lt, franchise: pf[0] };
}

test('Leveraged purchase debt payment is deducted after a full-season flow', () => {
  const league = initializeLeague();
  const template = league.ngl[0];
  const fr = createPlayerFranchise(template, 'ngl');

  const loanPrincipal = 50;
  const interestRate = 0.1;
  const termSeasons = 10;
  const seasonalPayment = calculateDebtPayment({ principal: loanPrincipal, interestRate, termSeasons });

  fr.cash = 120;
  fr.debtObject = {
    principal: loanPrincipal,
    interestRate,
    termSeasons,
    seasonalPayment,
    gmRep: 50,
    consecutiveMissedPayments: 0,
  };

  const endOfSeason = runFullSeason(league, fr);
  const cashBeforeDebt = endOfSeason.franchise.cash;
  const debtResult = applyDebtPenalty(endOfSeason.franchise.debtObject, cashBeforeDebt);

  assert.equal(debtResult.unpaidRemainder, 0);
  assert.equal(debtResult.cash, r1(cashBeforeDebt - seasonalPayment));
  assert.equal(debtResult.paymentMade, seasonalPayment);
});

test('Missing debt payments increments consecutive misses, applies penalty rate, and flags game over on second miss', () => {
  const debtObject = {
    principal: 80,
    interestRate: 0.09,
    termSeasons: 8,
    seasonalPayment: 20,
    gmRep: 45,
    consecutiveMissedPayments: 0,
  };

  const missOne = applyDebtPenalty(debtObject, 5);
  const expectedRateAfterMissOne = r1(calculateDynamicInterestRate(45, 0, missOne.debt.principal) + 0.05);

  assert.equal(missOne.debt.consecutiveMissedPayments, 1);
  assert.equal(missOne.debt.interestRate, expectedRateAfterMissOne);
  assert.equal(missOne.cash, 0);

  const missTwo = applyDebtPenalty({ ...missOne.debt, seasonalPayment: calculateDebtPayment(missOne.debt) }, 0);
  const gameOverForced = (missTwo.debt.consecutiveMissedPayments || 0) >= 2;

  assert.equal(missTwo.debt.consecutiveMissedPayments, 2);
  assert.equal(gameOverForced, true);
});

test('Sports Science + Recovery reduces long-term injury frequency over 100 quarters and taxi shortage does not crash', () => {
  const league = initializeLeague();
  const template = league.ngl[0];
  const baseFr = createPlayerFranchise(template, 'ngl');

  const deepRoster = Array.from({ length: 40 }, (_, i) => ({
    id: `p_${i}`,
    injuryProne: false,
    injuryStatus: { duration: 0, severity: null },
  }));

  let baselineLongTerm = 0;
  let investedLongTerm = 0;

  for (let quarter = 0; quarter < 100; quarter += 1) {
    baselineLongTerm += rollForInjuries(deepRoster, 0, false).filter(i => i.severity === 'long_term').length;
    investedLongTerm += rollForInjuries(deepRoster, 3, true).filter(i => i.severity === 'long_term').length;
  }

  const ratio = baselineLongTerm > 0 ? investedLongTerm / baselineLongTerm : 0;
  assert.ok(ratio <= 0.85, `Expected invested long-term injury ratio <= 0.85, got ${ratio.toFixed(3)}`);
  assert.ok(ratio >= 0.30, `Expected invested long-term injury ratio >= 0.30, got ${ratio.toFixed(3)}`);

  const injured = (player) => ({
    ...player,
    injured: true,
    injuryStatus: { duration: 4, severity: 'long_term' },
    injurySeverity: 'severe',
  });

  baseFr.star1 = injured(baseFr.star1);
  baseFr.star2 = injured(baseFr.star2);
  baseFr.corePiece = injured(baseFr.corePiece);
  baseFr.players = [baseFr.star1, baseFr.star2, baseFr.corePiece];
  baseFr.taxiSquad = [
    { id: 'taxi_a', name: 'Taxi A', rating: 70 },
    { id: 'taxi_b', name: 'Taxi B', rating: 68 },
  ];

  assert.doesNotThrow(() => {
    simulateLeagueQuarter(league, [baseFr], 1, 1);
  });
});
