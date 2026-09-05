import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE, gridToScreen, screenToGrid, centerMapOrigin } from '../src/core/topdown.js';

test('gridToScreen retorna o centro visual da celula (grid quadrado 1:1)', () => {
  assert.deepEqual(gridToScreen(0, 0), { x: TILE_SIZE / 2, y: TILE_SIZE / 2 });
  assert.deepEqual(gridToScreen(1, 0), { x: TILE_SIZE + TILE_SIZE / 2, y: TILE_SIZE / 2 });
  assert.deepEqual(gridToScreen(0, 1), { x: TILE_SIZE / 2, y: TILE_SIZE + TILE_SIZE / 2 });
  assert.deepEqual(gridToScreen(5, 7), {
    x: 5 * TILE_SIZE + TILE_SIZE / 2,
    y: 7 * TILE_SIZE + TILE_SIZE / 2,
  });
});

test('gridToScreen respeita originX/originY', () => {
  assert.deepEqual(gridToScreen(2, 3, 100, 200), {
    x: 100 + 2 * TILE_SIZE + TILE_SIZE / 2,
    y: 200 + 3 * TILE_SIZE + TILE_SIZE / 2,
  });
});

test('screenToGrid e o inverso de gridToScreen (round-trip)', () => {
  const cases = [
    [0, 0],
    [1, 0],
    [0, 1],
    [5, 7],
    [15, 11],
  ];
  for (const [col, row] of cases) {
    const { x, y } = gridToScreen(col, row);
    assert.deepEqual(screenToGrid(x, y), { col, row });
  }
});

test('screenToGrid round-trip com origin nao-zero', () => {
  const { x, y } = gridToScreen(4, 9, 50, -30);
  assert.deepEqual(screenToGrid(x, y, 50, -30), { col: 4, row: 9 });
});

test('centerMapOrigin centraliza um mapa menor que o canvas nos dois eixos', () => {
  const map = { width: 16, height: 12 };
  const { originX, originY } = centerMapOrigin(map, 800, 600);
  assert.equal(originX, (800 - 16 * TILE_SIZE) / 2);
  assert.equal(originY, (600 - 12 * TILE_SIZE) / 2);
});

test('centerMapOrigin depende so de width/height/TILE_SIZE, nao de posicao de personagem', () => {
  const map = { width: 10, height: 10 };
  const first = centerMapOrigin(map, 800, 600);
  const second = centerMapOrigin(map, 800, 600);
  assert.deepEqual(first, second);
});

test('centerMapOrigin e generico: mapas diferentes geram origens diferentes', () => {
  const exterior = centerMapOrigin({ width: 16, height: 12 }, 800, 600);
  const interior = centerMapOrigin({ width: 10, height: 10 }, 800, 600);
  assert.notDeepEqual(exterior, interior);
});
