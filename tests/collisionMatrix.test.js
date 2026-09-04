import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionMatrix } from '../src/core/collisionMatrix.js';

test('celulas fora dos limites contam como bloqueadas', () => {
  const matrix = new CollisionMatrix(3, 3);
  assert.equal(matrix.isBlocked(-1, 0), true);
  assert.equal(matrix.isBlocked(3, 0), true);
});

test('blockFootprint bloqueia todas as celulas do retangulo', () => {
  const matrix = new CollisionMatrix(4, 4);
  matrix.blockFootprint(1, 1, 2, 2);
  assert.equal(matrix.isBlocked(1, 1), true);
  assert.equal(matrix.isBlocked(2, 1), true);
  assert.equal(matrix.isBlocked(1, 2), true);
  assert.equal(matrix.isBlocked(2, 2), true);
  assert.equal(matrix.isBlocked(0, 0), false);
  assert.equal(matrix.isBlocked(3, 3), false);
});

test('source inicializa a matriz a partir de uma matriz binaria', () => {
  const matrix = new CollisionMatrix(2, 2, [
    [0, 1],
    [1, 0],
  ]);
  assert.equal(matrix.isBlocked(0, 0), false);
  assert.equal(matrix.isBlocked(1, 0), true);
  assert.equal(matrix.isBlocked(0, 1), true);
  assert.equal(matrix.isBlocked(1, 1), false);
});
