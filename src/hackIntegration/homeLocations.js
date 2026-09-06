// O quarto do personagem (player_home.json): tem um PC (entrada pro
// Mercado Negro) e uma cama (dormir pra recuperar energia). Reaproveita
// isAdjacentToBuilding de hackableBuildings.js - mesma logica de "esta do
// lado", nao reimplementada aqui.
import { isAdjacentToBuilding } from './hackableBuildings.js';

export const PLAYER_HOME_MAP_ID = 'player_home';

// Coordenadas calibradas visualmente pra baterem com a mesa/PC e a cama
// na arte de fundo de maps/player_home.json (nao ha mais props visuais -
// ver secao "Sector 7 Background Art" / interiores no CYBER_SPEC.md).
export const HOME_PC_LOCATION = { originX: 7, originY: 2, footprintW: 1, footprintH: 1 };
export const HOME_BED_LOCATION = { originX: 11, originY: 4, footprintW: 1, footprintH: 1 };

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
