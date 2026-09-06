// Nivel minimo do jogador pra poder hackear cada tier de predio (remoto
// pelo PC ou fisico, andando ate la - a trava e a mesma pros dois
// jeitos). Nao mexe na dificuldade/chance do hack em si (isso continua
// so em breachSuccessChance, ver src/hackloop/breach.js) - so limita
// QUANDO cada alvo fica disponivel, pra progressao fazer sentido (nao da
// pra tentar a BLACKNET com nivel 1).
export const REQUIRED_LEVEL_PER_TIER = {
  comum: 1,
  incomum: 3,
  raro: 5,
  epico: 8,
  lendario: 12,
};

export function requiredLevelForTier(tier) {
  return REQUIRED_LEVEL_PER_TIER[tier] ?? 1;
}
