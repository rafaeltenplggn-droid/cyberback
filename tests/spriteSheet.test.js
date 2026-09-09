import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, DIRECTION_ROWS, FRAME_POSES } from '../src/character/spriteSheet.js';

test('down/up/right usam a propria linha do sheet, sem espelhar', () => {
  for (const direction of ['down', 'up', 'right']) {
    for (const pose of FRAME_POSES) {
      const frame = getFrame(direction, pose);
      assert.equal(frame.row, DIRECTION_ROWS[direction]);
      assert.equal(frame.mirrored, false);
    }
  }
});

test('left nunca le a propria linha (row 3/index 2) do arquivo, sempre espelha right (a arte de perfil olha pra direita)', () => {
  for (const pose of FRAME_POSES) {
    const frame = getFrame('left', pose);
    assert.equal(frame.row, DIRECTION_ROWS.right);
    assert.notEqual(frame.row, DIRECTION_ROWS.left);
    assert.equal(frame.mirrored, true);
  }
});

test('coluna do frame corresponde a pose (idle=0, step1=1, step2=2)', () => {
  assert.equal(getFrame('down', 'idle').col, 0);
  assert.equal(getFrame('down', 'step1').col, 1);
  assert.equal(getFrame('down', 'step2').col, 2);
});

test('pose ou direcao invalida lanca erro', () => {
  assert.throws(() => getFrame('down', 'correndo'));
  assert.throws(() => getFrame('diagonal', 'idle'));
});
