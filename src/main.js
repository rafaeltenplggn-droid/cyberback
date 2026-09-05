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
import { DRINK_COST_BYTE } from './hackIntegration/drinkShop.js';
import { DRINK_BUFF_AMOUNT, DRINK_BUFF_DURATION_MS } from './hackIntegration/drinkBuff.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const origin = { originX: canvas.width / 2, originY: 80 };
const mapRenderer = new Renderer(ctx, origin);

// Sprite real do personagem 1 (Shadow Hacker, ver ART_STYLE_GUIDE.md).
// Carrega de forma assincrona - ate a imagem terminar de carregar,
// CharacterRenderer cai de volta no placeholder sozinho (ver isImageReady
// em characterRenderer.js). Todas as 3 direcoes ja tem pose de caminhada
// propria; "idle" reaproveita a imagem de passo 1 (nao ha pose parada
// separada gerada ainda).
function loadCharacterImage(fileName) {
  const img = new Image();
  img.src = `../assets/character1/${fileName}`;
  return img;
}

const character1FrontStep1 = loadCharacterImage('front_walk1.png');
const character1FrontStep2 = loadCharacterImage('front_walk2.png');
const character1SideStep1 = loadCharacterImage('side_walk1.png');
const character1SideStep2 = loadCharacterImage('side_walk2.png');
const character1BackStep1 = loadCharacterImage('back_walk1.png');
const character1BackStep2 = loadCharacterImage('back_walk2.png');

const character1Assets = {
  down: { idle: character1FrontStep1, step1: character1FrontStep1, step2: character1FrontStep2 },
  up: { idle: character1BackStep1, step1: character1BackStep1, step2: character1BackStep2 },
  left: { idle: character1SideStep1, step1: character1SideStep1, step2: character1SideStep2 },
};

const characterRenderer = new CharacterRenderer(ctx, origin, { assets: character1Assets });

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
  const sittingText = hackRuntime.isSitting ? ' | sentado no banco' : '';
  statusEl.textContent = `mapa: ${mapManager.currentMap.id} | posicao: (${mapManager.playerCol}, ${mapManager.playerRow}) | direcao: ${controller.direction} | pose: ${controller.pose} | trace: ${traceMeter.value.toFixed(1)}${sittingText}`;

  const stats = hackRuntime.playerStats;
  const xpNeeded = xpRequiredForLevel(stats.level);
  const buffText = hackRuntime.drinkBuffTracker.isActive()
    ? ` | DRINK ATIVO (+${DRINK_BUFF_AMOUNT} breachSpeed, ${Math.ceil(hackRuntime.drinkBuffTracker.remainingMs() / 1000)}s)`
    : '';
  playerStatusEl.textContent =
    `nivel ${stats.level} | xp ${stats.xp}/${xpNeeded} | energia: ${hackRuntime.energyValue.toFixed(0)}/${hackRuntime.energyMax} | BYTE: ${hackRuntime.byteBalance} | ` +
    `breachSpeed ${stats.breachSpeed} | stealth ${stats.stealth} | lootYield ${stats.lootYield} | traceResistance ${stats.traceResistance}${buffText}`;
}

let hackingBuildingId = null;
let lastHackResult = null;

function updateHackStatus() {
  if (hackingBuildingId) {
    hackStatusEl.textContent = `hackeando ${hackingBuildingId}... (status: ${hackRuntime.hackSession.status})`;
    return;
  }
  if (lastHackResult) {
    const { target, recon, breach, exfiltrate, fence, energyBlocked, energySpent, drinkBuffActive } = lastHackResult;
    const buffTag = drinkBuffActive ? ' (com drink)' : '';
    if (energyBlocked) {
      hackStatusEl.textContent = `ultimo hack (${target.id}, tier ${target.tier}): SEM ENERGIA (atual: ${hackRuntime.energyValue.toFixed(0)}/${hackRuntime.energyMax}) | espera recarregar | estimativa que o recon deu: ${recon.estimatedLoot.min}-${recon.estimatedLoot.max}`;
      return;
    }
    if (!breach.success) {
      hackStatusEl.textContent = `ultimo hack (${target.id}, tier ${target.tier}): FALHA no breach${buffTag} (chance ${(breach.chance * 100).toFixed(0)}%) | energia gasta: ${energySpent} | trace: ${traceMeter.value.toFixed(1)} | estimativa que o recon deu: ${recon.estimatedLoot.min}-${recon.estimatedLoot.max}`;
      return;
    }
    hackStatusEl.textContent =
      `ultimo hack (${target.id}, tier ${target.tier}): SUCESSO${buffTag} | loot bruto: ${exfiltrate.rawAmount} | loot final: ${exfiltrate.loot.amount}` +
      `${exfiltrate.overTime ? ' (estourou o tempo)' : ''} | BYTE ganho: ${fence.byteAmount} | XP ganho: ${lastHackResult.xpGained}` +
      `${lastHackResult.leveledUp ? ' | SUBIU DE NIVEL!' : ''} | energia gasta: ${energySpent} | trace: ${traceMeter.value.toFixed(1)}`;
    return;
  }
  const nearby = hackRuntime.nearbyHackableBuilding();
  hackStatusEl.textContent = nearby ? `[ESPACO/ENTER] hackear ${nearby.id}` : 'nenhum predio hackavel por perto';
}

