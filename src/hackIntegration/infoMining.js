// Minerar informacao no PC de casa: acao independente do hack-loop de
// predio (sem target, sem trace) - so uma chance fixa de sucesso. Gasta
// energia toda vez que tenta (sucesso ou falha, mesmo espirito do hack de
// predio de verdade em hackSession.js), pra nao virar fonte infinita de
// informacao/BYTE. Sucesso sempre rende 1 unidade de informacao 'comum' (a
// fonte barata/facil; informacao de raridade melhor vem so de hackear os
// predios de verdade, que custam bem mais energia - ver
// ENERGY_COST_PER_TIER em energyCosts.js).
export const INFO_MINING_SUCCESS_CHANCE = 0.6;
export const INFO_MINING_RARITY = 'comum';
export const INFO_MINING_ENERGY_COST_RATIO = 0.25;

export const INFO_MINING_REASON = {
  FAILED: 'minerou_sem_sucesso',
  NO_ENERGY: 'sem_energia',
};

/**
 * @param {{ informationLedger: import('./informationLedger.js').InformationLedger, energyMeter?: import('../hackloop/energy.js').EnergyMeter, rng?: () => number }} options
 */
export function mineInformation({ informationLedger, energyMeter, rng = Math.random }) {
  const energyCost = energyMeter ? Math.round(energyMeter.max * INFO_MINING_ENERGY_COST_RATIO) : 0;
  if (energyMeter && !energyMeter.spend(energyCost)) {
    return { success: false, reason: INFO_MINING_REASON.NO_ENERGY, rarity: null, energySpent: 0 };
  }

  const success = rng() < INFO_MINING_SUCCESS_CHANCE;
  if (!success) {
    return { success: false, reason: INFO_MINING_REASON.FAILED, rarity: null, energySpent: energyCost };
  }
  informationLedger.add(INFO_MINING_RARITY);
  return { success: true, reason: null, rarity: INFO_MINING_RARITY, energySpent: energyCost };
}
