// A BLACKNET (ghost_row_interior, dentro do ghost_row_market): mercado
// negro onde a informacao minerada/hackeada e vendida por BYTE. Ainda em
// blockout (sem props visuais), so um ponto logico de interacao - mesma
// logica de adjacencia de sempre (isAdjacentToBuilding).
import { isAdjacentToBuilding } from './hackableBuildings.js';

export const BLACKNET_MAP_ID = 'ghost_row_interior';

export const BLACKNET_SELL_LOCATION = { originX: 5, originY: 5, footprintW: 1, footprintH: 1 };

/** Retorna 'sell' ou null, dependendo de onde o personagem esta parado dentro da BLACKNET. */
export function nearbyBlacknetInteractable(mapManager) {
  if (mapManager.currentMap?.id !== BLACKNET_MAP_ID) return null;
  const { playerCol, playerRow } = mapManager;
  if (isAdjacentToBuilding(playerCol, playerRow, BLACKNET_SELL_LOCATION)) return 'sell';
  return null;
}
