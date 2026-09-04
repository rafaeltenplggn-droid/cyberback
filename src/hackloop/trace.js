// Trace do jogador: sobe em falha de breach ou estouro de janela de tempo,
// decai continuamente, e reseta pra zero apos um cooldown sem novos
// aumentos. Relogio injetavel (`now`) pra ser 100% testavel sem depender
// de tempo real.
export const TRACE_MIN = 0;
export const TRACE_MAX = 100;
export const DEFAULT_DECAY_PER_SECOND = 2;
export const DEFAULT_COOLDOWN_MS = 8000;

export class TraceMeter {
  constructor({ decayPerSecond = DEFAULT_DECAY_PER_SECOND, cooldownMs = DEFAULT_COOLDOWN_MS, now = () => Date.now() } = {}) {
    this._value = 0;
    this._decayPerSecond = decayPerSecond;
    this._cooldownMs = cooldownMs;
    this._now = now;
    this._lastIncreaseAt = null;
    this._lastUpdateAt = this._now();
  }

  /** Valor atual, aplicando decaimento/cooldown acumulado ate agora. */
  get value() {
    this._settle();
    return this._value;
  }

  /** Sobe o trace (falha de breach ou estouro de tempo em exfiltrate). */
  increase(amount) {
    if (amount <= 0) return this.value;
    this._settle();
    this._value = Math.min(TRACE_MAX, this._value + amount);
    this._lastIncreaseAt = this._now();
    return this._value;
  }

  _settle() {
    const now = this._now();
    const elapsedMs = now - this._lastUpdateAt;
    this._lastUpdateAt = now;
    if (elapsedMs <= 0) return;

    if (this._lastIncreaseAt !== null && now - this._lastIncreaseAt >= this._cooldownMs) {
      this._value = TRACE_MIN;
      this._lastIncreaseAt = null;
      return;
    }

    const decayAmount = (elapsedMs / 1000) * this._decayPerSecond;
    this._value = Math.max(TRACE_MIN, this._value - decayAmount);
  }
}
