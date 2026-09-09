// Trabalhadores contratados: os outros personagens do roster (ver
// src/character/characterRoster.js) que o jogador NAO esta controlando
// podem ser "contratados" no PC de casa pra minerar informacao sozinhos,
// em tempo real, pelo resto da partida - sem gastar a energia do jogador
// e sem precisar do jogador parado no PC apertando nada. Mesma
// chance/raridade do minerio manual (ver infoMining.js), so que
// automatico e continuo.
//
// Alem disso, cada trabalhador contratado tem a PROPRIA energia (ver
// EnergyMeter, hackloop/energy.js - mesma classe do jogador, so que uma
// instancia separada por trabalhador) - o jogador pode mandar ele
// hackear na hora (hackNow), gastando essa energia (nunca a do
// jogador), pra um resultado extra imediato em cima do que ja rende
// sozinho com o tick() automatico.
//
// So visual dentro da BLACKNET (sentados nas mesas, ver
// blacknetLocations.js) - pensado pra aparecer como uma aba com a foto
// de cada um dentro da tela do PC.
import { INFO_MINING_SUCCESS_CHANCE, INFO_MINING_RARITY } from './infoMining.js';
import { EnergyMeter } from '../hackloop/energy.js';

export const WORKER_HIRE_COST_BYTE = 150;
export const WORKER_WORK_INTERVAL_MS = 30000;

// Energia propria de cada trabalhador: um hackNow() manual custa um
// quarto da barra cheia (4 hacks por carga total) e recarrega sozinha
// com o tempo, bem mais devagar que a do jogador - e um bonus por cima
// do minerio automatico, nao um substituto dele.
export const WORKER_ENERGY_MAX = 100;
export const WORKER_ENERGY_COST = 25;
export const WORKER_ENERGY_REGEN_PER_SECOND = 1;

export const WORKER_HACK_REASON = {
  NOT_HIRED: 'nao_contratado',
  NOT_ENOUGH_ENERGY: 'energia_insuficiente',
};

export const HIRABLE_WORKERS = [
  { id: 'character2', name: 'Ghost Netrunner' },
  { id: 'character3', name: 'Drone Engineer' },
  { id: 'character4', name: 'Corporate Spy' },
];

// Passiva pequena de cada trabalhador - so ajusta a CHANCE de sucesso do
// minerio automatico (nunca o intervalo nem a raridade, pra nao mexer em
// mais nada do resto do sistema), com um pro/contra so de flavor. Bem
// discreto de proposito (uns pontos percentuais), como pedido - nao muda
// o jogo, so da um motivo pra escolher um em vez de outro.
export const WORKER_PASSIVES = {
  character2: { chanceBonus: 0.08, description: 'Reflexos rapidos: acha informacao com mais frequencia, mas some do radar de vez em quando.' },
  character3: { chanceBonus: 0.03, description: 'Metodico e caprichoso: um pouco mais de acerto, sem exageros.' },
  character4: { chanceBonus: -0.04, description: 'Trabalha em silencio - acerta um pouco menos, mas nunca deixa rastro.' },
};

export const WORKER_HIRE_REASON = {
  ALREADY_HIRED: 'ja_contratado',
  INVALID: 'trabalhador_invalido',
  NOT_ENOUGH_BYTE: 'byte_insuficiente',
};

export class WorkerRoster {
  constructor({ rng = Math.random, now } = {}) {
    this.rng = rng;
    this._now = now;
    this._hired = new Set();
    this._accumulatedMs = new Map();
    this._energyMeters = new Map();
  }

  isHired(workerId) {
    return this._hired.has(workerId);
  }

  /** Lista completa dos contrataveis, com `hired`, a passiva e a energia atual (se contratado) marcados - pronta pra UI. */
  list() {
    return HIRABLE_WORKERS.map((worker) => {
      const hired = this._hired.has(worker.id);
      const energyMeter = this._energyMeters.get(worker.id);
      return {
        ...worker,
        hired,
        passive: WORKER_PASSIVES[worker.id] ?? null,
        energyValue: hired ? energyMeter.value : null,
        energyMax: hired ? energyMeter.max : null,
      };
    });
  }

