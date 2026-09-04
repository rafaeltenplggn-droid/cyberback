import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HackSession, HACK_STAGES } from '../src/hackIntegration/hackSession.js';
import { HACKABLE_BUILDINGS } from '../src/hackIntegration/hackableBuildings.js';
import { XP_REWARD_PER_TIER } from '../src/hackIntegration/xpRewards.js';
import { createPlayerStats, xpRequiredForLevel } from '../src/hackloop/playerStats.js';
import { TraceMeter } from '../src/hackloop/trace.js';
import { EnergyMeter } from '../src/hackloop/energy.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';
import { ENERGY_COST_PER_TIER } from '../src/hackIntegration/energyCosts.js';
import { DrinkBuffTracker } from '../src/hackIntegration/drinkBuff.js';
import { breachSuccessChance } from '../src/hackloop/breach.js';
import { getTier } from '../src/hackloop/tiers.js';

function makeClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance(ms) {
      time += ms;
    },
  };
}

const GRIDCORP_TARGET = HACKABLE_BUILDINGS.find((b) => b.id === 'gridcorp_tower').target;

test('HackSession.run exige um target', async () => {
  const session = new HackSession({ playerStats: createPlayerStats(1) });
  await assert.rejects(() => session.run());
});

test('HackSession.run: fluxo completo com sucesso chama recon -> breach -> exfiltrate -> fence e grava no ledger', async () => {
  const playerStats = createPlayerStats(5);
  const traceMeter = new TraceMeter();
  const ledger = new ByteLedger();
  const session = new HackSession({ playerStats, traceMeter, ledger, rng: () => 0 });

  assert.equal(session.status, HACK_STAGES.IDLE);
  const resultPromise = session.run(GRIDCORP_TARGET);
  // logo apos chamar run(), recon e a parte sincrona de breach ja rodaram
  assert.equal(session.status, HACK_STAGES.BREACHING);

  const result = await resultPromise;

  assert.equal(session.status, HACK_STAGES.DONE);
  assert.equal(result.breach.success, true);
  assert.ok(result.recon.estimatedLoot.min > 0, 'recon rodou e trouxe uma estimativa');
  assert.ok(result.exfiltrate, 'exfiltrate rodou porque o breach teve sucesso');
  assert.ok(result.fence, 'fence rodou porque exfiltrate rodou');
  assert.equal(result.fence.byteAmount, ledger.entries[0].amount);
  assert.equal(ledger.entries.length, 1);
  assert.equal(ledger.entries[0].type, 'gain');
});

test('HackSession.run: falha no breach nao chama exfiltrate/fence e sobe o trace', async () => {
  const playerStats = createPlayerStats(1);
  const traceMeter = new TraceMeter();
  const ledger = new ByteLedger();
  const session = new HackSession({ playerStats, traceMeter, ledger, rng: () => 0.999999 });

  assert.equal(traceMeter.value, 0);
  const result = await session.run(GRIDCORP_TARGET);

  assert.equal(result.breach.success, false);
  assert.equal(result.exfiltrate, null);
  assert.equal(result.fence, null);
  assert.equal(ledger.entries.length, 0, 'nada e vendido se o breach falhou');
  assert.ok(traceMeter.value > 0, 'trace sobe numa falha de breach');
});

test('HackSession.run funciona igual pra qualquer um dos 3 predios (target so muda o tier)', async () => {
  for (const entry of HACKABLE_BUILDINGS) {
    const playerStats = createPlayerStats(5);
    const session = new HackSession({ playerStats, rng: () => 0 });
    const result = await session.run(entry.target);
    assert.equal(result.target.tier, entry.target.tier);
    assert.equal(result.breach.success, true);
  }
});

test('HackSession.run rejeita disparar um segundo hack enquanto o primeiro esta ativo', async () => {
  const playerStats = createPlayerStats(1);
  const session = new HackSession({ playerStats, rng: () => 0 });

  const first = session.run(GRIDCORP_TARGET);
  // run() e assincrona, entao um segundo disparo enquanto a primeira esta
  // ativa rejeita a Promise (nunca lanca sincronamente).
  await assert.rejects(() => session.run(GRIDCORP_TARGET));
  await first;
});

