// Cardapio de drinks com buff do bar: diferente do energetico simples (ver
// drinkShop.js, que so recarrega energia) - esses NAO recuperam energia
// nenhuma, so dao um bonus temporario num stat, e custam menos. So um
// buff ativo por vez; pedir outro substitui o anterior (sem acumular).
export const DRINK_BUFF_DURATION_MS = 60000;
export const DRINK_BUFF_AMOUNT = 5;

export const DRINKS = [
  { id: 'synth_ale', name: 'Synth Ale', costByte: 15, stat: 'breachSpeed', label: 'Breach Speed' },
  { id: 'neon_lager', name: 'Neon Lager', costByte: 15, stat: 'stealth', label: 'Stealth' },
  { id: 'kaze_whiskey', name: 'Kaze Whiskey', costByte: 20, stat: 'lootYield', label: 'Loot Yield' },
  { id: 'byte_sour', name: 'Byte Sour', costByte: 20, stat: 'traceResistance', label: 'Trace Resistance' },
];

export const DRINK_MENU_REASON = {
  NOT_ENOUGH_BYTE: 'byte_insuficiente',
  INVALID: 'drink_invalido',
};

export class DrinkBuffTracker {
  constructor({ now = () => Date.now() } = {}) {
    this._now = now;
    this._active = null; // { drinkId, stat, amount, expiresAt }
  }

  /** Buff ativo agora (ou null se nenhum foi pedido, ou se ja expirou). */
  get active() {
    if (this._active && this._now() >= this._active.expiresAt) {
      this._active = null;
    }
    return this._active;
  }

  /** Pede um drink do cardapio: cobra na hora, substitui qualquer buff anterior. Nao mexe em energia. */
  order(drinkId, { ledger }) {
    const drink = DRINKS.find((d) => d.id === drinkId);
    if (!drink) {
      return { success: false, reason: DRINK_MENU_REASON.INVALID };
    }
    if (!ledger || ledger.balance < drink.costByte) {
      return { success: false, reason: DRINK_MENU_REASON.NOT_ENOUGH_BYTE };
    }

    ledger.record({ type: 'spend', amount: drink.costByte, meta: { source: 'drink_menu', drinkId } });
    this._active = {
      drinkId,
      stat: drink.stat,
      amount: DRINK_BUFF_AMOUNT,
      expiresAt: this._now() + DRINK_BUFF_DURATION_MS,
    };
    return { success: true, reason: null, drink, expiresAt: this._active.expiresAt };
  }

  /** playerStats com o buff ativo somado (se houver) - usar isso em qualquer calculo de hack, nunca playerStats puro. */
  applyTo(playerStats) {
    const buff = this.active;
    if (!buff) return playerStats;
    return { ...playerStats, [buff.stat]: playerStats[buff.stat] + buff.amount };
  }
}
