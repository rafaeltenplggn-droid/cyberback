// Posicoes das 5 mesas do ginasio da CORP (gridcorp_interior) - 4
// lutadores num 2x2 mais perto da entrada, o lider bem no fundo, igual a
// arte de referencia. Reaproveita isAdjacentToBuilding de
// hackableBuildings.js - mesma logica de "esta do lado", nao
// reimplementada aqui.
import { isAdjacentToBuilding } from './hackableBuildings.js';

export const CORP_GYM_MAP_ID = 'gridcorp_interior';

const CORP_GYM_DESK_APPROACH_SIDES = ['south'];

/**
 * seatCol/seatRow: onde o NPC aparece sentado (lutador ou lider). A mesa em
 * si (a celula bloqueada, 1 acima do assento) e o ponto de interacao -
 * mesmo esquema das mesas da BLACKNET. Os NPCs do ginasio sao inimigos
 * genericos da CORP, nunca o roster jogavel/NFT (ver characterRoster.js) -
 * por isso nao tem characterId aqui; a renderizacao (main.js) usa um
 * placeholder generico ate ter arte propria de cada lutador.
 */
export const CORP_GYM_DESKS = {
  fighter1: { seatCol: 5, seatRow: 7 },
  fighter2: { seatCol: 11, seatRow: 7 },
  fighter3: { seatCol: 5, seatRow: 5 },
  fighter4: { seatCol: 11, seatRow: 5 },
  leader: { seatCol: 8, seatRow: 4 },
};

/** A celula da mesa em si (bloqueada, 1 acima do assento) - usado tanto pro cadeado quanto pra ancorar o balao de fala. */
export function corpGymDeskLocation(stageId) {
  const desk = CORP_GYM_DESKS[stageId];
  return { originX: desk.seatCol, originY: desk.seatRow - 1, footprintW: 1, footprintH: 1 };
}

/** O id do estagio cuja mesa esta na frente do jogador dentro do ginasio da CORP, ou null. */
export function nearbyCorpGymDesk(mapManager) {
  if (mapManager.currentMap?.id !== CORP_GYM_MAP_ID) return null;
  const { playerCol, playerRow } = mapManager;
  for (const stageId of Object.keys(CORP_GYM_DESKS)) {
    if (isAdjacentToBuilding(playerCol, playerRow, corpGymDeskLocation(stageId), CORP_GYM_DESK_APPROACH_SIDES)) {
      return stageId;
    }
  }
  return null;
}
