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
import { energyCostForTier } from './energyCosts.js';
import { infoRarityForTier } from './informationLedger.js';

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
  constructor({ playerStats, traceMeter, energyMeter, informationLedger, rng } = {}) {
    this.playerStats = playerStats;
    this.traceMeter = traceMeter;
    this.energyMeter = energyMeter;
    this.informationLedger = informationLedger;
    this.rng = rng;
    this.status = STAGE_IDLE;
    this.result = null;
  }

  get isActive() {
    return this.status !== STAGE_IDLE && this.status !== STAGE_DONE;
  }

  async run(target, { statBuff } = {}) {
    if (this.isActive) {
      throw new Error('ja existe um hack em andamento');
    }
    if (!target) {
      throw new Error('target e obrigatorio');
    }

    // statBuff (ver drinkMenu.js) e um bonus temporario de drink, so afeta
    // os calculos deste hack (breach/fence) - nunca o playerStats
    // persistido/nivelado, que continua intocado aqui.
    const effectiveStats =
      statBuff && this.playerStats
        ? { ...this.playerStats, [statBuff.stat]: this.playerStats[statBuff.stat] + statBuff.amount }
        : this.playerStats;

    this.result = null;
    this.status = STAGE_RECON;
    // recon e so consulta, nunca gasta energia (nem nenhum outro recurso).
    const reconResult = reconStage(target);

    const energyCost = this.energyMeter ? energyCostForTier(target.tier) : 0;
    if (this.energyMeter && !this.energyMeter.spend(energyCost)) {
      // Sem energia suficiente: o hack nem tenta o breach, ninguem rola
      // risco (falha/trace) por uma tentativa que nunca aconteceu de
      // verdade.
      this.status = STAGE_DONE;
      this.result = {
        target,
        recon: reconResult,
        breach: null,
        exfiltrate: null,
        fence: null,
        traceValue: this.traceMeter ? this.traceMeter.value : null,
        xpGained: 0,
        leveledUp: false,
        playerStats: this.playerStats,
        energyBlocked: true,
        energySpent: 0,
        energyValue: this.energyMeter.value,
      };
      return this.result;
    }

    this.status = STAGE_BREACHING;
    const breachResult = await breachStage(target, effectiveStats, { rng: this.rng });

    let exfiltrateResult = null;
    let fenceResult = null;
    let xpGained = 0;
    let informationGained = null;
    const levelBefore = this.playerStats?.level ?? null;

    if (breachResult.success) {
      this.status = STAGE_EXFILTRATING;
      exfiltrateResult = exfiltrateStage(target, breachResult.timeTakenMs, {
        rng: this.rng,
        traceMeter: this.traceMeter,
      });

      this.status = STAGE_FENCING;
      // fence() so calcula o valor equivalente do loot (usado como
      // referencia/estimativa) - nao credita mais BYTE direto no ledger. O
      // que o jogador realmente ganha e uma unidade de Informacao (ver
      // informationLedger.js), vendida depois na BLACKNET por BYTE.
      fenceResult = fenceStage(exfiltrateResult.loot, effectiveStats, {});
      if (this.informationLedger) {
        const rarity = infoRarityForTier(target.tier);
        this.informationLedger.add(rarity);
        informationGained = { rarity };
      }

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
      informationGained,
      traceValue: this.traceMeter ? this.traceMeter.value : null,
      xpGained,
      leveledUp: levelBefore !== null && this.playerStats.level > levelBefore,
      playerStats: this.playerStats,
      energyBlocked: false,
      energySpent: energyCost,
      energyValue: this.energyMeter ? this.energyMeter.value : null,
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
