// Quanto de energia uma tentativa de hack custa, por tier do target.
// Progressao/economia da integracao, nao stage do hack-loop: nao mexe em
// src/hackloop/.
// Fica sempre um pouco mais caro que minerar no PC (25% da energia
// maxima, ver INFO_MINING_ENERGY_COST_RATIO em infoMining.js) - os
// predios de verdade sao mais dificeis de acessar, entao custam mais e
// rendem informacao mais rara (ver infoRarityForTier em
// informationLedger.js). Reduzido de um primeiro rascunho (60/75/90) que
// ficou pesado demais somado a chance de sucesso ja ser baixa nos tiers
// mais dificeis (quanto menor a chance, menor o custo precisa ser pra nao
// punir demais uma tentativa que so falha).
export const ENERGY_COST_PER_TIER = {
  comum: 30,
  incomum: 40,
  raro: 50,
  epico: 60,
  lendario: 70,
};

export function energyCostForTier(tier) {
  const cost = ENERGY_COST_PER_TIER[tier];
  if (cost === undefined) {
    throw new Error(`Tier invalido: ${tier}`);
  }
  return cost;
}
