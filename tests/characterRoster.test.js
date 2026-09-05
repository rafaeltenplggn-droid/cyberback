import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_ROSTER } from '../src/character/characterRoster.js';

test('CHARACTER_ROSTER tem os 4 personagens, cada um com id e name unicos', () => {
  assert.equal(CHARACTER_ROSTER.length, 4);
  const ids = CHARACTER_ROSTER.map((entry) => entry.id);
  const names = CHARACTER_ROSTER.map((entry) => entry.name);
  assert.equal(new Set(ids).size, 4, 'ids devem ser unicos');
  assert.equal(new Set(names).size, 4, 'names devem ser unicos');
  for (const entry of CHARACTER_ROSTER) {
    assert.equal(typeof entry.id, 'string');
    assert.equal(typeof entry.name, 'string');
    assert.ok(entry.id.length > 0);
    assert.ok(entry.name.length > 0);
  }
});
