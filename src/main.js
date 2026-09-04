import { MapManager } from './maps/mapManager.js';
import { Renderer } from './render/renderer.js';
import { MovementController } from './character/movementController.js';
import { CharacterRenderer } from './character/characterRenderer.js';
import { createPlayerStats } from './hackloop/playerStats.js';
import { TraceMeter } from './hackloop/trace.js';
import { ByteLedger } from './hackloop/byteLedger.js';
import { HackRuntime } from './hackIntegration/hackRuntime.js';

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
const ledger = new ByteLedger();
const hackRuntime = new HackRuntime({ mapManager, controller, playerStats, traceMeter, ledger });

const statusEl = document.getElementById('status');
const hackStatusEl = document.getElementById('hack-status');

function updateStatus() {
  statusEl.textContent = `mapa: ${mapManager.currentMap.id} | posicao: (${mapManager.playerCol}, ${mapManager.playerRow}) | direcao: ${controller.direction} | pose: ${controller.pose} | trace: ${traceMeter.value.toFixed(1)}`;
}

let hackingBuildingId = null;
let lastHackResult = null;

function updateHackStatus() {
  if (hackingBuildingId) {
    hackStatusEl.textContent = `hackeando ${hackingBuildingId}... (status: ${hackRuntime.hackSession.status})`;
    return;
  }
  if (lastHackResult) {
    const { target, recon, breach, exfiltrate, fence } = lastHackResult;
    if (!breach.success) {
      hackStatusEl.textContent = `ultimo hack (${target.id}, tier ${target.tier}): FALHA no breach (chance ${(breach.chance * 100).toFixed(0)}%) | trace: ${traceMeter.value.toFixed(1)} | estimativa que o recon deu: ${recon.estimatedLoot.min}-${recon.estimatedLoot.max}`;
      return;
    }
    hackStatusEl.textContent =
      `ultimo hack (${target.id}, tier ${target.tier}): SUCESSO | loot bruto: ${exfiltrate.rawAmount} | loot final: ${exfiltrate.loot.amount}` +
      `${exfiltrate.overTime ? ' (estourou o tempo)' : ''} | BYTE ganho: ${fence.byteAmount} | trace: ${traceMeter.value.toFixed(1)}`;
    return;
  }
  const nearby = hackRuntime.nearbyHackableBuilding();
  hackStatusEl.textContent = nearby ? `[ESPACO/ENTER] hackear ${nearby.id}` : 'nenhum predio hackavel por perto';
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
  }
});

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  mapRenderer.drawMap(mapManager.currentMap);
  const { col, row } = controller.visualPosition;
  characterRenderer.draw({ col, row, direction: controller.direction, pose: controller.pose });
  updateStatus();
  updateHackStatus();
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
