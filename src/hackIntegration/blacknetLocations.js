// A BLACKNET (ghost_row_interior, dentro do ghost_row_market): mercado
// negro com 4 estacoes de trabalho. Uma delas (canto inferior direito) e
// so decorativa (mesa vazia, sem personagem nenhum - vender informacao
// agora e so pelo PC de casa, ver hackRuntime.sellInformation). As outras
// 3 (uma por HIRABLE_WORKERS, ver workers.js) comecam trancadas: aparecem
// com um cadeado ate o trabalhador correspondente ser contratado, e so
// entao passam a aparecer sentados hackeando - ver
// assets/backgrounds/blacknet_interior.png. Reaproveita
// isAdjacentToBuilding de hackableBuildings.js - mesma logica de "esta do
// lado", nao reimplementada aqui.
import { isAdjacentToBuilding } from './hackableBuildings.js';

export const BLACKNET_MAP_ID = 'ghost_row_interior';

const BLACKNET_DESK_APPROACH_SIDES = ['south'];

/**
 * Uma mesa por HIRABLE_WORKERS - `seatCol/seatRow` e onde o trabalhador
 * aparece sentado depois de contratado (ver drawBlacknetWorkers em
 * main.js); a mesa em si (a celula bloqueada, 1 acima do assento) e o
 * ponto de interacao do cadeado antes disso.
 */
export const BLACKNET_WORKER_DESKS = {
  character2: { seatCol: 6, seatRow: 4, direction: 'up' },
  character3: { seatCol: 10, seatRow: 4, direction: 'up' },
  character4: { seatCol: 6, seatRow: 7, direction: 'up' },
};

/** A celula da mesa em si (bloqueada, 1 acima do assento) - usado tanto pro cadeado quanto pra ancorar o balao de fala. */
export function blacknetDeskLocation(desk) {
  return { originX: desk.seatCol, originY: desk.seatRow - 1, footprintW: 1, footprintH: 1 };
}

/**
 * Retorna o id do trabalhador (HIRABLE_WORKERS) cuja mesa esta trancada
 * (ainda nao contratado) e o jogador esta parado na frente dela, ou null.
 * `hiredIds` e a lista de ids ja contratados (ver hackRuntime.hirableWorkers).
 */
export function nearbyLockedBlacknetDesk(mapManager, hiredIds) {
  if (mapManager.currentMap?.id !== BLACKNET_MAP_ID) return null;
  const { playerCol, playerRow } = mapManager;
  for (const [workerId, desk] of Object.entries(BLACKNET_WORKER_DESKS)) {
    if (hiredIds.includes(workerId)) continue;
    if (isAdjacentToBuilding(playerCol, playerRow, blacknetDeskLocation(desk), BLACKNET_DESK_APPROACH_SIDES)) {
      return workerId;
    }
  }
  return null;
}
