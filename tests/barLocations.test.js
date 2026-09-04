import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearbyBarInteractable, BAR_MAP_ID, BAR_COUNTER_LOCATION } from '../src/hackIntegration/barLocations.js';

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

test('longe do balcao, dentro do bar, retorna null', () => {
  const mapManager = makeFakeMapManager({ col: 1, row: 8 });
  assert.equal(nearbyBarInteractable(mapManager), null);
});
