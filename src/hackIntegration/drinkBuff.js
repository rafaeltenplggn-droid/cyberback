// Buff temporario do drink: da um bonus pequeno e curto num stat, sem
// mexer na progressao permanente (level/xp/stats do hackloop continuam
// intocados). Relogio injetavel, mesmo padrao do TraceMeter/EnergyMeter/
// SleepTracker.
export const DRINK_BUFF_STAT = 'breachSpeed';
export const DRINK_BUFF_AMOUNT = 2;
export const DRINK_BUFF_DURATION_MS = 60000;

export class DrinkBuffTracker {
  constructor({ now = () => Date.now() } = {}) {
    this._now = now;
    this._expiresAt = null;
  }

  isActive() {
    return this._expiresAt !== null && this._now() < this._expiresAt;
  }

  remainingMs() {
    if (!this.isActive()) return 0;
    return this._expiresAt - this._now();
  }

  activate() {
    this._expiresAt = this._now() + DRINK_BUFF_DURATION_MS;
  }

  /**
   * Devolve uma copia de `stats` com o bonus aplicado no stat do buff, se
   * estiver ativo no momento - nunca muta o `stats` recebido. E so uma
   * "visao" temporaria pro breach usar, a progressao real fica intocada.
   */
  applyTo(stats) {
    if (!this.isActive()) return stats;
    return { ...stats, [DRINK_BUFF_STAT]: stats[DRINK_BUFF_STAT] + DRINK_BUFF_AMOUNT };
  }
}
