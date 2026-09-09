import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearbyCorpGymDesk, corpGymDeskLocation, CORP_GYM_MAP_ID, CORP_GYM_DESKS } from '../src/hackIntegration/corpGymLocations.js';

function makeFakeMapManager({ mapId = CORP_GYM_MAP_ID, col, row }) {
  return { currentMap: { id: mapId }, playerCol: col, playerRow: row };
}

const DESK_IDS = Object.keys(CORP_GYM_DESKS);
const [FIRST_STAGE_ID] = DESK_IDS;
const FIRST_DESK = CORP_GYM_DESKS[FIRST_STAGE_ID];

test('fora do ginasio da CORP, sempre retorna null (mesmo nas mesmas coordenadas)', () => {
  const mapManager = makeFakeMapManager({ mapId: 'district_07', col: FIRST_DESK.seatCol, row: FIRST_DESK.seatRow });
  assert.equal(nearbyCorpGymDesk(mapManager), null);
});

test('na frente de cada mesa (ao sul dela) retorna o id do estagio certo', () => {
  for (const stageId of DESK_IDS) {
    const desk = CORP_GYM_DESKS[stageId];
    const mapManager = makeFakeMapManager({ col: desk.seatCol, row: desk.seatRow });
    assert.equal(nearbyCorpGymDesk(mapManager), stageId);
  }
});

test('dos outros lados da mesa (nunca de frente) nao retorna nada', () => {
  // usa a mesa do lider (coluna 7) - nenhuma outra mesa do ginasio
  // compartilha essa coluna, entao os pontos vizinhos ficam garantidos
  // longe de qualquer outra mesa.
  const desk = CORP_GYM_DESKS.leader;
  const north = makeFakeMapManager({ col: desk.seatCol, row: desk.seatRow - 2 });
  const west = makeFakeMapManager({ col: desk.seatCol - 1, row: desk.seatRow - 1 });
  const east = makeFakeMapManager({ col: desk.seatCol + 1, row: desk.seatRow - 1 });
  assert.equal(nearbyCorpGymDesk(north), null);
  assert.equal(nearbyCorpGymDesk(west), null);
  assert.equal(nearbyCorpGymDesk(east), null);
});

test('longe de qualquer mesa, dentro do ginasio, retorna null', () => {
  const mapManager = makeFakeMapManager({ col: 1, row: 1 });
  assert.equal(nearbyCorpGymDesk(mapManager), null);
});

test('corpGymDeskLocation fica exatamente 1 fileira acima do assento', () => {
  for (const stageId of DESK_IDS) {
    const desk = CORP_GYM_DESKS[stageId];
    const location = corpGymDeskLocation(stageId);
    assert.equal(location.originX, desk.seatCol);
    assert.equal(location.originY, desk.seatRow - 1);
  }
});
