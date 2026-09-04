import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SleepTracker, SLEEP_ENERGY_RESTORE, SLEEP_COOLDOWN_MS } from '../src/hackIntegration/sleepAction.js';
import { EnergyMeter } from '../src/hackloop/energy.js';

function makeClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance(ms) {
      time += ms;
    },
  };
}

test('pode dormir de cara, antes de qualquer cooldown', () => {
  const tracker = new SleepTracker();
  assert.equal(tracker.canSleep(), true);
  assert.equal(tracker.cooldownRemainingMs(), 0);
});

test('sleep() recupera SLEEP_ENERGY_RESTORE de energia e nao passa do maximo', () => {
  const clock = makeClock();
  const tracker = new SleepTracker({ now: clock.now });
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(energyMeter.max - 10); // fica com 10

  const result = tracker.sleep(energyMeter);

  assert.equal(result.success, true);
  assert.equal(energyMeter.value, 10 + SLEEP_ENERGY_RESTORE);
  assert.equal(result.energyValue, energyMeter.value);
});

test('logo depois de dormir, entra em cooldown e uma segunda tentativa e recusada', () => {
  const clock = makeClock();
  const tracker = new SleepTracker({ now: clock.now });
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(50);

  tracker.sleep(energyMeter);
  assert.equal(tracker.canSleep(), false);

  const valueBefore = energyMeter.value;
  const result = tracker.sleep(energyMeter);

  assert.equal(result.success, false);
  assert.equal(result.reason, 'cooldown');
  assert.ok(result.cooldownRemainingMs > 0);
  assert.equal(energyMeter.value, valueBefore, 'tentativa recusada nao muda a energia');
});

test('depois que o cooldown inteiro passa, da pra dormir de novo', () => {
  const clock = makeClock();
  const tracker = new SleepTracker({ now: clock.now });
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });
  energyMeter.spend(50);

  tracker.sleep(energyMeter);
  clock.advance(SLEEP_COOLDOWN_MS - 1);
  assert.equal(tracker.canSleep(), false, 'ainda faltando 1ms de cooldown');

  clock.advance(1);
  assert.equal(tracker.canSleep(), true);

  const result = tracker.sleep(energyMeter);
  assert.equal(result.success, true);
});

test('cooldownRemainingMs diminui com o tempo e some quando o cooldown acaba', () => {
  const clock = makeClock();
  const tracker = new SleepTracker({ now: clock.now });
  const energyMeter = new EnergyMeter({ regenPerSecond: 0 });

  tracker.sleep(energyMeter);
  assert.equal(tracker.cooldownRemainingMs(), SLEEP_COOLDOWN_MS);

  clock.advance(SLEEP_COOLDOWN_MS / 2);
  assert.equal(tracker.cooldownRemainingMs(), SLEEP_COOLDOWN_MS / 2);

  clock.advance(SLEEP_COOLDOWN_MS / 2);
  assert.equal(tracker.cooldownRemainingMs(), 0);
});
