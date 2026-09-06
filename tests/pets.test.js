import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PetCollection, PETS, PET_COST_BYTE, PET_PURCHASE_REASON } from '../src/hackIntegration/pets.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';

function fundedLedger(amount = PET_COST_BYTE * 2) {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount });
  return ledger;
}

test('list() comeca com os gatos disponiveis e nao possuido', () => {
  const pets = new PetCollection();
  const list = pets.list();
  assert.equal(list.length, PETS.length);
  assert.ok(list.some((p) => p.id === 'gato_laranja'));
  assert.ok(list.every((p) => p.owned === false));
});

test('buy() compra o pet e cobra o custo do ledger', () => {
  const pets = new PetCollection();
  const ledger = fundedLedger();

  const result = pets.buy('gato_laranja', { ledger });

  assert.equal(result.success, true);
  assert.equal(pets.isOwned('gato_laranja'), true);
  assert.equal(ledger.balance, PET_COST_BYTE * 2 - PET_COST_BYTE);
  assert.equal(pets.list().find((p) => p.id === 'gato_laranja').owned, true);
});

test('buy() e recusado sem BYTE suficiente, sem cobrar nada', () => {
  const pets = new PetCollection();
  const ledger = fundedLedger(PET_COST_BYTE - 1);

  const result = pets.buy('gato_laranja', { ledger });

  assert.equal(result.success, false);
  assert.equal(result.reason, PET_PURCHASE_REASON.NOT_ENOUGH_BYTE);
  assert.equal(ledger.balance, PET_COST_BYTE - 1);
});

test('buy() e recusado pra um pet ja possuido, sem cobrar de novo', () => {
  const pets = new PetCollection();
  const ledger = fundedLedger();
  pets.buy('gato_laranja', { ledger });

  const second = pets.buy('gato_laranja', { ledger });

  assert.equal(second.success, false);
  assert.equal(second.reason, PET_PURCHASE_REASON.ALREADY_OWNED);
  assert.equal(ledger.balance, PET_COST_BYTE, 'so cobrou uma vez');
});

test('os dois gatos podem ser comprados de forma independente', () => {
  const pets = new PetCollection();
  const ledger = fundedLedger(PET_COST_BYTE * 2);

  const laranja = pets.buy('gato_laranja', { ledger });
  const cinza = pets.buy('gato_cinza', { ledger });

  assert.equal(laranja.success, true);
  assert.equal(cinza.success, true);
  assert.equal(pets.isOwned('gato_laranja'), true);
  assert.equal(pets.isOwned('gato_cinza'), true);
  assert.equal(ledger.balance, 0);
});

test('buy() e recusado pra um id invalido', () => {
  const pets = new PetCollection();
  const ledger = fundedLedger();
  const result = pets.buy('cachorro', { ledger });
  assert.equal(result.success, false);
  assert.equal(result.reason, PET_PURCHASE_REASON.INVALID);
});
