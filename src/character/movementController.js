// Maquina de estado de movimento em grid, conforme CYBER_SPEC.md:
// - 4 direcoes, sem diagonal, um passo por celula.
// - Tween visual de 150 a 180ms por passo.
// - A posicao logica so atualiza no fim do tween.
// - Input novo entra em fila e nao interrompe o tween em andamento.
// - Colisao e checada pela matriz que o MapManager ja carregou do mapa
//   ativo (mapManager.canEnter), nunca uma segunda fonte de verdade.
//
// Este controller NUNCA reescreve logica de mapa/porta: a posicao logica e
// a troca de sala continuam inteiramente a cargo de mapManager.tryMove.
import { DIRECTIONS, isDirection } from './directions.js';

export const MIN_STEP_DURATION_MS = 150;
export const MAX_STEP_DURATION_MS = 180;
export const DEFAULT_STEP_DURATION_MS = 165;

function lerp(from, to, t) {
  return from + (to - from) * t;
}

export class MovementController {
  constructor(mapManager, { stepDurationMs = DEFAULT_STEP_DURATION_MS, onMapChanged } = {}) {
    if (stepDurationMs < MIN_STEP_DURATION_MS || stepDurationMs > MAX_STEP_DURATION_MS) {
      throw new Error(
        `stepDurationMs deve estar entre ${MIN_STEP_DURATION_MS} e ${MAX_STEP_DURATION_MS}ms`
      );
    }

    this.mapManager = mapManager;
    this.stepDurationMs = stepDurationMs;
    this.onMapChanged = onMapChanged ?? (() => {});

    this.queue = [];
    this.direction = 'down';
    this.pose = 'idle';
    this.tween = null;
    this._finishing = false;
  }

  get isMoving() {
    return this.tween !== null;
  }

  get queueLength() {
    return this.queue.length;
  }

  /** Enfileira um input novo. Nao interrompe o tween em andamento. */
  enqueueInput(direction) {
    if (!isDirection(direction)) return;
    this.queue.push(direction);
  }

  /** Posicao visual interpolada (para render). A posicao logica fica em mapManager. */
  get visualPosition() {
    if (!this.tween) {
      return { col: this.mapManager.playerCol, row: this.mapManager.playerRow };
    }
    const t = Math.min(this.tween.elapsed / this.tween.duration, 1);
    return {
      col: lerp(this.tween.fromCol, this.tween.toCol, t),
      row: lerp(this.tween.fromRow, this.tween.toRow, t),
    };
  }

  /** Avanca a maquina de estado em deltaMs. Nao precisa ser aguardado pelo loop de render. */
  tick(deltaMs) {
    if (this.tween) {
      this.tween.elapsed += deltaMs;
      if (this.tween.elapsed >= this.tween.duration && !this._finishing) {
        this._finishStep();
        return;
      }
      if (!this._finishing) {
        const t = this.tween.elapsed / this.tween.duration;
        this.pose = t < 0.5 ? 'step1' : 'step2';
      }
      return;
    }

    if (!this._finishing) {
      this._tryStartNext();
    }
  }

  _finishStep() {
    this._finishing = true;
    const { toCol, toRow, direction } = this.tween;
    // A posicao logica so muda aqui, no fim do tween, e so atraves do
    // MapManager (unica fonte de verdade pra posicao/colisao/porta). A
    // direcao do passo vai junto pra MapManager poder exigir uma door.approach
    // especifica (ver mapManager.js).
    this.mapManager.tryMove(toCol, toRow, direction).then((result) => {
      this.tween = null;
      this.pose = 'idle';
      this._finishing = false;
      if (result.doorTriggered) {
        this.onMapChanged(this.mapManager.currentMap);
      }
      this._tryStartNext();
    });
  }

  _tryStartNext() {
    while (this.queue.length > 0) {
      const direction = this.queue.shift();
      const { dCol, dRow } = DIRECTIONS[direction];
      const fromCol = this.mapManager.playerCol;
      const fromRow = this.mapManager.playerRow;
      const toCol = fromCol + dCol;
      const toRow = fromRow + dRow;

      this.direction = direction;

      // Colisao checada ANTES de iniciar o tween, usando a matriz que o
      // mapa ativo do MapManager ja carregou.
      if (!this.mapManager.canEnter(toCol, toRow)) {
        continue;
      }

      this.tween = {
        direction,
        fromCol,
        fromRow,
        toCol,
        toRow,
        elapsed: 0,
        duration: this.stepDurationMs,
      };
      this.pose = 'step1';
      return;
    }
    this.pose = 'idle';
  }
}
