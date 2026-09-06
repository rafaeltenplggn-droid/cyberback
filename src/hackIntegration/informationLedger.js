// Informacao: item que o jogador ganha hackeando (predios ou minerando no
// PC de casa), guardado ate ser vendido na BLACKNET por BYTE. Mesmo
// espirito de auditoria do ByteLedger (src/hackloop/byteLedger.js), mas
// aqui guardamos so a contagem por raridade, nao um log de entradas -
// nao ha necessidade de historico, so o estoque atual.
export const INFO_RARITIES = ['comum', 'rara', 'epica'];

// Preco de venda na BLACKNET, por raridade - valor baixo de proposito
// (informacao e um item farmavel, nao deve substituir o hack direto como
// fonte principal de BYTE).
export const INFO_SELL_PRICE_BYTE = {
  comum: 5,
  rara: 25,
  epica: 60,
};

// Tier do predio hackeado -> raridade da informacao obtida. Mapeamento
// simples e deterministico: quanto mais dificil o predio, melhor a
// informacao. Tiers alem de "raro" (epico/lendario, ainda sem predio no
// jogo) caem em 'epica' por seguranca.
const TIER_TO_INFO_RARITY = {
  comum: 'comum',
  incomum: 'rara',
  raro: 'epica',
};

export function infoRarityForTier(tier) {
  return TIER_TO_INFO_RARITY[tier] ?? 'epica';
}

export class InformationLedger {
  constructor() {
    this._counts = Object.fromEntries(INFO_RARITIES.map((r) => [r, 0]));
  }

  /** Adiciona `amount` unidades de informacao da raridade dada (default 1). */
  add(rarity, amount = 1) {
    if (!(rarity in this._counts)) {
      throw new Error(`raridade invalida: ${rarity}`);
    }
    this._counts[rarity] += amount;
  }

  /** Copia do estoque atual, por raridade - nunca exposto pra mutacao direta. */
  get counts() {
    return { ...this._counts };
  }

  get total() {
    return INFO_RARITIES.reduce((sum, r) => sum + this._counts[r], 0);
  }

  /**
   * Vende todo o estoque de uma vez, ao preco de INFO_SELL_PRICE_BYTE por
   * raridade, e zera o estoque. Retorna quanto BYTE isso rendeu e quantas
   * unidades de cada raridade foram vendidas (raridades com 0 unidades nao
   * aparecem em `sold`). Vender com o estoque vazio rende 0 BYTE e nao
   * mexe em nada.
   */
  sellAll() {
    let byteEarned = 0;
    const sold = {};
    for (const rarity of INFO_RARITIES) {
      const count = this._counts[rarity];
      if (count > 0) {
        byteEarned += count * INFO_SELL_PRICE_BYTE[rarity];
        sold[rarity] = count;
        this._counts[rarity] = 0;
      }
    }
    return { byteEarned, sold };
  }
}
