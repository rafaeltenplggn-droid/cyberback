import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HackRuntime } from '../src/hackIntegration/hackRuntime.js';
import { createPlayerStats } from '../src/hackloop/playerStats.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';
import { EnergyMeter } from '../src/hackloop/energy.js';
import { ENERGY_COST_PER_TIER } from '../src/hackIntegration/energyCosts.js';
import { SLEEP_COOLDOWN_MS } from '../src/hackIntegration/sleepAction.js';
import { DRINK_COST_BYTE } from '../src/hackIntegration/drinkShop.js';
import { INFO_MINING_ENERGY_COST_RATIO } from '../src/hackIntegration/infoMining.js';
import { HIRABLE_WORKERS, WORKER_HIRE_COST_BYTE, WORKER_WORK_INTERVAL_MS } from '../src/hackIntegration/workers.js';
import { PET_COST_BYTE } from '../src/hackIntegration/pets.js';
import { BITE_TRADE_STAKE_BYTE, BITE_TRADE_PAYOUT_BYTE } from '../src/hackIntegration/biteTrade.js';
import { DRINKS, DRINK_BUFF_AMOUNT } from '../src/hackIntegration/drinkMenu.js';

function makeFakeMapManager({ mapId = 'district_07', col = 3, row = 5 } = {}) {
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
    gridcorp_tower: { col: 15, row: 2 },
    nullpoint_bar: { col: 3, row: 5 },
    ghost_row_market: { col: 7, row: 1 },
  };

  for (const [buildingId, pos] of Object.entries(adjacentCells)) {
    const mapManager = makeFakeMapManager(pos);
    const controller = makeFakeController();
    const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), rng: () => 0, hackDelayMs: 0 });

    assert.equal(runtime.nearbyHackableBuilding()?.id, buildingId);
    assert.equal(runtime.canTriggerHack(), true);

    const result = await runtime.triggerHack();
    assert.equal(result.target.id, `${buildingId}_test`);
  }
});

test('mapa errado (fora do district_07) nunca dispara o hack, mesmo com as mesmas coordenadas', () => {
  const mapManager = makeFakeMapManager({ mapId: 'gridcorp_interior', col: 3, row: 5 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.canTriggerHack(), false);
});

test('personagem em movimento (tween em andamento) nao pode disparar o hack', () => {
  const mapManager = makeFakeMapManager({ col: 3, row: 5 });
  const controller = makeFakeController({ isMoving: true });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.canTriggerHack(), false);
});

test('movimento fica bloqueado durante o hack e libera de novo quando termina (sucesso)', async () => {
  const mapManager = makeFakeMapManager({ col: 3, row: 5 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(5), rng: () => 0, hackDelayMs: 0 });

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
  const mapManager = makeFakeMapManager({ col: 3, row: 5 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(5), rng: () => 0.999999, hackDelayMs: 0 });

  const resultPromise = runtime.triggerHack();
  assert.equal(runtime.isMovementBlocked, true);

  const result = await resultPromise;
  assert.equal(result.breach.success, false);
  assert.equal(runtime.isMovementBlocked, false, 'movimento libera mesmo quando o hack falha');
});

test('playerStats evolui e a informacao aparece no informationLedger depois de um hack bem sucedido (BYTE nao muda mais direto)', async () => {
  const mapManager = makeFakeMapManager({ col: 3, row: 5 });
  const controller = makeFakeController();
  const ledger = new ByteLedger();
  const runtime = new HackRuntime({
    mapManager,
    controller,
    playerStats: createPlayerStats(5),
    ledger,
    rng: () => 0,
    hackDelayMs: 0,
  });

  assert.equal(runtime.playerStats.xp, 0);
  assert.equal(runtime.byteBalance, 0);
  assert.equal(runtime.informationTotal, 0);

  await runtime.triggerHack();

  assert.ok(runtime.playerStats.xp > 0, 'xp sobe depois de um hack bem sucedido');
  assert.equal(runtime.byteBalance, 0, 'hackear predio nao credita BYTE direto mais');
  assert.equal(runtime.informationTotal, 1, 'informacao aparece no estoque');
});

