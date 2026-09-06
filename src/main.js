import { MapManager } from './maps/mapManager.js';
import { Renderer } from './render/renderer.js';
import { centerMapOrigin } from './core/topdown.js';
import { MovementController } from './character/movementController.js';
import { CharacterRenderer, isImageReady } from './character/characterRenderer.js';
import { CHARACTER_ROSTER, loadCharacterAssets, loadPortraitImage } from './character/characterRoster.js';
import { loadPropImage } from './render/propAssets.js';
import { loadBackgroundImage } from './render/backgroundAssets.js';
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

// Roda o jogo de verdade com o personagem escolhido na tela de selecao.
function startGame(characterId) {
  // Preenchido sob demanda (ver ensurePropImagesLoaded) conforme cada mapa
  // e carregado. Renderer guarda a MESMA referencia, entao um asset que
  // termina de carregar depois passa a aparecer sozinho no proximo frame.
  const propImages = {};
  const backgroundImages = {};
  const mapRenderer = new Renderer(ctx, origin, { propImages, backgroundImages });
  const characterRenderer = new CharacterRenderer(ctx, origin, { assets: loadCharacterAssets(characterId) });

  function ensurePropImagesLoaded(map) {
    for (const prop of map.props) {
      if (!propImages[prop.asset]) {
        propImages[prop.asset] = loadPropImage(prop.asset);
      }
    }
  }

  function ensureBackgroundImageLoaded(map) {
    if (map.background && !backgroundImages[map.background]) {
      backgroundImages[map.background] = loadBackgroundImage(map.background);
    }
  }

  // World Structure Lock: camera fixa por mapa, nunca segue o personagem.
  // Recalculada uma unica vez a cada troca de mapa (load inicial e
  // onMapChanged via door) - nao mais a cada frame. Generica: depende so
  // de map.width/map.height/TILE_SIZE, funciona igual pro exterior e pra
  // qualquer interior.
  function fixCameraForMap(map) {
    const { originX, originY } = centerMapOrigin(map, canvas.width, canvas.height);
    mapRenderer.originX = originX;
    mapRenderer.originY = originY;
    characterRenderer.originX = originX;
    characterRenderer.originY = originY;
  }

  async function loadMapJson(mapId) {
    const response = await fetch(`maps/${mapId}.json`);
    if (!response.ok) throw new Error(`Falha ao carregar mapa ${mapId}`);
    return response.json();
  }

  const mapManager = new MapManager({ loadMapJson });
  const controller = new MovementController(mapManager, {
    onMapChanged: (map) => {
      fixCameraForMap(map);
      ensurePropImagesLoaded(map);
      ensureBackgroundImageLoaded(map);
      updateStatus();
    },
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

  // Direcoes seguradas de verdade (nao o auto-repeat do SO, que tem um
  // atraso inicial e uma cadencia proprias e dava aquele "travadinho" ao
  // segurar a seta - estilo Pokemon FireRed, o input e reamostrado a cada
  // frame do proprio jogo em vez de depender do repeat do teclado).
  const heldDirections = new Set();

  function feedHeldMovement() {
    if (hackRuntime.isMovementBlocked) return;
    // So decide o proximo passo quando o passo atual ja terminou de vez -
    // enfileirar durante o tween em andamento adiantava um passo mesmo
    // depois da tecla ja ter sido solta, dando aquele deslize/atraso ao
    // parar. Assim o personagem sempre para exatamente onde a tecla foi
    // solta, sem "coast" de um passo extra.
    if (controller.isMoving) return;
    if (controller.queueLength > 0) return;
    if (heldDirections.size === 0) return;
    const direction = [...heldDirections].pop();
    controller.enqueueInput(direction);
  }

  window.addEventListener('keydown', (event) => {
    const direction = MOVE_KEYS[event.key];
    if (direction) {
      event.preventDefault();
      heldDirections.add(direction);
      // So enfileira aqui no primeiro toque (nao no repeat do SO); o
      // reforco continuo enquanto segura vem de feedHeldMovement() no loop.
      if (!event.repeat && !hackRuntime.isMovementBlocked) {
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

  window.addEventListener('keyup', (event) => {
    const direction = MOVE_KEYS[event.key];
    if (direction) heldDirections.delete(direction);
  });

  // Perder o foco (trocar de aba, alt-tab) nunca dispara keyup - sem isso
  // o personagem ficaria andando sozinho pra sempre na direcao que estava
  // segurada.
  window.addEventListener('blur', () => heldDirections.clear());

  function render(nowMs) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    mapRenderer.drawMap(mapManager.currentMap);
    mapRenderer.drawReflections(mapManager.currentMap, nowMs);
    const { col, row } = controller.visualPosition;
    mapRenderer.drawPropsAndCharacter(mapManager.currentMap.props, row, () => {
      characterRenderer.draw({ col, row, direction: controller.direction, pose: controller.pose });
    });
    updateStatus();
    updateHackStatus();
    updateShopStatus();
  }

  let lastTime = performance.now();
  function loop(now) {
    const deltaMs = now - lastTime;
    lastTime = now;
    feedHeldMovement();
    hackRuntime.tick(deltaMs);
    render(now);
    requestAnimationFrame(loop);
  }

  const params = new URLSearchParams(window.location.search);
  const startMap = params.get('map') || 'district_07';
  const startCol = Number(params.get('x') ?? 5);
  const startRow = Number(params.get('y') ?? 5);

  mapManager.loadMap(startMap, startCol, startRow).then(
    () => {
      fixCameraForMap(mapManager.currentMap);
      ensurePropImagesLoaded(mapManager.currentMap);
      ensureBackgroundImageLoaded(mapManager.currentMap);
      render(performance.now());
      requestAnimationFrame(loop);
    },
    (error) => {
      statusEl.textContent = `erro ao carregar o mapa "${startMap}": ${error.message}`;
    }
  );
}

// Tela de selecao de personagem: roda antes do jogo em si. Puramente
// visual/input - nao toca em nada do HackRuntime/MapManager, que so
// existem depois que o jogador escolhe (dentro de startGame). Se a URL
// ja vier com ?char=characterN valido, pula a selecao (atalho pra
// debug/teste visual sem precisar apertar nada) - um id desconhecido
// cai pra tela de selecao normal em vez de tentar carregar assets
// inexistentes silenciosamente.
const forcedCharacter = new URLSearchParams(window.location.search).get('char');
const forcedEntry = CHARACTER_ROSTER.find((entry) => entry.id === forcedCharacter);
if (forcedEntry) {
  startGame(forcedEntry.id);
} else {
  const previews = CHARACTER_ROSTER.map((entry) => ({ ...entry, image: loadPortraitImage(entry.id) }));

  let selectedIndex = 0;
  let confirmed = false;

  function drawSelectionScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e5e5e5';
    ctx.font = '20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Escolha seu personagem', 20, 40);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('SETAS pra navegar, ESPACO/ENTER pra confirmar', 20, 64);

    const cardWidth = canvas.width / previews.length;
    previews.forEach((entry, index) => {
      const cardX = cardWidth * index;
      const centerX = cardX + cardWidth / 2;
      const centerY = canvas.height / 2 + 20;
      const isSelected = index === selectedIndex;

      ctx.strokeStyle = isSelected ? '#3ad6ff' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(cardX + 10, centerY - 110, cardWidth - 20, 220);

      const img = entry.image;
      if (isImageReady(img)) {
        const targetH = 150;
        const w = img.naturalWidth * (targetH / img.naturalHeight);
        ctx.drawImage(img, centerX - w / 2, centerY - targetH / 2 - 10, w, targetH);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = isSelected ? '#3ad6ff' : '#aaa';
      ctx.font = '15px monospace';
      ctx.fillText(entry.name, centerX, centerY + 95);
      ctx.textAlign = 'left';
    });
  }

  function selectionLoop() {
    drawSelectionScreen();
    if (!confirmed) requestAnimationFrame(selectionLoop);
  }

  function handleSelectionKeydown(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectedIndex = (selectedIndex - 1 + previews.length) % previews.length;
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectedIndex = (selectedIndex + 1) % previews.length;
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      confirmed = true;
      window.removeEventListener('keydown', handleSelectionKeydown);
      startGame(previews[selectedIndex].id);
    }
  }

  window.addEventListener('keydown', handleSelectionKeydown);
  requestAnimationFrame(selectionLoop);
}
