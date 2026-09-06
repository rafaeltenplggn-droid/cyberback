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

  /** Lista completa dos contrataveis, com `hired` marcado pra cada um - pronta pra UI. */
  list() {
    return HIRABLE_WORKERS.map((worker) => ({ ...worker, hired: this._hired.has(worker.id) }));
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
   * do PC) - sucesso credita 1 informacao comum no ledger compartilhado.
   */
  tick(deltaMs, { informationLedger }) {
    for (const workerId of this._hired) {
      let acc = (this._accumulatedMs.get(workerId) ?? 0) + deltaMs;
      while (acc >= WORKER_WORK_INTERVAL_MS) {
        acc -= WORKER_WORK_INTERVAL_MS;
        if (this.rng() < INFO_MINING_SUCCESS_CHANCE) {
          informationLedger.add(INFO_MINING_RARITY);
        }
      }
      this._accumulatedMs.set(workerId, acc);
    }
  }
}