  /** Contrata um trabalhador pagando `WORKER_HIRE_COST_BYTE` do ledger. So pode contratar cada um uma vez. */
  hire(workerId, { ledger }) {
    if (!HIRABLE_WORKERS.some((worker) => worker.id === workerId)) {
      return { success: false, reason: WORKER_HIRE_REASON.INVALID };
    }
    if (this._hired.has(workerId)) {
      return { success: false, reason: WORKER_HIRE_REASON.ALREADY_HIRED };
    }
    if (!ledger || ledger.balance < WORKER_HIRE_COST_BYTE) {
      return { success: false, reason: WORKER_HIRE_REASON.NOT_ENOUGH_BYTE };
    }
    ledger.record({ type: 'spend', amount: WORKER_HIRE_COST_BYTE, meta: { source: 'worker_hire', workerId } });
    this._hired.add(workerId);
    this._accumulatedMs.set(workerId, 0);
    this._energyMeters.set(
      workerId,
      new EnergyMeter({
        max: WORKER_ENERGY_MAX,
        regenPerSecond: WORKER_ENERGY_REGEN_PER_SECOND,
        ...(this._now ? { now: this._now } : {}),
      })
    );
    return { success: true, reason: null };
  }

  /**
   * Manda o trabalhador `workerId` hackear agora, gastando WORKER_ENERGY_COST
   * da energia PROPRIA dele (nunca a do jogador) - mesma chance/raridade do
   * minerio automatico (INFO_MINING_SUCCESS_CHANCE + a passiva dele), so
   * que o resultado sai na hora, sem esperar o tick() periodico. Sem
   * energia suficiente, recusa sem gastar nada.
   */
  hackNow(workerId, { informationLedger }) {
    if (!this._hired.has(workerId)) {
      return { success: false, reason: WORKER_HACK_REASON.NOT_HIRED, informationGained: false };
    }
    const energyMeter = this._energyMeters.get(workerId);
    if (!energyMeter.spend(WORKER_ENERGY_COST)) {
      return { success: false, reason: WORKER_HACK_REASON.NOT_ENOUGH_ENERGY, informationGained: false };
    }
    const chanceBonus = WORKER_PASSIVES[workerId]?.chanceBonus ?? 0;
    const chance = Math.min(1, Math.max(0, INFO_MINING_SUCCESS_CHANCE + chanceBonus));
    const informationGained = this.rng() < chance;
    if (informationGained) {
      informationLedger.add(INFO_MINING_RARITY);
    }
    return {
      success: true,
      reason: null,
      informationGained,
      rarity: informationGained ? INFO_MINING_RARITY : null,
      energyValue: energyMeter.value,
      energyMax: energyMeter.max,
    };
  }

  /**
   * Chamado a cada frame (deltaMs) independente de qualquer coisa que o
   * jogador esteja fazendo. Cada trabalhador contratado acumula tempo e,
   * a cada WORKER_WORK_INTERVAL_MS, tenta minerar sozinho (mesma chance
   * do PC, com a passiva de cada um somada) - sucesso credita 1
   * informacao comum no ledger compartilhado.
   */
  tick(deltaMs, { informationLedger }) {
    for (const workerId of this._hired) {
      const chanceBonus = WORKER_PASSIVES[workerId]?.chanceBonus ?? 0;
      const chance = Math.min(1, Math.max(0, INFO_MINING_SUCCESS_CHANCE + chanceBonus));
      let acc = (this._accumulatedMs.get(workerId) ?? 0) + deltaMs;
      while (acc >= WORKER_WORK_INTERVAL_MS) {
        acc -= WORKER_WORK_INTERVAL_MS;
        if (this.rng() < chance) {
          informationLedger.add(INFO_MINING_RARITY);
        }
      }
      this._accumulatedMs.set(workerId, acc);
    }
  }
}