let lastShopResult = null;
let lastSleepResult = null;
let lastNearbyHome = null;
let lastDrinkResult = null;
let lastNearbyBar = null;

function updateShopStatus() {
  const nearby = hackRuntime.nearbyHomeInteractable();
  if (nearby !== lastNearbyHome) {
    // saiu/entrou de perto do PC ou da cama: o resultado anterior nao vale
    // mais como "recem-aconteceu", senao ele fica preso na tela pra sempre
    // (o jogador ve uma compra/sono de minutos atras como se fosse agora).
    lastShopResult = null;
    lastSleepResult = null;
    lastNearbyHome = nearby;
  }

  const nearbyBar = hackRuntime.nearbyBarInteractable();
  if (nearbyBar !== lastNearbyBar) {
    lastDrinkResult = null;
    lastNearbyBar = nearbyBar;
  }

  if (nearbyBar === 'stool') {
    shopStatusEl.textContent = hackRuntime.isSitting ? '[C] levantar do banco' : '[C] sentar no banco (so cosmetico)';
    return;
  }

  if (nearbyBar === 'counter' || nearbyBar === 'bartender') {
    const label = nearbyBar === 'bartender' ? 'atendente do bar' : 'balcao do bar';
    if (!lastDrinkResult) {
      shopStatusEl.textContent = `[D] ${label}: pedir um drink por ${DRINK_COST_BYTE} BYTE (+${DRINK_BUFF_AMOUNT} breachSpeed por ${DRINK_BUFF_DURATION_MS / 1000}s)`;
    } else if (lastDrinkResult.success) {
      shopStatusEl.textContent = `[D] ${label}: drink servido por ${lastDrinkResult.byteSpent} BYTE`;
    } else if (lastDrinkResult.reason === 'buff_ativo') {
      shopStatusEl.textContent = `[D] ${label}: ja esta com um drink ativo (${Math.ceil(hackRuntime.drinkBuffTracker.remainingMs() / 1000)}s restantes)`;
    } else if (lastDrinkResult.reason === 'byte_insuficiente') {
      shopStatusEl.textContent = `[D] ${label}: BYTE insuficiente (precisa de ${DRINK_COST_BYTE}, tem ${hackRuntime.byteBalance})`;
    } else {
      shopStatusEl.textContent = `[D] ${label}: nao foi possivel pedir agora`;
    }
    return;
  }

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
    // O cooldown e recalculado a cada frame direto do sleepTracker (fonte
    // viva), nao do cooldownRemainingMs congelado de um resultado antigo -
    // senao a contagem regressiva fica presa mesmo depois do tempo passar.
    const remainingMs = hackRuntime.sleepTracker.cooldownRemainingMs();
    if (lastSleepResult?.success) {
      shopStatusEl.textContent = `[S] dormiu: +${SLEEP_ENERGY_RESTORE} energia`;
    } else if (remainingMs > 0) {
      const secs = Math.ceil(remainingMs / 1000);
      shopStatusEl.textContent = `[S] ainda cansado, espera mais ${secs}s pra dormir de novo`;
    } else {
      shopStatusEl.textContent = `[S] dormir (+${SLEEP_ENERGY_RESTORE} energia, uma vez a cada 2 minutos)`;
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

function handleBuyDrink() {
  lastDrinkResult = hackRuntime.buyDrink();
  updateShopStatus();
}

function handleToggleSit() {
  hackRuntime.toggleSit();
  updateStatus();
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
    return;
  }
  if (event.key === 'd' || event.key === 'D') {
    event.preventDefault();
    handleBuyDrink();
    return;
  }
  if (event.key === 'c' || event.key === 'C') {
    event.preventDefault();
    handleToggleSit();
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
