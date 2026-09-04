import { MapManager } from './maps/mapManager.js';
import { Renderer } from './render/renderer.js';
import { bindDebugAvatarControls } from './debug/debugAvatar.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const renderer = new Renderer(ctx, { originX: canvas.width / 2, originY: 60 });

async function loadMapJson(mapId) {
  const response = await fetch(`../maps/${mapId}.json`);
  if (!response.ok) throw new Error(`Falha ao carregar mapa ${mapId}`);
  return response.json();
}

const mapManager = new MapManager({ loadMapJson });

function render() {
  renderer.clear(canvas.width, canvas.height);
  renderer.drawMap(mapManager.currentMap);
  renderer.drawDebugAvatar(mapManager.playerCol, mapManager.playerRow);
  const status = document.getElementById('status');
  status.textContent = `mapa: ${mapManager.currentMap.id} | posicao: (${mapManager.playerCol}, ${mapManager.playerRow})`;
}

bindDebugAvatarControls(window, mapManager, () => render());

mapManager.loadMap('test_map_a', 1, 2).then(render);