test('sem ledger, byteBalance e null (o runtime nao inventa um saldo)', () => {
  const mapManager = makeFakeMapManager({ col: 3, row: 5 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.byteBalance, null);
});

test('energyValue/energyMax ficam disponiveis e caem depois de um hack', async () => {
  const mapManager = makeFakeMapManager({ col: 15, row: 2 });
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), energyMeter, rng: () => 0, hackDelayMs: 0 });

  assert.equal(runtime.energyValue, energyMeter.max);
  assert.equal(runtime.energyMax, energyMeter.max);

  await runtime.triggerHack();

  // (15,2) e adjacente ao gridcorp_tower, tier comum
  assert.equal(runtime.energyValue, energyMeter.max - ENERGY_COST_PER_TIER.comum);
});

test('sem energyMeter, energyValue/energyMax sao null', () => {
  const mapManager = makeFakeMapManager({ col: 3, row: 5 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.energyValue, null);
  assert.equal(runtime.energyMax, null);
});

test('sem energia suficiente, o hack roda mas nao tenta o breach (energyBlocked)', async () => {
  const mapManager = makeFakeMapManager({ col: 3, row: 5 });
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(energyMeter.max - 5); // so 5, menos que o custo do gridcorp_tower (comum, 30)
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(5), energyMeter, rng: () => 0, hackDelayMs: 0 });

  const result = await runtime.triggerHack();

  assert.equal(result.energyBlocked, true);
  assert.equal(result.breach, null);
  assert.equal(runtime.isMovementBlocked, false, 'movimento libera normalmente mesmo bloqueado por energia');
});

test('mineInformation rende informacao comum e gasta um quarto da energia quando parado perto do PC no player_home', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 }); // oeste do PC (origem 7,2)
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), energyMeter, rng: () => 0, miningDelayMs: 0 });

  assert.equal(runtime.nearbyHomeInteractable(), 'pc');
  const result = await runtime.mineInformation();

  assert.equal(result.success, true);
  assert.equal(result.rarity, 'comum');
  assert.equal(result.energySpent, energyMeter.max * INFO_MINING_ENERGY_COST_RATIO);
  assert.equal(runtime.informationCounts.comum, 1);
  assert.equal(runtime.energyValue, energyMeter.max * (1 - INFO_MINING_ENERGY_COST_RATIO));
});

test('mineInformation pode falhar (rng alto) sem conceder informacao nenhuma, mas ainda gasta energia', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), energyMeter, rng: () => 0.999999, miningDelayMs: 0 });

  const result = await runtime.mineInformation();

  assert.equal(result.success, false);
  assert.equal(runtime.informationTotal, 0);
  assert.equal(result.energySpent, energyMeter.max * INFO_MINING_ENERGY_COST_RATIO);
  assert.equal(runtime.energyValue, energyMeter.max * (1 - INFO_MINING_ENERGY_COST_RATIO));
});

test('mineInformation e recusado sem energia suficiente (nao gasta nem tenta minerar)', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(energyMeter.max - 10); // so 10, menos que os 25 necessarios
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), energyMeter, rng: () => 0, miningDelayMs: 0 });

  const result = await runtime.mineInformation();

  assert.equal(result.success, false);
  assert.equal(result.reason, 'sem_energia');
  assert.equal(runtime.informationTotal, 0);
  assert.equal(runtime.energyValue, 10, 'nada foi descontado sem energia suficiente');
});

test('mineInformation bloqueia o movimento enquanto o delay de feedback esta rodando', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({
    mapManager,
    controller,
    playerStats: createPlayerStats(1),
    rng: () => 0,
    delayFn: () => new Promise((resolve) => setTimeout(resolve, 0)),
  });

  assert.equal(runtime.isMovementBlocked, false);
  const resultPromise = runtime.mineInformation();
  assert.equal(runtime.isMining, true);
  assert.equal(runtime.isMovementBlocked, true, 'minerando tambem bloqueia movimento, igual um hack de predio');

  await resultPromise;
  assert.equal(runtime.isMining, false);
  assert.equal(runtime.isMovementBlocked, false);
});

