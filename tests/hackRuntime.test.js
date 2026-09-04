import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HackRuntime } from '../src/hackIntegration/hackRuntime.js';
import { createPlayerStats } from '../src/hackloop/playerStats.js';

function makeFakeMapManager({ mapId = 'district_07', col = 0, row = 1 } = {}) {
  return { currentMap: { id: mapId }, playerCol: col, playerRow: row };
}

function makeFakeController({ isMoving = false } = {}) {
  return {
    isMoving,
    ticks: 0,
    tick(deltaMs) {
      this.ticks += deltaMs;
    },
    enqueueInput() {},
  };
}

test('fora de alcance: canTriggerHack e false e triggerHack nao dispara nada', () => {
  const mapManager = makeFakeMapManager({ col: 8, row: 8 }); // longe do gridcorp_tower
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.canTriggerHack(), false);
  assert.equal(runtime.triggerHack(), null);
  assert.equal(runtime.isMovementBlocked, false);
});

test('em alcance, parado, em district_07: canTriggerHack e true e triggerHack dispara o hack', async () => {
  const mapManager = makeFakeMapManager({ col: 0, row: 1 }); // adjacente ao gridcorp_tower (oeste)
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), rng: () => 0 });

  assert.equal(runtime.canTriggerHack(), true);
  const resultPromise = runtime.triggerHack();
  assert.ok(resultPromise instanceof Promise);

  const result = await resultPromise;
  assert.equal(result.target.id, 'gridcorp_tower_test');
  assert.equal(result.target.tier, 'raro');
});

test('mapa errado (fora do district_07) nunca dispara o hack, mesmo com as mesmas coordenadas', () => {
  const mapManager = makeFakeMapManager({ mapId: 'gridcorp_interior', col: 0, row: 1 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.canTriggerHack(), false);
});

test('personagem em movimento (tween em andamento) nao pode disparar o hack', () => {
  const mapManager = makeFakeMapManager({ col: 0, row: 1 });
  const controller = makeFakeController({ isMoving: true });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.canTriggerHack(), false);
});

test('movimento fica bloqueado durante o hack e libera de novo quando termina (sucesso)', async () => {
  const mapManager = makeFakeMapManager({ col: 0, row: 1 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), rng: () => 0 });

  assert.equal(runtime.isMovementBlocked, false);
  runtime.tick(100);
  assert.equal(controller.ticks, 100, 'antes do hack, tick() repassa normalmente pro controller');

  const resultPromise = runtime.triggerHack();
  assert.equal(runtime.isMovementBlocked, true, 'hack em andamento bloqueia o movimento');

  runtime.tick(100);
  assert.equal(controller.ticks, 100, 'tick() nao repassa pro controller enquanto o hack esta ativo');

  await resultPromise;

  assert.equal(runtime.isMovementBlocked, false, 'movimento libera de novo ao terminar');
  runtime.tick(50);
  assert.equal(controller.ticks, 150, 'tick() volta a repassar pro controller depois do hack');
});

test('movimento fica bloqueado durante o hack e libera de novo quando termina (falha)', async () => {
  const mapManager = makeFakeMapManager({ col: 0, row: 1 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), rng: () => 0.999999 });

  const resultPromise = runtime.triggerHack();
  assert.equal(runtime.isMovementBlocked, true);

  const result = await resultPromise;
  assert.equal(result.breach.success, false);
  assert.equal(runtime.isMovementBlocked, false, 'movimento libera mesmo quando o hack falha');
});

test('nao da pra disparar um segundo hack enquanto o primeiro ainda esta rodando', async () => {
  const mapManager = makeFakeMapManager({ col: 0, row: 1 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), rng: () => 0 });

  const first = runtime.triggerHack();
  assert.equal(runtime.canTriggerHack(), false);
  assert.equal(runtime.triggerHack(), null);

  await first;
  assert.equal(runtime.canTriggerHack(), true, 'depois de terminar, um novo hack pode ser disparado');
});
