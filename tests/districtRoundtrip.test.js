import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MapManager } from '../src/maps/mapManager.js';
import { parseMap } from '../src/maps/mapParser.js';

const mapsDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../maps');

async function loadMapJson(mapId) {
  const raw = await readFile(path.join(mapsDir, `${mapId}.json`), 'utf8');
  return JSON.parse(raw);
}

function makeManager() {
  return new MapManager({ loadMapJson });
}

test('district_07.json tem 16x12 e as 3 portas para os interiores', async () => {
  const raw = await loadMapJson('district_07');
  const map = parseMap(raw);
  assert.equal(map.width, 16);
  assert.equal(map.height, 12);

  const gridcorpDoor = map.getDoorAt(1, 3);
  assert.equal(gridcorpDoor.target_map, 'gridcorp_interior');
  assert.deepEqual([gridcorpDoor.spawn_x, gridcorpDoor.spawn_y], [5, 7]);

  const nullpointDoor = map.getDoorAt(10, 6);
  assert.equal(nullpointDoor.target_map, 'nullpoint_interior');
  assert.deepEqual([nullpointDoor.spawn_x, nullpointDoor.spawn_y], [5, 7]);

  const ghostRowDoor = map.getDoorAt(1, 10);
  assert.equal(ghostRowDoor.target_map, 'ghost_row_interior');
  assert.deepEqual([ghostRowDoor.spawn_x, ghostRowDoor.spawn_y], [5, 7]);

  const homeDoor = map.getDoorAt(14, 2);
  assert.equal(homeDoor.target_map, 'player_home');
  assert.deepEqual([homeDoor.spawn_x, homeDoor.spawn_y], [5, 7]);
});

test('predios do district_07 bloqueiam o footprint inteiro, streetlamp e planter nao bloqueiam', async () => {
  const map = parseMap(await loadMapJson('district_07'));

  // gridcorp_tower, origem 1,1, 2x2
  assert.equal(map.isBlocked(1, 1), true);
  assert.equal(map.isBlocked(2, 2), true);
  // nullpoint_bar, origem 10,4, 2x2
  assert.equal(map.isBlocked(10, 4), true);
  assert.equal(map.isBlocked(11, 5), true);
  // ghost_row_market, origem 1,8, 2x2
  assert.equal(map.isBlocked(1, 8), true);
  assert.equal(map.isBlocked(2, 9), true);
  // crate_stack_magenta em 13,6, com colisao
  assert.equal(map.isBlocked(13, 6), true);

  assert.equal(map.isBlocked(0, 5), false); // streetlamp_cyan
  assert.equal(map.isBlocked(8, 8), false); // planter_green
});

for (const [interiorId, exteriorDoor] of [
  ['gridcorp_interior', { x: 1, y: 3 }],
  ['nullpoint_interior', { x: 10, y: 6 }],
  ['ghost_row_interior', { x: 1, y: 10 }],
  ['player_home', { x: 14, y: 2 }],
]) {
  test(`district_07 -> ${interiorId} -> district_07 sem travar em nenhum ponto`, async () => {
    const manager = makeManager();
    await manager.loadMap('district_07', 5, 5);

    const enterResult = await manager.tryMove(exteriorDoor.x, exteriorDoor.y);
    assert.equal(enterResult.moved, true);
    assert.equal(enterResult.doorTriggered, true);
    assert.equal(enterResult.targetMap, interiorId);
    assert.equal(manager.currentMap.id, interiorId);
    assert.equal(manager.canEnter(manager.playerCol, manager.playerRow), true);

    const interiorDoor = manager.currentMap.doors[0];
    assert.equal(interiorDoor.target_map, 'district_07');

    const exitResult = await manager.tryMove(interiorDoor.x, interiorDoor.y);
    assert.equal(exitResult.moved, true);
    assert.equal(exitResult.doorTriggered, true);
    assert.equal(exitResult.targetMap, 'district_07');
    assert.equal(manager.currentMap.id, 'district_07');
    assert.equal(manager.playerCol, interiorDoor.spawn_x);
    assert.equal(manager.playerRow, interiorDoor.spawn_y);
    // o jogador precisa reaparecer em chao livre, nao preso na propria porta ou em colisao
    assert.equal(manager.canEnter(manager.playerCol, manager.playerRow), true);
  });
}

test('os quatro interiores sao salas 10x10 com borda solida e a porta de saida aberta', async () => {
  for (const id of ['gridcorp_interior', 'nullpoint_interior', 'ghost_row_interior', 'player_home']) {
    const map = parseMap(await loadMapJson(id));
    assert.equal(map.width, 10);
    assert.equal(map.height, 10);

    for (let col = 0; col < 10; col++) {
      if (col === 5) continue; // celula da porta, tratada abaixo
      assert.equal(map.isBlocked(col, 0), true, `${id} topo (${col},0) devia ser parede`);
      assert.equal(map.isBlocked(col, 9), col === 5 ? false : true, `${id} base (${col},9)`);
    }
    for (let row = 0; row < 10; row++) {
      assert.equal(map.isBlocked(0, row), true, `${id} parede oeste (0,${row})`);
      assert.equal(map.isBlocked(9, row), true, `${id} parede leste (9,${row})`);
    }

    const door = map.getDoorAt(5, 9);
    assert.ok(door, `${id} deve ter porta na parede sul (5,9)`);
    assert.equal(map.isBlocked(5, 9), false, `${id} celula da porta nao pode bloquear`);
  }
});

test('player_home tem o PC e a cama bloqueados, no lugar certo, e o spawn de volta pro district_07 nao e a propria porta', async () => {
  const map = parseMap(await loadMapJson('player_home'));
  assert.equal(map.isBlocked(3, 3), true, 'PC bloqueia a celula dele');
  assert.equal(map.isBlocked(6, 3), true, 'cama bloqueia a celula dela');

  const door = map.getDoorAt(5, 9);
  assert.equal(door.spawn_x, 14);
  assert.equal(door.spawn_y, 3);

  const districtMap = parseMap(await loadMapJson('district_07'));
  assert.equal(districtMap.isBlocked(14, 3), false, 'spawn de volta e chao livre, nao a propria porta');
  assert.equal(districtMap.getDoorAt(14, 3), null, 'spawn de volta nao e, ele mesmo, outra porta');
});
