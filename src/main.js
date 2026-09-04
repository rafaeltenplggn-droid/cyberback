import { MapManager } from './maps/mapManager.js';
import { Renderer } from './render/renderer.js';
import { MovementController } from './character/movementController.js';
import { CharacterRenderer } from './character/characterRenderer.js';
import { bindKeyboardInput } from './character/keyboardInput.js';

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

const statusEl = document.getElementById('status');
function updateStatus() {
  statusEl.textContent = `mapa: ${mapManager.currentMap.id} | posicao: (${mapManager.playerCol}, ${mapManager.playerRow}) | direcao: ${controller.direction} | pose: ${controller.pose}`;
}

const controller = new MovementController(mapManager, {
  onMapChanged: () => updateStatus(),
});

bindKeyboardInput(window, controller);

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  mapRenderer.drawMap(mapManager.currentMap);
  const { col, row } = controller.visualPosition;
  characterRenderer.draw({ col, row, direction: controller.direction, pose: controller.pose });
  updateStatus();
}

let lastTime = performance.now();
function loop(now) {
  const deltaMs = now - lastTime;
  lastTime = now;
  controller.tick(deltaMs);
  render();
  requestAnimationFrame(loop);
}

const params = new URLSearchParams(window.location.search);
const startMap = params.get('map') || 'district_07';
const startCol = Number(params.get('x') ?? 5);
const startRow = Number(params.get('y') ?? 5);

mapManager.loadMap(startMap, startCol, startRow).then(() => {
  render();
  requestAnimationFrame(loop);
});
