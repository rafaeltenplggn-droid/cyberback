import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyDrink, DRINK_COST_BYTE, DRINK_SHOP_REASON } from '../src/hackIntegration/drinkShop.js';
import { DrinkBuffTracker } from '../src/hackIntegration/drinkBuff.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';

function makeFundedLedger(amount) {
  const ledger = new ByteLedger();
  if (amount > 0) ledger.record({ type: 'gain', amount });
  return ledger;
}

test('compra bem sucedida: cobra o preco certo e ativa o buff', () => {
  const buffTracker = new DrinkBuffTracker();
  const ledger = makeFundedLedger(100);

  const result = buyDrink({ buffTracker, ledger });

  assert.equal(result.success, true);
  assert.equal(result.byteSpent, DRINK_COST_BYTE);
  assert.equal(buffTracker.isActive(), true);
  assert.equal(ledger.balance, 100 - DRINK_COST_BYTE);
  assert.equal(ledger.entries.at(-1).type, 'spend');
});

test('recusa e nao cobra nada se ja tiver um buff ativo', () => {
  const buffTracker = new DrinkBuffTracker();
  buffTracker.activate();
  const ledger = makeFundedLedger(100);

  const result = buyDrink({ buffTracker, ledger });

  assert.equal(result.success, false);
  assert.equal(result.reason, DRINK_SHOP_REASON.BUFF_ACTIVE);
  assert.equal(result.byteSpent, 0);
  assert.equal(ledger.balance, 100, 'nada foi cobrado');
});

test('recusa e nao ativa o buff se o saldo de BYTE for insuficiente', () => {
  const buffTracker = new DrinkBuffTracker();
  const ledger = makeFundedLedger(DRINK_COST_BYTE - 1);

  const result = buyDrink({ buffTracker, ledger });

  assert.equal(result.success, false);
  assert.equal(result.reason, DRINK_SHOP_REASON.NOT_ENOUGH_BYTE);
  assert.equal(buffTracker.isActive(), false, 'compra recusada nao ativa o buff');
  assert.equal(ledger.balance, DRINK_COST_BYTE - 1, 'nada foi cobrado');
});
