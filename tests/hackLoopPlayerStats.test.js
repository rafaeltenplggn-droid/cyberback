import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayerStats,
  addXp,
  xpRequiredForLevel,
  STAT_INCREMENT_PER_LEVEL,
  BASE_STATS,
  STAT_NAMES,
} from '../src/hackloop/playerStats.js';

test('createPlayerStats no nivel 1 usa os stats base, xp zerado', () => {
  const stats = createPlayerStats();
  assert.equal(stats.level, 1);
  assert.equal(stats.xp, 0);
  for (const stat of STAT_NAMES) {
    assert.equal(stats[stat], BASE_STATS[stat]);
  }
});

test('cada nivel acima do 1 aplica o incremento fixo em todos os stats', () => {
  const stats = createPlayerStats(3);
  for (const stat of STAT_NAMES) {
    assert.equal(stats[stat], BASE_STATS[stat] + 2 * STAT_INCREMENT_PER_LEVEL);
  }
});

test('xpRequiredForLevel cresce a cada nivel', () => {
  const l1 = xpRequiredForLevel(1);
  const l2 = xpRequiredForLevel(2);
  const l3 = xpRequiredForLevel(3);
  assert.ok(l2 > l1);
  assert.ok(l3 > l2);
});

test('addXp nao muta o objeto de stats recebido', () => {
  const stats = createPlayerStats(1);
  const frozenXp = stats.xp;
  addXp(stats, 10);
  assert.equal(stats.xp, frozenXp);
});

test('addXp abaixo do necessario so acumula xp, sem subir de nivel', () => {
  const stats = createPlayerStats(1);
  const needed = xpRequiredForLevel(1);
  const next = addXp(stats, needed - 1);
  assert.equal(next.level, 1);
  assert.equal(next.xp, needed - 1);
});

test('addXp o suficiente sobe exatamente um nivel e aplica o incremento nos stats', () => {
  const stats = createPlayerStats(1);
  const needed = xpRequiredForLevel(1);
  const next = addXp(stats, needed);

  assert.equal(next.level, 2);
  assert.equal(next.xp, 0);
  for (const stat of STAT_NAMES) {
    assert.equal(next[stat], stats[stat] + STAT_INCREMENT_PER_LEVEL);
  }
});

test('addXp com xp suficiente pra varios levels sobe todos de uma vez', () => {
  const stats = createPlayerStats(1);
  const totalForThreeLevels = xpRequiredForLevel(1) + xpRequiredForLevel(2) + xpRequiredForLevel(3) + 5;
  const next = addXp(stats, totalForThreeLevels);

  assert.equal(next.level, 4);
  assert.equal(next.xp, 5);
  for (const stat of STAT_NAMES) {
    assert.equal(next[stat], stats[stat] + 3 * STAT_INCREMENT_PER_LEVEL);
  }
});

test('addXp rejeita xp negativo', () => {
  const stats = createPlayerStats(1);
  assert.throws(() => addXp(stats, -1));
});
