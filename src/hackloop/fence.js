// Estagio 4 do loop de hack: converte o loot (de exfiltrate) em BYTE
// usando a tabela de conversao por tier, modificada pelo stat lootYield do
// jogador. Se um ledger for passado, grava o ganho nele (append-only).
import { getTier } from './tiers.js';

// Cada ponto de lootYield acima da base (10, ver playerStats.js) aumenta a
// conversao em 1%.
export const LOOT_YIELD_BASELINE = 10;
export const LOOT_YIELD_BONUS_PER_POINT = 0.01;

/**
 * @param {{tier:string, amount:number}} loot resultado de exfiltrate().loot
 * @param {{lootYield:number}} playerStats
 * @param {{ ledger?: import('./byteLedger.js').ByteLedger }} [options]
 */
export function fence(loot, playerStats, { ledger } = {}) {
  const tier = getTier(loot.tier);
  const lootYieldMultiplier = 1 + Math.max(0, playerStats.lootYield - LOOT_YIELD_BASELINE) * LOOT_YIELD_BONUS_PER_POINT;
  const byteAmount = Math.round(loot.amount * tier.byteRate * lootYieldMultiplier);

  const entry = ledger
    ? ledger.record({ type: 'gain', amount: byteAmount, meta: { source: 'fence', tier: loot.tier } })
    : null;

  return { byteAmount, tier: loot.tier, entry };
}
