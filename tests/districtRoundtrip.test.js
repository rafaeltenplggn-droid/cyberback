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

test('district_07.json tem 24x16 e as 5 portas para os interiores', async () => {
  const raw = await loadMapJson('district_07');
  const map = parseMap(raw);
  assert.equal(map.width, 24);
  assert.equal(map.height, 16);

  const nullpointDoor = map.getDoorAt(1, 4);
  assert.equal(nullpointDoor.target_map, 'nullpoint_interior');
  assert.deepEqual([nullpointDoor.spawn_x, nullpointDoor.spawn_y], [5, 7]);

  const ghostRowDoor = map.getDoorAt(8, 4);
  assert.equal(ghostRowDoor.target_map, 'ghost_row_interior');
  assert.deepEqual([ghostRowDoor.spawn_x, ghostRowDoor.spawn_y], [5, 7]);

  const gridcorpDoor = map.getDoorAt(17, 4);
  assert.equal(gridcorpDoor.target_map, 'gridcorp_interior');
  assert.deepEqual([gridcorpDoor.spawn_x, gridcorpDoor.spawn_y], [5, 7]);

  const homeDoor = map.getDoorAt(2, 10);
  assert.equal(homeDoor.target_map, 'player_home');
  assert.deepEqual([homeDoor.spawn_x, homeDoor.spawn_y], [5, 7]);

  const dataTerminalDoor = map.getDoorAt(17, 10);
  assert.equal(dataTerminalDoor.target_map, 'data_terminal_interior');
  assert.deepEqual([dataTerminalDoor.spawn_x, dataTerminalDoor.spawn_y], [5, 7]);
});

test('predios do district_07 bloqueiam o footprint inteiro, streetlamp e planter nao bloqueiam', async () => {
  const map = parseMap(await loadMapJson('district_07'));

  // nullpoint_bar (BAR), origem 1,1, 4x3
  assert.equal(map.isBlocked(1, 1), true);
  assert.equal(map.isBlocked(4, 3), true);
  // ghost_row_market (BLACKNET), origem 8,1, 4x3
  assert.equal(map.isBlocked(8, 1), true);
  assert.equal(map.isBlocked(11, 3), true);
  // gridcorp_tower (CORP), origem 17,1, 4x3
  assert.equal(map.isBlocked(17, 1), true);
  assert.equal(map.isBlocked(20, 3), true);
  // player_home_building (MY HOME), origem 2,11, 3x3
  assert.equal(map.isBlocked(2, 11), true);
  assert.equal(map.isBlocked(4, 13), true);
  // data_terminal_building, origem 17,11, 3x3
  assert.equal(map.isBlocked(17, 11), true);
  assert.equal(map.isBlocked(19, 13), true);
  // crate_stack_magenta em 21,9, com colisao
  assert.equal(map.isBlocked(21, 9), true);

  assert.equal(map.isBlocked(10, 6), false); // streetlamp_cyan
  assert.equal(map.isBlocked(14, 3), false); // planter_green
});

for (const [interiorId, exteriorDoor] of [
  ['nullpoint_interior', { x: 1, y: 4 }],
  ['ghost_row_interior', { x: 8, y: 4 }],
  ['gridcorp_interior', { x: 17, y: 4 }],
  ['player_home', { x: 2, y: 10 }],
  ['data_terminal_interior', { x: 17, y: 10 }],
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
  for (const id of ['gridcorp_interior', 'nullpoint_interior', 'ghost_row_interior', 'player_home', 'data_terminal_interior']) {
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
  assert.equal(door.spawn_x, 2);
  assert.equal(door.spawn_y, 9);

  const districtMap = parseMap(await loadMapJson('district_07'));
  assert.equal(districtMap.isBlocked(2, 9), false, 'spawn de volta e chao livre, nao a propria porta');
  assert.equal(districtMap.getDoorAt(2, 9), null, 'spawn de volta nao e, ele mesmo, outra porta');
});

test('nullpoint_interior tem o balcao do bar bloqueado, e o nullpoint_bar continua hackavel normalmente', async () => {
  const map = parseMap(await loadMapJson('nullpoint_interior'));
  assert.equal(map.isBlocked(3, 3), true, 'balcao do bar bloqueia a celula dele');

  const districtMap = parseMap(await loadMapJson('district_07'));
  assert.equal(districtMap.isBlocked(1, 1), true, 'nullpoint_bar (predio exterior) continua com colisao normal');
  assert.equal(districtMap.getDoorAt(1, 4).target_map, 'nullpoint_interior');
});
