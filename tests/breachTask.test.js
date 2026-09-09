import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  breachTaskParamsForTier,
  layoutBreachTaskZone,
  resolveBreachTaskAttempt,
  BREACH_TASK_STAT,
} from '../src/hackIntegration/breachTask.js';

test('breachTaskParamsForTier retorna os parametros do tier, ou o de comum como fallback', () => {
  assert.equal(breachTaskParamsForTier('raro').zoneWidth, 0.15);
  assert.deepEqual(breachTaskParamsForTier('tier_desconhecido'), breachTaskParamsForTier('comum'));
});

test('layoutBreachTaskZone sorteia uma zona dentro de 0..1, do tamanho do tier', () => {
  const { zoneStart, zoneEnd } = layoutBreachTaskZone('epico', () => 0.5);
  assert.ok(zoneStart >= 0 && zoneEnd <= 1);
  assert.ok(Math.abs(zoneEnd - zoneStart - breachTaskParamsForTier('epico').zoneWidth) < 1e-9);
});

test('resolveBreachTaskAttempt fora da zona retorna null (ERROU, sem bonus)', () => {
  assert.equal(resolveBreachTaskAttempt(0.1, 0.4, 0.6, 'comum'), null);
  assert.equal(resolveBreachTaskAttempt(0.9, 0.4, 0.6, 'comum'), null);
});

test('resolveBreachTaskAttempt no centro da zona da o bonus cheio do tier (PERFEITO)', () => {
  const attempt = resolveBreachTaskAttempt(0.5, 0.4, 0.6, 'raro');
  assert.ok(attempt);
  assert.equal(attempt.stat, BREACH_TASK_STAT);
  assert.equal(attempt.amount, breachTaskParamsForTier('raro').bonus);
  assert.equal(attempt.perfect, true);
});

test('resolveBreachTaskAttempt perto da borda da so 60% do bonus (BOM)', () => {
  const attempt = resolveBreachTaskAttempt(0.41, 0.4, 0.6, 'raro');
  assert.ok(attempt);
  assert.equal(attempt.perfect, false);
  assert.equal(attempt.amount, Math.round(breachTaskParamsForTier('raro').bonus * 0.6));
});
