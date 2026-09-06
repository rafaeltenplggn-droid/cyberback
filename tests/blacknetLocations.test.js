import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearbyBlacknetInteractable, BLACKNET_MAP_ID, BLACKNET_SELL_LOCATION } from '../src/hackIntegration/blacknetLocations.js';

function makeFakeMapManager({ mapId = BLACKNET_MAP_ID, col, row }) {
  return { currentMap: { id: mapId }, playerCol: col, playerRow: row };
}

test('fora da BLACKNET, sempre retorna null (mesmo nas mesmas coordenadas)', () => {
  const mapManager = makeFakeMapManager({ mapId: 'district_07', col: BLACKNET_SELL_LOCATION.originX - 1, row: BLACKNET_SELL_LOCATION.originY });
  assert.equal(nearbyBlacknetInteractable(mapManager), null);
});

test('adjacente ao ponto de venda dentro da BLACKNET retorna "sell"', () => {
  const mapManager = makeFakeMapManager({ col: BLACKNET_SELL_LOCATION.originX - 1, row: BLACKNET_SELL_LOCATION.originY });
  assert.equal(nearbyBlacknetInteractable(mapManager), 'sell');
});

test('longe do ponto de venda, dentro da BLACKNET, retorna null', () => {
  const mapManager = makeFakeMapManager({ col: 1, row: 8 });
  assert.equal(nearbyBlacknetInteractable(mapManager), null);
});
