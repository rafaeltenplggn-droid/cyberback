// O ginasio da CORP (gridcorp_interior, dentro do gridcorp_tower): 4
// lutadores + o lider, direto inspirado num ginasio de Pokemon. So da pra
// desafiar um de cada vez, na ordem certa - o proximo so destranca depois
// que o anterior for vencido. Cada estagio usa a mesma task de
// sincronizacao do hack normal (ver breachTask.js), so que aqui ela
// GANHA ou PERDE de verdade: acertar derruba o lutador (credita
// Informacao, raridade crescente ate o lider - o mais raro e mais
// dificil) e destranca o proximo; errar nao penaliza nada, so nao avanca
// (pode tentar de novo a hora que quiser). Cada estagio so paga uma vez
// (e um "badge", nao e farmavel).
export const CORP_GYM_STAGES = [
  { id: 'fighter1', taskTier: 'comum', rewardRarity: 'comum' },
  { id: 'fighter2', taskTier: 'incomum', rewardRarity: 'comum' },
  { id: 'fighter3', taskTier: 'raro', rewardRarity: 'rara' },
  { id: 'fighter4', taskTier: 'epico', rewardRarity: 'rara' },
  { id: 'leader', taskTier: 'lendario', rewardRarity: 'epica' },
];

export const CORP_GYM_STAGE_REASON = {
  INVALID: 'estagio_invalido',
  OUT_OF_ORDER: 'fora_de_ordem',
};

export class CorpGymProgress {
  constructor() {
    this._defeated = new Set();
  }

  isDefeated(stageId) {
    return this._defeated.has(stageId);
  }

  /** O id do proximo estagio a desafiar (o primeiro ainda nao vencido), ou null se o ginasio inteiro ja foi vencido. */
  get currentStageId() {
    const next = CORP_GYM_STAGES.find((stage) => !this._defeated.has(stage.id));
    return next ? next.id : null;
  }

  get completed() {
    return this.currentStageId === null;
  }

  /** 'locked' (ainda nao chegou a vez), 'current' (pode desafiar agora) ou 'defeated'. */
  stageStatus(stageId) {
    if (this._defeated.has(stageId)) return 'defeated';
    return stageId === this.currentStageId ? 'current' : 'locked';
  }

  /**
   * Marca `stageId` como vencido e credita a Informacao da raridade dele -
   * so funciona se for exatamente o estagio da vez (nunca fora de ordem,
   * nunca de novo depois de ja vencido).
   */
  defeat(stageId, { informationLedger }) {
    const stage = CORP_GYM_STAGES.find((s) => s.id === stageId);
    if (!stage) {
      return { success: false, reason: CORP_GYM_STAGE_REASON.INVALID };
    }
    if (this.stageStatus(stageId) !== 'current') {
      return { success: false, reason: CORP_GYM_STAGE_REASON.OUT_OF_ORDER };
    }
    this._defeated.add(stageId);
    informationLedger.add(stage.rewardRarity);
    return { success: true, reason: null, rarity: stage.rewardRarity, gymCompleted: this.completed };
  }
}
