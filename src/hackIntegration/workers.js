// Trabalhadores contratados: os outros personagens do roster (ver
// src/character/characterRoster.js) que o jogador NAO esta controlando
// podem ser "contratados" no PC de casa pra minerar informacao sozinhos,
// em tempo real, pelo resto da partida - sem gastar a energia do jogador
// (a energia deles e sempre cheia, nunca acaba) e sem precisar do jogador
// parado no PC apertando nada. Mesma chance/raridade do minerio manual
// (ver infoMining.js), so que automatico e continuo.
//
// Nao ha nada fisico/visual no mapa - so um estoque de "quem esta
// contratado", pensado pra aparecer como uma aba com a foto de cada um
// dentro da futura tela do PC (ver o mockup do terminal de hack).
import { INFO_MINING_SUCCESS_CHANCE, INFO_MINING_RARITY } from './infoMining.js';

export const WORKER_HIRE_COST_BYTE = 150;
export const WORKER_WORK_INTERVAL_MS = 30000;

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
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this._hired = new Set();
    this._accumulatedMs = new Map();
  }

  isHired(workerId) {
    return this._hired.has(workerId);
  }

  /** Lista completa dos contrataveis, com `hired` e a passiva marcados - pronta pra UI. */
  list() {
    return HIRABLE_WORKERS.map((worker) => ({
      ...worker,
      hired: this._hired.has(worker.id),
      passive: WORKER_PASSIVES[worker.id] ?? null,
    }));
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
    return { success: true, reason: null };
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
