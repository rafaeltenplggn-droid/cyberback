import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyDrink, DRINK_COST_BYTE, DRINK_SHOP_REASON } from '../src/hackIntegration/drinkShop.js';
import { EnergyMeter } from '../src/hackloop/energy.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';

function makeFundedLedger(amount) {
  const ledger = new ByteLedger();
  if (amount > 0) ledger.record({ type: 'gain', amount });
  return ledger;
}

test('compra bem sucedida: cobra o preco certo, enche a energia, grava gasto no ledger', () => {
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(70); // fica com 30/100
  const ledger = makeFundedLedger(100);

  const result = buyDrink({ energyMeter, ledger });

  assert.equal(result.success, true);
  assert.equal(result.byteSpent, DRINK_COST_BYTE);
  assert.equal(energyMeter.value, energyMeter.max);
  assert.equal(result.energyValue, energyMeter.max);
  assert.equal(ledger.balance, 100 - DRINK_COST_BYTE);
  assert.equal(ledger.entries.at(-1).type, 'spend');
});

test('recusa e nao cobra nada se a energia ja estiver cheia', () => {
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const ledger = makeFundedLedger(100);

  const result = buyDrink({ energyMeter, ledger });

  assert.equal(result.success, false);
  assert.equal(result.reason, DRINK_SHOP_REASON.ENERGY_FULL);
  assert.equal(result.byteSpent, 0);
  assert.equal(ledger.balance, 100, 'nada foi cobrado');
});

test('recusa e nao cobra nada (nem gasta energia) se o saldo de BYTE for insuficiente', () => {
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(70); // 30/100
  const ledger = makeFundedLedger(DRINK_COST_BYTE - 1);

  const result = buyDrink({ energyMeter, ledger });

  assert.equal(result.success, false);
  assert.equal(result.reason, DRINK_SHOP_REASON.NOT_ENOUGH_BYTE);
  assert.equal(result.byteSpent, 0);
  assert.equal(energyMeter.value, 30, 'a energia nao mudou numa compra recusada');
  assert.equal(ledger.balance, DRINK_COST_BYTE - 1, 'nada foi cobrado');
});
