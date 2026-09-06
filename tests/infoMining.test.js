import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mineInformation,
  INFO_MINING_SUCCESS_CHANCE,
  INFO_MINING_REASON,
  INFO_MINING_ENERGY_COST_RATIO,
} from '../src/hackIntegration/infoMining.js';
import { InformationLedger } from '../src/hackIntegration/informationLedger.js';
import { EnergyMeter } from '../src/hackloop/energy.js';

test('sucesso (rng abaixo da chance) rende 1 informacao comum e credita no ledger', () => {
  const informationLedger = new InformationLedger();
  const result = mineInformation({ informationLedger, rng: () => 0 });

  assert.equal(result.success, true);
  assert.equal(result.rarity, 'comum');
  assert.equal(informationLedger.counts.comum, 1);
});

test('falha (rng acima da chance) nao credita nada', () => {
  const informationLedger = new InformationLedger();
  const result = mineInformation({ informationLedger, rng: () => 0.999999 });

  assert.equal(result.success, false);
  assert.equal(result.reason, INFO_MINING_REASON.FAILED);
  assert.equal(result.rarity, null);
  assert.equal(informationLedger.total, 0);
});

test('rng exatamente na borda da chance de sucesso conta como falha (chance e exclusiva)', () => {
  const informationLedger = new InformationLedger();
  const result = mineInformation({ informationLedger, rng: () => INFO_MINING_SUCCESS_CHANCE });
  assert.equal(result.success, false);
});

test('com energyMeter, gasta metade da energia maxima mesmo quando da sucesso', () => {
  const informationLedger = new InformationLedger();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const result = mineInformation({ informationLedger, energyMeter, rng: () => 0 });

  assert.equal(result.success, true);
  assert.equal(result.energySpent, energyMeter.max * INFO_MINING_ENERGY_COST_RATIO);
  assert.equal(energyMeter.value, energyMeter.max * (1 - INFO_MINING_ENERGY_COST_RATIO));
});

test('com energyMeter, gasta a energia mesmo quando falha (a tentativa aconteceu)', () => {
  const informationLedger = new InformationLedger();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const result = mineInformation({ informationLedger, energyMeter, rng: () => 0.999999 });

  assert.equal(result.success, false);
  assert.equal(result.reason, INFO_MINING_REASON.FAILED);
  assert.equal(result.energySpent, energyMeter.max * INFO_MINING_ENERGY_COST_RATIO);
  assert.equal(energyMeter.value, energyMeter.max * (1 - INFO_MINING_ENERGY_COST_RATIO));
});

test('sem energia suficiente, nem tenta minerar: nao gasta energia nem rola a chance', () => {
  const informationLedger = new InformationLedger();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(energyMeter.max - 10); // so 10, menos da metade

  const result = mineInformation({ informationLedger, energyMeter, rng: () => 0 });

  assert.equal(result.success, false);
  assert.equal(result.reason, INFO_MINING_REASON.NO_ENERGY);
  assert.equal(result.energySpent, 0);
  assert.equal(energyMeter.value, 10, 'nada foi descontado sem energia suficiente');
  assert.equal(informationLedger.total, 0);
});
