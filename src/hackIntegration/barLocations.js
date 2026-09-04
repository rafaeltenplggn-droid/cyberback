// O bar (nullpoint_interior, dentro do nullpoint_bar): tem um balcao que
// vende drinks. Reaproveita isAdjacentToBuilding de hackableBuildings.js -
// mesma logica de "esta do lado", nao reimplementada aqui. O nullpoint_bar
// em si continua hackavel exatamente como ja era, sem nenhuma mudanca.
import { isAdjacentToBuilding } from './hackableBuildings.js';

export const BAR_MAP_ID = 'nullpoint_interior';

// Casa com o prop real de maps/nullpoint_interior.json (mesma origem/footprint).
export const BAR_COUNTER_LOCATION = { originX: 3, originY: 3, footprintW: 1, footprintH: 1 };

/** Retorna 'counter' se o personagem estiver parado do lado do balcao dentro do bar, senao null. */
export function nearbyBarInteractable(mapManager) {
  if (mapManager.currentMap?.id !== BAR_MAP_ID) return null;
  const { playerCol, playerRow } = mapManager;
  if (isAdjacentToBuilding(playerCol, playerRow, BAR_COUNTER_LOCATION)) return 'counter';
  return null;
}
