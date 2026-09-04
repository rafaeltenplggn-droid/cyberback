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

test('adjacente ao laptop dentro do nullpoint_interior retorna "laptop"', () => {
  const mapManager = makeFakeMapManager({ col: BAR_LAPTOP_LOCATION.originX - 1, row: BAR_LAPTOP_LOCATION.originY });
  assert.equal(nearbyBarInteractable(mapManager), 'laptop');
});

test('adjacente ao atendente dentro do nullpoint_interior retorna "bartender"', () => {
  const mapManager = makeFakeMapManager({ col: BAR_NPC_LOCATION.originX - 1, row: BAR_NPC_LOCATION.originY });
  assert.equal(nearbyBarInteractable(mapManager), 'bartender');
});

test('longe de tudo, dentro do bar, retorna null', () => {
  const mapManager = makeFakeMapManager({ col: 1, row: 8 });
  assert.equal(nearbyBarInteractable(mapManager), null);
});
