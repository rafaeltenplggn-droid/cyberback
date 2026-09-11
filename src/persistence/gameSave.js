import { createPlayerStats, xpRequiredForLevel } from '../hackloop/playerStats.js';
import { HIRABLE_WORKERS, WORKER_WORK_INTERVAL_MS } from '../hackIntegration/workers.js';
import { PETS } from '../hackIntegration/pets.js';
import { CORP_GYM_STAGES } from '../hackIntegration/corpGym.js';
import { DRINKS, DRINK_BUFF_DURATION_MS } from '../hackIntegration/drinkMenu.js';
import { SLEEP_COOLDOWN_MS } from '../hackIntegration/sleepAction.js';
import { CHARACTER_ROSTER } from '../character/characterRoster.js';

export const SAVE_KEY = 'cyberback.save.v1';
const numberIn = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const integerIn = (v, min, max) => Number.isSafeInteger(v) && numberIn(v, min, max);
const uniqueIds = (ids, allowed) => Array.isArray(ids) && ids.length <= allowed.length && new Set(ids).size === ids.length && ids.every(id => allowed.includes(id));

// Valida tudo antes de aplicar: um arquivo incompleto nunca restaura meia partida.
export function validateSave(s) {
  if (!s || s.version !== 1 || !CHARACTER_ROSTER.some(c => c.id === s.characterId)) return false;
  if (!integerIn(s.level, 1, 1000) || !integerIn(s.xp, 0, xpRequiredForLevel(s.level) - 1)) return false;
  if (!numberIn(s.byteBalance, 0, Number.MAX_SAFE_INTEGER) || !numberIn(s.energy, 0, 100) || !numberIn(s.trace, 0, 100)) return false;
  if (!s.information || !['comum', 'rara', 'epica'].every(r => integerIn(s.information[r], 0, Number.MAX_SAFE_INTEGER))) return false;
  if (!uniqueIds(s.pets, PETS.map(p => p.id)) || !uniqueIds(s.defeated, CORP_GYM_STAGES.map(s => s.id))) return false;
  if (!s.defeated.every((id, i) => id === CORP_GYM_STAGES[i].id)) return false;
  if (!Array.isArray(s.workers) || s.workers.some(w => !w)) return false;
  if (!uniqueIds(s.workers.map(w => w.id), HIRABLE_WORKERS.map(w => w.id))) return false;
  if (!s.workers.every(w => numberIn(w.energy, 0, 100) && numberIn(w.elapsedMs, 0, WORKER_WORK_INTERVAL_MS - 0.000001))) return false;
  if (!numberIn(s.sleepRemainingMs, 0, SLEEP_COOLDOWN_MS)) return false;
  if (s.buff !== null && (!s.buff || !DRINKS.some(d => d.id === s.buff.drinkId) || !numberIn(s.buff.remainingMs, 0, DRINK_BUFF_DURATION_MS))) return false;
  return Boolean(s.position && typeof s.position.mapId === 'string' && /^[a-z0-9_]+$/.test(s.position.mapId) && integerIn(s.position.col, 0, 10000) && integerIn(s.position.row, 0, 10000));
}

export function captureSave(characterId, runtime, mapManager) {
  const buff = runtime.activeDrinkBuff;
  return {
    version: 1, characterId,
    level: runtime.playerStats.level, xp: runtime.playerStats.xp,
    byteBalance: runtime.byteBalance, energy: runtime.energyValue,
    trace: runtime.hackSession.traceMeter.value,
    information: runtime.informationCounts,
    workers: runtime.workerRoster.snapshot(),
    pets: runtime.pets.filter(p => p.owned).map(p => p.id),
    defeated: runtime.corpGymStages.filter(s => s.status === 'defeated').map(s => s.id),
    sleepRemainingMs: runtime.sleepTracker.cooldownRemainingMs(),
    buff: buff ? { drinkId: buff.drinkId, remainingMs: Math.max(0, buff.expiresAt - runtime._now()) } : null,
    position: { mapId: mapManager.currentMap.id, col: mapManager.playerCol, row: mapManager.playerRow },
  };
}

// Aplicado apenas a um runtime novo; nao repete compras nem premios do ginasio.
export function restoreSave(s, runtime) {
  if (!validateSave(s)) throw new Error('Save invalido');
  runtime.hackSession.playerStats = { ...createPlayerStats(s.level), xp: s.xp };
  const difference = s.byteBalance - runtime.byteBalance;
  if (difference) runtime.ledger.record({ type: difference > 0 ? 'gain' : 'spend', amount: Math.abs(difference), meta: { source: 'save_restore' } });
  runtime.hackSession.energyMeter.restore(s.energy);
  runtime.hackSession.traceMeter.increase(s.trace);
  for (const rarity of ['comum', 'rara', 'epica']) runtime.informationLedger.add(rarity, s.information[rarity]);
  runtime.workerRoster.restore(s.workers);
  runtime.petCollection.restore(s.pets);
  runtime.corpGymProgress.restore(s.defeated);
  runtime.sleepTracker.restore(s.sleepRemainingMs);
  runtime.drinkBuffTracker.restore(s.buff);
}

export class SaveStore {
  constructor(getStorage = () => window.localStorage) {
    this.getStorage = getStorage;
    this.error = '';
    this.protected = false;
  }

  read() {
    try {
      const raw = this.getStorage().getItem(SAVE_KEY);
      if (raw === null) return null;
      const save = JSON.parse(raw);
      if (!validateSave(save)) throw new Error('Save invalido');
      return save;
    } catch {
      // Preserva o original, inclusive saves de uma versao futura.
      this.protected = true;
      this.error = 'Nao foi possivel ler a partida salva. O arquivo original foi preservado; esta sessao nao sera salva.';
      return null;
    }
  }

  write(save) {
    if (this.protected) return false;
    try {
      if (!validateSave(save)) throw new Error('Save invalido');
      this.getStorage().setItem(SAVE_KEY, JSON.stringify(save));
      this.error = '';
      return true;
    } catch {
      this.error = 'Nao foi possivel salvar. Libere espaco ou permita o armazenamento neste navegador.';
      return false;
    }
  }
}