test('mineInformation e recusado fora do PC (outro mapa, ou longe dele dentro do player_home)', async () => {
  const inDistrict = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'district_07', col: 3, row: 5 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    miningDelayMs: 0,
  });
  assert.equal((await inDistrict.mineInformation()).reason, 'fora_do_pc');

  const farFromPc = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 8, row: 8 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    miningDelayMs: 0,
  });
  assert.equal((await farFromPc.mineInformation()).reason, 'fora_do_pc');
});

test('sleep recupera energia parado perto da cama, mas so fora do cooldown', () => {
  let now = 0;
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 10, row: 4 }); // oeste da cama (origem 11,4)
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
  const mapManager = makeFakeMapManager({ mapId: 'district_07', col: 3, row: 5 });
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), energyMeter });

  const result = runtime.sleep();
  assert.equal(result.success, false);
  assert.equal(result.reason, 'fora_da_cama');
});

test('buyDrink compra o energetico e recarrega a energia quando parado perto do balcao do bar', () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 7, row: 4 }); // oeste do balcao (origem 8,4)
  const controller = makeFakeController();
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), ledger, energyMeter });

  assert.equal(runtime.nearbyBarInteractable(), 'counter');
  energyMeter.spend(50); // 50/100

  const result = runtime.buyDrink();

  assert.equal(result.success, true);
  assert.equal(result.byteSpent, DRINK_COST_BYTE);
  assert.equal(runtime.energyValue, energyMeter.max);
  assert.equal(runtime.byteBalance, 100 - DRINK_COST_BYTE);
});

test('buyDrink e recusado fora do balcao (outro mapa, ou longe dele dentro do bar)', () => {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(50);

  const inDistrict = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'district_07', col: 9, row: 4 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
    energyMeter,
  });
  assert.equal(inDistrict.buyDrink().reason, 'fora_do_balcao');

  const farFromCounter = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'nullpoint_interior', col: 3, row: 5 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
    energyMeter,
  });
  assert.equal(farFromCounter.buyDrink().reason, 'fora_do_balcao');

  assert.equal(ledger.balance, 100, 'nenhuma tentativa recusada cobrou nada');
});

test('orderDrink pede um drink do cardapio novo, cobra BYTE e ativa o buff, sem mexer em energia', () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 7, row: 4 }); // oeste do balcao (origem 8,4)
  const controller = makeFakeController();
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(50); // 50/100
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), ledger, energyMeter });

  assert.equal(runtime.activeDrinkBuff, null);
  const drink = DRINKS[0];
  const result = runtime.orderDrink(drink.id);

  assert.equal(result.success, true);
  assert.equal(runtime.byteBalance, 100 - drink.costByte);
  assert.equal(runtime.energyValue, 50, 'orderDrink nao recarrega energia, diferente de buyDrink');
  assert.equal(runtime.activeDrinkBuff.stat, drink.stat);
  assert.equal(runtime.activeDrinkBuff.amount, DRINK_BUFF_AMOUNT);
});

test('orderDrink e recusado fora do balcao (mesma regra de alcance do buyDrink)', () => {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });

  const farFromCounter = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'nullpoint_interior', col: 3, row: 5 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
  });
  assert.equal(farFromCounter.orderDrink(DRINKS[0].id).reason, 'fora_do_balcao');
  assert.equal(ledger.balance, 100);
});

test('orderDrink funciona tambem parado perto do atendente (bartender)', () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 8, row: 4 }); // na frente do atendente (origem 8,3)
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  const runtime = new HackRuntime({ mapManager, controller: makeFakeController(), playerStats: createPlayerStats(1), ledger });

  const result = runtime.orderDrink(DRINKS[0].id);
  assert.equal(result.success, true);
});

