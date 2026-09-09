import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearbyBlacknetInteractable, BLACKNET_MAP_ID, BLACKNET_BROKER_LOCATION } from '../src/hackIntegration/blacknetLocations.js';

function makeFakeMapManager({ mapId = BLACKNET_MAP_ID, col, row }) {
  return { currentMap: { id: mapId }, playerCol: col, playerRow: row };
}

test('fora da BLACKNET, sempre retorna null (mesmo nas mesmas coordenadas)', () => {
  const mapManager = makeFakeMapManager({
    mapId: 'district_07',
    col: BLACKNET_BROKER_LOCATION.originX,
    row: BLACKNET_BROKER_LOCATION.originY + BLACKNET_BROKER_LOCATION.footprintH,
  });
  assert.equal(nearbyBlacknetInteractable(mapManager), null);
});

test('na frente do corretor (ao sul dele) dentro da BLACKNET retorna "sell"', () => {
  const mapManager = makeFakeMapManager({
    col: BLACKNET_BROKER_LOCATION.originX,
    row: BLACKNET_BROKER_LOCATION.originY + BLACKNET_BROKER_LOCATION.footprintH,
  });
  assert.equal(nearbyBlacknetInteractable(mapManager), 'sell');
});

test('dos outros lados do corretor (nunca de frente) nao retorna "sell"', () => {
  const north = makeFakeMapManager({ col: BLACKNET_BROKER_LOCATION.originX, row: BLACKNET_BROKER_LOCATION.originY - 1 });
  const west = makeFakeMapManager({ col: BLACKNET_BROKER_LOCATION.originX - 1, row: BLACKNET_BROKER_LOCATION.originY });
  const east = makeFakeMapManager({ col: BLACKNET_BROKER_LOCATION.originX + BLACKNET_BROKER_LOCATION.footprintW, row: BLACKNET_BROKER_LOCATION.originY });
  assert.notEqual(nearbyBlacknetInteractable(north), 'sell');
  assert.notEqual(nearbyBlacknetInteractable(west), 'sell');
  assert.notEqual(nearbyBlacknetInteractable(east), 'sell');
});

test('longe do corretor, dentro da BLACKNET, retorna null', () => {
  const mapManager = makeFakeMapManager({ col: 1, row: 8 });
  assert.equal(nearbyBlacknetInteractable(mapManager), null);
});
