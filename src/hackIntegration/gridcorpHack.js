// Integracao minima do hack-loop com o mundo navegavel: SO o gridcorp_tower
// em district_07 e hackavel nesta tarefa. Nao ha sistema generico de
// "qualquer predio e hackavel" aqui de proposito - isso e prematuro antes
// de provar que a integracao ponta a ponta funciona.
//
// Consome exatamente as 4 funcoes de estagio que ja existem em
// src/hackloop/, sem reescrever nenhuma logica interna delas.
import { recon as reconStage } from '../hackloop/recon.js';
import { breach as breachStage } from '../hackloop/breach.js';
import { exfiltrate as exfiltrateStage, TIME_OVERRUN_TRACE_PENALTY_PER_DIFFICULTY } from '../hackloop/exfiltrate.js';
import { fence as fenceStage } from '../hackloop/fence.js';
import { getTier } from '../hackloop/tiers.js';

// district_07.json: prop gridcorp_tower, origin_x 1, origin_y 1, footprint 2x2.
export const GRIDCORP_TOWER_BUILDING = { originX: 1, originY: 1, footprintW: 2, footprintH: 2 };
export const GRIDCORP_TOWER_MAP_ID = 'district_07';

// Target fixo de teste pra essa integracao minima, tier raro.
export const GRIDCORP_TOWER_TARGET = { id: 'gridcorp_tower_test', tier: 'raro' };

/** Celulas ortogonalmente adjacentes ao footprint de um predio (nao inclui diagonais). */
export function isAdjacentToBuilding(col, row, building) {
  const { originX, originY, footprintW, footprintH } = building;
  const inColRange = col >= originX && col < originX + footprintW;
  const inRowRange = row >= originY && row < originY + footprintH;

  const north = inColRange && row === originY - 1;
  const south = inColRange && row === originY + footprintH;
  const west = inRowRange && col === originX - 1;
  const east = inRowRange && col === originX + footprintW;

  return north || south || west || east;
}

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

/**
 * Orquestra o fluxo completo recon -> breach -> exfiltrate -> fence usando
 * exatamente as funcoes de src/hackloop/. So decide QUANDO chamar cada
 * estagio e o que fazer com o resultado (ex: subir trace numa falha de
 * breach, algo que o proprio breach() nao faz porque nao recebe um
 * traceMeter) - nenhuma formula das 4 funcoes e alterada aqui.
 */
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

  async run(target = GRIDCORP_TOWER_TARGET) {
    if (this.isActive) {
      throw new Error('ja existe um hack em andamento');
    }

    this.result = null;
    this.status = STAGE_RECON;
    const reconResult = reconStage(target);

    this.status = STAGE_BREACHING;
    const breachResult = await breachStage(target, this.playerStats, { rng: this.rng });

    let exfiltrateResult = null;
    let fenceResult = null;

    if (breachResult.success) {
      this.status = STAGE_EXFILTRATING;
      exfiltrateResult = exfiltrateStage(target, breachResult.timeTakenMs, {
        rng: this.rng,
        traceMeter: this.traceMeter,
      });

      this.status = STAGE_FENCING;
      fenceResult = fenceStage(exfiltrateResult.loot, this.playerStats, { ledger: this.ledger });
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
