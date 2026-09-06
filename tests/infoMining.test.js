import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mineInformation, INFO_MINING_SUCCESS_CHANCE, INFO_MINING_REASON } from '../src/hackIntegration/infoMining.js';
import { InformationLedger } from '../src/hackIntegration/informationLedger.js';

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