test('hack bem sucedido concede XP (proporcional ao tier) e atualiza playerStats.xp', async () => {
  const playerStats = createPlayerStats(1);
  const session = new HackSession({ playerStats, rng: () => 0 });

  const result = await session.run(GRIDCORP_TARGET);

  assert.equal(result.xpGained, XP_REWARD_PER_TIER.raro);
  assert.equal(result.playerStats.xp, XP_REWARD_PER_TIER.raro);
  assert.equal(session.playerStats.xp, XP_REWARD_PER_TIER.raro, 'a sessao guarda os stats atualizados pro proximo hack');
});

test('hack que falha no breach nao concede XP nenhum', async () => {
  const playerStats = createPlayerStats(1);
  const session = new HackSession({ playerStats, rng: () => 0.999999 });

  const result = await session.run(GRIDCORP_TARGET);

  assert.equal(result.breach.success, false);
  assert.equal(result.xpGained, 0);
  assert.equal(result.playerStats.xp, 0);
  assert.equal(result.leveledUp, false);
});

test('xp suficiente sobe de nivel e result.leveledUp fica true so nesse hack', async () => {
  const playerStats = createPlayerStats(1);
  const session = new HackSession({ playerStats, rng: () => 0 });
  const needed = xpRequiredForLevel(1);

  let lastResult;
  let hacksNeeded = 0;
  while (session.playerStats.level === 1) {
    lastResult = await session.run(GRIDCORP_TARGET);
    session.reset();
    hacksNeeded += 1;
    if (hacksNeeded > 20) throw new Error('nao deveria precisar de tantos hacks pra subir de nivel');
  }

  assert.equal(lastResult.leveledUp, true);
  assert.equal(session.playerStats.level, 2);
  assert.ok(needed > 0);
});

test('level up tambem sobe os stats do jogador (breachSpeed etc), reaproveitando addXp do hackloop', async () => {
  const playerStats = createPlayerStats(1);
  const breachSpeedBefore = playerStats.breachSpeed;
  const session = new HackSession({ playerStats, rng: () => 0 });

  let result;
  do {
    result = await session.run(GRIDCORP_TARGET);
    if (!result.leveledUp) session.reset();
  } while (!result.leveledUp);

  assert.ok(result.playerStats.breachSpeed > breachSpeedBefore);
});

test('hack bem sucedido gasta energia proporcional ao tier', async () => {
  const playerStats = createPlayerStats(5);
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const session = new HackSession({ playerStats, energyMeter, rng: () => 0 });

  const result = await session.run(GRIDCORP_TARGET);

  assert.equal(result.energyBlocked, false);
  assert.equal(result.energySpent, ENERGY_COST_PER_TIER.raro);
  assert.equal(energyMeter.value, energyMeter.max - ENERGY_COST_PER_TIER.raro);
  assert.equal(result.energyValue, energyMeter.value);
});

test('hack que falha no breach tambem gasta energia (a tentativa aconteceu)', async () => {
  const playerStats = createPlayerStats(1);
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  const session = new HackSession({ playerStats, energyMeter, rng: () => 0.999999 });

  const result = await session.run(GRIDCORP_TARGET);

  assert.equal(result.breach.success, false);
  assert.equal(result.energySpent, ENERGY_COST_PER_TIER.raro);
  assert.equal(energyMeter.value, energyMeter.max - ENERGY_COST_PER_TIER.raro);
});

test('sem energia suficiente, o hack nem tenta o breach: nao gasta xp, nem trace, nem energia', async () => {
  const playerStats = createPlayerStats(1);
  const traceMeter = new TraceMeter();
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(energyMeter.max - 5); // deixa so 5, menos que o custo do raro

  const session = new HackSession({ playerStats, traceMeter, energyMeter, rng: () => 0.999999 });
  const result = await session.run(GRIDCORP_TARGET);

  assert.equal(result.energyBlocked, true);
  assert.equal(result.breach, null);
  assert.equal(result.exfiltrate, null);
  assert.equal(result.fence, null);
  assert.equal(result.xpGained, 0);
  assert.equal(result.energySpent, 0);
  assert.equal(energyMeter.value, 5, 'nada foi descontado numa tentativa bloqueada');
  assert.equal(traceMeter.value, 0, 'sem tentativa de breach, trace nao sobe');
  assert.ok(result.recon, 'recon e gratis, roda mesmo bloqueado por energia');
});

