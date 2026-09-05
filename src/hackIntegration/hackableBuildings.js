// Registro dos predios hackaveis de district_07. Cada entrada casa com um
// prop real de maps/district_07.json (mesma origem/footprint) e com um
// target fixo de teste do hack-loop.
//
// Tier de cada um (progressao de dificuldade/recompensa, do mais fraco pro
// mais forte): ghost_row_market (comum) < nullpoint_bar (incomum) <
// gridcorp_tower (raro).
export const HACKABLE_BUILDINGS = [
  {
    id: 'gridcorp_tower',
    mapId: 'district_07',
    building: { originX: 17, originY: 1, footprintW: 4, footprintH: 3 },
    target: { id: 'gridcorp_tower_test', tier: 'raro' },
  },
  {
    id: 'nullpoint_bar',
    mapId: 'district_07',
    building: { originX: 1, originY: 1, footprintW: 4, footprintH: 3 },
    target: { id: 'nullpoint_bar_test', tier: 'incomum' },
  },
  {
    id: 'ghost_row_market',
    mapId: 'district_07',
    building: { originX: 8, originY: 1, footprintW: 4, footprintH: 3 },
    target: { id: 'ghost_row_market_test', tier: 'comum' },
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
