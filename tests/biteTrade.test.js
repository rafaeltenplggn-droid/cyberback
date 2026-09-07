import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BiteMarket,
  BITE_TRADE_STAKE_BYTE,
  BITE_TRADE_PAYOUT_BYTE,
  BITE_CANDLE_INTERVAL_MS,
  BITE_HISTORY_LENGTH,
  BITE_START_PRICE,
  BITE_TRADE_REASON,
} from '../src/hackIntegration/biteTrade.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';

function fundedLedger(amount = BITE_TRADE_STAKE_BYTE * 2) {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount });
  return ledger;
}

test('comeca no preco inicial, com um unico ponto no historico', () => {
  const market = new BiteMarket({ rng: () => 0.5 });
  assert.equal(market.price, BITE_START_PRICE);
  assert.deepEqual(market.history, [BITE_START_PRICE]);
});

test('tick() so avanca o preco quando completa um intervalo inteiro, e acumula entre chamadas', () => {
  const market = new BiteMarket({ rng: () => 1 }); // rng=1 -> sempre sobe
  market.tick(BITE_CANDLE_INTERVAL_MS - 1);
  assert.equal(market.history.length, 1, 'ainda nao completou um candle');

  market.tick(1);
  assert.equal(market.history.length, 2, 'completou o candle acumulado');
  assert.ok(market.price > BITE_START_PRICE, 'rng=1 sempre sobe o preco');
});

test('tick() com deltaMs grande gera varios candles de uma vez', () => {
  const market = new BiteMarket({ rng: () => 1 });
  market.tick(BITE_CANDLE_INTERVAL_MS * 3);
  assert.equal(market.history.length, 4); // ponto inicial + 3 candles
});

test('o historico nunca passa de BITE_HISTORY_LENGTH pontos (descarta os mais antigos)', () => {
  const market = new BiteMarket({ rng: () => 0.9 });
  market.tick(BITE_CANDLE_INTERVAL_MS * (BITE_HISTORY_LENGTH + 10));
  assert.equal(market.history.length, BITE_HISTORY_LENGTH);
});

test('trade() acerta a direcao "up": cobra a aposta e paga o premio, saldo liquido positivo', () => {
  const market = new BiteMarket({ rng: () => 1 }); // sempre sobe
  const ledger = fundedLedger();

  const result = market.trade('up', { ledger });

  assert.equal(result.success, true);
  assert.equal(result.correct, true);
  assert.ok(result.priceAfter > result.priceBefore);
  assert.equal(result.byteDelta, BITE_TRADE_PAYOUT_BYTE - BITE_TRADE_STAKE_BYTE);
  assert.equal(ledger.balance, BITE_TRADE_STAKE_BYTE * 2 - BITE_TRADE_STAKE_BYTE + BITE_TRADE_PAYOUT_BYTE);
});

test('trade() erra a direcao: so cobra a aposta, sem pagar nada', () => {
  const market = new BiteMarket({ rng: () => 1 }); // sempre sobe
  const ledger = fundedLedger();

  const result = market.trade('down', { ledger });

  assert.equal(result.success, true);
  assert.equal(result.correct, false);
  assert.equal(result.byteDelta, -BITE_TRADE_STAKE_BYTE);
  assert.equal(ledger.balance, BITE_TRADE_STAKE_BYTE * 2 - BITE_TRADE_STAKE_BYTE);
});

test('trade() e recusado sem BYTE suficiente, sem cobrar nada e sem mexer no preco', () => {
  const market = new BiteMarket({ rng: () => 1 });
  const ledger = fundedLedger(BITE_TRADE_STAKE_BYTE - 1);
  const priceBefore = market.price;

  const result = market.trade('up', { ledger });

  assert.equal(result.success, false);
  assert.equal(result.reason, BITE_TRADE_REASON.NOT_ENOUGH_BYTE);
  assert.equal(ledger.balance, BITE_TRADE_STAKE_BYTE - 1);
  assert.equal(market.price, priceBefore);
});

test('trade() forca um candle na hora, sem esperar o proximo tick automatico', () => {
  const market = new BiteMarket({ rng: () => 1 });
  const ledger = fundedLedger();

  assert.equal(market.history.length, 1);
  market.trade('up', { ledger });
  assert.equal(market.history.length, 2, 'trade() ja gerou o candle, mesmo sem tick()');
});
