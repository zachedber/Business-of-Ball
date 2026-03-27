import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, initialState } from '@/lib/gameReducer';
import { initializeLeague, createPlayerFranchise } from '@/lib/engine';
import { applyDebtPenalty, calculateDebtPayment } from '@/lib/engine/finance';

test('Reducer mutates state correctly for leveraged purchase debt penalty and triggers forced sale', () => {
  const league = initializeLeague();
  const template = league.ngl[0];
  const fr = createPlayerFranchise(template, 'ngl');

  const loanPrincipal = 80;
  const interestRate = 0.09;
  const termSeasons = 8;
  const seasonalPayment = calculateDebtPayment({ principal: loanPrincipal, interestRate, termSeasons });

  const leveragedFranchise = {
    ...fr,
    cash: 5,
    debtObject: {
      principal: loanPrincipal,
      interestRate,
      termSeasons,
      seasonalPayment,
      gmRep: 45,
      consecutiveMissedPayments: 0,
    }
  };

  let state = gameReducer(initialState, {
    type: 'CREATE_FRANCHISE',
    payload: { lt: league, frArray: [leveragedFranchise], cash: 5, events: [], freeAg: { ngl: [], abl: [] } }
  });

  const penaltyResult1 = applyDebtPenalty(state.fr[0].debtObject, state.cash);
  state = gameReducer(state, {
    type: 'SET_FRANCHISE',
    payload: [ { ...state.fr[0], cash: penaltyResult1.cash, debtObject: penaltyResult1.debt } ]
  });

  assert.equal(state.fr[0].debtObject.consecutiveMissedPayments, 1);
  assert.equal(state.cash, 0);

  const penaltyResult2 = applyDebtPenalty(state.fr[0].debtObject, state.cash);
  state = gameReducer(state, {
    type: 'SET_FRANCHISE',
    payload: [ { ...state.fr[0], cash: penaltyResult2.cash, debtObject: penaltyResult2.debt } ]
  });

  if (penaltyResult2.debt.consecutiveMissedPayments >= 2) {
     state = gameReducer(state, { type: 'GAME_OVER_FORCED' });
  }

  assert.equal(state.gameOverForced, true);
  assert.equal(state.simming, false);
});

test('Reducer updates simulation sequencing state correctly', () => {
  let state = gameReducer(initialState, { type: 'BEGIN_SIM' });
  assert.equal(state.simming, true);

  state = gameReducer(state, { type: 'SET_QUARTER_PHASE', payload: 1 });
  assert.equal(state.quarterPhase, 1);

  state = gameReducer(state, { type: 'Q1_PAUSE_OPEN' });
  assert.equal(state.q1PauseActive, true);
  assert.equal(state.simming, false);
});
