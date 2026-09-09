import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSequence,
  isSequenceStepCorrect,
  resolveSequenceAttempt,
  sequenceTaskParamsForTier,
  SEQUENCE_TASK_DIRECTIONS,
} from '../src/hackIntegration/sequenceTask.js';

test('sequenceTaskParamsForTier: cresce em tamanho e velocidade a cada tier, cai pro comum se tier desconhecido', () => {
  const tiers = ['comum', 'incomum', 'raro', 'epico', 'lendario'];
  let prevLength = 0;
  let prevRevealMs = Infinity;
  for (const tier of tiers) {
    const params = sequenceTaskParamsForTier(tier);
    assert.ok(params.length > prevLength, `${tier} devia ter sequencia mais longa que a anterior`);
    assert.ok(params.revealMs <= prevRevealMs, `${tier} devia revelar mais rapido (ou igual) que a anterior`);
    prevLength = params.length;
    prevRevealMs = params.revealMs;
  }
  assert.deepEqual(sequenceTaskParamsForTier('tier_desconhecido'), sequenceTaskParamsForTier('comum'));
});

test('generateSequence: tamanho bate com o tier, e so usa direcoes validas', () => {
  const sequence = generateSequence('raro', () => 0.999);
  assert.equal(sequence.length, sequenceTaskParamsForTier('raro').length);
  for (const direction of sequence) {
    assert.ok(SEQUENCE_TASK_DIRECTIONS.includes(direction));
  }
});

test('generateSequence: rng determinístico sempre no mesmo valor gera a mesma direcao repetida', () => {
  const sequence = generateSequence('comum', () => 0);
  assert.deepEqual(sequence, ['up', 'up', 'up']);
});

test('isSequenceStepCorrect: compara so o passo pedido', () => {
  const sequence = ['up', 'left', 'down'];
  assert.equal(isSequenceStepCorrect(sequence, 0, 'up'), true);
  assert.equal(isSequenceStepCorrect(sequence, 1, 'up'), false);
  assert.equal(isSequenceStepCorrect(sequence, 2, 'down'), true);
});

test('resolveSequenceAttempt: sequencia certa (ordem e tamanho) credita o bonus do tier', () => {
  const sequence = ['up', 'left', 'down'];
  const result = resolveSequenceAttempt(sequence, ['up', 'left', 'down'], 'comum');
  assert.deepEqual(result, { stat: 'breachSpeed', amount: sequenceTaskParamsForTier('comum').bonus });
});

test('resolveSequenceAttempt: ordem errada, tamanho errado ou incompleta -> null', () => {
  const sequence = ['up', 'left', 'down'];
  assert.equal(resolveSequenceAttempt(sequence, ['left', 'up', 'down'], 'comum'), null);
  assert.equal(resolveSequenceAttempt(sequence, ['up', 'left'], 'comum'), null);
  assert.equal(resolveSequenceAttempt(sequence, ['up', 'left', 'down', 'right'], 'comum'), null);
});
