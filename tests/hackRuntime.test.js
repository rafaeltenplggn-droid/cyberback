import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HackRuntime } from '../src/hackIntegration/hackRuntime.js';
import { createPlayerStats } from '../src/hackloop/playerStats.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';
import { EnergyMeter } from '../src/hackloop/energy.js';
import { ENERGY_COST_PER_TIER } from '../src/hackIntegration/energyCosts.js';
import { SLEEP_COOLDOWN_MS } from '../src/hackIntegration/sleepAction.js';

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
  const mapManager = makeFakeMapManager({ col: 7, row: 7 }); // longe de qualquer predio
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.nearbyHackableBuilding(), null);
  assert.equal(runtime.canTriggerHack(), false);
  assert.equal(runtime.triggerHack(), null);
  assert.equal(runtime.isMovementBlocked, false);
});

test('em alcance de cada um dos 3 predios, o hack dispara com o target certo', async () => {
  const adjacentCells = {
    gridcorp_tower: { col: 0, row: 1 },
    nullpoint_bar: { col: 9, row: 4 },
    ghost_row_market: { col: 0, row: 8 },
  };

  for (const [buildingId, pos] of Object.entries(adjacentCells)) {
    const mapManager = makeFakeMapManager(pos);
    const controller = makeFakeController();
    const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), rng: () => 0 });

    assert.equal(runtime.nearbyHackableBuilding()?.id, buildingId);
    assert.equal(runtime.canTriggerHack(), true);

    const result = await runtime.triggerHack();
    assert.equal(result.target.id, `${buildingId}_test`);
  }
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

test('playerStats e byteBalance ficam disponiveis no runtime e evoluem depois de um hack bem sucedido', async () => {
  const mapManager = makeFakeMapManager({ col: 0, row: 1 });
  const controller = makeFakeController();
  const ledger = new ByteLedger();
  const runtime = new HackRuntime({
    mapManager,
    controller,
    playerStats: createPlayerStats(1),
    ledger,
    rng: () => 0,
  });

  assert.equal(runtime.playerStats.xp, 0);
  assert.equal(runtime.byteBalance, 0);

  await runtime.triggerHack();

  assert.ok(runtime.playerStats.xp > 0, 'xp sobe depois de um hack bem sucedido');
  assert.ok(runtime.byteBalance > 0, 'BYTE ganho aparece no saldo do ledger');
});

test('sem ledger, byteBalance e null (o runtime nao inventa um saldo)', () => {
  const mapManager = makeFakeMapManager({ col: 0, row: 1 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.byteBalance, null);
});

test('energyValue/energyMax ficam disponiveis e caem depois de um hack', async () => {
  const mapManager = makeFakeMapManager({ col: 0, row: 1 });
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), energyMeter, rng: () => 0 });

  assert.equal(runtime.energyValue, energyMeter.max);
  assert.equal(runtime.energyMax, energyMeter.max);

  await runtime.triggerHack();

  // (0,1) e adjacente ao gridcorp_tower, tier raro
  assert.equal(runtime.energyValue, energyMeter.max - ENERGY_COST_PER_TIER.raro);
});

test('sem energyMeter, energyValue/energyMax sao null', () => {
  const mapManager = makeFakeMapManager({ col: 0, row: 1 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.energyValue, null);
  assert.equal(runtime.energyMax, null);
});

test('sem energia suficiente, o hack roda mas nao tenta o breach (energyBlocked)', async () => {
  const mapManager = makeFakeMapManager({ col: 0, row: 1 });
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(energyMeter.max - 5); // so 5, menos que o custo do gridcorp_tower (raro, 30)
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), energyMeter, rng: () => 0 });

  const result = await runtime.triggerHack();

  assert.equal(result.energyBlocked, true);
  assert.equal(result.breach, null);
  assert.equal(runtime.isMovementBlocked, false, 'movimento libera normalmente mesmo bloqueado por energia');
});

test('buyEnergyRefill compra a recarga quando parado perto do PC no player_home', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 2, row: 3 }); // oeste do PC (origem 3,3)
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), energyMeter, ledger });

  assert.equal(runtime.nearbyHomeInteractable(), 'pc');
  energyMeter.spend(50); // 50/100
  const result = runtime.buyEnergyRefill();

  assert.equal(result.success, true);
  assert.equal(runtime.energyValue, energyMeter.max);
  assert.ok(runtime.byteBalance < 100, 'BYTE foi descontado');
});

test('buyEnergyRefill e recusado fora do PC (outro mapa, ou longe dele dentro do player_home)', () => {
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  energyMeter.spend(50);

  const inDistrict = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'district_07', col: 0, row: 1 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    energyMeter,
    ledger,
  });
  assert.equal(inDistrict.buyEnergyRefill().reason, 'fora_do_pc');

  const farFromPc = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 8, row: 8 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    energyMeter,
    ledger,
  });
  assert.equal(farFromPc.buyEnergyRefill().reason, 'fora_do_pc');

  assert.equal(energyMeter.value, 50, 'nenhuma das tentativas recusadas mexeu na energia');
});

test('sleep recupera energia parado perto da cama, mas so fora do cooldown', () => {
  let now = 0;
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 7, row: 3 }); // leste da cama (origem 6,3)
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0, now: () => now });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), energyMeter, now: () => now });

  energyMeter.spend(60); // 40/100
  assert.equal(runtime.nearbyHomeInteractable(), 'bed');

  const first = runtime.sleep();
  assert.equal(first.success, true);
  assert.equal(energyMeter.value, 65); // 40 + 25

  const second = runtime.sleep();
  assert.equal(second.success, false);
  assert.equal(second.reason, 'cooldown');
  assert.equal(energyMeter.value, 65, 'tentativa em cooldown nao muda a energia');

  now += SLEEP_COOLDOWN_MS; // passa o cooldown inteiro
  const third = runtime.sleep();
  assert.equal(third.success, true);
  assert.equal(energyMeter.value, 90); // 65 + 25
});

test('sleep e recusado fora da cama', () => {
  const mapManager = makeFakeMapManager({ mapId: 'district_07', col: 0, row: 1 });
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), energyMeter });

  const result = runtime.sleep();
  assert.equal(result.success, false);
  assert.equal(result.reason, 'fora_da_cama');
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
