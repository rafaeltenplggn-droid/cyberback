// Quanto de energia uma tentativa de hack custa, por tier do target.
// Progressao/economia da integracao, nao stage do hack-loop: nao mexe em
// src/hackloop/.
export const ENERGY_COST_PER_TIER = {
  comum: 15,
  incomum: 20,
  raro: 30,
  epico: 45,
  lendario: 65,
};

export function energyCostForTier(tier) {
  const cost = ENERGY_COST_PER_TIER[tier];
  if (cost === undefined) {
    throw new Error(`Tier invalido: ${tier}`);
  }
  return cost;
}
