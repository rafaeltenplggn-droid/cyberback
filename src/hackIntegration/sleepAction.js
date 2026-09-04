// Dormir na cama do quarto: recupera energia na hora, de graca, mas so uma
// vez a cada tanto tempo - senao vira um jeito gratis de furar o limite de
// energia. Relogio injetavel (`now`), mesmo padrao do TraceMeter/EnergyMeter.
export const SLEEP_ENERGY_RESTORE = 25;
export const SLEEP_COOLDOWN_MS = 60000;

export class SleepTracker {
  constructor({ now = () => Date.now() } = {}) {
    this._now = now;
    this._lastSleepAt = null;
  }

  canSleep() {
    return this.cooldownRemainingMs() <= 0;
  }

  /** Quanto tempo falta pra poder dormir de novo, em ms (0 se ja pode). */
  cooldownRemainingMs() {
    if (this._lastSleepAt === null) return 0;
    const elapsed = this._now() - this._lastSleepAt;
    return Math.max(0, SLEEP_COOLDOWN_MS - elapsed);
  }

  /** Tenta dormir: recupera SLEEP_ENERGY_RESTORE de energia se nao estiver em cooldown. */
  sleep(energyMeter) {
    if (!this.canSleep()) {
      return { success: false, reason: 'cooldown', cooldownRemainingMs: this.cooldownRemainingMs() };
    }
    energyMeter.refill(SLEEP_ENERGY_RESTORE);
    this._lastSleepAt = this._now();
    return { success: true, reason: null, energyValue: energyMeter.value };
  }
}
