// Comprar um drink no balcao do bar: ativa o DrinkBuffTracker, cobrando
// BYTE. So essa opcao por enquanto, mesmo espirito minimo do Mercado Negro.
export const DRINK_COST_BYTE = 15;

export const DRINK_SHOP_REASON = {
  BUFF_ACTIVE: 'buff_ativo',
  NOT_ENOUGH_BYTE: 'byte_insuficiente',
};

/**
 * Compra um drink: ativa o buff se nao houver um ja ativo e o saldo de
 * BYTE for suficiente. Nao cobra nada numa recusa.
 */
export function buyDrink({ buffTracker, ledger }) {
  if (buffTracker.isActive()) {
    return { success: false, reason: DRINK_SHOP_REASON.BUFF_ACTIVE, byteSpent: 0 };
  }
  if (ledger.balance < DRINK_COST_BYTE) {
    return { success: false, reason: DRINK_SHOP_REASON.NOT_ENOUGH_BYTE, byteSpent: 0 };
  }

  ledger.record({ type: 'spend', amount: DRINK_COST_BYTE, meta: { source: 'shop', item: 'drink' } });
  buffTracker.activate();

  return { success: true, reason: null, byteSpent: DRINK_COST_BYTE };
}
