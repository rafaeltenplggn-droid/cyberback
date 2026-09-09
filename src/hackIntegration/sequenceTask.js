// Task de sequencia ("repita a sequencia"): variante da Breach Sync
// (ver breachTask.js) pro ginasio da CORP - memoriza uma sequencia de
// setas e repete na ordem certa antes do tempo acabar. Mesmo contrato:
// puro/testavel, sem DOM aqui (a UI - setas piscando, captura de tecla -
// fica em main.js/index.html). Erra uma tecla ou estoura o tempo -> falha
// (sem bonus); acerta a sequencia inteira -> bonus de stat, mesmo formato
// do statBuff (ver drinkMenu.js/breachTask.js).
export const SEQUENCE_TASK_STAT = 'breachSpeed';

export const SEQUENCE_TASK_DIRECTIONS = ['up', 'down', 'left', 'right'];

export const SEQUENCE_TASK_TIER_PARAMS = {
  comum: { length: 3, revealMs: 600, inputMs: 6000, bonus: 8 },
  incomum: { length: 4, revealMs: 550, inputMs: 5500, bonus: 10 },
  raro: { length: 5, revealMs: 500, inputMs: 5000, bonus: 13 },
  epico: { length: 6, revealMs: 450, inputMs: 4500, bonus: 16 },
  lendario: { length: 7, revealMs: 400, inputMs: 4000, bonus: 18 },
};

export function sequenceTaskParamsForTier(tier) {
  return SEQUENCE_TASK_TIER_PARAMS[tier] ?? SEQUENCE_TASK_TIER_PARAMS.comum;
}

/** Sorteia a sequencia de direcoes - o tamanho vem do tier. */
export function generateSequence(tier, rng = Math.random) {
  const { length } = sequenceTaskParamsForTier(tier);
  return Array.from({ length }, () => SEQUENCE_TASK_DIRECTIONS[Math.floor(rng() * SEQUENCE_TASK_DIRECTIONS.length)]);
}

/** true se a tecla apertada bate com o passo `index` da sequencia. */
export function isSequenceStepCorrect(sequence, index, direction) {
  return sequence[index] === direction;
}

/**
 * Resolve uma tentativa completa: `input` e o array de direcoes que o
 * jogador apertou. Sequencia errada (ordem ou tamanho) ou incompleta ->
 * null (falha). Sequencia batida -> bonus pronto pro statBuff.
 */
export function resolveSequenceAttempt(sequence, input, tier) {
  const correct = sequence.length === input.length && sequence.every((direction, index) => direction === input[index]);
  if (!correct) return null;
  const params = sequenceTaskParamsForTier(tier);
  return { stat: SEQUENCE_TASK_STAT, amount: params.bonus };
}
