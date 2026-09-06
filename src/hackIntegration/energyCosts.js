// Quanto de energia uma tentativa de hack custa, por tier do target.
// Progressao/economia da integracao, nao stage do hack-loop: nao mexe em
// src/hackloop/.
// Recalibrado pra ficar sempre mais caro que minerar no PC (metade da
// energia maxima, ver INFO_MINING_ENERGY_COST_RATIO em infoMining.js) -
// os predios de verdade sao mais dificeis de acessar, entao custam mais e
// rendem informacao mais rara (ver infoRarityForTier em
// informationLedger.js).
export const ENERGY_COST_PER_TIER = {
  comum: 60,
  incomum: 75,
  raro: 90,
  epico: 100,
  lendario: 100,
};

export function energyCostForTier(tier) {
  const cost = ENERGY_COST_PER_TIER[tier];
  if (cost === undefined) {
    throw new Error(`Tier invalido: ${tier}`);
  }
  return cost;
}
