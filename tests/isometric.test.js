import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridToScreen } from '../src/core/isometric.js';

test('gridToScreen aplica a formula do CYBER_SPEC.md', () => {
  const { x, y } = gridToScreen(3, 1, 0, 0);
  assert.equal(x, (3 - 1) * 32);
  assert.equal(y, (3 + 1) * 16);
});

test('gridToScreen respeita a origem', () => {
  const { x, y } = gridToScreen(0, 0, 100, 50);
  assert.equal(x, 100);
  assert.equal(y, 50);
});
