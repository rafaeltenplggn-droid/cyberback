import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CorpGymProgress, CORP_GYM_STAGES, CORP_GYM_STAGE_REASON } from '../src/hackIntegration/corpGym.js';
import { InformationLedger } from '../src/hackIntegration/informationLedger.js';

test('comeca com o primeiro estagio liberado e o resto trancado', () => {
  const progress = new CorpGymProgress();
  assert.equal(progress.currentStageId, CORP_GYM_STAGES[0].id);
  assert.equal(progress.stageStatus(CORP_GYM_STAGES[0].id), 'current');
  for (const stage of CORP_GYM_STAGES.slice(1)) {
    assert.equal(progress.stageStatus(stage.id), 'locked');
  }
  assert.equal(progress.completed, false);
});

test('defeat() vence o estagio da vez, credita a Informacao certa, e destranca o proximo', () => {
  const progress = new CorpGymProgress();
  const informationLedger = new InformationLedger();
  const first = CORP_GYM_STAGES[0];
  const second = CORP_GYM_STAGES[1];

  const result = progress.defeat(first.id, { informationLedger });

  assert.equal(result.success, true);
  assert.equal(result.rarity, first.rewardRarity);
  assert.equal(result.gymCompleted, false);
  assert.equal(progress.stageStatus(first.id), 'defeated');
  assert.equal(progress.stageStatus(second.id), 'current');
  assert.equal(informationLedger.counts[first.rewardRarity], 1);
});

test('defeat() recusa fora de ordem (pular estagio, ou vencer de novo o que ja passou)', () => {
  const progress = new CorpGymProgress();
  const informationLedger = new InformationLedger();
  const [first, second] = CORP_GYM_STAGES;

  const skipAhead = progress.defeat(second.id, { informationLedger });
  assert.equal(skipAhead.success, false);
  assert.equal(skipAhead.reason, CORP_GYM_STAGE_REASON.OUT_OF_ORDER);
  assert.equal(informationLedger.total, 0);

  progress.defeat(first.id, { informationLedger });
  const rematch = progress.defeat(first.id, { informationLedger });
  assert.equal(rematch.success, false);
  assert.equal(rematch.reason, CORP_GYM_STAGE_REASON.OUT_OF_ORDER);
  assert.equal(informationLedger.total, 1, 'nao credita de novo, so um badge por estagio');
});

test('defeat() recusa um id de estagio invalido', () => {
  const progress = new CorpGymProgress();
  const informationLedger = new InformationLedger();
  const result = progress.defeat('nao_existe', { informationLedger });
  assert.equal(result.success, false);
  assert.equal(result.reason, CORP_GYM_STAGE_REASON.INVALID);
});

test('vencer todos os estagios em ordem completa o ginasio, o lider por ultimo dando a raridade mais rara', () => {
  const progress = new CorpGymProgress();
  const informationLedger = new InformationLedger();

  for (const stage of CORP_GYM_STAGES.slice(0, -1)) {
    const result = progress.defeat(stage.id, { informationLedger });
    assert.equal(result.gymCompleted, false);
  }

  assert.equal(progress.completed, false);
  const leader = CORP_GYM_STAGES[CORP_GYM_STAGES.length - 1];
  assert.equal(leader.id, 'leader');
  assert.equal(leader.rewardRarity, 'epica', 'o lider da a raridade mais rara do jogo');
  assert.equal(leader.taskTier, 'lendario', 'e a task mais dificil tambem');

  const finalResult = progress.defeat(leader.id, { informationLedger });
  assert.equal(finalResult.success, true);
  assert.equal(finalResult.gymCompleted, true);
  assert.equal(progress.completed, true);
});
