import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMap, MapParseError } from '../src/maps/mapParser.js';

function baseMap(overrides = {}) {
  return {
    id: 'distrito_07',
    tileset: 'distrito_07',
    width: 3,
    height: 2,
    tiles: [
      [0, 0, 0],
      [0, 0, 0],
    ],
    collision: [
      [0, 0, 0],
      [0, 0, 0],
    ],
    doors: [],
    props: [],
    ...overrides,
  };
}

test('parseMap aceita um mapa valido e expõe helpers', () => {
  const map = parseMap(baseMap());
  assert.equal(map.id, 'distrito_07');
  assert.equal(map.isBlocked(0, 0), false);
  assert.equal(map.getDoorAt(0, 0), null);
});

test('tiles nunca bloqueiam por si so, mesmo com id != 0', () => {
  const map = parseMap(
    baseMap({
      tiles: [
        [3, 3, 3],
        [3, 3, 3],
      ],
    })
  );
  assert.equal(map.isBlocked(1, 1), false);
});

test('collision e uma camada binaria separada de tiles', () => {
  const map = parseMap(
    baseMap({
      collision: [
        [0, 1, 0],
        [0, 0, 0],
      ],
    })
  );
  assert.equal(map.isBlocked(1, 0), true);
  assert.equal(map.isBlocked(0, 0), false);
});

test('door registra o gatilho na celula certa e nao bloqueia por si so', () => {
  const map = parseMap(
    baseMap({
      doors: [{ x: 2, y: 1, target_map: 'gridcorp_interior', spawn_x: 3, spawn_y: 14 }],
    })
  );
  const door = map.getDoorAt(2, 1);
  assert.ok(door);
  assert.equal(door.target_map, 'gridcorp_interior');
  assert.equal(map.isBlocked(2, 1), false);
});

test('prop com collision_footprint=true bloqueia todas as celulas do footprint', () => {
  const map = parseMap(
    baseMap({
      width: 4,
      height: 4,
      tiles: Array.from({ length: 4 }, () => [0, 0, 0, 0]),
      collision: Array.from({ length: 4 }, () => [0, 0, 0, 0]),
      props: [
        {
          id: 'shop_mid',
          asset: 'shop_mid.png',
          origin_x: 1,
          origin_y: 1,
          footprint_w: 2,
          footprint_h: 2,
          collision_footprint: true,
        },
      ],
    })
  );
  assert.equal(map.isBlocked(1, 1), true);
  assert.equal(map.isBlocked(2, 2), true);
  assert.equal(map.isBlocked(0, 0), false);
});

test('prop sem collision_footprint nao bloqueia', () => {
  const map = parseMap(
    baseMap({
      props: [
        {
          id: 'streetlamp_cyan',
          asset: 'streetlamp_cyan.png',
          origin_x: 1,
          origin_y: 0,
          footprint_w: 1,
          footprint_h: 1,
          collision_footprint: false,
        },
      ],
    })
  );
  assert.equal(map.isBlocked(1, 0), false);
});

test('prop e door podem coexistir na mesma celula', () => {
  const map = parseMap(
    baseMap({
      doors: [{ x: 1, y: 0, target_map: 'outro_mapa', spawn_x: 0, spawn_y: 0 }],
      props: [
        {
          id: 'planter_green',
          asset: 'planter_green.png',
          origin_x: 1,
          origin_y: 0,
          footprint_w: 1,
          footprint_h: 1,
          collision_footprint: false,
        },
      ],
    })
  );
  assert.ok(map.getDoorAt(1, 0));
  assert.equal(map.isBlocked(1, 0), false);
});

test('rejeita tiles com dimensoes diferentes de width/height', () => {
  assert.throws(() => parseMap(baseMap({ tiles: [[0, 0]] })), MapParseError);
});

test('rejeita door fora dos limites do mapa', () => {
  assert.throws(
    () => parseMap(baseMap({ doors: [{ x: 99, y: 0, target_map: 'x', spawn_x: 0, spawn_y: 0 }] })),
    MapParseError
  );
});

test('rejeita prop cujo footprint ultrapassa os limites do mapa', () => {
  assert.throws(
    () =>
      parseMap(
        baseMap({
          props: [
            {
              id: 'shop_mid',
              asset: 'shop_mid.png',
              origin_x: 2,
              origin_y: 1,
              footprint_w: 2,
              footprint_h: 2,
              collision_footprint: true,
            },
          ],
        })
      ),
    MapParseError
  );
});