test('o buff do drink afeta o hack seguinte (breach/fence), mas nunca o playerStats persistido', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 7, row: 4 });
  const controller = makeFakeController();
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  const drink = DRINKS.find((d) => d.stat === 'breachSpeed');
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(3), ledger, rng: () => 0, hackDelayMs: 0 });

  const breachSpeedBefore = runtime.playerStats.breachSpeed;
  runtime.orderDrink(drink.id);
  assert.equal(runtime.activeDrinkBuff.stat, 'breachSpeed');

  mapManager.currentMap.id = 'nullpoint_interior';
  mapManager.playerCol = 13;
  mapManager.playerRow = 4; // na frente do laptop (origem 13,3), dispara o hack remoto do bar
  const result = await runtime.triggerHack();

  assert.ok(result.breach, 'o hack rodou');
  assert.equal(runtime.playerStats.breachSpeed, breachSpeedBefore, 'stat persistido nao ganha o bonus do drink depois do hack');
});

test('triggerHack aceita um taskBuff opcional (bonus da task de sincronizacao), somado ao do drink se houver', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 13, row: 4 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(3), rng: () => 0, hackDelayMs: 0 });

  const plain = await runtime.triggerHack();

  mapManager.playerCol = 13;
  mapManager.playerRow = 4;
  const buffed = await runtime.triggerHack({ stat: 'breachSpeed', amount: 8 });

  assert.ok(buffed.breach.chance > plain.breach.chance, 'taskBuff deve aumentar a chance de breach');
  assert.equal(runtime.playerStats.breachSpeed, createPlayerStats(3).breachSpeed, 'stat persistido nao ganha o bonus da task');
});

test('triggerRemoteHack tambem aceita um taskBuff opcional', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(5), rng: () => 0, hackDelayMs: 0 });

  const result = await runtime.triggerRemoteHack('gridcorp_tower', { stat: 'breachSpeed', amount: 8 });
  assert.ok(result.breach, 'o hack remoto rodou com o taskBuff');
});

test('parado no laptop dentro do nullpoint_interior, nearbyHackableBuilding aponta pro nullpoint_bar', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 13, row: 4 }); // na frente do laptop (origem 13,3)
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), rng: () => 0, hackDelayMs: 0 });

  const entry = runtime.nearbyHackableBuilding();
  assert.equal(entry?.id, 'nullpoint_bar');
  assert.equal(runtime.canTriggerHack(), true);

  const result = await runtime.triggerHack();
  assert.equal(result.target.id, 'nullpoint_bar_test');
  assert.equal(result.target.tier, 'incomum');
});

test('longe do laptop, dentro do nullpoint_interior, nao disparava hack nenhum', () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 1, row: 8 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.nearbyHackableBuilding(), null);
  assert.equal(runtime.canTriggerHack(), false);
});

test('parado perto do atendente do bar, nearbyBarInteractable retorna "bartender" e so a compra de drink funciona (nao hackeia, nao senta)', () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 8, row: 4 }); // na frente do atendente (origem 8,3)
  const controller = makeFakeController();
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(50);
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), ledger, energyMeter });

  assert.equal(runtime.nearbyBarInteractable(), 'bartender');
  assert.equal(runtime.nearbyHackableBuilding(), null);
  assert.equal(runtime.canTriggerHack(), false);
  assert.equal(runtime.toggleSit().reason, 'fora_do_banco');

  const result = runtime.buyDrink();
  assert.equal(result.success, true);
  assert.equal(result.byteSpent, DRINK_COST_BYTE);
  assert.equal(runtime.energyValue, energyMeter.max);
});

