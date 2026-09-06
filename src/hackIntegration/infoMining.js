// Minerar informacao no PC de casa: acao independente do hack-loop de
// predio (sem target, sem energia, sem trace) - so uma chance fixa de
// sucesso. Sucesso sempre rende 1 unidade de informacao 'comum' (a fonte
// barata/facil; informacao de raridade melhor vem so de hackear os
// predios de verdade, ver informationLedger.js).
export const INFO_MINING_SUCCESS_CHANCE = 0.6;
export const INFO_MINING_RARITY = 'comum';

export const INFO_MINING_REASON = {
  FAILED: 'minerou_sem_sucesso',
};

/**
 * @param {{ informationLedger: import('./informationLedger.js').InformationLedger, rng?: () => number }} options
 */
export function mineInformation({ informationLedger, rng = Math.random }) {
  const success = rng() < INFO_MINING_SUCCESS_CHANCE;
  if (!success) {
    return { success: false, reason: INFO_MINING_REASON.FAILED, rarity: null };
  }
  informationLedger.add(INFO_MINING_RARITY);
  return { success: true, reason: null, rarity: INFO_MINING_RARITY };
}
