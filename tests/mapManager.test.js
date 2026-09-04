import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MapManager } from '../src/maps/mapManager.js';

const RAW_MAPS = {
  map_a: {
    id: 'map_a',
    tileset: 'generic',
    width: 3,
    height: 3,
    tiles: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    collision: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
    doors: [{ x: 2, y: 0, target_map: 'map_b', spawn_x: 0, spawn_y: 0 }],
    props: [],
  },
  map_b: {
    id: 'map_b',
    tileset: 'generic',
    width: 2,
    height: 2,
    tiles: [
      [0, 0],
      [0, 0],
    ],
    collision: [
      [0, 0],
      [0, 0],
    ],
    doors: [],
    props: [],
  },
};

function makeManager() {
  return new MapManager({ loadMapJson: async (id) => RAW_MAPS[id] });
}

test('loadMap posiciona o jogador no spawn informado', async () => {
  const manager = makeManager();
  await manager.loadMap('map_a', 1, 1);
  assert.equal(manager.currentMap.id, 'map_a');
  assert.equal(manager.playerCol, 1);
  assert.equal(manager.playerRow, 1);
});

test('tryMove bloqueado por colisao nao move o jogador', async () => {
  const manager = makeManager();
  await manager.loadMap('map_a', 0, 0);
  const result = await manager.tryMove(1, 1);
  assert.equal(result.moved, false);
  assert.equal(manager.playerCol, 0);
  assert.equal(manager.playerRow, 0);
});

test('tryMove sobre uma door troca o mapa inteiro e reposiciona no spawn do destino', async () => {
  const manager = makeManager();
  await manager.loadMap('map_a', 1, 0);
  const result = await manager.tryMove(2, 0);
  assert.equal(result.moved, true);
  assert.equal(result.doorTriggered, true);
  assert.equal(result.targetMap, 'map_b');
  assert.equal(manager.currentMap.id, 'map_b');
  assert.equal(manager.playerCol, 0);
  assert.equal(manager.playerRow, 0);
});

test('tryMove para celula livre sem door apenas atualiza a posicao', async () => {
  const manager = makeManager();
  await manager.loadMap('map_a', 0, 0);
  const result = await manager.tryMove(1, 0);
  assert.equal(result.moved, true);
  assert.equal(result.doorTriggered, false);
  assert.equal(manager.playerCol, 1);
  assert.equal(manager.playerRow, 0);
  assert.equal(manager.currentMap.id, 'map_a');
});