test('toggleSit senta parado perto do banco, levanta de qualquer lugar, e levanta sozinho ao se afastar', () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 5, row: 4 }); // oeste do banco (origem 6,4)
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  assert.equal(runtime.isSitting, false);

  const sitResult = runtime.toggleSit();
  assert.equal(sitResult.success, true);
  assert.equal(sitResult.sitting, true);
  assert.equal(runtime.isSitting, true);

  const standResult = runtime.toggleSit();
  assert.equal(standResult.sitting, false);
  assert.equal(runtime.isSitting, false);
});

test('toggleSit e recusado longe do banco', () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 1, row: 8 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  const result = runtime.toggleSit();
  assert.equal(result.success, false);
  assert.equal(result.reason, 'fora_do_banco');
  assert.equal(runtime.isSitting, false);
});

test('sentado, o personagem levanta sozinho quando o jogo detecta que ele se afastou do banco', () => {
  const mapManager = makeFakeMapManager({ mapId: 'nullpoint_interior', col: 5, row: 4 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1) });

  runtime.toggleSit();
  assert.equal(runtime.isSitting, true);

  mapManager.playerCol = 1; // simula ter andado embora do banco
  mapManager.playerRow = 8;
  runtime.tick(16);

  assert.equal(runtime.isSitting, false, 'tick() detecta que saiu de perto do banco e levanta sozinho');
});

test('nao da pra disparar um segundo hack enquanto o primeiro ainda esta rodando', async () => {
  const mapManager = makeFakeMapManager({ col: 3, row: 5 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(5), rng: () => 0, hackDelayMs: 0 });

  const first = runtime.triggerHack();
  assert.equal(runtime.canTriggerHack(), false);
  assert.equal(runtime.triggerHack(), null);

  await first;
  assert.equal(runtime.canTriggerHack(), true, 'depois de terminar, um novo hack pode ser disparado');
});

test('sellInformation vende o estoque por BYTE quando parado no ponto de venda da BLACKNET', () => {
  const mapManager = makeFakeMapManager({ mapId: 'ghost_row_interior', col: 10, row: 8 }); // na frente do corretor (origem 10,7)
  const controller = makeFakeController();
  const ledger = new ByteLedger();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), ledger });

  runtime.informationLedger.add('comum', 2);
  assert.equal(runtime.nearbyBlacknetInteractable(), 'sell');

  const result = runtime.sellInformation();

  assert.equal(result.success, true);
  assert.ok(result.byteEarned > 0);
  assert.equal(runtime.byteBalance, result.byteEarned);
  assert.equal(runtime.informationTotal, 0, 'estoque zerado depois da venda');
});

test('sellInformation e recusado fora do ponto de venda, e com o estoque vazio', () => {
  const ledger = new ByteLedger();

  const farFromSellPoint = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'ghost_row_interior', col: 1, row: 8 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
  });
  farFromSellPoint.informationLedger.add('comum');
  assert.equal(farFromSellPoint.sellInformation().reason, 'fora_da_blacknet');

  const emptyStock = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'ghost_row_interior', col: 10, row: 8 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
  });
  assert.equal(emptyStock.sellInformation().reason, 'sem_informacao');
});

test('hireWorker contrata parado no PC, cobrando do ledger', () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: WORKER_HIRE_COST_BYTE });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), ledger });

  const workerId = HIRABLE_WORKERS[0].id;
  const result = runtime.hireWorker(workerId);

  assert.equal(result.success, true);
  assert.equal(runtime.byteBalance, 0);
  assert.equal(runtime.hirableWorkers.find((w) => w.id === workerId).hired, true);
});

test('hireWorker e recusado fora do PC, e sem BYTE suficiente', () => {
  const ledger = new ByteLedger();
  const farFromPc = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 8, row: 8 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
  });
  assert.equal(farFromPc.hireWorker(HIRABLE_WORKERS[0].id).reason, 'fora_do_pc');

  const brokeAtPc = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
  });
  assert.equal(brokeAtPc.hireWorker(HIRABLE_WORKERS[0].id).reason, 'byte_insuficiente');
});

