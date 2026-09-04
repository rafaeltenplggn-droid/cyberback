import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnergyMeter, ENERGY_MAX } from '../src/hackloop/energy.js';

function makeClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance(ms) {
      time += ms;
    },
  };
}

test('comeca cheia (no maximo)', () => {
  const meter = new EnergyMeter();
  assert.equal(meter.value, ENERGY_MAX);
  assert.equal(meter.max, ENERGY_MAX);
});

test('spend com energia suficiente desconta e retorna true', () => {
  const clock = makeClock();
  const meter = new EnergyMeter({ now: clock.now, regenPerSecond: 0 });

  const ok = meter.spend(30);
  assert.equal(ok, true);
  assert.equal(meter.value, 70);
});

test('spend sem energia suficiente nao desconta nada e retorna false', () => {
  const clock = makeClock();
  const meter = new EnergyMeter({ max: 50, now: clock.now, regenPerSecond: 0 });

  meter.spend(40);
  assert.equal(meter.value, 10);

  const ok = meter.spend(20); // so tem 10
  assert.equal(ok, false);
  assert.equal(meter.value, 10, 'nao gastou nada quando recusou');
});

test('spend com valor <= 0 nao muda nada e retorna true', () => {
  const clock = makeClock();
  const meter = new EnergyMeter({ now: clock.now, regenPerSecond: 0 });

  assert.equal(meter.spend(0), true);
  assert.equal(meter.spend(-5), true);
  assert.equal(meter.value, ENERGY_MAX);
});

test('energia recarrega continuamente com o tempo, na taxa configurada', () => {
  const clock = makeClock();
  const meter = new EnergyMeter({ now: clock.now, regenPerSecond: 5 });

  meter.spend(50);
  assert.equal(meter.value, 50);

  clock.advance(2000); // 2s de recarga a 5/s = +10
  assert.equal(meter.value, 60);

  clock.advance(3000); // mais 3s = +15
  assert.equal(meter.value, 75);
});

test('a recarga nunca passa do maximo', () => {
  const clock = makeClock();
  const meter = new EnergyMeter({ max: 50, now: clock.now, regenPerSecond: 100 });

  meter.spend(5);
  clock.advance(10000); // recarga muito maior que o teto
  assert.equal(meter.value, 50);
});

test('refill adiciona energia diretamente, sem passar do maximo', () => {
  const clock = makeClock();
  const meter = new EnergyMeter({ max: 100, now: clock.now, regenPerSecond: 0 });

  meter.spend(80);
  assert.equal(meter.value, 20);

  meter.refill(30);
  assert.equal(meter.value, 50);

  meter.refill(1000); // muito mais que o necessario pra encher
  assert.equal(meter.value, 100);
});

test('refill com valor <= 0 nao muda nada', () => {
  const clock = makeClock();
  const meter = new EnergyMeter({ now: clock.now, regenPerSecond: 0 });
  meter.spend(50);
  meter.refill(0);
  meter.refill(-10);
  assert.equal(meter.value, 50);
});

test('depois de recarregar o suficiente, da pra gastar de novo', () => {
  const clock = makeClock();
  const meter = new EnergyMeter({ max: 100, now: clock.now, regenPerSecond: 10 });

  assert.equal(meter.spend(90), true);
  assert.equal(meter.spend(20), false, 'so tem 10, nao da pra gastar 20');

  clock.advance(1000); // +10 de recarga
  assert.equal(meter.spend(20), true, 'agora tem 20');
  assert.equal(meter.value, 0);
});
