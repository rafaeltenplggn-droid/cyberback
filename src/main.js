import { MapManager } from './maps/mapManager.js';
import { Renderer } from './render/renderer.js';
import { MovementController } from './character/movementController.js';
import { CharacterRenderer } from './character/characterRenderer.js';
import { createPlayerStats, xpRequiredForLevel } from './hackloop/playerStats.js';
import { TraceMeter } from './hackloop/trace.js';
import { EnergyMeter } from './hackloop/energy.js';
import { ByteLedger } from './hackloop/byteLedger.js';
import { HackRuntime } from './hackIntegration/hackRuntime.js';
import { ENERGY_REFILL_COST_BYTE } from './hackIntegration/energyShop.js';
import { SLEEP_ENERGY_RESTORE } from './hackIntegration/sleepAction.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const origin = { originX: canvas.width / 2, originY: 80 };
const mapRenderer = new Renderer(ctx, origin);
const characterRenderer = new CharacterRenderer(ctx, origin);

async function loadMapJson(mapId) {
  const response = await fetch(`../maps/${mapId}.json`);
  if (!response.ok) throw new Error(`Falha ao carregar mapa ${mapId}`);
  return response.json();
}

const mapManager = new MapManager({ loadMapJson });
const controller = new MovementController(mapManager, {
  onMapChanged: () => updateStatus(),
});

const playerStats = createPlayerStats(1);
const traceMeter = new TraceMeter();
const energyMeter = new EnergyMeter();
const ledger = new ByteLedger();
const hackRuntime = new HackRuntime({ mapManager, controller, playerStats, traceMeter, energyMeter, ledger });

const statusEl = document.getElementById('status');
const playerStatusEl = document.getElementById('player-status');
const hackStatusEl = document.getElementById('hack-status');
const shopStatusEl = document.getElementById('shop-status');

function updateStatus() {
  statusEl.textContent = `mapa: ${mapManager.currentMap.id} | posicao: (${mapManager.playerCol}, ${mapManager.playerRow}) | direcao: ${controller.direction} | pose: ${controller.pose} | trace: ${traceMeter.value.toFixed(1)}`;

  const stats = hackRuntime.playerStats;
  const xpNeeded = xpRequiredForLevel(stats.level);
  playerStatusEl.textContent =
    `nivel ${stats.level} | xp ${stats.xp}/${xpNeeded} | energia: ${hackRuntime.energyValue.toFixed(0)}/${hackRuntime.energyMax} | BYTE: ${hackRuntime.byteBalance} | ` +
    `breachSpeed ${stats.breachSpeed} | stealth ${stats.stealth} | lootYield ${stats.lootYield} | traceResistance ${stats.traceResistance}`;
}

let hackingBuildingId = null;
let lastHackResult = null;

function updateHackStatus() {
  if (hackingBuildingId) {
    hackStatusEl.textContent = `hackeando ${hackingBuildingId}... (status: ${hackRuntime.hackSession.status})`;
    return;
  }
  if (lastHackResult) {
    const { target, recon, breach, exfiltrate, fence, energyBlocked, energySpent } = lastHackResult;
    if (energyBlocked) {
      hackStatusEl.textContent = `ultimo hack (${target.id}, tier ${target.tier}): SEM ENERGIA (atual: ${hackRuntime.energyValue.toFixed(0)}/${hackRuntime.energyMax}) | espera recarregar | estimativa que o recon deu: ${recon.estimatedLoot.min}-${recon.estimatedLoot.max}`;
      return;
    }
    if (!breach.success) {
      hackStatusEl.textContent = `ultimo hack (${target.id}, tier ${target.tier}): FALHA no breach (chance ${(breach.chance * 100).toFixed(0)}%) | energia gasta: ${energySpent} | trace: ${traceMeter.value.toFixed(1)} | estimativa que o recon deu: ${recon.estimatedLoot.min}-${recon.estimatedLoot.max}`;
      return;
    }
    hackStatusEl.textContent =
      `ultimo hack (${target.id}, tier ${target.tier}): SUCESSO | loot bruto: ${exfiltrate.rawAmount} | loot final: ${exfiltrate.loot.amount}` +
      `${exfiltrate.overTime ? ' (estourou o tempo)' : ''} | BYTE ganho: ${fence.byteAmount} | XP ganho: ${lastHackResult.xpGained}` +
      `${lastHackResult.leveledUp ? ' | SUBIU DE NIVEL!' : ''} | energia gasta: ${energySpent} | trace: ${traceMeter.value.toFixed(1)}`;
    return;
  }
  const nearby = hackRuntime.nearbyHackableBuilding();
  hackStatusEl.textContent = nearby ? `[ESPACO/ENTER] hackear ${nearby.id}` : 'nenhum predio hackavel por perto';
}

