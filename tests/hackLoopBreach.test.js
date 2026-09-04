import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breach, breachSuccessChance, MIN_SUCCESS_CHANCE, MAX_SUCCESS_CHANCE } from '../src/hackloop/breach.js';
import { createPlayerStats } from '../src/hackloop/playerStats.js';
import { getTier } from '../src/hackloop/tiers.js';

test('breach resolve como uma Promise com success/timeTakenMs (interface estavel pra troca futura por UI)', async () => {
  const stats = createPlayerStats(1);
  const result = breach({ id: 't1', tier: 'comum' }, stats, { rng: () => 0.01 });
  assert.ok(result instanceof Promise);

  const resolved = await result;
  assert.equal(typeof resolved.success, 'boolean');
  assert.equal(typeof resolved.timeTakenMs, 'number');
});

test('rng baixo (< chance) da sucesso, rng alto (>= chance) da falha', async () => {
  const stats = createPlayerStats(5);
  const tier = getTier('incomum');
  const chance = breachSuccessChance(stats, tier);

  const successResult = await breach({ id: 't1', tier: 'incomum' }, stats, { rng: () => 0 });
  assert.equal(successResult.success, true);
  assert.equal(successResult.chance, chance);

  const failureResult = await breach({ id: 't1', tier: 'incomum' }, stats, { rng: () => 0.999999 });
  assert.equal(failureResult.success, false);
});

test('breachSpeed maior aumenta a chance de sucesso contra o mesmo tier', () => {
  const tier = getTier('raro');
  const weak = createPlayerStats(1);
  const strong = createPlayerStats(20);

  const weakChance = breachSuccessChance(weak, tier);
  const strongChance = breachSuccessChance(strong, tier);

  assert.ok(strongChance > weakChance);
  assert.ok(weakChance >= MIN_SUCCESS_CHANCE && weakChance <= MAX_SUCCESS_CHANCE);
  assert.ok(strongChance >= MIN_SUCCESS_CHANCE && strongChance <= MAX_SUCCESS_CHANCE);
});

test('tier mais dificil reduz a chance de sucesso pro mesmo jogador', () => {
  const stats = createPlayerStats(5);
  const easyChance = breachSuccessChance(stats, getTier('comum'));
  const hardChance = breachSuccessChance(stats, getTier('lendario'));
  assert.ok(hardChance < easyChance);
});

test('resolveTimeMs pode ser injetado (util pra testar exfiltrate isoladamente)', async () => {
  const stats = createPlayerStats(1);
  const result = await breach({ id: 't1', tier: 'comum' }, stats, { rng: () => 0, resolveTimeMs: 4242 });
  assert.equal(result.timeTakenMs, 4242);
});

test('sem resolveTimeMs, o tempo simulado e sempre um numero >= 0 e determinado pelo rng', async () => {
  const stats = createPlayerStats(1);
  const a = await breach({ id: 't1', tier: 'comum' }, stats, { rng: () => 0.3 });
  const b = await breach({ id: 't1', tier: 'comum' }, stats, { rng: () => 0.3 });
  assert.equal(a.timeTakenMs, b.timeTakenMs, 'mesmo rng determinístico -> mesmo tempo simulado');
  assert.ok(a.timeTakenMs >= 0);
});
