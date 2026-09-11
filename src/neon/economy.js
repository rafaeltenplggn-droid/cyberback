export const SAVE_KEY = 'cyberback.neon.v2';
export const PET_IDS = ['gato_laranja', 'gato_cinza', 'gato_sphynx'];
export const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
export const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const SPIN_MS = 4000;
export const INFORMATION_PRICE = 30;
export const HACK_ENERGY = 10;
export const REGEN_MS = 30000;
const money = n => Number.isSafeInteger(n) && n >= 0 && n < 1e12;
export const colorOf = n => n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
export function fresh(now = Date.now()) { return {version:2, byteBalance:100, information:0, pcLevel:1, pets:[], characterId:'character1', pending:null, energy:100, energyAt:now, hackActive:false}; }
export function upgradeSave(old) {
  const next = structuredClone(old);
  if(next?.version === 2) {
    if(next.information === undefined) next.information = 0;
    if(next.hackActive === undefined) next.hackActive = false;
  }
  return next;
}
export function valid(s) {
  return !!s && s.version === 2 && money(s.byteBalance) && money(s.information) && [1,2].includes(s.pcLevel)
    && Number.isInteger(s.energy) && s.energy >= 0 && s.energy <= 100 && Number.isSafeInteger(s.energyAt) && s.energyAt >= 0 && typeof s.hackActive === 'boolean'
    && /^character[1-4]$/.test(s.characterId) && Array.isArray(s.pets)
    && s.pets.every(id => PET_IDS.includes(id)) && new Set(s.pets).size === s.pets.length
    && (s.pending === null || (['roulette','trade'].includes(s.pending?.type)
      && money(s.pending.payout) && [0,38,40].includes(s.pending.payout)
      && Number.isInteger(s.pending.result) && s.pending.result >= 0 && s.pending.result <= 36));
}
export function migrate(old, now = Date.now()) {
  if (!old || old.version !== 1 || !money(old.byteBalance)) return null;
  const s = fresh(now); s.byteBalance = old.byteBalance;
  const inventory = ['comum','rara','epica'].map(key => old.information?.[key] ?? 0);
  if(inventory.every(money) && money(inventory.reduce((a,b)=>a+b,0))) s.information = inventory.reduce((a,b)=>a+b,0);
  if (Number.isFinite(old.energy)) s.energy = Math.max(0, Math.min(100, Math.floor(old.energy)));
  s.pets = [...new Set((Array.isArray(old.pets) ? old.pets : []).filter(id => PET_IDS.includes(id)))];
  if (/^character[1-4]$/.test(old.characterId)) s.characterId = old.characterId;
  return s;
}
export function regenerate(s, now = Date.now()) {
  const next = structuredClone(s);
  const ticks = Math.max(0, Math.floor((now - s.energyAt) / REGEN_MS));
  next.energy = Math.min(100, s.energy + ticks);
  next.energyAt = next.energy === 100 || now < s.energyAt ? now : s.energyAt + ticks * REGEN_MS;
  return next;
}
// A aposta e seu resultado ficam juntos no save. Recarregar liquida uma unica vez.
export function transact(s, action) {
  if (!valid(s)) throw new Error('Partida inválida.');
  const next = structuredClone(s);
  if (action.type === 'settle') {
    if (!next.pending) return next;
    next.byteBalance += next.pending.payout; next.pending = null; return next;
  }
  if (next.pending) throw new Error('Espere a rodada terminar.');
  if (action.type === 'hackStart') {
    if (next.hackActive) throw new Error('Termine o hack atual.');
    if (next.energy < HACK_ENERGY) throw new Error('Energia insuficiente. Ela se recupera aos poucos.');
    next.energy -= HACK_ENERGY; next.hackActive = true;
  }
  else if (action.type === 'hack') {
    if (!next.hackActive) throw new Error('Inicie uma tentativa primeiro.');
    next.information += next.pcLevel; next.hackActive = false;
  }
  else if (action.type === 'sellInformation') {
    if(action.mapId !== 'ghost_row_interior') throw new Error('Venda suas informações na BLACKNET.');
    if(next.hackActive) throw new Error('Termine o hack atual.');
    if(next.information === 0) throw new Error('Você ainda não tem informações para vender.');
    next.byteBalance += next.information * INFORMATION_PRICE;
    next.information = 0;
  }
  else if (action.type === 'hackCancel') next.hackActive = false;
  else if (action.type === 'pet') {
    if (!PET_IDS.includes(action.id) || next.pets.includes(action.id)) throw new Error('Pet indisponível.');
    if (next.byteBalance < 100) throw new Error('Você precisa de 100 BYTE.');
    next.byteBalance -= 100; next.pets.push(action.id);
  } else if (action.type === 'upgrade') {
    if (next.pcLevel !== 1) throw new Error('Seu PC já está no máximo.');
    if (next.byteBalance < 150) throw new Error('Você precisa de 150 BYTE.');
    next.byteBalance -= 150; next.pcLevel = 2;
  } else if (action.type === 'roulette' || action.type === 'trade') {
    if (next.byteBalance < 20) throw new Error('Você precisa de 20 BYTE.');
    let payout;
    if (action.type === 'roulette') {
      if (!['red','black'].includes(action.choice) || !Number.isInteger(action.result) || action.result < 0 || action.result > 36) throw new Error('Aposta inválida.');
      payout = colorOf(action.result) === action.choice ? 40 : 0;
    } else {
      if (!['up','down'].includes(action.choice) || ![0,1].includes(action.result)) throw new Error('Trade inválido.');
      payout = action.choice === (action.result ? 'up' : 'down') ? 38 : 0;
    }
    next.byteBalance -= 20;
    next.pending = {type:action.type, result:action.result, payout};
  } else throw new Error('Ação inválida.');
  if (!valid(next)) throw new Error('Limite de saldo atingido.');
  return next;
}
