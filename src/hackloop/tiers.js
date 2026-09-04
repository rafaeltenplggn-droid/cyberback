// Tabela de tiers do loop de hack. Modulo de logica pura: sem dependencia
// de mapa, sprite ou render.
export const TIER_ORDER = ['comum', 'incomum', 'raro', 'epico', 'lendario'];

export const TIERS = {
  comum: { difficulty: 1, lootMin: 10, lootMax: 30, maxWindowMs: 8000, byteRate: 1 },
  incomum: { difficulty: 2, lootMin: 25, lootMax: 60, maxWindowMs: 7000, byteRate: 1.5 },
  raro: { difficulty: 3, lootMin: 50, lootMax: 120, maxWindowMs: 6000, byteRate: 2.25 },
  epico: { difficulty: 4, lootMin: 100, lootMax: 220, maxWindowMs: 5000, byteRate: 3.5 },
  lendario: { difficulty: 5, lootMin: 200, lootMax: 400, maxWindowMs: 4000, byteRate: 5 },
};

export function getTier(tierName) {
  const tier = TIERS[tierName];
  if (!tier) {
    throw new Error(`Tier invalido: ${tierName}`);
  }
  return tier;
}
