import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearbyLockedBlacknetDesk, BLACKNET_MAP_ID, BLACKNET_WORKER_DESKS } from '../src/hackIntegration/blacknetLocations.js';

function makeFakeMapManager({ mapId = BLACKNET_MAP_ID, col, row }) {
  return { currentMap: { id: mapId }, playerCol: col, playerRow: row };
}

const DESK_ENTRIES = Object.entries(BLACKNET_WORKER_DESKS);
const [FIRST_WORKER_ID, FIRST_DESK] = DESK_ENTRIES[0];

test('fora da BLACKNET, sempre retorna null (mesmo nas mesmas coordenadas)', () => {
  const mapManager = makeFakeMapManager({ mapId: 'district_07', col: FIRST_DESK.seatCol, row: FIRST_DESK.seatRow });
  assert.equal(nearbyLockedBlacknetDesk(mapManager, []), null);
});

test('na frente de uma mesa trancada (ao sul dela) retorna o id do trabalhador', () => {
  const mapManager = makeFakeMapManager({ col: FIRST_DESK.seatCol, row: FIRST_DESK.seatRow });
  assert.equal(nearbyLockedBlacknetDesk(mapManager, []), FIRST_WORKER_ID);
});

test('mesa ja contratada nao aparece mais como trancada', () => {
  const mapManager = makeFakeMapManager({ col: FIRST_DESK.seatCol, row: FIRST_DESK.seatRow });
  assert.equal(nearbyLockedBlacknetDesk(mapManager, [FIRST_WORKER_ID]), null);
});

test('dos outros lados da mesa (nunca de frente) nao retorna nada', () => {
  const north = makeFakeMapManager({ col: FIRST_DESK.seatCol, row: FIRST_DESK.seatRow - 2 });
  const west = makeFakeMapManager({ col: FIRST_DESK.seatCol - 1, row: FIRST_DESK.seatRow - 1 });
  const east = makeFakeMapManager({ col: FIRST_DESK.seatCol + 1, row: FIRST_DESK.seatRow - 1 });
  assert.equal(nearbyLockedBlacknetDesk(north, []), null);
  assert.equal(nearbyLockedBlacknetDesk(west, []), null);
  assert.equal(nearbyLockedBlacknetDesk(east, []), null);
});

test('cada mesa trancada retorna o worker id certo dela', () => {
  for (const [workerId, desk] of DESK_ENTRIES) {
    const mapManager = makeFakeMapManager({ col: desk.seatCol, row: desk.seatRow });
    assert.equal(nearbyLockedBlacknetDesk(mapManager, []), workerId);
  }
});

test('longe de qualquer mesa, dentro da BLACKNET, retorna null', () => {
  const mapManager = makeFakeMapManager({ col: 1, row: 8 });
  assert.equal(nearbyLockedBlacknetDesk(mapManager, []), null);
});
