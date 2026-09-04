// Energia do jogador: cada tentativa de hack gasta energia (mesmo se
// falhar), e ela recarrega sozinha com o tempo - o oposto do trace
// (src/hackloop/trace.js), que sobe e decai. Mesmo padrao: relogio
// injetavel (`now`) pra ser 100% testavel sem depender de tempo real.
export const ENERGY_MIN = 0;
export const ENERGY_MAX = 100;
export const DEFAULT_REGEN_PER_SECOND = 2;

export class EnergyMeter {
  constructor({ max = ENERGY_MAX, regenPerSecond = DEFAULT_REGEN_PER_SECOND, now = () => Date.now() } = {}) {
    this._max = max;
    this._value = max; // comeca cheia
    this._regenPerSecond = regenPerSecond;
    this._now = now;
    this._lastUpdateAt = this._now();
  }

  get max() {
    return this._max;
  }

  /** Valor atual, aplicando a regeneracao acumulada ate agora. */
  get value() {
    this._settle();
    return this._value;
  }

  /**
   * Tenta gastar `amount` de energia. Se nao tiver energia suficiente, nao
   * gasta nada e retorna false - quem chama decide o que fazer (ex: nao
   * tentar o hack).
   */
  spend(amount) {
    this._settle();
    if (amount <= 0) return true;
    if (this._value < amount) return false;
    this._value -= amount;
    return true;
  }

  _settle() {
    const now = this._now();
    const elapsedMs = now - this._lastUpdateAt;
    this._lastUpdateAt = now;
    if (elapsedMs <= 0) return;

    const regenAmount = (elapsedMs / 1000) * this._regenPerSecond;
    this._value = Math.min(this._max, this._value + regenAmount);
  }
}
