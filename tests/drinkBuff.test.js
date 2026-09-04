import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrinkBuffTracker, DRINK_BUFF_STAT, DRINK_BUFF_AMOUNT, DRINK_BUFF_DURATION_MS } from '../src/hackIntegration/drinkBuff.js';

function makeClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance(ms) {
      time += ms;
    },
  };
}

test('comeca inativo, applyTo nao muda os stats', () => {
  const tracker = new DrinkBuffTracker();
  assert.equal(tracker.isActive(), false);
  assert.equal(tracker.remainingMs(), 0);

  const stats = { breachSpeed: 10, stealth: 10 };
  assert.deepEqual(tracker.applyTo(stats), stats);
});

test('activate() liga o buff e applyTo soma o bonus so no stat certo, sem mutar o original', () => {
  const clock = makeClock();
  const tracker = new DrinkBuffTracker({ now: clock.now });
  tracker.activate();

  assert.equal(tracker.isActive(), true);
  const stats = { breachSpeed: 10, stealth: 10, lootYield: 10 };
  const buffed = tracker.applyTo(stats);

  assert.equal(buffed[DRINK_BUFF_STAT], 10 + DRINK_BUFF_AMOUNT);
  assert.equal(buffed.stealth, 10);
  assert.equal(buffed.lootYield, 10);
  assert.equal(stats.breachSpeed, 10, 'o objeto original nao foi mutado');
});

test('o buff expira sozinho depois de DRINK_BUFF_DURATION_MS', () => {
  const clock = makeClock();
  const tracker = new DrinkBuffTracker({ now: clock.now });
  tracker.activate();

  clock.advance(DRINK_BUFF_DURATION_MS - 1);
  assert.equal(tracker.isActive(), true, 'ainda faltando 1ms');

  clock.advance(1);
  assert.equal(tracker.isActive(), false);
  assert.equal(tracker.remainingMs(), 0);

  const stats = { breachSpeed: 10 };
  assert.deepEqual(tracker.applyTo(stats), stats, 'depois de expirar, nao aplica bonus nenhum');
});

test('remainingMs diminui com o tempo', () => {
  const clock = makeClock();
  const tracker = new DrinkBuffTracker({ now: clock.now });
  tracker.activate();

  assert.equal(tracker.remainingMs(), DRINK_BUFF_DURATION_MS);
  clock.advance(DRINK_BUFF_DURATION_MS / 2);
  assert.equal(tracker.remainingMs(), DRINK_BUFF_DURATION_MS / 2);
});

test('activate() de novo enquanto ja esta ativo reinicia a duracao', () => {
  const clock = makeClock();
  const tracker = new DrinkBuffTracker({ now: clock.now });
  tracker.activate();

  clock.advance(DRINK_BUFF_DURATION_MS - 1000);
  tracker.activate(); // reativa antes de expirar

  clock.advance(1000);
  assert.equal(tracker.isActive(), true, 'a reativacao reiniciou o timer, ainda nao devia ter expirado');
});
