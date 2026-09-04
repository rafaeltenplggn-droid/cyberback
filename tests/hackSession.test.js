import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HackSession, HACK_STAGES } from '../src/hackIntegration/hackSession.js';
import { HACKABLE_BUILDINGS } from '../src/hackIntegration/hackableBuildings.js';
import { createPlayerStats } from '../src/hackloop/playerStats.js';
import { TraceMeter } from '../src/hackloop/trace.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';

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

test('reset() so funciona depois que o hack termina', async () => {
  const playerStats = createPlayerStats(1);
  const session = new HackSession({ playerStats, rng: () => 0 });

  const runPromise = session.run(GRIDCORP_TARGET);
  assert.throws(() => session.reset());
  await runPromise;
  assert.doesNotThrow(() => session.reset());
  assert.equal(session.status, HACK_STAGES.IDLE);
});
