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

test('district_07.json tem 24x16, fundo real (Visual Master) e as portas pros 5 interiores', async () => {
  const raw = await loadMapJson('district_07');
  const map = parseMap(raw);
  assert.equal(map.width, 24);
  assert.equal(map.height, 16);
  assert.equal(map.background, 'sector7_exterior.png');

  // BAR, BLACKNET, CORP e MY HOME tem porta de 2 celulas de largura (bate
  // com o desenho das portas duplas na arte de fundo, ver
  // assets/backgrounds/sector7_exterior.png - entrar so pela celula da
  // esquerda parecia "entrar de lado" da porta). DATA TERMINAL ja nascia
  // com a porta bem centralizada numa unica celula.
  for (const doorX of [3, 4]) {
    const door = map.getDoorAt(doorX, 5);
    assert.equal(door.target_map, 'nullpoint_interior');
    assert.deepEqual([door.spawn_x, door.spawn_y], [8, 8]);
  }
  for (const doorX of [11, 12]) {
    const door = map.getDoorAt(doorX, 5);
    assert.equal(door.target_map, 'ghost_row_interior');
    assert.deepEqual([door.spawn_x, door.spawn_y], [8, 8]);
  }
  for (const doorX of [18, 19]) {
    const door = map.getDoorAt(doorX, 5);
    assert.equal(door.target_map, 'gridcorp_interior');
    assert.deepEqual([door.spawn_x, door.spawn_y], [5, 7]);
  }
  for (const doorX of [6, 7]) {
    const door = map.getDoorAt(doorX, 13);
    assert.equal(door.target_map, 'player_home');
    assert.deepEqual([door.spawn_x, door.spawn_y], [5, 7]);
  }

  const dataTerminalDoor = map.getDoorAt(18, 13);
  assert.equal(dataTerminalDoor.target_map, 'data_terminal_interior');
  assert.deepEqual([dataTerminalDoor.spawn_x, dataTerminalDoor.spawn_y], [5, 7]);
});

for (const [label, doorCoords, southOf, targetMap] of [
  ['BAR', { x: 3, y: 5 }, { x: 3, y: 6 }, 'nullpoint_interior'],
  ['BLACKNET', { x: 11, y: 5 }, { x: 11, y: 6 }, 'ghost_row_interior'],
  ['CORP', { x: 18, y: 5 }, { x: 18, y: 6 }, 'gridcorp_interior'],
  ['MY HOME', { x: 7, y: 13 }, { x: 7, y: 14 }, 'player_home'],
  ['DATA TERMINAL', { x: 18, y: 13 }, { x: 18, y: 14 }, 'data_terminal_interior'],
]) {
  test(`porta do ${label}: de lado (na propria calcada da porta) nao dispara, so andando pra cima de baixo dela`, async () => {
    // De lado: o jogador chega na propria celula da porta vindo de outra
    // porta vizinha na mesma calcada (ex: saindo do BAR andando pro
    // BLACKNET) - isso NUNCA pode disparar sozinho.
    const sideways = makeManager();
    await sideways.loadMap('district_07', doorCoords.x - 1, doorCoords.y);
    const sidewaysResult = await sideways.tryMove(doorCoords.x, doorCoords.y, 'right');
    assert.equal(sidewaysResult.doorTriggered, false, 'de lado nao dispara');
    assert.equal(sideways.currentMap.id, 'district_07');

    // De baixo pra cima: o unico jeito de verdade de entrar - e exatamente
    // onde o jogo sempre poe o jogador de volta ao sair de dentro (ver
    // spawn_y em cada maps/*_interior.json, sempre 1 fileira abaixo da
    // porta) e onde o spawn inicial do jogo tambem cai agora (ver
    // startRow em main.js, nunca mais em cima da propria porta).
    const upward = makeManager();
    await upward.loadMap('district_07', southOf.x, southOf.y);
    const upwardResult = await upward.tryMove(doorCoords.x, doorCoords.y, 'up');
    assert.equal(upwardResult.doorTriggered, true);
    assert.equal(upwardResult.targetMap, targetMap);
  });
}

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
  assert.equal(map.isBlocked(3, 5), false); // porta do BAR
  assert.equal(map.isBlocked(11, 5), false); // porta do BLACKNET
  assert.equal(map.isBlocked(18, 5), false); // porta do CORP
  assert.equal(map.isBlocked(7, 13), false); // porta da MY HOME
  assert.equal(map.isBlocked(18, 13), false); // porta do DATA TERMINAL
});

