import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ByteLedger } from '../src/hackloop/byteLedger.js';

test('record grava uma entrada e retorna o saldo correto', () => {
  const ledger = new ByteLedger({ now: () => 1000 });
  ledger.record({ type: 'gain', amount: 100 });
  ledger.record({ type: 'spend', amount: 30 });

  assert.equal(ledger.entries.length, 2);
  assert.equal(ledger.balance, 70);
});

test('cada entrada e imutavel (congelada) assim que gravada', () => {
  const ledger = new ByteLedger();
  const entry = ledger.record({ type: 'gain', amount: 50 });
  assert.throws(() => {
    entry.amount = 999;
  });
  assert.equal(entry.amount, 50);
});

test('entries retorna uma copia, mutar o array retornado nao afeta o ledger', () => {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 10 });

  const snapshot = ledger.entries;
  snapshot.push({ type: 'gain', amount: 999 });

  assert.equal(ledger.entries.length, 1);
});

test('e append-only: nao existe metodo pra editar ou remover uma entrada gravada', () => {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 10 });
  assert.equal(typeof ledger.remove, 'undefined');
  assert.equal(typeof ledger.update, 'undefined');
  assert.equal(typeof ledger.clear, 'undefined');
});

test('ids sao sequenciais na ordem de gravacao', () => {
  const ledger = new ByteLedger();
  const first = ledger.record({ type: 'gain', amount: 1 });
  const second = ledger.record({ type: 'gain', amount: 2 });
  const third = ledger.record({ type: 'spend', amount: 1 });

  assert.deepEqual([first.id, second.id, third.id], [1, 2, 3]);
});

test('rejeita type invalido e amount invalido', () => {
  const ledger = new ByteLedger();
  assert.throws(() => ledger.record({ type: 'roubo', amount: 10 }));
  assert.throws(() => ledger.record({ type: 'gain', amount: -5 }));
  assert.throws(() => ledger.record({ type: 'gain', amount: NaN }));
});

test('meta e gravado junto da entrada e tambem fica congelado', () => {
  const ledger = new ByteLedger();
  const entry = ledger.record({ type: 'gain', amount: 10, meta: { source: 'fence', tier: 'raro' } });
  assert.deepEqual(entry.meta, { source: 'fence', tier: 'raro' });
  assert.throws(() => {
    entry.meta.tier = 'lendario';
  });
});
