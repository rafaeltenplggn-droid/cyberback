import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DrinkBuffTracker,
  DRINKS,
  DRINK_BUFF_AMOUNT,
  DRINK_BUFF_DURATION_MS,
  DRINK_MENU_REASON,
} from '../src/hackIntegration/drinkMenu.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';

function fundedLedger(amount = 100) {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount });
  return ledger;
}

test('sem nenhum drink pedido, nao ha buff ativo', () => {
  const tracker = new DrinkBuffTracker({ now: () => 0 });
  assert.equal(tracker.active, null);
});

test('order() cobra o BYTE do drink e ativa o buff correspondente', () => {
  const tracker = new DrinkBuffTracker({ now: () => 0 });
  const ledger = fundedLedger();
  const drink = DRINKS[0];

  const result = tracker.order(drink.id, { ledger });

  assert.equal(result.success, true);
  assert.equal(ledger.balance, 100 - drink.costByte);
  assert.deepEqual(tracker.active, {
    drinkId: drink.id,
    stat: drink.stat,
    amount: DRINK_BUFF_AMOUNT,
    expiresAt: DRINK_BUFF_DURATION_MS,
  });
});

test('order() com drink invalido e recusado', () => {
  const tracker = new DrinkBuffTracker({ now: () => 0 });
  const ledger = fundedLedger();

  const result = tracker.order('drink_que_nao_existe', { ledger });

  assert.equal(result.success, false);
  assert.equal(result.reason, DRINK_MENU_REASON.INVALID);
  assert.equal(ledger.balance, 100);
});

test('order() sem BYTE suficiente e recusado, sem cobrar nada', () => {
  const tracker = new DrinkBuffTracker({ now: () => 0 });
  const ledger = fundedLedger(1);

  const result = tracker.order(DRINKS[0].id, { ledger });

  assert.equal(result.success, false);
  assert.equal(result.reason, DRINK_MENU_REASON.NOT_ENOUGH_BYTE);
  assert.equal(ledger.balance, 1);
  assert.equal(tracker.active, null);
});

test('pedir um segundo drink substitui o buff anterior, sem acumular', () => {
  const tracker = new DrinkBuffTracker({ now: () => 0 });
  const ledger = fundedLedger();

  tracker.order(DRINKS[0].id, { ledger });
  tracker.order(DRINKS[1].id, { ledger });

  assert.equal(tracker.active.drinkId, DRINKS[1].id);
  assert.equal(tracker.active.stat, DRINKS[1].stat);
});

test('o buff expira apos DRINK_BUFF_DURATION_MS', () => {
  let now = 0;
  const tracker = new DrinkBuffTracker({ now: () => now });
  const ledger = fundedLedger();

  tracker.order(DRINKS[0].id, { ledger });
  now = DRINK_BUFF_DURATION_MS - 1;
  assert.notEqual(tracker.active, null);

  now = DRINK_BUFF_DURATION_MS;
  assert.equal(tracker.active, null);
});

test('applyTo() soma o buff ativo ao stat correspondente, sem mexer nos outros', () => {
  const tracker = new DrinkBuffTracker({ now: () => 0 });
  const ledger = fundedLedger();
  const drink = DRINKS[0];
  tracker.order(drink.id, { ledger });

  const playerStats = { breachSpeed: 10, stealth: 10, lootYield: 10, traceResistance: 10 };
  const buffed = tracker.applyTo(playerStats);

  assert.equal(buffed[drink.stat], 10 + DRINK_BUFF_AMOUNT);
  for (const stat of Object.keys(playerStats)) {
    if (stat !== drink.stat) assert.equal(buffed[stat], 10);
  }
});

test('applyTo() sem buff ativo retorna o mesmo playerStats, sem alterar nada', () => {
  const tracker = new DrinkBuffTracker({ now: () => 0 });
  const playerStats = { breachSpeed: 10, stealth: 10, lootYield: 10, traceResistance: 10 };

  const result = tracker.applyTo(playerStats);

  assert.deepEqual(result, playerStats);
});

test('drinks nao mexem em energia: order() nunca recebe nem usa energyMeter', () => {
  const tracker = new DrinkBuffTracker({ now: () => 0 });
  const ledger = fundedLedger();
  const result = tracker.order(DRINKS[0].id, { ledger });
  assert.equal('energyMeter' in result, false);
  assert.equal('energyValue' in result, false);
});
