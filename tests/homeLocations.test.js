import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearbyHomeInteractable, PLAYER_HOME_MAP_ID, HOME_PC_LOCATION, HOME_BED_LOCATION } from '../src/hackIntegration/homeLocations.js';

function makeFakeMapManager({ mapId = PLAYER_HOME_MAP_ID, col, row }) {
  return { currentMap: { id: mapId }, playerCol: col, playerRow: row };
}

test('fora do player_home, sempre retorna null (mesmo em cima das mesmas coordenadas)', () => {
  const mapManager = makeFakeMapManager({ mapId: 'district_07', col: HOME_PC_LOCATION.originX - 1, row: HOME_PC_LOCATION.originY });
  assert.equal(nearbyHomeInteractable(mapManager), null);
});

test('adjacente ao PC dentro do player_home retorna "pc"', () => {
  const mapManager = makeFakeMapManager({ col: HOME_PC_LOCATION.originX - 1, row: HOME_PC_LOCATION.originY });
  assert.equal(nearbyHomeInteractable(mapManager), 'pc');
});

test('adjacente a cama dentro do player_home retorna "bed"', () => {
  const mapManager = makeFakeMapManager({ col: HOME_BED_LOCATION.originX + 1, row: HOME_BED_LOCATION.originY });
  assert.equal(nearbyHomeInteractable(mapManager), 'bed');
});

test('no meio do quarto, longe dos dois, retorna null', () => {
  const mapManager = makeFakeMapManager({ col: 1, row: 8 });
  assert.equal(nearbyHomeInteractable(mapManager), null);
});

test('em cima do PC (nao adjacente, dentro do footprint) retorna null - so adjacencia conta', () => {
  const mapManager = makeFakeMapManager({ col: HOME_PC_LOCATION.originX, row: HOME_PC_LOCATION.originY });
  assert.equal(nearbyHomeInteractable(mapManager), null);
});
