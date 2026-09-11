import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveStore, SAVE_KEY, validateSave, captureSave, restoreSave } from '../src/persistence/gameSave.js';
import { HackRuntime } from '../src/hackIntegration/hackRuntime.js';
import { createPlayerStats, addXp } from '../src/hackloop/playerStats.js';
import { EnergyMeter } from '../src/hackloop/energy.js';
import { TraceMeter } from '../src/hackloop/trace.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';

function setup() {
  const now = () => 1000;
  const mapManager = { currentMap: { id: 'district_07' }, playerCol: 5, playerRow: 6 };
  const ledger = new ByteLedger({ now });
  ledger.record({ type: 'gain', amount: 100 });
  const runtime = new HackRuntime({ mapManager, controller: { isMoving: false, tick() {} }, playerStats: createPlayerStats(), energyMeter: new EnergyMeter({ now }), traceMeter: new TraceMeter({ now }), ledger, now, rng: () => 0 });
  return { runtime, mapManager };
}

test('save restaura bens, progressao, energia e temporizadores sem cobrar ou premiar novamente', () => {
  const { runtime: r, mapManager } = setup();
  r.ledger.record({ type: 'gain', amount: 1000 });
  r.workerRoster.hire('character2', { ledger: r.ledger });
  r.workerRoster.hackNow('character2', { informationLedger: r.informationLedger });
  r.workerRoster.tick(12000, { informationLedger: r.informationLedger });
  r.petCollection.buy('gato_cinza', { ledger: r.ledger });
  r.corpGymProgress.defeat('fighter1', { informationLedger: r.informationLedger });
  r.hackSession.playerStats = addXp(r.playerStats, 145);
  r.hackSession.energyMeter.spend(80);
  r.sleepTracker.sleep(r.hackSession.energyMeter);
  r.hackSession.traceMeter.increase(30);
  r.drinkBuffTracker.order('neon_lager', { ledger: r.ledger });
  r.informationLedger.add('epica', 2);
  const save = captureSave('character3', r, mapManager);
  assert.equal(validateSave(save), true);
  const restored = setup();
  restoreSave(JSON.parse(JSON.stringify(save)), restored.runtime);
  assert.deepEqual(captureSave('character3', restored.runtime, restored.mapManager), save);
  assert.equal(restored.runtime.corpGymProgress.defeat('fighter1', { informationLedger: restored.runtime.informationLedger }).success, false);
  assert.equal(restored.runtime.workerRoster.hire('character2', { ledger: restored.runtime.ledger }).success, false);
  assert.equal(restored.runtime.sleepTracker.canSleep(), false);
});

test('save local e lido por uma nova sessao', () => {
  const storage = new Map();
  const getStorage = () => ({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
  const { runtime, mapManager } = setup();
  const save = captureSave('character1', runtime, mapManager);
  assert.equal(new SaveStore(getStorage).read(), null);
  assert.equal(new SaveStore(getStorage).write(save), true);
  assert.deepEqual(new SaveStore(getStorage).read(), save);
  assert.ok(storage.has(SAVE_KEY));
});

for (const [name, mutate] of [
  ['versao futura', s => { s.version = 2; }],
  ['saldo negativo', s => { s.byteBalance = -1; }],
  ['energia fora do limite', s => { s.energy = 101; }],
  ['XP impossivel', s => { s.xp = 100; }],
  ['inventario fracionado', s => { s.information.comum = 0.5; }],
  ['personagem desconhecido', s => { s.characterId = 'missing'; }],
  ['pet desconhecido', s => { s.pets = ['missing']; }],
  ['ginasio fora de ordem', s => { s.defeated = ['leader']; }],
  ['trabalhador duplicado', s => { s.workers = Array(2).fill({ id: 'character2', energy: 100, elapsedMs: 0 }); }],
  ['caminho de mapa invalido', s => { s.position.mapId = '../package'; }],
  ['buff invalido', s => { s.buff = { drinkId: 'missing', remainingMs: 100 }; }],
]) {
  test(`rejeita ${name} antes de alterar a partida`, () => {
    const { runtime, mapManager } = setup();
    const original = captureSave('character1', runtime, mapManager);
    const invalid = structuredClone(original);
    mutate(invalid);
    assert.equal(validateSave(invalid), false);
    assert.throws(() => restoreSave(invalid, runtime));
    assert.deepEqual(captureSave('character1', runtime, mapManager), original);
  });
}

test('JSON corrompido e preservado e bloqueia sobrescrita', () => {
  let raw = '{invalid';
  const store = new SaveStore(() => ({ getItem: () => raw, setItem: (_, value) => { raw = value; } }));
  assert.equal(store.read(), null);
  const { runtime, mapManager } = setup();
  assert.equal(store.write(captureSave('character1', runtime, mapManager)), false);
  assert.equal(raw, '{invalid');
  assert.ok(store.error);
});

test('storage bloqueado ou cheio nao interrompe o jogo', () => {
  const { runtime, mapManager } = setup();
  const save = captureSave('character1', runtime, mapManager);
  const blocked = new SaveStore(() => { throw new Error('SecurityError'); });
  assert.equal(blocked.read(), null);
  assert.equal(blocked.write(save), false);
  const full = new SaveStore(() => ({ setItem() { throw new Error('QuotaExceededError'); } }));
  assert.equal(full.write(save), false);
  assert.ok(full.error);
});