test('trabalhadores contratados minerm sozinhos via tick(), mesmo com o movimento bloqueado', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: WORKER_HIRE_COST_BYTE });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), ledger, rng: () => 0, miningDelayMs: 0 });

  runtime.hireWorker(HIRABLE_WORKERS[0].id);

  const miningPromise = runtime.mineInformation();
  assert.equal(runtime.isMovementBlocked, true);
  runtime.tick(WORKER_WORK_INTERVAL_MS);
  assert.equal(runtime.informationTotal, 1, 'trabalhador contratado minerou mesmo com o jogador minerando/bloqueado');

  await miningPromise;
});

test('remoteHackTargets lista os 3 predios com o nivel minimo certo, travados ou nao pro nivel atual', () => {
  const lowLevel = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
  });
  const targets = lowLevel.remoteHackTargets;
  assert.equal(targets.length, 3);
  const byId = Object.fromEntries(targets.map((t) => [t.id, t]));
  assert.equal(byId.gridcorp_tower.locked, false, 'comum (nivel 1) esta liberado desde o inicio');
  assert.equal(byId.nullpoint_bar.locked, true, 'incomum exige nivel maior que 1');
  assert.equal(byId.ghost_row_market.locked, true, 'raro exige nivel maior que 1');

  const highLevel = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(5),
  });
  assert.ok(highLevel.remoteHackTargets.every((t) => t.locked === false), 'nivel 5 libera todos os 3');
});

test('triggerRemoteHack hackeia um predio direto do PC, sem precisar andar ate la', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), rng: () => 0, hackDelayMs: 0 });

  const result = await runtime.triggerRemoteHack('gridcorp_tower');

  assert.equal(result.target.id, 'gridcorp_tower_test');
  assert.equal(result.breach.success, true);
});

test('triggerRemoteHack e recusado fora do PC, com id invalido, ou com hack/mineracao ja em andamento', async () => {
  const outsidePc = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 8, row: 8 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
  });
  assert.equal(outsidePc.triggerRemoteHack('gridcorp_tower'), null);

  const atPc = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
  });
  assert.equal(atPc.triggerRemoteHack('predio_que_nao_existe'), null);

  const busyMining = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    rng: () => 0,
    miningDelayMs: 0,
  });
  const miningPromise = busyMining.mineInformation();
  assert.equal(busyMining.triggerRemoteHack('gridcorp_tower'), null, 'nao da pra hackear remoto enquanto ja esta minerando');
  await miningPromise;
});

test('triggerRemoteHack e triggerHack (fisico) recusam um alvo acima do nivel do jogador (levelBlocked)', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), rng: () => 0 });

  const result = await runtime.triggerRemoteHack('ghost_row_market');

  assert.equal(result.levelBlocked, true);
  assert.equal(result.requiredLevel, 5);
  assert.equal(result.playerLevel, 1);
  assert.equal(runtime.informationTotal, 0, 'nada foi hackeado de verdade');
});

test('triggerHack fisico tambem respeita a trava de nivel (mesma regra do remoto)', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'district_07', col: 3, row: 5 }); // adjacente ao nullpoint_bar, incomum
  const controller = makeFakeController();
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), rng: () => 0 });

  const result = await runtime.triggerHack();

  assert.equal(result.levelBlocked, true);
  assert.equal(result.requiredLevel, 3);
});

test('hackear (fisico ou remoto) leva o tempo de verdade configurado (hackDelayMs), bloqueando o movimento ate o fim', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const runtime = new HackRuntime({
    mapManager,
    controller,
    playerStats: createPlayerStats(1),
    rng: () => 0,
    hackDelayMs: 5000,
    delayFn: () => new Promise((resolve) => setTimeout(resolve, 0)),
  });

  assert.equal(runtime.isMovementBlocked, false);
  const resultPromise = runtime.triggerRemoteHack('gridcorp_tower');
  assert.equal(runtime.isHacking, true);
  assert.equal(runtime.isMovementBlocked, true, 'hackeando tambem bloqueia movimento, igual minerar');
  assert.ok(runtime.hackRemainingMs > 0, 'ainda falta tempo pro hack terminar');

  await resultPromise;
  assert.equal(runtime.isHacking, false);
  assert.equal(runtime.isMovementBlocked, false);
  assert.equal(runtime.hackRemainingMs, 0);
});

