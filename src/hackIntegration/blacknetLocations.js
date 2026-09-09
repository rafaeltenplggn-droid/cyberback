// A BLACKNET (ghost_row_interior, dentro do ghost_row_market): mercado
// negro onde a informacao minerada/hackeada e vendida por BYTE, e onde os
// trabalhadores contratados (ver workers.js) aparecem sentados hackeando -
// ver assets/backgrounds/blacknet_interior.png. Reaproveita
// isAdjacentToBuilding de hackableBuildings.js - mesma logica de "esta do
// lado", nao reimplementada aqui.
import { isAdjacentToBuilding } from './hackableBuildings.js';

export const BLACKNET_MAP_ID = 'ghost_row_interior';

// A mesa do canto inferior direito (a mesma com o grafico rosa na tela) e
// sempre ocupada pelo corretor da BLACKNET (NPC fixo, nao depende de
// contratar ninguem) - vender informacao e falar com ele, igual o
// atendente do bar: so responde de frente pra ele (ao sul).
export const BLACKNET_BROKER_LOCATION = { originX: 10, originY: 7, footprintW: 1, footprintH: 1 };
const BLACKNET_BROKER_APPROACH_SIDES = ['south'];

/**
 * As outras 3 mesas (uma por HIRABLE_WORKERS, ver workers.js) - cada uma
 * so aparece ocupada (visualmente) depois que aquele trabalhador e
 * contratado. Sao so pontos de desenho, nao tem interacao nenhuma (o
 * trabalho deles acontece sozinho, em segundo plano, nao precisa o
 * jogador parado do lado).
 */
export const BLACKNET_WORKER_DESKS = {
  character2: { seatCol: 6, seatRow: 4, direction: 'up' },
  character3: { seatCol: 10, seatRow: 4, direction: 'up' },
  character4: { seatCol: 6, seatRow: 7, direction: 'up' },
};

/** Retorna 'sell' ou null, dependendo de onde o personagem esta parado dentro da BLACKNET. */
export function nearbyBlacknetInteractable(mapManager) {
  if (mapManager.currentMap?.id !== BLACKNET_MAP_ID) return null;
  const { playerCol, playerRow } = mapManager;
  if (isAdjacentToBuilding(playerCol, playerRow, BLACKNET_BROKER_LOCATION, BLACKNET_BROKER_APPROACH_SIDES)) return 'sell';
  return null;
}
