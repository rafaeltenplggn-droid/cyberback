import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAdjacentToBuilding, findHackableBuildingAt, HACKABLE_BUILDINGS } from '../src/hackIntegration/hackableBuildings.js';

test('HACKABLE_BUILDINGS lista os 3 predios de district_07 com os tiers combinados', () => {
  const byId = Object.fromEntries(HACKABLE_BUILDINGS.map((b) => [b.id, b]));
  assert.equal(byId.gridcorp_tower.target.tier, 'raro');
  assert.equal(byId.nullpoint_bar.target.tier, 'incomum');
  assert.equal(byId.ghost_row_market.target.tier, 'comum');
  for (const entry of HACKABLE_BUILDINGS) {
    assert.equal(entry.mapId, 'district_07');
  }
});

test('isAdjacentToBuilding reconhece as celulas ortogonais ao redor de um footprint 2x2', () => {
  const building = { originX: 1, originY: 1, footprintW: 2, footprintH: 2 };
  const adjacent = [
    [1, 0], [2, 0], // norte
    [1, 3], [2, 3], // sul
    [0, 1], [0, 2], // oeste
    [3, 1], [3, 2], // leste
  ];
  for (const [col, row] of adjacent) {
    assert.equal(isAdjacentToBuilding(col, row, building), true, `(${col},${row}) deveria ser adjacente`);
  }
});

test('isAdjacentToBuilding rejeita celulas dentro do footprint, diagonais e longe do predio', () => {
  const building = { originX: 1, originY: 1, footprintW: 2, footprintH: 2 };
  const notAdjacent = [
    [1, 1], [2, 2], // dentro do footprint
    [0, 0], [3, 0], [0, 3], [3, 3], // diagonais (quinas)
    [5, 5], [10, 10], // longe
  ];
  for (const [col, row] of notAdjacent) {
    assert.equal(isAdjacentToBuilding(col, row, building), false, `(${col},${row}) nao deveria ser adjacente`);
  }
});

test('findHackableBuildingAt encontra cada um dos 3 predios pelas celulas adjacentes reais do mapa', () => {
  assert.equal(findHackableBuildingAt('district_07', 15, 2)?.id, 'gridcorp_tower');
  assert.equal(findHackableBuildingAt('district_07', 3, 5)?.id, 'nullpoint_bar');
  assert.equal(findHackableBuildingAt('district_07', 7, 2)?.id, 'ghost_row_market');
});

test('findHackableBuildingAt retorna null longe de qualquer predio ou em outro mapa', () => {
  assert.equal(findHackableBuildingAt('district_07', 7, 7), null);
  assert.equal(findHackableBuildingAt('gridcorp_interior', 0, 1), null);
});