test('hack bloqueado por energia nao espera o hackDelayMs todo (nao faz sentido segurar so pra dizer que faltou energia)', async () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(energyMeter.max - 5); // so 5, menos que o custo do gridcorp_tower (comum, 30)
  const runtime = new HackRuntime({
    mapManager,
    controller,
    playerStats: createPlayerStats(1),
    energyMeter,
    rng: () => 0,
    hackDelayMs: 999999, // bem alto de proposito - se esperasse, o teste travaria/estouraria o timeout
  });

  const result = await runtime.triggerRemoteHack('gridcorp_tower');

  assert.equal(result.energyBlocked, true);
  assert.equal(runtime.isHacking, false);
});

test('buyPet compra o gato parado no PC, cobrando do ledger', () => {
  const mapManager = makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 });
  const controller = makeFakeController();
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: PET_COST_BYTE });
  const runtime = new HackRuntime({ mapManager, controller, playerStats: createPlayerStats(1), ledger });

  const result = runtime.buyPet('gato_laranja');

  assert.equal(result.success, true);
  assert.equal(runtime.byteBalance, 0);
  assert.equal(runtime.pets.find((p) => p.id === 'gato_laranja').owned, true);
});

test('buyPet e recusado fora do PC, e sem BYTE suficiente', () => {
  const ledger = new ByteLedger();
  const farFromPc = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 8, row: 8 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
  });
  assert.equal(farFromPc.buyPet('gato_laranja').reason, 'fora_do_pc');

  const brokeAtPc = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
  });
  assert.equal(brokeAtPc.buyPet('gato_laranja').reason, 'byte_insuficiente');
});

test('tradeBite funciona parado no PC de casa, cobrando/pagando pelo ledger', () => {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  const runtime = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'player_home', col: 6, row: 2 }), // oeste do PC (origem 7,2)
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
    rng: () => 1, // sempre sobe
  });

  const result = runtime.tradeBite('up');
  assert.equal(result.success, true);
  assert.equal(result.correct, true);
  assert.equal(runtime.byteBalance, 100 - BITE_TRADE_STAKE_BYTE + BITE_TRADE_PAYOUT_BYTE);
  assert.ok(runtime.biteHistory.length >= 2, 'o trade ja gerou um candle novo, refletido no historico');
});

test('tradeBite funciona parado no laptop do bar', () => {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  const runtime = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'nullpoint_interior', col: 13, row: 4 }), // na frente do laptop (origem 13,3)
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
    rng: () => 0, // sempre desce
  });

  const result = runtime.tradeBite('down');
  assert.equal(result.success, true);
  assert.equal(result.correct, true);
});

test('tradeBite e recusado fora do PC/laptop, sem cobrar nada', () => {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: 100 });
  const runtime = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'district_07', col: 3, row: 5 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    ledger,
  });

  const result = runtime.tradeBite('up');
  assert.equal(result.success, false);
  assert.equal(result.reason, 'fora_do_trade');
  assert.equal(ledger.balance, 100);
});

test('o mercado da BITE avanca sozinho pelo tick(), mesmo longe do PC/laptop', () => {
  const runtime = new HackRuntime({
    mapManager: makeFakeMapManager({ mapId: 'district_07', col: 3, row: 5 }),
    controller: makeFakeController(),
    playerStats: createPlayerStats(1),
    rng: () => 1,
  });

  const priceBefore = runtime.bitePrice;
  runtime.tick(4000); // BITE_CANDLE_INTERVAL_MS
  assert.ok(runtime.bitePrice > priceBefore, 'o preco avanca mesmo sem o jogador estar no trade');
});
