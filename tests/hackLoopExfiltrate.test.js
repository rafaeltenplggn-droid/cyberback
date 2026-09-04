import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exfiltrate, TIME_OVERRUN_TRACE_PENALTY_PER_DIFFICULTY } from '../src/hackloop/exfiltrate.js';
import { getTier } from '../src/hackloop/tiers.js';
import { TraceMeter } from '../src/hackloop/trace.js';

test('dentro da janela: loot sai integral e trace nao aumenta', () => {
  const tier = getTier('comum');
  const target = { id: 't1', tier: 'comum' };
  const timeTakenMs = tier.maxWindowMs - 1;

  const result = exfiltrate(target, timeTakenMs, { rng: () => 0.5 });

  assert.equal(result.overTime, false);
  assert.equal(result.loot.amount, result.rawAmount);
  assert.equal(result.traceIncrease, 0);
});

test('estourando a janela: loot e reduzido proporcionalmente e trace aumenta', () => {
  const tier = getTier('comum');
  const target = { id: 't1', tier: 'comum' };
  const timeTakenMs = tier.maxWindowMs * 2; // o dobro da janela maxima

  const result = exfiltrate(target, timeTakenMs, { rng: () => 0.5 });

  assert.equal(result.overTime, true);
  assert.ok(result.loot.amount < result.rawAmount);
  // estourou em 2x a janela -> a proporcao de loot mantida e ~metade
  assert.equal(result.loot.amount, Math.round(result.rawAmount * 0.5));
  assert.equal(result.traceIncrease, TIME_OVERRUN_TRACE_PENALTY_PER_DIFFICULTY * tier.difficulty);
});

test('quanto maior o estouro, menor a proporcao de loot mantida', () => {
  const tier = getTier('raro');
  const target = { id: 't1', tier: 'raro' };

  const smallOverrun = exfiltrate(target, tier.maxWindowMs * 1.1, { rng: () => 0.5 });
  const bigOverrun = exfiltrate(target, tier.maxWindowMs * 3, { rng: () => 0.5 });

  assert.ok(bigOverrun.loot.amount < smallOverrun.loot.amount);
});

test('loot fica dentro do range do tier (rng em 0 e em quase 1)', () => {
  const tier = getTier('epico');
  const target = { id: 't1', tier: 'epico' };

  const min = exfiltrate(target, 100, { rng: () => 0 });
  const max = exfiltrate(target, 100, { rng: () => 0.999999 });

  assert.equal(min.rawAmount, tier.lootMin);
  assert.ok(max.rawAmount <= tier.lootMax);
});

test('quando um traceMeter e passado e a janela estoura, o trace do jogador sobe de verdade', () => {
  const traceMeter = new TraceMeter({ now: () => 0 });
  const tier = getTier('lendario');
  const target = { id: 't1', tier: 'lendario' };

  assert.equal(traceMeter.value, 0);
  exfiltrate(target, tier.maxWindowMs * 2, { rng: () => 0.5, traceMeter });
  assert.equal(traceMeter.value, TIME_OVERRUN_TRACE_PENALTY_PER_DIFFICULTY * tier.difficulty);
});

test('sem traceMeter, exfiltrate ainda funciona (trace so e reportado, quem chama decide o que fazer)', () => {
  const tier = getTier('incomum');
  const target = { id: 't1', tier: 'incomum' };
  const result = exfiltrate(target, tier.maxWindowMs * 5, { rng: () => 0.5 });
  assert.ok(result.traceIncrease > 0);
});
