// Quanto XP um hack bem sucedido rende, por tier do target. Progressao,
// nao stage do hack-loop: nao mexe em src/hackloop/.
export const XP_REWARD_PER_TIER = {
  comum: 20,
  incomum: 35,
  raro: 60,
  epico: 100,
  lendario: 160,
};

export function xpRewardForTier(tier) {
  const reward = XP_REWARD_PER_TIER[tier];
  if (reward === undefined) {
    throw new Error(`Tier invalido: ${tier}`);
  }
  return reward;
}
