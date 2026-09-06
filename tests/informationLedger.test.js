import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InformationLedger, INFO_SELL_PRICE_BYTE, infoRarityForTier } from '../src/hackIntegration/informationLedger.js';

test('comeca vazio, total 0, todas as raridades zeradas', () => {
  const ledger = new InformationLedger();
  assert.equal(ledger.total, 0);
  assert.deepEqual(ledger.counts, { comum: 0, rara: 0, epica: 0 });
});

test('add() soma na raridade certa, sem mexer nas outras', () => {
  const ledger = new InformationLedger();
  ledger.add('comum');
  ledger.add('comum');
  ledger.add('rara', 3);

  assert.deepEqual(ledger.counts, { comum: 2, rara: 3, epica: 0 });
  assert.equal(ledger.total, 5);
});

test('add() com raridade invalida lanca erro', () => {
  const ledger = new InformationLedger();
  assert.throws(() => ledger.add('lendaria'));
});

test('sellAll() vende tudo, calcula o BYTE certo por raridade, e zera o estoque', () => {
  const ledger = new InformationLedger();
  ledger.add('comum', 2);
  ledger.add('epica', 1);

  const result = ledger.sellAll();

  const expectedByte = 2 * INFO_SELL_PRICE_BYTE.comum + 1 * INFO_SELL_PRICE_BYTE.epica;
  assert.equal(result.byteEarned, expectedByte);
  assert.deepEqual(result.sold, { comum: 2, epica: 1 });
  assert.equal(ledger.total, 0, 'estoque zerado depois da venda');
});

test('sellAll() com estoque vazio rende 0 BYTE e nao quebra', () => {
  const ledger = new InformationLedger();
  const result = ledger.sellAll();
  assert.equal(result.byteEarned, 0);
  assert.deepEqual(result.sold, {});
});

test('counts() nunca expoe o objeto interno pra mutacao', () => {
  const ledger = new InformationLedger();
  const counts = ledger.counts;
  counts.comum = 999;
  assert.equal(ledger.counts.comum, 0, 'mutar a copia nao afeta o estoque real');
});

test('infoRarityForTier mapeia comum/incomum/raro pra comum/rara/epica, e cai em epica pra tiers desconhecidos', () => {
  assert.equal(infoRarityForTier('comum'), 'comum');
  assert.equal(infoRarityForTier('incomum'), 'rara');
  assert.equal(infoRarityForTier('raro'), 'epica');
  assert.equal(infoRarityForTier('lendario'), 'epica');
});
