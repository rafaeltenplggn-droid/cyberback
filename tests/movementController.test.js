import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MovementController,
  DEFAULT_STEP_DURATION_MS,
  MIN_STEP_DURATION_MS,
  MAX_STEP_DURATION_MS,
} from '../src/character/movementController.js';

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeFakeMapManager({ blockedCells = new Set(), doorAt = new Map(), map = { id: 'map_a' } } = {}) {
  const manager = {
    playerCol: 0,
    playerRow: 0,
    currentMap: map,
    canEnter(col, row) {
      return !blockedCells.has(`${col},${row}`);
    },
    async tryMove(col, row) {
      if (!manager.canEnter(col, row)) {
        return { moved: false, doorTriggered: false };
      }
      const door = doorAt.get(`${col},${row}`);
      if (door) {
        manager.currentMap = { id: door.target_map };
        manager.playerCol = door.spawn_x;
        manager.playerRow = door.spawn_y;
        return { moved: true, doorTriggered: true, targetMap: door.target_map };
      }
      manager.playerCol = col;
      manager.playerRow = row;
      return { moved: true, doorTriggered: false };
    },
  };
  return manager;
}

test('constructor rejeita stepDurationMs fora de 150-180ms', () => {
  const mapManager = makeFakeMapManager();
  assert.throws(() => new MovementController(mapManager, { stepDurationMs: 100 }));
  assert.throws(() => new MovementController(mapManager, { stepDurationMs: 200 }));
  assert.doesNotThrow(() => new MovementController(mapManager, { stepDurationMs: MIN_STEP_DURATION_MS }));
  assert.doesNotThrow(() => new MovementController(mapManager, { stepDurationMs: MAX_STEP_DURATION_MS }));
});

test('enqueueInput so enfileira; a posicao logica nao muda ate o tween terminar', async () => {
  const mapManager = makeFakeMapManager();
  const controller = new MovementController(mapManager);

  controller.enqueueInput('down');
  assert.equal(controller.queueLength, 1);
  assert.equal(mapManager.playerCol, 0);
  assert.equal(mapManager.playerRow, 0);

  controller.tick(0); // consome a fila e inicia o tween, mas ainda nao decorreu tempo
  assert.equal(controller.isMoving, true);
  assert.equal(mapManager.playerRow, 0, 'posicao logica so muda no fim do tween');

  controller.tick(DEFAULT_STEP_DURATION_MS); // termina o tween
  await flushMicrotasks();

  assert.equal(controller.isMoving, false);
  assert.equal(mapManager.playerRow, 1);
});

test('input novo entra em fila e nao interrompe o tween em andamento', async () => {
  const mapManager = makeFakeMapManager();
  const controller = new MovementController(mapManager);

  controller.enqueueInput('down');
  controller.tick(0);
  assert.equal(controller.isMoving, true);
  const tweenDirectionBefore = controller.direction;

  // input novo chega no meio do tween em andamento
  controller.tick(DEFAULT_STEP_DURATION_MS / 2);
  controller.enqueueInput('right');
  assert.equal(controller.queueLength, 1, 'o input novo fica na fila, nao interrompe o tween atual');
  assert.equal(controller.isMoving, true);
  assert.equal(controller.direction, tweenDirectionBefore, 'o tween em andamento continua na direcao original');
  assert.equal(mapManager.playerRow, 0, 'posicao logica ainda nao mudou');

  controller.tick(DEFAULT_STEP_DURATION_MS / 2);
  await flushMicrotasks();

  assert.equal(mapManager.playerRow, 1, 'primeiro passo concluido');
  assert.equal(controller.isMoving, true, 'o segundo input da fila comeca a ser processado');
  assert.equal(controller.direction, 'right');

  controller.tick(DEFAULT_STEP_DURATION_MS);
  await flushMicrotasks();

  assert.equal(mapManager.playerCol, 1);
  assert.equal(mapManager.playerRow, 1);
  assert.equal(controller.isMoving, false);
});

test('colisao e checada antes de iniciar o tween, usando a mesma matriz do MapManager', async () => {
  const mapManager = makeFakeMapManager({ blockedCells: new Set(['0,1']) });
  const controller = new MovementController(mapManager);

  controller.enqueueInput('down'); // bloqueado
  controller.tick(0);

  assert.equal(controller.isMoving, false, 'movimento bloqueado nunca inicia tween');
  assert.equal(mapManager.playerRow, 0);
});

test('depois de um input bloqueado, o proximo input valido da fila e processado', async () => {
  const mapManager = makeFakeMapManager({ blockedCells: new Set(['0,1']) });
  const controller = new MovementController(mapManager);

  controller.enqueueInput('down'); // bloqueado, descartado
  controller.enqueueInput('right'); // livre
  controller.tick(0);

  assert.equal(controller.isMoving, true);
  assert.equal(controller.direction, 'right');

  controller.tick(DEFAULT_STEP_DURATION_MS);
  await flushMicrotasks();

  assert.equal(mapManager.playerCol, 1);
  assert.equal(mapManager.playerRow, 0);
});

test('pisar numa door troca de mapa via MapManager e dispara onMapChanged', async () => {
  const doorAt = new Map([['0,1', { target_map: 'gridcorp_interior', spawn_x: 5, spawn_y: 7 }]]);
  const mapManager = makeFakeMapManager({ doorAt });

  let changedTo = null;
  const controller = new MovementController(mapManager, {
    onMapChanged: (map) => {
      changedTo = map.id;
    },
  });

  controller.enqueueInput('down');
  controller.tick(0);
  controller.tick(DEFAULT_STEP_DURATION_MS);
  await flushMicrotasks();

  assert.equal(mapManager.currentMap.id, 'gridcorp_interior');
  assert.equal(mapManager.playerCol, 5);
  assert.equal(mapManager.playerRow, 7);
  assert.equal(changedTo, 'gridcorp_interior');
});

test('visualPosition interpola durante o tween e bate com a posicao logica antes/depois', async () => {
  const mapManager = makeFakeMapManager();
  const controller = new MovementController(mapManager);

  controller.enqueueInput('right');
  controller.tick(0);
  controller.tick(DEFAULT_STEP_DURATION_MS / 2);

  const midway = controller.visualPosition;
  assert.ok(midway.col > 0 && midway.col < 1, 'no meio do tween a posicao visual esta entre origem e destino');

  controller.tick(DEFAULT_STEP_DURATION_MS / 2);
  await flushMicrotasks();

  const after = controller.visualPosition;
  assert.equal(after.col, 1);
  assert.equal(after.row, 0);
});