test('depois de recarregar energia suficiente, o proximo hack ja funciona normalmente', async () => {
  const clock = makeClock();
  const playerStats = createPlayerStats(5);
  const energyMeter = new EnergyMeter({ now: clock.now, regenPerSecond: 10 });
  energyMeter.spend(energyMeter.max - 5); // so 5 de energia, insuficiente pro raro (30)

  const session = new HackSession({ playerStats, energyMeter, rng: () => 0 });

  const blockedResult = await session.run(GRIDCORP_TARGET);
  assert.equal(blockedResult.energyBlocked, true);
  session.reset();

  clock.advance(5000); // +50 de energia
  const okResult = await session.run(GRIDCORP_TARGET);
  assert.equal(okResult.energyBlocked, false);
  assert.equal(okResult.breach.success, true);
});

test('drink ativo aumenta a chance de sucesso do breach o suficiente pra virar um roll que antes falhava', async () => {
  const tier = getTier(GRIDCORP_TARGET.tier);
  const baseStats = createPlayerStats(1);
  const buffedStats = { ...baseStats, breachSpeed: baseStats.breachSpeed + 2 };

  const unbuffedChance = breachSuccessChance(baseStats, tier);
  const buffedChance = breachSuccessChance(buffedStats, tier);
  assert.ok(buffedChance > unbuffedChance, 'pre-condicao: o buff realmente aumenta a chance calculada pelo hackloop');

  const roll = (unbuffedChance + buffedChance) / 2; // entre as duas chances

  const withoutBuff = new HackSession({ playerStats: createPlayerStats(1), rng: () => roll });
  const withoutResult = await withoutBuff.run(GRIDCORP_TARGET);
  assert.equal(withoutResult.breach.success, false, 'sem buff, esse roll deveria falhar');

  const drinkBuffTracker = new DrinkBuffTracker();
  drinkBuffTracker.activate();
  const withBuff = new HackSession({ playerStats: createPlayerStats(1), drinkBuffTracker, rng: () => roll });
  const withResult = await withBuff.run(GRIDCORP_TARGET);
  assert.equal(withResult.breach.success, true, 'com o buff ativo, o mesmo roll deveria ter sucesso');
  assert.equal(withResult.drinkBuffActive, true);
});

test('o buff do drink nao muda os stats permanentes do jogador, so a chance daquele breach', async () => {
  const playerStats = createPlayerStats(1);
  const drinkBuffTracker = new DrinkBuffTracker();
  drinkBuffTracker.activate();
  const session = new HackSession({ playerStats, drinkBuffTracker, rng: () => 0 });

  const result = await session.run(GRIDCORP_TARGET);

  assert.equal(session.playerStats.breachSpeed, playerStats.breachSpeed, 'breachSpeed permanente nao mudou');
  assert.equal(result.playerStats.breachSpeed, playerStats.breachSpeed);
});

test('sem buff ativo, drinkBuffActive vem false no resultado', async () => {
  const drinkBuffTracker = new DrinkBuffTracker(); // nunca ativado
  const session = new HackSession({ playerStats: createPlayerStats(1), drinkBuffTracker, rng: () => 0 });
  const result = await session.run(GRIDCORP_TARGET);
  assert.equal(result.drinkBuffActive, false);
});

test('reset() so funciona depois que o hack termina', async () => {
  const playerStats = createPlayerStats(1);
  const session = new HackSession({ playerStats, rng: () => 0 });

  const runPromise = session.run(GRIDCORP_TARGET);
  assert.throws(() => session.reset());
  await runPromise;
  assert.doesNotThrow(() => session.reset());
  assert.equal(session.status, HACK_STAGES.IDLE);
});
