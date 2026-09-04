// Estagio 2 do loop de hack: resolve como uma funcao assincrona com uma
// interface clara de sucesso/falha, pra que uma UI de puzzle visual possa
// substituir a resolucao interna depois sem mudar a assinatura da funcao.
// Por enquanto resolve internamente com uma chance de sucesso calculada a
// partir de playerStats.breachSpeed contra a dificuldade do tier, mais um
// tempo simulado de resolucao.
import { getTier } from './tiers.js';

export const DIFFICULTY_WEIGHT = 8;
export const MIN_SUCCESS_CHANCE = 0.05;
export const MAX_SUCCESS_CHANCE = 0.95;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Chance de sucesso de um breach: breachSpeed do jogador contra a dificuldade do tier. */
export function breachSuccessChance(playerStats, tier) {
  const raw = playerStats.breachSpeed / (playerStats.breachSpeed + tier.difficulty * DIFFICULTY_WEIGHT);
  return clamp(raw, MIN_SUCCESS_CHANCE, MAX_SUCCESS_CHANCE);
}

/** Tempo simulado de resolucao: quanto maior o breachSpeed, mais rapido; tem uma margem de variacao. */
export function simulateResolutionTime(tier, playerStats, rng) {
  const speedFactor = 1 / (1 + playerStats.breachSpeed / 10);
  const base = tier.maxWindowMs * 0.5 * speedFactor;
  const jitter = tier.maxWindowMs * 0.25 * rng();
  return Math.round(base + jitter);
}

/**
 * Resolve um breach. Assincrona de proposito: hoje a resolucao e interna
 * (roll de chance + tempo simulado), mas a assinatura (Promise com
 * success/timeTakenMs) e o contrato que uma UI de puzzle real vai
 * implementar depois, sem quebrar quem chama breach().
 */
export async function breach(target, playerStats, { rng = Math.random, resolveTimeMs } = {}) {
  const tier = getTier(target.tier);
  const chance = breachSuccessChance(playerStats, tier);
  const roll = rng();
  const success = roll < chance;
  const timeTakenMs = resolveTimeMs ?? simulateResolutionTime(tier, playerStats, rng);

  return {
    targetId: target.id,
    tier: target.tier,
    success,
    chance,
    roll,
    timeTakenMs,
  };
}
