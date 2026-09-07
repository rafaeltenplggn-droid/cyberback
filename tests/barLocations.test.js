import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nearbyBarInteractable,
  BAR_MAP_ID,
  BAR_COUNTER_LOCATION,
  BAR_STOOL_LOCATION,
  BAR_LAPTOP_LOCATION,
  BAR_NPC_LOCATION,
} from '../src/hackIntegration/barLocations.js';

function makeFakeMapManager({ mapId = BAR_MAP_ID, col, row }) {
  return { currentMap: { id: mapId }, playerCol: col, playerRow: row };
}

test('fora do nullpoint_interior, sempre retorna null (mesmo nas mesmas coordenadas)', () => {
  const mapManager = makeFakeMapManager({ mapId: 'district_07', col: BAR_COUNTER_LOCATION.originX - 1, row: BAR_COUNTER_LOCATION.originY });
  assert.equal(nearbyBarInteractable(mapManager), null);
});

test('adjacente ao balcao dentro do nullpoint_interior retorna "counter"', () => {
  const mapManager = makeFakeMapManager({ col: BAR_COUNTER_LOCATION.originX - 1, row: BAR_COUNTER_LOCATION.originY });
  assert.equal(nearbyBarInteractable(mapManager), 'counter');
});

test('adjacente ao banco dentro do nullpoint_interior retorna "stool"', () => {
  const mapManager = makeFakeMapManager({ col: BAR_STOOL_LOCATION.originX - 1, row: BAR_STOOL_LOCATION.originY });
  assert.equal(nearbyBarInteractable(mapManager), 'stool');
});

test('na frente do laptop (ao sul dele) dentro do nullpoint_interior retorna "laptop"', () => {
  const mapManager = makeFakeMapManager({ col: BAR_LAPTOP_LOCATION.originX, row: BAR_LAPTOP_LOCATION.originY + BAR_LAPTOP_LOCATION.footprintH });
  assert.equal(nearbyBarInteractable(mapManager), 'laptop');
});

test('na frente do atendente (ao sul dele) dentro do nullpoint_interior retorna "bartender"', () => {
  const mapManager = makeFakeMapManager({ col: BAR_NPC_LOCATION.originX, row: BAR_NPC_LOCATION.originY + BAR_NPC_LOCATION.footprintH });
  assert.equal(nearbyBarInteractable(mapManager), 'bartender');
});

test('dos outros lados do atendente (nunca de frente) nao retorna "bartender"', () => {
  const north = makeFakeMapManager({ col: BAR_NPC_LOCATION.originX, row: BAR_NPC_LOCATION.originY - 1 });
  const west = makeFakeMapManager({ col: BAR_NPC_LOCATION.originX - 1, row: BAR_NPC_LOCATION.originY });
  const east = makeFakeMapManager({ col: BAR_NPC_LOCATION.originX + BAR_NPC_LOCATION.footprintW, row: BAR_NPC_LOCATION.originY });
  assert.notEqual(nearbyBarInteractable(north), 'bartender');
  assert.notEqual(nearbyBarInteractable(west), 'bartender');
  assert.notEqual(nearbyBarInteractable(east), 'bartender');
});

test('longe de tudo, dentro do bar, retorna null', () => {
  const mapManager = makeFakeMapManager({ col: 1, row: 8 });
  assert.equal(nearbyBarInteractable(mapManager), null);
});
