// Comprar um energetico no balcao do bar: recarrega a energia na hora,
// cobrando BYTE. Antes o drink dava um buff temporario de breachSpeed;
// agora e a fonte "premium" de energia (junto com dormir de graca, ver
// sleepAction.js) - o PC de casa nao vende mais energia (virou minerar
// informacao, ver infoMining.js).
export const DRINK_COST_BYTE = 30;

export const DRINK_SHOP_REASON = {
  ENERGY_FULL: 'energia_cheia',
  NOT_ENOUGH_BYTE: 'byte_insuficiente',
};

/**
 * Compra um energetico: recarrega a energia ate o maximo, cobrando
 * DRINK_COST_BYTE. Nao faz nada (e nao cobra nada) se a energia ja
 * estiver cheia ou se o saldo de BYTE for insuficiente.
 */
export function buyDrink({ energyMeter, ledger }) {
  if (energyMeter.value >= energyMeter.max) {
    return { success: false, reason: DRINK_SHOP_REASON.ENERGY_FULL, byteSpent: 0 };
  }
  if (ledger.balance < DRINK_COST_BYTE) {
    return { success: false, reason: DRINK_SHOP_REASON.NOT_ENOUGH_BYTE, byteSpent: 0 };
  }

  ledger.record({ type: 'spend', amount: DRINK_COST_BYTE, meta: { source: 'shop', item: 'energetico' } });
  const missing = energyMeter.max - energyMeter.value;
  energyMeter.refill(missing);

  return { success: true, reason: null, byteSpent: DRINK_COST_BYTE, energyValue: energyMeter.value };
}