for (const [interiorId, exteriorDoor] of [
  ['nullpoint_interior', { x: 3, y: 5 }],
  ['ghost_row_interior', { x: 11, y: 5 }],
  ['gridcorp_interior', { x: 18, y: 5 }],
  ['player_home', { x: 7, y: 13 }],
  ['data_terminal_interior', { x: 18, y: 13 }],
]) {
  test(`district_07 -> ${interiorId} -> district_07 sem travar em nenhum ponto`, async () => {
    const manager = makeManager();
    await manager.loadMap('district_07', 12, 8);

    // As doors do district_07 so disparam andando pra cima (approach: 'up')
    // - ver mapManager.js/mapParser.js - senao qualquer passo LATERAL por
    // cima da calcada em frente a loja jogava o jogador pra dentro sem
    // querer, so de passar por ali indo pro predio vizinho.
    const enterResult = await manager.tryMove(exteriorDoor.x, exteriorDoor.y, 'up');
    assert.equal(enterResult.moved, true);
    assert.equal(enterResult.doorTriggered, true);
    assert.equal(enterResult.targetMap, interiorId);
    assert.equal(manager.currentMap.id, interiorId);
    assert.equal(manager.canEnter(manager.playerCol, manager.playerRow), true);

    const interiorDoor = manager.currentMap.doors[0];
    assert.equal(interiorDoor.target_map, 'district_07');

    // E as portas de saida dos interiores so disparam andando pra baixo
    // (approach: 'down'), mesmo motivo.
    const exitResult = await manager.tryMove(interiorDoor.x, interiorDoor.y, 'down');
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

test('os dois interiores ainda em blockout sao salas 10x10 com borda solida e a porta de saida aberta', async () => {
  for (const id of ['gridcorp_interior', 'data_terminal_interior']) {
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

  // As 2 mesas redondas do meio (fileira 6) continuam bloqueando - so a
  // mesa mesmo, nao o tapete ao redor dela (fileira 7, so chao/tapete,
  // sem nenhum movel em cima - andar por ali tem que funcionar).
  assert.equal(map.isBlocked(7, 6), true, 'mesa redonda 1 bloqueia a celula dela');
  assert.equal(map.isBlocked(10, 6), true, 'mesa redonda 2 bloqueia a celula dela');
  assert.equal(map.isBlocked(8, 6), false, 'vao do tapete entre as duas mesas tem que ser livre');
  for (const col of [6, 7, 8, 9, 10, 11]) {
    assert.equal(map.isBlocked(col, 7), false, `tapete embaixo das mesas (${col},7) tem que ser livre`);
  }

  const districtMap = parseMap(await loadMapJson('district_07'));
  assert.equal(districtMap.isBlocked(0, 0), true, 'nullpoint_bar (predio exterior) continua com colisao normal');
  assert.equal(districtMap.getDoorAt(3, 5).target_map, 'nullpoint_interior');
});

test('ghost_row_interior (BLACKNET) usa arte de fundo real, 16x12, com as mesas bloqueadas e a porta de saida aberta', async () => {
  const map = parseMap(await loadMapJson('ghost_row_interior'));
  assert.equal(map.width, 16);
  assert.equal(map.height, 12);
  assert.equal(map.background, 'blacknet_interior.png');
  assert.equal(map.isBlocked(10, 6), true, 'mesa do corretor bloqueia a celula dela');
  assert.equal(map.isBlocked(6, 4), true, 'mesa do primeiro trabalhador bloqueia a celula dela');
  assert.equal(map.isBlocked(8, 9), false, 'porta de saida nao pode bloquear');

  const districtMap = parseMap(await loadMapJson('district_07'));
  assert.equal(districtMap.getDoorAt(11, 5).target_map, 'ghost_row_interior');
});
