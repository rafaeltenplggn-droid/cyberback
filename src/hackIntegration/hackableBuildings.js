// Registro dos predios hackaveis de district_07. Cada entrada casa com um
// prop real de maps/district_07.json (mesma origem/footprint) e com um
// target fixo de teste do hack-loop.
//
// Tier de cada um (progressao de dificuldade/recompensa, do mais fraco pro
// mais forte): gridcorp_tower (comum) < nullpoint_bar (incomum) <
// ghost_row_market/BLACKNET (raro) - a BLACKNET e o mercado negro que
// compra a informacao roubada (ver informationLedger.js), entao e o alvo
// mais protegido/dificil dos tres.
export const HACKABLE_BUILDINGS = [
  {
    id: 'gridcorp_tower',
    mapId: 'district_07',
    building: { originX: 16, originY: 0, footprintW: 8, footprintH: 5 },
    target: { id: 'gridcorp_tower_test', tier: 'comum' },
  },
  {
    id: 'nullpoint_bar',
    mapId: 'district_07',
    building: { originX: 0, originY: 0, footprintW: 8, footprintH: 5 },
    target: { id: 'nullpoint_bar_test', tier: 'incomum' },
  },
  {
    id: 'ghost_row_market',
    mapId: 'district_07',
    building: { originX: 8, originY: 0, footprintW: 8, footprintH: 5 },
    target: { id: 'ghost_row_market_test', tier: 'raro' },
  },
];

/** Celulas ortogonalmente adjacentes ao footprint de um predio (nao inclui diagonais). */
export function isAdjacentToBuilding(col, row, building) {
  const { originX, originY, footprintW, footprintH } = building;
  const inColRange = col >= originX && col < originX + footprintW;
  const inRowRange = row >= originY && row < originY + footprintH;

  const north = inColRange && row === originY - 1;
  const south = inColRange && row === originY + footprintH;
  const west = inRowRange && col === originX - 1;
  const east = inRowRange && col === originX + footprintW;

  return north || south || west || east;
}

/** Devolve o predio hackavel adjacente a (col,row) no mapa `mapId`, ou null se nenhum. */
export function findHackableBuildingAt(mapId, col, row) {
  return HACKABLE_BUILDINGS.find(
    (entry) => entry.mapId === mapId && isAdjacentToBuilding(col, row, entry.building)
  ) ?? null;
}
