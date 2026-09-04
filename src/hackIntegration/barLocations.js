// O bar (nullpoint_interior, dentro do nullpoint_bar): tem um balcao que
// vende drinks, um banco pra sentar (so cosmetico) e um laptop (hackeia o
// nullpoint_bar remotamente, sem sair do bar). Reaproveita
// isAdjacentToBuilding de hackableBuildings.js - mesma logica de "esta do
// lado", nao reimplementada aqui. O nullpoint_bar em si continua hackavel
// exatamente como ja era, sem nenhuma mudanca.
import { isAdjacentToBuilding } from './hackableBuildings.js';

export const BAR_MAP_ID = 'nullpoint_interior';

// O laptop hackeia esta mesma entrada de HACKABLE_BUILDINGS (hackableBuildings.js) -
// exportado aqui pra quem usa 'laptop' nao precisar repetir a string solta.
export const BAR_HACKABLE_BUILDING_ID = 'nullpoint_bar';

// Casam com os props reais de maps/nullpoint_interior.json (mesma origem/footprint).
export const BAR_COUNTER_LOCATION = { originX: 3, originY: 3, footprintW: 1, footprintH: 1 };
export const BAR_STOOL_LOCATION = { originX: 3, originY: 6, footprintW: 1, footprintH: 1 };
export const BAR_LAPTOP_LOCATION = { originX: 6, originY: 3, footprintW: 1, footprintH: 1 };
export const BAR_NPC_LOCATION = { originX: 3, originY: 2, footprintW: 1, footprintH: 1 };

/** Retorna 'counter', 'stool', 'laptop', 'bartender' ou null, dependendo de onde o personagem esta parado dentro do bar. */
export function nearbyBarInteractable(mapManager) {
  if (mapManager.currentMap?.id !== BAR_MAP_ID) return null;
  const { playerCol, playerRow } = mapManager;
  if (isAdjacentToBuilding(playerCol, playerRow, BAR_COUNTER_LOCATION)) return 'counter';
  if (isAdjacentToBuilding(playerCol, playerRow, BAR_STOOL_LOCATION)) return 'stool';
  if (isAdjacentToBuilding(playerCol, playerRow, BAR_LAPTOP_LOCATION)) return 'laptop';
  if (isAdjacentToBuilding(playerCol, playerRow, BAR_NPC_LOCATION)) return 'bartender';
  return null;
}
