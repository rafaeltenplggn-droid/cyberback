// Loja minima: por enquanto so vende uma coisa - recarregar a energia na
// hora, pagando BYTE. Usa o ByteLedger e o EnergyMeter que ja existem,
// nao reimplementa nenhum dos dois.
export const ENERGY_REFILL_COST_BYTE = 40;

export const ENERGY_SHOP_REASON = {
  ENERGY_FULL: 'energia_cheia',
  NOT_ENOUGH_BYTE: 'byte_insuficiente',
};

/**
 * Recarrega a energia do jogador ate o maximo, cobrando
 * ENERGY_REFILL_COST_BYTE em BYTE. Nao faz nada (e nao cobra nada) se a
 * energia ja estiver cheia ou se o saldo de BYTE for insuficiente.
 */
export function buyEnergyRefill({ energyMeter, ledger }) {
  if (energyMeter.value >= energyMeter.max) {
    return { success: false, reason: ENERGY_SHOP_REASON.ENERGY_FULL, byteSpent: 0 };
  }
  if (ledger.balance < ENERGY_REFILL_COST_BYTE) {
    return { success: false, reason: ENERGY_SHOP_REASON.NOT_ENOUGH_BYTE, byteSpent: 0 };
  }

  ledger.record({ type: 'spend', amount: ENERGY_REFILL_COST_BYTE, meta: { source: 'shop', item: 'energy_refill' } });
  const missing = energyMeter.max - energyMeter.value;
  energyMeter.refill(missing);

  return { success: true, reason: null, byteSpent: ENERGY_REFILL_COST_BYTE, energyValue: energyMeter.value };
}
