// Estagio 1 do loop de hack: so consulta, nao gasta nenhum recurso do
// jogador e nao compromete nada.
import { getTier } from './tiers.js';

/**
 * Estimativa de loot e dificuldade de um target antes de qualquer
 * compromisso de recurso.
 */
export function recon(target) {
  const tier = getTier(target.tier);
  return {
    targetId: target.id,
    tier: target.tier,
    difficulty: tier.difficulty,
    estimatedLoot: { min: tier.lootMin, max: tier.lootMax },
    maxWindowMs: tier.maxWindowMs,
  };
}
