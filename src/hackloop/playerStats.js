// Stats do jogador e curva de nivel do loop de hack. Logica pura, sem
// dependencia de mapa, sprite ou render.
export const STAT_NAMES = ['breachSpeed', 'stealth', 'lootYield', 'traceResistance'];

export const BASE_STATS = {
  breachSpeed: 10,
  stealth: 10,
  lootYield: 10,
  traceResistance: 10,
};

export const STAT_INCREMENT_PER_LEVEL = 2;
export const BASE_XP_TO_LEVEL = 100;
export const XP_GROWTH_FACTOR = 1.25;

/** xp necessario pra sair do nivel `level` e ir pro proximo. Cresce por nivel. */
export function xpRequiredForLevel(level) {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error('nivel invalido');
  }
  return Math.round(BASE_XP_TO_LEVEL * XP_GROWTH_FACTOR ** (level - 1));
}

export function createPlayerStats(level = 1) {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error('nivel invalido');
  }
  const bonus = (level - 1) * STAT_INCREMENT_PER_LEVEL;
  const stats = { level, xp: 0 };
  for (const stat of STAT_NAMES) {
    stats[stat] = BASE_STATS[stat] + bonus;
  }
  return stats;
}

/**
 * Aplica ganho de xp e resolve quantos level ups acontecem (pode subir mais
 * de um nivel de uma vez). Cada stat sobe um incremento fixo por nivel.
 * Retorna um novo objeto de stats, nunca muta o `stats` recebido.
 */
export function addXp(stats, amount) {
  if (amount < 0) {
    throw new Error('xp ganho nao pode ser negativo');
  }

  let next = { ...stats, xp: stats.xp + amount };
  while (next.xp >= xpRequiredForLevel(next.level)) {
    next.xp -= xpRequiredForLevel(next.level);
    next = { ...next, level: next.level + 1 };
    for (const stat of STAT_NAMES) {
      next[stat] += STAT_INCREMENT_PER_LEVEL;
    }
  }
  return next;
}
