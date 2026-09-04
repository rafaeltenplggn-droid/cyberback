import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fence, LOOT_YIELD_BASELINE } from '../src/hackloop/fence.js';
import { getTier } from '../src/hackloop/tiers.js';
import { createPlayerStats } from '../src/hackloop/playerStats.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';

test('converte loot em BYTE usando a taxa do tier', () => {
  const stats = createPlayerStats(1); // lootYield na baseline, sem bonus
  assert.equal(stats.lootYield, LOOT_YIELD_BASELINE);

  const loot = { tier: 'raro', amount: 100 };
  const result = fence(loot, stats);

  assert.equal(result.byteAmount, Math.round(100 * getTier('raro').byteRate));
  assert.equal(result.tier, 'raro');
});

test('lootYield acima da baseline aumenta a conversao', () => {
  const baseline = createPlayerStats(1);
  const highYield = { ...baseline, lootYield: baseline.lootYield + 50 };

  const loot = { tier: 'comum', amount: 100 };
  const baseResult = fence(loot, baseline);
  const boostedResult = fence(loot, highYield);

  assert.ok(boostedResult.byteAmount > baseResult.byteAmount);
});

test('lootYield abaixo da baseline nunca reduz a conversao pra menos que a taxa base', () => {
  const stats = createPlayerStats(1);
  const lowYield = { ...stats, lootYield: 0 };
  const loot = { tier: 'comum', amount: 100 };

  const result = fence(loot, lowYield);
  assert.equal(result.byteAmount, Math.round(100 * getTier('comum').byteRate));
});

test('rejeita tier de loot desconhecido', () => {
  const stats = createPlayerStats(1);
  assert.throws(() => fence({ tier: 'inexistente', amount: 10 }, stats));
});

test('com ledger, fence grava o ganho como uma entrada append-only', () => {
  const ledger = new ByteLedger();
  const stats = createPlayerStats(1);
  const loot = { tier: 'incomum', amount: 40 };

  const result = fence(loot, stats, { ledger });

  assert.equal(ledger.entries.length, 1);
  assert.equal(ledger.entries[0].type, 'gain');
  assert.equal(ledger.entries[0].amount, result.byteAmount);
  assert.equal(result.entry, ledger.entries[0]);
});

test('sem ledger, fence ainda retorna o byteAmount normalmente', () => {
  const stats = createPlayerStats(1);
  const result = fence({ tier: 'comum', amount: 10 }, stats);
  assert.equal(result.entry, null);
  assert.ok(result.byteAmount > 0);
});
