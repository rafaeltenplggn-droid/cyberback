import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFrame, DIRECTION_ROWS, FRAME_POSES } from '../src/character/spriteSheet.js';

test('down/up/left usam a propria linha do sheet, sem espelhar', () => {
  for (const direction of ['down', 'up', 'left']) {
    for (const pose of FRAME_POSES) {
      const frame = getFrame(direction, pose);
      assert.equal(frame.row, DIRECTION_ROWS[direction]);
      assert.equal(frame.mirrored, false);
    }
  }
});

test('right nunca le a propria linha (row 4/index 3) do arquivo, sempre espelha left', () => {
  for (const pose of FRAME_POSES) {
    const frame = getFrame('right', pose);
    assert.equal(frame.row, DIRECTION_ROWS.left);
    assert.notEqual(frame.row, DIRECTION_ROWS.right);
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
