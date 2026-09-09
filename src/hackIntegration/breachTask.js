// Task de sincronizacao ("Breach Sync"): minijogo estilo Among Us disparado
// toda vez que o jogador hackeia (fisico ou remoto) - acertar da um bonus
// temporario de stat SO nesse hack (mesmo mecanismo statBuff dos drinks, ver
// drinkMenu.js), errar ou nao tentar nao penaliza nada, o hack roda normal
// com a chance de sempre. Puro/testavel, sem nenhum DOM aqui - a UI (marker
// animado, tecla de espaco) fica em main.js/index.html.
export const BREACH_TASK_STAT = 'breachSpeed';

export const BREACH_TASK_TIER_PARAMS = {
  comum: { zoneWidth: 0.30, speed: 0.55, bonus: 8 },
  incomum: { zoneWidth: 0.22, speed: 0.75, bonus: 10 },
  raro: { zoneWidth: 0.15, speed: 1.0, bonus: 13 },
  epico: { zoneWidth: 0.10, speed: 1.3, bonus: 16 },
  lendario: { zoneWidth: 0.08, speed: 1.5, bonus: 18 },
};

export function breachTaskParamsForTier(tier) {
  return BREACH_TASK_TIER_PARAMS[tier] ?? BREACH_TASK_TIER_PARAMS.comum;
}

/** Sorteia onde a zona-alvo comeca/termina (0..1) - zoneWidth vem do tier. */
export function layoutBreachTaskZone(tier, rng = Math.random) {
  const { zoneWidth } = breachTaskParamsForTier(tier);
  const zoneStart = rng() * (1 - zoneWidth);
  return { zoneStart, zoneEnd: zoneStart + zoneWidth };
}

/**
 * Resolve uma tentativa: pos e a posicao do marker (0..1) no momento do
 * aperto. Fora da zona -> null (sem bonus, ERROU). Dentro -> um objeto
 * pronto pro statBuff do hackSession ({stat, amount}), com bonus cheio perto
 * do centro da zona (PERFEITO) ou 60% dele mais na borda (BOM).
 */
export function resolveBreachTaskAttempt(pos, zoneStart, zoneEnd, tier) {
  if (pos < zoneStart || pos > zoneEnd) return null;
  const params = breachTaskParamsForTier(tier);
  const zoneMid = (zoneStart + zoneEnd) / 2;
  const zoneHalf = (zoneEnd - zoneStart) / 2 || 0.0001;
  const closeness = 1 - Math.abs(pos - zoneMid) / zoneHalf;
  const perfect = closeness > 0.6;
  const amount = perfect ? params.bonus : Math.round(params.bonus * 0.6);
  return { stat: BREACH_TASK_STAT, amount, closeness, perfect };
}
