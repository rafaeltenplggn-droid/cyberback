import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recon } from '../src/hackloop/recon.js';
import { TIERS } from '../src/hackloop/tiers.js';

test('recon nao recebe playerStats e nao gasta nada, so consulta o tier do target', () => {
  const target = { id: 't1', tier: 'raro' };
  const result = recon(target);

  assert.equal(result.targetId, 't1');
  assert.equal(result.tier, 'raro');
  assert.equal(result.difficulty, TIERS.raro.difficulty);
  assert.deepEqual(result.estimatedLoot, { min: TIERS.raro.lootMin, max: TIERS.raro.lootMax });
  assert.equal(result.maxWindowMs, TIERS.raro.maxWindowMs);
});

test('recon rejeita tier desconhecido', () => {
  assert.throws(() => recon({ id: 't1', tier: 'inexistente' }));
});

test('tiers mais dificeis tem estimativa de loot maior e janela de tempo menor', () => {
  const order = ['comum', 'incomum', 'raro', 'epico', 'lendario'];
  let previous = null;
  for (const tierName of order) {
    const result = recon({ id: 'x', tier: tierName });
    if (previous) {
      assert.ok(result.estimatedLoot.max > previous.estimatedLoot.max, `${tierName} deveria valer mais que o tier anterior`);
      assert.ok(result.maxWindowMs < previous.maxWindowMs, `${tierName} deveria ter janela menor que o tier anterior`);
    }
    previous = result;
  }
});
