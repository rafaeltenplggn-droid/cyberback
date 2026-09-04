// Estagio 3 do loop de hack: compara o tempo gasto contra a janela maxima
// do tier. Se exceder, reduz o loot proporcionalmente e aumenta o trace do
// jogador. Se nao exceder, o loot sai integral.
import { getTier } from './tiers.js';

export const TIME_OVERRUN_TRACE_PENALTY_PER_DIFFICULTY = 4;

function rollLoot(tier, rng) {
  return Math.round(tier.lootMin + (tier.lootMax - tier.lootMin) * rng());
}

/**
 * @param {{id:string, tier:string}} target
 * @param {number} timeTakenMs tempo gasto durante o breach bem sucedido
 * @param {{ rng?: () => number, traceMeter?: import('./trace.js').TraceMeter }} [options]
 */
export function exfiltrate(target, timeTakenMs, { rng = Math.random, traceMeter } = {}) {
  const tier = getTier(target.tier);
  const rawAmount = rollLoot(tier, rng);
  const overTime = timeTakenMs > tier.maxWindowMs;

  let amount = rawAmount;
  let traceIncrease = 0;

  if (overTime) {
    const overshootRatio = tier.maxWindowMs / timeTakenMs; // sempre < 1 aqui
    amount = Math.max(0, Math.round(rawAmount * overshootRatio));
    traceIncrease = TIME_OVERRUN_TRACE_PENALTY_PER_DIFFICULTY * tier.difficulty;
    if (traceMeter) {
      traceMeter.increase(traceIncrease);
    }
  }

  return {
    loot: { tier: target.tier, amount },
    rawAmount,
    overTime,
    traceIncrease,
    timeTakenMs,
    maxWindowMs: tier.maxWindowMs,
  };
}
