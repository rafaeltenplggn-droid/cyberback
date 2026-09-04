import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TraceMeter, TRACE_MAX } from '../src/hackloop/trace.js';

function makeClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance(ms) {
      time += ms;
    },
  };
}

test('trace comeca em zero', () => {
  const meter = new TraceMeter();
  assert.equal(meter.value, 0);
});

test('increase sobe o trace, sem passar do teto', () => {
  const clock = makeClock();
  const meter = new TraceMeter({ now: clock.now, decayPerSecond: 0 });

  meter.increase(30);
  assert.equal(meter.value, 30);

  meter.increase(TRACE_MAX);
  assert.equal(meter.value, TRACE_MAX);
});

test('increase com valor <= 0 nao faz nada', () => {
  const clock = makeClock();
  const meter = new TraceMeter({ now: clock.now, decayPerSecond: 0 });
  meter.increase(10);
  meter.increase(0);
  meter.increase(-5);
  assert.equal(meter.value, 10);
});

test('trace decai continuamente com o tempo, na taxa configurada', () => {
  const clock = makeClock();
  const meter = new TraceMeter({ now: clock.now, decayPerSecond: 5, cooldownMs: 999999 });

  meter.increase(50);
  clock.advance(2000); // 2s de decaimento a 5/s = -10
  assert.equal(meter.value, 40);

  clock.advance(3000); // mais 3s = -15
  assert.equal(meter.value, 25);
});

test('decaimento nunca deixa o trace negativo', () => {
  const clock = makeClock();
  const meter = new TraceMeter({ now: clock.now, decayPerSecond: 10, cooldownMs: 999999 });

  meter.increase(5);
  clock.advance(10000); // decaimento muito maior que o trace atual
  assert.equal(meter.value, 0);
});

test('apos o cooldown sem novos aumentos, o trace reseta pra zero de uma vez', () => {
  const clock = makeClock();
  const meter = new TraceMeter({ now: clock.now, decayPerSecond: 1, cooldownMs: 5000 });

  meter.increase(80);
  clock.advance(4999);
  assert.ok(meter.value > 0, 'ainda nao passou o cooldown inteiro');

  clock.advance(2); // agora passou de 5000ms desde o ultimo aumento
  assert.equal(meter.value, 0);
});

test('um novo increase antes do cooldown terminar reinicia a contagem do cooldown', () => {
  const clock = makeClock();
  const meter = new TraceMeter({ now: clock.now, decayPerSecond: 1, cooldownMs: 5000 });

  meter.increase(50);
  clock.advance(4000);
  meter.increase(10); // reinicia o cooldown daqui

  clock.advance(4000); // 4s desde o segundo increase, ainda dentro do cooldown
  assert.ok(meter.value > 0);

  clock.advance(1001); // agora sim passaram 5000ms+ desde o ultimo increase
  assert.equal(meter.value, 0);
});