let lastShopResult = null;
let lastSleepResult = null;

function updateShopStatus() {
  const nearby = hackRuntime.nearbyHomeInteractable();

  if (nearby === 'pc') {
    if (!lastShopResult) {
      shopStatusEl.textContent = `[B] Mercado Negro: recarregar energia por ${ENERGY_REFILL_COST_BYTE} BYTE`;
    } else if (lastShopResult.success) {
      shopStatusEl.textContent = `[B] Mercado Negro: recarga comprada por ${lastShopResult.byteSpent} BYTE`;
    } else if (lastShopResult.reason === 'energia_cheia') {
      shopStatusEl.textContent = '[B] Mercado Negro: energia ja esta cheia';
    } else if (lastShopResult.reason === 'byte_insuficiente') {
      shopStatusEl.textContent = `[B] Mercado Negro: BYTE insuficiente (precisa de ${ENERGY_REFILL_COST_BYTE}, tem ${hackRuntime.byteBalance})`;
    } else {
      shopStatusEl.textContent = '[B] Mercado Negro: nao foi possivel comprar agora';
    }
    return;
  }

  if (nearby === 'bed') {
    if (!lastSleepResult) {
      shopStatusEl.textContent = `[S] dormir (+${SLEEP_ENERGY_RESTORE} energia, uma vez por minuto)`;
    } else if (lastSleepResult.success) {
      shopStatusEl.textContent = `[S] dormiu: +${SLEEP_ENERGY_RESTORE} energia`;
    } else {
      const secs = Math.ceil(lastSleepResult.cooldownRemainingMs / 1000);
      shopStatusEl.textContent = `[S] ainda cansado, espera mais ${secs}s pra dormir de novo`;
    }
    return;
  }

  shopStatusEl.textContent = '';
}

function handleBuyEnergyRefill() {
  lastShopResult = hackRuntime.buyEnergyRefill();
  updateShopStatus();
}

function handleSleep() {
  lastSleepResult = hackRuntime.sleep();
  updateShopStatus();
}

async function handleAction() {
  const nearby = hackRuntime.nearbyHackableBuilding();
  if (!nearby) return;
  hackingBuildingId = nearby.id;
  updateHackStatus();
  const result = await hackRuntime.triggerHack();
  lastHackResult = result;
  hackingBuildingId = null;
  updateHackStatus();
}

const MOVE_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

window.addEventListener('keydown', (event) => {
  const direction = MOVE_KEYS[event.key];
  if (direction) {
    event.preventDefault();
    if (!hackRuntime.isMovementBlocked) {
      controller.enqueueInput(direction);
    }
    return;
  }
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    handleAction();
    return;
  }
  if (event.key === 'b' || event.key === 'B') {
    event.preventDefault();
    handleBuyEnergyRefill();
    return;
  }
  if (event.key === 's' || event.key === 'S') {
    event.preventDefault();
    handleSleep();
  }
});

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  mapRenderer.drawMap(mapManager.currentMap);
  const { col, row } = controller.visualPosition;
  characterRenderer.draw({ col, row, direction: controller.direction, pose: controller.pose });
  updateStatus();
  updateHackStatus();
  updateShopStatus();
}

let lastTime = performance.now();
function loop(now) {
  const deltaMs = now - lastTime;
  lastTime = now;
  hackRuntime.tick(deltaMs);
  render();
  requestAnimationFrame(loop);
}

const params = new URLSearchParams(window.location.search);
const startMap = params.get('map') || 'district_07';
const startCol = Number(params.get('x') ?? 5);
const startRow = Number(params.get('y') ?? 5);

mapManager.loadMap(startMap, startCol, startRow).then(
  () => {
    render();
    requestAnimationFrame(loop);
  },
  (error) => {
    statusEl.textContent = `erro ao carregar o mapa "${startMap}": ${error.message}`;
  }
);
