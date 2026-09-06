import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WorkerRoster,
  HIRABLE_WORKERS,
  WORKER_HIRE_COST_BYTE,
  WORKER_WORK_INTERVAL_MS,
  WORKER_HIRE_REASON,
} from '../src/hackIntegration/workers.js';
import { ByteLedger } from '../src/hackloop/byteLedger.js';
import { InformationLedger } from '../src/hackIntegration/informationLedger.js';

function fundedLedger(amount = WORKER_HIRE_COST_BYTE * 3) {
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount });
  return ledger;
}

test('list() comeca com todos os trabalhadores nao contratados', () => {
  const roster = new WorkerRoster();
  const list = roster.list();
  assert.equal(list.length, HIRABLE_WORKERS.length);
  assert.ok(list.every((w) => w.hired === false));
});

test('hire() contrata e cobra o custo do ledger', () => {
  const roster = new WorkerRoster();
  const ledger = fundedLedger();
  const workerId = HIRABLE_WORKERS[0].id;

  const result = roster.hire(workerId, { ledger });

  assert.equal(result.success, true);
  assert.equal(roster.isHired(workerId), true);
  assert.equal(ledger.balance, WORKER_HIRE_COST_BYTE * 3 - WORKER_HIRE_COST_BYTE);
  assert.equal(roster.list().find((w) => w.id === workerId).hired, true);
});

test('hire() e recusado sem BYTE suficiente, e nao cobra nada', () => {
  const roster = new WorkerRoster();
  const ledger = fundedLedger(WORKER_HIRE_COST_BYTE - 1);

  const result = roster.hire(HIRABLE_WORKERS[0].id, { ledger });

  assert.equal(result.success, false);
  assert.equal(result.reason, WORKER_HIRE_REASON.NOT_ENOUGH_BYTE);
  assert.equal(ledger.balance, WORKER_HIRE_COST_BYTE - 1);
});

test('hire() e recusado pra um trabalhador ja contratado, sem cobrar de novo', () => {
  const roster = new WorkerRoster();
  const ledger = fundedLedger();
  const workerId = HIRABLE_WORKERS[0].id;
  roster.hire(workerId, { ledger });

  const secondAttempt = roster.hire(workerId, { ledger });

  assert.equal(secondAttempt.success, false);
  assert.equal(secondAttempt.reason, WORKER_HIRE_REASON.ALREADY_HIRED);
  assert.equal(ledger.balance, WORKER_HIRE_COST_BYTE * 2, 'so cobrou uma vez');
});

test('hire() e recusado pra um id invalido', () => {
  const roster = new WorkerRoster();
  const ledger = fundedLedger();
  const result = roster.hire('nao_existe', { ledger });
  assert.equal(result.success, false);
  assert.equal(result.reason, WORKER_HIRE_REASON.INVALID);
});

test('podem ser contratados varios trabalhadores ao mesmo tempo', () => {
  const roster = new WorkerRoster();
  const ledger = fundedLedger();
  for (const worker of HIRABLE_WORKERS) {
    assert.equal(roster.hire(worker.id, { ledger }).success, true);
  }
  assert.ok(HIRABLE_WORKERS.every((w) => roster.isHired(w.id)));
});

test('tick() nao credita informacao de trabalhadores nao contratados', () => {
  const roster = new WorkerRoster({ rng: () => 0 });
  const informationLedger = new InformationLedger();

  roster.tick(WORKER_WORK_INTERVAL_MS * 5, { informationLedger });

  assert.equal(informationLedger.total, 0);
});

test('tick() credita informacao a cada intervalo pra cada trabalhador contratado (rng sempre sucesso)', () => {
  const roster = new WorkerRoster({ rng: () => 0 });
  const ledger = fundedLedger();
  const informationLedger = new InformationLedger();
  roster.hire(HIRABLE_WORKERS[0].id, { ledger });

  roster.tick(WORKER_WORK_INTERVAL_MS * 3, { informationLedger });

  assert.equal(informationLedger.counts.comum, 3);
});

test('tick() nao credita nada antes de completar um intervalo inteiro, e acumula entre chamadas', () => {
  const roster = new WorkerRoster({ rng: () => 0 });
  const ledger = fundedLedger();
  const informationLedger = new InformationLedger();
  roster.hire(HIRABLE_WORKERS[0].id, { ledger });

  roster.tick(WORKER_WORK_INTERVAL_MS - 1, { informationLedger });
  assert.equal(informationLedger.total, 0);

  roster.tick(1, { informationLedger });
  assert.equal(informationLedger.total, 1);
});

test('tick() pode falhar (rng alto) sem creditar informacao, mesmo com o intervalo completo', () => {
  const roster = new WorkerRoster({ rng: () => 0.999999 });
  const ledger = fundedLedger();
  const informationLedger = new InformationLedger();
  roster.hire(HIRABLE_WORKERS[0].id, { ledger });

  roster.tick(WORKER_WORK_INTERVAL_MS, { informationLedger });

  assert.equal(informationLedger.total, 0);
});

test('varios trabalhadores contratados tickam de forma independente', () => {
  const roster = new WorkerRoster({ rng: () => 0 });
  const ledger = fundedLedger();
  roster.hire(HIRABLE_WORKERS[0].id, { ledger });
  roster.hire(HIRABLE_WORKERS[1].id, { ledger });
  const informationLedger = new InformationLedger();

  roster.tick(WORKER_WORK_INTERVAL_MS, { informationLedger });

  assert.equal(informationLedger.counts.comum, 2);
});
