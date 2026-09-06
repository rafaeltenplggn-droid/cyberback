import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiredLevelForTier, REQUIRED_LEVEL_PER_TIER } from '../src/hackIntegration/hackLevelGate.js';

test('requiredLevelForTier mapeia cada tier conhecido pro nivel minimo certo', () => {
  assert.equal(requiredLevelForTier('comum'), REQUIRED_LEVEL_PER_TIER.comum);
  assert.equal(requiredLevelForTier('incomum'), REQUIRED_LEVEL_PER_TIER.incomum);
  assert.equal(requiredLevelForTier('raro'), REQUIRED_LEVEL_PER_TIER.raro);
});

test('tiers vao ficando mais exigentes em ordem', () => {
  assert.ok(REQUIRED_LEVEL_PER_TIER.comum < REQUIRED_LEVEL_PER_TIER.incomum);
  assert.ok(REQUIRED_LEVEL_PER_TIER.incomum < REQUIRED_LEVEL_PER_TIER.raro);
});

test('tier desconhecido cai no nivel 1 (nao trava por seguranca)', () => {
  assert.equal(requiredLevelForTier('nao_existe'), 1);
});
