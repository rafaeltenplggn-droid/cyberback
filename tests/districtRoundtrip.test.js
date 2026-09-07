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

test('district_07.json tem 24x16, fundo real (Visual Master) e as 5 portas para os interiores', async () => {
  const raw = await loadMapJson('district_07');
  const map = parseMap(raw);
  assert.equal(map.width, 24);
  assert.equal(map.height, 16);
  assert.equal(map.background, 'sector7_exterior.png');

  const nullpointDoor = map.getDoorAt(4, 5);
  assert.equal(nullpointDoor.target_map, 'nullpoint_interior');
  assert.deepEqual([nullpointDoor.spawn_x, nullpointDoor.spawn_y], [8, 8]);

  const ghostRowDoor = map.getDoorAt(11, 5);
  assert.equal(ghostRowDoor.target_map, 'ghost_row_interior');
  assert.deepEqual([ghostRowDoor.spawn_x, ghostRowDoor.spawn_y], [5, 7]);

  const gridcorpDoor = map.getDoorAt(18, 5);
  assert.equal(gridcorpDoor.target_map, 'gridcorp_interior');
  assert.deepEqual([gridcorpDoor.spawn_x, gridcorpDoor.spawn_y], [5, 7]);

  const homeDoor = map.getDoorAt(7, 13);
  assert.equal(homeDoor.target_map, 'player_home');
  assert.deepEqual([homeDoor.spawn_x, homeDoor.spawn_y], [5, 7]);

  const dataTerminalDoor = map.getDoorAt(18, 13);
  assert.equal(dataTerminalDoor.target_map, 'data_terminal_interior');
  assert.deepEqual([dataTerminalDoor.spawn_x, dataTerminalDoor.spawn_y], [5, 7]);
});

test('predios do district_07 bloqueiam o footprint que bate com a arte de fundo', async () => {
  const map = parseMap(await loadMapJson('district_07'));

  // nullpoint_bar (BAR), origem 0,0, 8x5
  assert.equal(map.isBlocked(0, 0), true);
  assert.equal(map.isBlocked(7, 4), true);
  // ghost_row_market (BLACKNET), origem 8,0, 8x5
  assert.equal(map.isBlocked(8, 0), true);
  assert.equal(map.isBlocked(15, 4), true);
  // gridcorp_tower (CORP), origem 16,0, 8x5
  assert.equal(map.isBlocked(16, 0), true);
  assert.equal(map.isBlocked(23, 4), true);
  // player_home_building (MY HOME), origem 4,9, 6x4
  assert.equal(map.isBlocked(4, 9), true);
  assert.equal(map.isBlocked(9, 12), true);
  // data_terminal_building, origem 16,9, 5x4
  assert.equal(map.isBlocked(16, 9), true);
  assert.equal(map.isBlocked(20, 12), true);
  // predio de cenario sem porta, origem 0,9, 4x5
  assert.equal(map.isBlocked(0, 9), true);
  // borda do mapa (fim da tela): col0, col23 e a ultima linha
  assert.equal(map.isBlocked(0, 7), true);
  assert.equal(map.isBlocked(23, 7), true);
  assert.equal(map.isBlocked(12, 15), true);

  // calcada em frente aos predios, livre
  assert.equal(map.isBlocked(4, 5), false); // porta do BAR
  assert.equal(map.isBlocked(11, 5), false); // porta do BLACKNET
  assert.equal(map.isBlocked(18, 5), false); // porta do CORP
  assert.equal(map.isBlocked(7, 13), false); // porta da MY HOME
  assert.equal(map.isBlocked(18, 13), false); // porta do DATA TERMINAL
});

for (const [interiorId, exteriorDoor] of [
  ['nullpoint_interior', { x: 4, y: 5 }],
  ['ghost_row_interior', { x: 11, y: 5 }],
  ['gridcorp_interior', { x: 18, y: 5 }],
  ['player_home', { x: 7, y: 13 }],
  ['data_terminal_interior', { x: 18, y: 13 }],
]) {
  test(`district_07 -> ${interiorId} -> district_07 sem travar em nenhum ponto`, async () => {
    const manager = makeManager();
    await manager.loadMap('district_07', 12, 8);

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

test('os tres interiores ainda em blockout sao salas 10x10 com borda solida e a porta de saida aberta', async () => {
  for (const id of ['gridcorp_interior', 'ghost_row_interior', 'data_terminal_interior']) {
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

test('player_home usa arte de fundo real, 16x12, com PC e cama bloqueados no lugar certo', async () => {
  const map = parseMap(await loadMapJson('player_home'));
  assert.equal(map.width, 16);
  assert.equal(map.height, 12);
  assert.equal(map.background, 'player_home_interior.png');

  assert.equal(map.isBlocked(7, 2), true, 'PC (mesa com monitores) bloqueia a celula dele');
  assert.equal(map.isBlocked(11, 4), true, 'cama bloqueia a celula dela');
  assert.equal(map.isBlocked(7, 3), false, 'chao em frente ao PC e livre (cadeira)');
  assert.equal(map.isBlocked(10, 4), false, 'chao a oeste da cama e livre');

  const door = map.getDoorAt(7, 9);
  assert.ok(door, 'porta de saida no vao sul');
  assert.equal(door.target_map, 'district_07');
  assert.equal(door.spawn_x, 7);
  assert.equal(door.spawn_y, 14);

  const districtMap = parseMap(await loadMapJson('district_07'));
  assert.equal(districtMap.isBlocked(7, 14), false, 'spawn de volta e chao livre, nao a propria porta');
  assert.equal(districtMap.getDoorAt(7, 14), null, 'spawn de volta nao e, ele mesmo, outra porta');
});

test('nullpoint_interior usa arte de fundo real, 16x12, com o balcao bloqueado e a porta de saida aberta', async () => {
  const map = parseMap(await loadMapJson('nullpoint_interior'));
  assert.equal(map.width, 16);
  assert.equal(map.height, 12);
  assert.equal(map.background, 'nullpoint_bar_interior.png');
  assert.equal(map.isBlocked(8, 3), true, 'balcao do bar bloqueia a celula dele');
  assert.equal(map.isBlocked(8, 9), false, 'porta de saida nao pode bloquear');

  const districtMap = parseMap(await loadMapJson('district_07'));
  assert.equal(districtMap.isBlocked(0, 0), true, 'nullpoint_bar (predio exterior) continua com colisao normal');
  assert.equal(districtMap.getDoorAt(4, 5).target_map, 'nullpoint_interior');
});
