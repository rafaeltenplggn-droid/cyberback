// Orquestra o fluxo completo recon -> breach -> exfiltrate -> fence usando
// exatamente as funcoes que ja existem em src/hackloop/, sem reescrever
// nenhuma logica interna delas. Generico: funciona pra qualquer target de
// qualquer predio hackavel (ver hackableBuildings.js).
import { recon as reconStage } from '../hackloop/recon.js';
import { breach as breachStage } from '../hackloop/breach.js';
import { exfiltrate as exfiltrateStage, TIME_OVERRUN_TRACE_PENALTY_PER_DIFFICULTY } from '../hackloop/exfiltrate.js';
import { fence as fenceStage } from '../hackloop/fence.js';
import { getTier } from '../hackloop/tiers.js';
import { addXp } from '../hackloop/playerStats.js';
import { xpRewardForTier } from './xpRewards.js';

const STAGE_IDLE = 'idle';
const STAGE_RECON = 'recon';
const STAGE_BREACHING = 'breaching';
const STAGE_EXFILTRATING = 'exfiltrating';
const STAGE_FENCING = 'fencing';
const STAGE_DONE = 'done';

export const HACK_STAGES = {
  IDLE: STAGE_IDLE,
  RECON: STAGE_RECON,
  BREACHING: STAGE_BREACHING,
  EXFILTRATING: STAGE_EXFILTRATING,
  FENCING: STAGE_FENCING,
  DONE: STAGE_DONE,
};

export class HackSession {
  constructor({ playerStats, traceMeter, ledger, rng } = {}) {
    this.playerStats = playerStats;
    this.traceMeter = traceMeter;
    this.ledger = ledger;
    this.rng = rng;
    this.status = STAGE_IDLE;
    this.result = null;
  }

  get isActive() {
    return this.status !== STAGE_IDLE && this.status !== STAGE_DONE;
  }

  async run(target) {
    if (this.isActive) {
      throw new Error('ja existe um hack em andamento');
    }
    if (!target) {
      throw new Error('target e obrigatorio');
    }

    this.result = null;
    this.status = STAGE_RECON;
    const reconResult = reconStage(target);

    this.status = STAGE_BREACHING;
    const breachResult = await breachStage(target, this.playerStats, { rng: this.rng });

    let exfiltrateResult = null;
    let fenceResult = null;
    let xpGained = 0;
    const levelBefore = this.playerStats?.level ?? null;

    if (breachResult.success) {
      this.status = STAGE_EXFILTRATING;
      exfiltrateResult = exfiltrateStage(target, breachResult.timeTakenMs, {
        rng: this.rng,
        traceMeter: this.traceMeter,
      });

      this.status = STAGE_FENCING;
      fenceResult = fenceStage(exfiltrateResult.loot, this.playerStats, { ledger: this.ledger });

      // Progressao: XP concedido so em hack bem sucedido. addXp() e a curva
      // de nivel que ja existe em src/hackloop/playerStats.js, nao
      // reimplementada aqui - so decidimos QUANDO conceder XP e QUANTO
      // (xpRewardForTier), a formula da curva em si continua intocada.
      if (this.playerStats) {
        xpGained = xpRewardForTier(target.tier);
        this.playerStats = addXp(this.playerStats, xpGained);
      }
    } else if (this.traceMeter) {
      // breach() nao mexe em trace (nao recebe traceMeter); falha de breach
      // ainda precisa subir o trace, entao isso e feito aqui na integracao,
      // reaproveitando a mesma constante de penalidade que exfiltrate ja usa
      // pra estouro de tempo.
      const tier = getTier(target.tier);
      this.traceMeter.increase(TIME_OVERRUN_TRACE_PENALTY_PER_DIFFICULTY * tier.difficulty);
    }

    this.status = STAGE_DONE;
    this.result = {
      target,
      recon: reconResult,
      breach: breachResult,
      exfiltrate: exfiltrateResult,
      fence: fenceResult,
      traceValue: this.traceMeter ? this.traceMeter.value : null,
      xpGained,
      leveledUp: levelBefore !== null && this.playerStats.level > levelBefore,
      playerStats: this.playerStats,
    };
    return this.result;
  }

  /** Volta pro estado idle depois de um hack concluido, liberando um novo hack. */
  reset() {
    if (this.isActive) {
      throw new Error('nao da pra resetar um hack em andamento');
    }
    this.status = STAGE_IDLE;
  }
}
