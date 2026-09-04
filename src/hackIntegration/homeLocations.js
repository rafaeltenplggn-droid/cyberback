// O quarto do personagem (player_home.json): tem um PC (entrada pro
// Mercado Negro) e uma cama (dormir pra recuperar energia). Reaproveita
// isAdjacentToBuilding de hackableBuildings.js - mesma logica de "esta do
// lado", nao reimplementada aqui.
import { isAdjacentToBuilding } from './hackableBuildings.js';

export const PLAYER_HOME_MAP_ID = 'player_home';

// Casam com os props reais de maps/player_home.json (mesma origem/footprint).
export const HOME_PC_LOCATION = { originX: 3, originY: 3, footprintW: 1, footprintH: 1 };
export const HOME_BED_LOCATION = { originX: 6, originY: 3, footprintW: 1, footprintH: 1 };

/**
 * Retorna 'pc', 'bed' ou null dependendo de onde o personagem esta parado
 * dentro do player_home. Fora do player_home sempre retorna null.
 */
export function nearbyHomeInteractable(mapManager) {
  if (mapManager.currentMap?.id !== PLAYER_HOME_MAP_ID) return null;
  const { playerCol, playerRow } = mapManager;
  if (isAdjacentToBuilding(playerCol, playerRow, HOME_PC_LOCATION)) return 'pc';
  if (isAdjacentToBuilding(playerCol, playerRow, HOME_BED_LOCATION)) return 'bed';
  return null;
}
