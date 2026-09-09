import { MapManager } from './maps/mapManager.js';
import { Renderer } from './render/renderer.js';
import { centerMapOrigin, gridToScreen, screenToGrid, TILE_SIZE } from './core/topdown.js';
import { MovementController } from './character/movementController.js';
import { CharacterRenderer, isImageReady } from './character/characterRenderer.js';
import { CHARACTER_ROSTER, loadCharacterAssets, loadPortraitImage, applyPortraitImage } from './character/characterRoster.js';
import { loadPropImage } from './render/propAssets.js';
import { loadBackgroundImage } from './render/backgroundAssets.js';
import { createPlayerStats, xpRequiredForLevel } from './hackloop/playerStats.js';
import { TraceMeter, TRACE_MAX } from './hackloop/trace.js';
import { EnergyMeter } from './hackloop/energy.js';
import { ByteLedger } from './hackloop/byteLedger.js';
import { HackRuntime } from './hackIntegration/hackRuntime.js';
import { SLEEP_ENERGY_RESTORE } from './hackIntegration/sleepAction.js';
import { DRINK_COST_BYTE } from './hackIntegration/drinkShop.js';
import { DRINKS, DRINK_BUFF_DURATION_MS } from './hackIntegration/drinkMenu.js';
import { INFO_MINING_ENERGY_COST_RATIO } from './hackIntegration/infoMining.js';
import { WORKER_HIRE_COST_BYTE, WORKER_ENERGY_COST } from './hackIntegration/workers.js';
import { PET_COST_BYTE } from './hackIntegration/pets.js';
import { BITE_TRADE_STAKE_BYTE, BITE_TRADE_PAYOUT_BYTE } from './hackIntegration/biteTrade.js';
import { requiredLevelForTier } from './hackIntegration/hackLevelGate.js';
import { layoutBreachTaskZone, breachTaskParamsForTier, resolveBreachTaskAttempt } from './hackIntegration/breachTask.js';
import { PLAYER_HOME_MAP_ID, HOME_BED_LOCATION, HOME_PC_LOCATION } from './hackIntegration/homeLocations.js';
import {
  BAR_MAP_ID,
  BAR_COUNTER_LOCATION,
  BAR_STOOL_LOCATION,
  BAR_LAPTOP_LOCATION,
  BAR_NPC_LOCATION,
} from './hackIntegration/barLocations.js';
import { BLACKNET_MAP_ID, BLACKNET_WORKER_DESKS, blacknetDeskLocation } from './hackIntegration/blacknetLocations.js';
import { CORP_GYM_MAP_ID, CORP_GYM_DESKS, corpGymDeskLocation } from './hackIntegration/corpGymLocations.js';

const STARTING_BYTE_BALANCE = 100;
const BAR_OWNER_NAME = 'Rook';

// Corpo (sprite 320x320 inteira, com uma orelha apagada) + orelha em
// sprites separados pra so ela balancar sozinha, sem depender de
// sprite-sheet de verdade - ver Renderer.drawPet. earBox/earPivot sao
// coordenadas na MESMA sprite 320x320, calibrados a mao pra cada gato -
// cada arte tem sua propria orelha "escolhida" pra balancar (a outra,
// quando existe, fica parada, ja desenhada dentro do proprio body).
const PET_ROOM_SPRITES = {
  gato_laranja: {
    body: 'pet_gato_laranja_body.png',
    ear: 'pet_gato_laranja_ear.png',
    earBox: { x: 248, y: 115, w: 39, h: 61 },
    earPivot: { x: 267.5, y: 176 },
  },
  gato_cinza: {
    body: 'pet_gato_cinza_body.png',
    ear: 'pet_gato_cinza_ear.png',
    earBox: { x: 253, y: 123, w: 32, h: 57 },
    earPivot: { x: 269, y: 180 },
  },
  gato_sphynx: {
    // Sphynx tem as duas orelhas visiveis na arte (unico dos tres); a
    // orelha grande da direita fica parada (dentro do body), e a
    // pequena da esquerda e a que balanca.
    body: 'pet_gato_sphynx_body.png',
    ear: 'pet_gato_sphynx_ear.png',
    earBox: { x: 19, y: 140, w: 31, h: 70 },
    earPivot: { x: 50, y: 175 },
  },
};
const PET_ROOM_ART_HEIGHT_PX = 46;
const PET_EAR_WIGGLE_MAX_RAD = 0.06;
const PET_EAR_WIGGLE_PERIOD_MS = 1300;
// Deslocamento em pixels de tela pra tirar o pet da borda da cama (perto
// do travesseiro, onde fica o tile de interacao) e por mais perto do meio
// do colchao - calibrado a olho contra o fundo (player_home_interior.png).
const PET_BED_OFFSET_X_PX = 34;
const PET_BED_OFFSET_Y_PX = 18;
// De vez em quando o pet se espreguica: um squash/stretch rapido em cima
// da MESMA arte (sem pose nova de verdade) - fica a maior parte do tempo
// parado (so a orelha mexe) e, a cada PET_STRETCH_PERIOD_MS, estica por
// PET_STRETCH_DURATION_MS antes de voltar ao normal.
const PET_STRETCH_PERIOD_MS = 16000;
const PET_STRETCH_DURATION_MS = 1100;

/** {sx,sy} do momento (1,1 na maior parte do tempo) - ver PET_ROOM_SPRITES/drawPet. */
function petStretchScale(nowMs, phaseMs) {
  const t = (nowMs + phaseMs) % PET_STRETCH_PERIOD_MS;
  if (t > PET_STRETCH_DURATION_MS) return { sx: 1, sy: 1 };
  const ease = Math.sin((t / PET_STRETCH_DURATION_MS) * Math.PI);
  return { sx: 1 - 0.05 * ease, sy: 1 + 0.07 * ease };
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const origin = { originX: canvas.width / 2, originY: 80 };

const HINT_BUBBLE_FONT = '11px "IBM Plex Mono", monospace';
const HINT_BUBBLE_MAX_WIDTH = 200;
const HINT_BUBBLE_PADDING = 8;
const HINT_BUBBLE_LINE_HEIGHT = 14;

/** Quebra `text` em linhas que cabem em `maxWidth` (ctx.font ja deve estar setado). */
function wrapHintText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Balao de fala generico (canvas puro, sem DOM) - aparece acima de
 * qualquer interativel (NPC, PC, laptop, predio hackavel) quando o
 * personagem esta perto o suficiente pra agir, avisando a tecla de atalho
 * e que tambem da pra clicar direto nele. `anchorX/anchorY` e o topo-centro
 * do alvo (onde a pontinha do balao aponta).
 */
function drawHintBubble(ctx, anchorX, anchorY, text) {
  ctx.save();
  ctx.font = HINT_BUBBLE_FONT;
  ctx.textBaseline = 'top';
  const lines = wrapHintText(ctx, text, HINT_BUBBLE_MAX_WIDTH);
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const boxW = textWidth + HINT_BUBBLE_PADDING * 2;
  const boxH = lines.length * HINT_BUBBLE_LINE_HEIGHT + HINT_BUBBLE_PADDING * 2;
  const tailH = 6;
  let boxX = anchorX - boxW / 2;
  // pra alvos perto do topo do mapa (predios altos, por exemplo) nao ha
  // espaco pro balao ficar ACIMA do anchor sem vazar pra fora do canvas -
  // nesse caso vira o balao pra BAIXO do anchor, com a pontinha apontando
  // pra cima em vez de pra baixo.
  const preferAbove = anchorY - boxH - tailH >= 4;
  const boxY = preferAbove ? anchorY - boxH - tailH : anchorY + tailH;
  // nao deixa o balao vazar pelas bordas laterais do canvas
  boxX = Math.max(4, Math.min(boxX, ctx.canvas.width - boxW - 4));

  ctx.fillStyle = 'rgba(8, 10, 14, 0.88)';
  ctx.strokeStyle = 'rgba(77, 255, 184, 0.7)';
  ctx.lineWidth = 1;
  const radius = 6;
  ctx.beginPath();
  ctx.moveTo(boxX + radius, boxY);
  ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, radius);
  ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, radius);
  ctx.arcTo(boxX, boxY + boxH, boxX, boxY, radius);
  ctx.arcTo(boxX, boxY, boxX + boxW, boxY, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // pontinha do balao, sempre alinhada com o alvo (nao com o centro da caixa) -
  // aponta pra baixo (caso normal) ou pra cima (quando o balao foi virado)
  const tailX = Math.max(boxX + 10, Math.min(anchorX, boxX + boxW - 10));
  const tailBaseY = preferAbove ? boxY + boxH : boxY;
  const tailTipY = preferAbove ? tailBaseY + tailH : tailBaseY - tailH;
  ctx.beginPath();
  ctx.moveTo(tailX - 5, tailBaseY);
  ctx.lineTo(tailX + 5, tailBaseY);
  ctx.lineTo(tailX, tailTipY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#eaf6f2';
  lines.forEach((line, index) => {
    const lineWidth = ctx.measureText(line).width;
    ctx.fillText(line, boxX + (boxW - lineWidth) / 2, boxY + HINT_BUBBLE_PADDING + index * HINT_BUBBLE_LINE_HEIGHT);
  });
  ctx.restore();
}

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

  // Balao de boas-vindas ao entrar no bar (ver render()/drawHintBubble) -
  // fica um tempo fixo na tela, sem precisar o jogador chegar perto de
  // nenhum interativel especifico, so pra apresentar o que da pra fazer
  // ali assim que a porta troca de mapa.
  const BAR_ENTRANCE_HINT_DURATION_MS = 6000;
  const BAR_ENTRANCE_HINT_TEXT = 'BALCAO: bebidas (M) | BANCO: sentar (C) | LAPTOP no canto: hackear (ESPACO)';
  let barEntranceHintUntil = 0;

  const mapManager = new MapManager({ loadMapJson });
  const controller = new MovementController(mapManager, {
    onMapChanged: (map) => {
      fixCameraForMap(map);
      ensurePropImagesLoaded(map);
      ensureBackgroundImageLoaded(map);
      if (map.id === BAR_MAP_ID) {
        barEntranceHintUntil = performance.now() + BAR_ENTRANCE_HINT_DURATION_MS;
      }
      updateStatus();
    },
  });

  const playerStats = createPlayerStats(1);
  const traceMeter = new TraceMeter();
  const energyMeter = new EnergyMeter();
  const ledger = new ByteLedger();
  ledger.record({ type: 'gain', amount: STARTING_BYTE_BALANCE, meta: { source: 'saldo_inicial' } });
  const hackRuntime = new HackRuntime({ mapManager, controller, playerStats, traceMeter, energyMeter, ledger });

  const statusEl = document.getElementById('status');
  const hackStatusEl = document.getElementById('hack-status');
  const shopStatusEl = document.getElementById('shop-status');
  const workerStatusEl = document.getElementById('worker-status');
  const gymStatusEl = document.getElementById('gym-status');

  // ---------- HUD (cartao de status no canto superior esquerdo) ----------
  const hudAvatarImgEl = document.getElementById('hud-avatar-img');
  // Retrato do personagem escolhido (o "NFT") no avatar redondo do HUD -
  // mesma cadeia de fallback da tela de selecao (portrait -> front_idle ->
  // front_walk1), so carregada uma vez, no inicio da partida.
  applyPortraitImage(hudAvatarImgEl, characterId);
  const hudLevelEl = document.getElementById('hud-level');
  const hudXpFillEl = document.getElementById('hud-xp-fill');
  const hudXpValueEl = document.getElementById('hud-xp-value');
  const hudEnergyFillEl = document.getElementById('hud-energy-fill');
  const hudEnergyValueEl = document.getElementById('hud-energy-value');
  const hudTraceFillEl = document.getElementById('hud-trace-fill');
  const hudTraceValueEl = document.getElementById('hud-trace-value');
  const hudByteEl = document.getElementById('hud-byte');
  const hudStatBreachEl = document.getElementById('hud-stat-breach');
  const hudStatStealthEl = document.getElementById('hud-stat-stealth');
  const hudStatLootEl = document.getElementById('hud-stat-loot');
  const hudStatTraceEl = document.getElementById('hud-stat-trace');
  const hudInfoComumEl = document.getElementById('hud-info-comum');
  const hudInfoRaraEl = document.getElementById('hud-info-rara');
  const hudInfoEpicaEl = document.getElementById('hud-info-epica');
  const hudInfoTotalEl = document.getElementById('hud-info-total');

  // ---------- Tela de invasao (PC screen) ----------
  // Overlay visual mostrado durante um hack de predio ou a mineracao do
  // PC de casa, no lugar do jogador so ver o texto discreto do HUD. Pura
  // camada de apresentacao: nao muda em nada as regras/numeros do jogo,
  // so anima o que ja estava acontecendo por baixo (ver hackRuntime.js).
  const pcScreenEl = document.getElementById('pc-screen');
  const pcCloseBtnEl = document.getElementById('pc-close-btn');
  const pcTabTerminalEl = document.getElementById('pc-tab-terminal');
  const pcTabEquipeEl = document.getElementById('pc-tab-equipe');
  const pcTabLojaEl = document.getElementById('pc-tab-loja');
  const pcTabTradeEl = document.getElementById('pc-tab-trade');
  const pcPanelTerminalEl = document.getElementById('pc-panel-terminal');
  const pcPanelEquipeEl = document.getElementById('pc-panel-equipe');
  const pcPanelLojaEl = document.getElementById('pc-panel-loja');
  const pcPanelTradeEl = document.getElementById('pc-panel-trade');
  const pcTradePriceEl = document.getElementById('pc-trade-price');
  const pcTradeChartEl = document.getElementById('pc-trade-chart');
  const pcTradeUpBtn = document.getElementById('pc-trade-up');
  const pcTradeDownBtn = document.getElementById('pc-trade-down');
  const pcTradeResultEl = document.getElementById('pc-trade-result');
  const pcHeadTargetEl = document.getElementById('pc-head-target');
  const pcHeadTierEl = document.getElementById('pc-head-tier');
  const pcLogEl = document.getElementById('pc-log');
  const pcBarLabelEl = document.getElementById('pc-bar-label');
  const pcBarFillEl = document.getElementById('pc-bar-fill');
  const pcBarValEl = document.getElementById('pc-bar-val');
  const pcWorkersEl = document.getElementById('pc-workers');
  const pcPetsEl = document.getElementById('pc-pets');
  const pcMenuEl = document.getElementById('pc-menu');
  const pcRunEl = document.getElementById('pc-run');
  const pcMenuMineBtn = document.getElementById('pc-menu-mine');
  const pcMenuSellBtn = document.getElementById('pc-menu-sell');
  const pcMenuTargetsEl = document.getElementById('pc-menu-targets');
  const pcTaskEl = document.getElementById('pc-task');
  const pcTaskTargetEl = document.getElementById('pc-task-target');
  const pcTaskTierEl = document.getElementById('pc-task-tier');
  const pcTaskTrackEl = document.getElementById('pc-task-track');
  const pcTaskZoneEl = document.getElementById('pc-task-zone');
  const pcTaskMarkerEl = document.getElementById('pc-task-marker');
  const pcTaskBtn = document.getElementById('pc-task-btn');
  const pcTaskResultEl = document.getElementById('pc-task-result');

  // ---------- Cardapio de drinks (buff, ver drinkMenu.js) ----------
  // Overlay separado da tela do PC, com skin propria (balcao de bar) -
  // diferente do energetico simples ([D], ver drinkShop.js), que continua
  // intocado e so recarrega energia.
  const drinkMenuEl = document.getElementById('drink-menu');
  const drinkListEl = document.getElementById('drink-list');
  const drinkActiveEl = document.getElementById('drink-active');
  const drinkResultEl = document.getElementById('drink-result');
  const drinkCloseBtnEl = document.getElementById('drink-close-btn');

  const workerPortraits = {};
  let lastPetResult = null;

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function pcScreenSetTab(tab) {
    pcTabTerminalEl.dataset.active = String(tab === 'terminal');
    pcTabEquipeEl.dataset.active = String(tab === 'equipe');
    pcTabLojaEl.dataset.active = String(tab === 'loja');
    pcTabTradeEl.dataset.active = String(tab === 'trade');
    pcPanelTerminalEl.hidden = tab !== 'terminal';
    pcPanelEquipeEl.hidden = tab !== 'equipe';
    pcPanelLojaEl.hidden = tab !== 'loja';
    pcPanelTradeEl.hidden = tab !== 'trade';
    if (tab === 'trade') renderTradePanel();
  }

  /**
   * `tabs` lista quais abas ficam visiveis nessa sessao do PC - EQUIPE/LOJA
   * so fazem sentido no fluxo do PC de casa (menu); TRADE aparece tanto no
   * PC de casa quanto no laptop do bar (ver handleOpenBarTrade). `activeTab`
   * e a aba que abre selecionada.
   */
  function pcScreenOpen({ tabs = ['terminal'], activeTab = 'terminal' }) {
    pcScreenEl.hidden = false;
    pcTabTerminalEl.hidden = !tabs.includes('terminal');
    pcTabEquipeEl.hidden = !tabs.includes('equipe');
    pcTabLojaEl.hidden = !tabs.includes('loja');
    pcTabTradeEl.hidden = !tabs.includes('trade');
    pcScreenSetTab(activeTab);
  }

  function pcScreenClose() {
    pcScreenEl.hidden = true;
  }

  /** Mostra o menu de acoes (minerar / hackear remoto) no lugar do terminal em execucao. */
  function pcScreenShowMenu() {
    pcMenuEl.hidden = false;
    pcRunEl.hidden = true;
    pcTaskEl.hidden = true;
  }

  /** Mostra o terminal em execucao (log + barra) no lugar do menu. */
  function pcScreenShowRun() {
    pcMenuEl.hidden = true;
    pcRunEl.hidden = false;
    pcTaskEl.hidden = true;
  }

  /** Mostra a task de sincronizacao (Breach Sync) no lugar do menu/terminal. */
  function pcScreenShowTask() {
    pcMenuEl.hidden = true;
    pcRunEl.hidden = true;
    pcTaskEl.hidden = false;
  }

  const BREACH_TASK_AUTO_MISS_MS = 6000;
  const BREACH_TASK_VERDICT_HOLD_MS = 900;
  // Enquanto a task esta aberta, ESPACO deve so contar como a tentativa de
  // sincronizar (ver runBreachTask) - sem isso o listener global de ESPACO
  // (mais abaixo) tambem chamaria handleAction() de novo no meio da task.
  let breachTaskOpen = false;

  /**
   * Roda a task de sincronizacao (Among-Us-like) antes do hack de verdade:
   * um marker anda de um lado a outro de uma barra, e o jogador tenta
   * parar dentro da zona-alvo (SINCRONIZAR ou ESPACO). Acertar retorna um
   * bonus temporario de stat (mesmo formato do statBuff dos drinks, ver
   * drinkMenu.js/breachTask.js) pra somar so nesse hack; errar ou deixar o
   * tempo passar (BREACH_TASK_AUTO_MISS_MS) resolve com null - o hack roda
   * normal, com a chance de sempre, nunca falha por causa da task.
   */
  function runBreachTask({ id, tier }) {
    return new Promise((resolve) => {
      breachTaskOpen = true;
      pcTaskTargetEl.textContent = `ALVO: ${id.toUpperCase()}`;
      pcTaskTierEl.textContent = `TIER: ${tier.toUpperCase()}`;
      pcTaskResultEl.textContent = '';
      pcTaskResultEl.className = 'pc-task-result';
      pcScreenShowTask();

      const { zoneStart, zoneEnd } = layoutBreachTaskZone(tier);
      const { speed } = breachTaskParamsForTier(tier);
      pcTaskZoneEl.style.left = `${zoneStart * 100}%`;
      pcTaskZoneEl.style.width = `${(zoneEnd - zoneStart) * 100}%`;

      let pos = 0;
      let dir = 1;
      let lastTs = null;
      let rafId = null;
      let settled = false;

      function paintMarker() {
        pcTaskMarkerEl.style.left = `${pos * 100}%`;
      }

      function step(ts) {
        if (lastTs === null) lastTs = ts;
        const dt = (ts - lastTs) / 1000;
        lastTs = ts;
        pos += dir * speed * dt;
        if (pos >= 1) {
          pos = 1;
          dir = -1;
        } else if (pos <= 0) {
          pos = 0;
          dir = 1;
        }
        paintMarker();
        if (!settled) rafId = requestAnimationFrame(step);
      }
      paintMarker();
      rafId = requestAnimationFrame(step);

      function finish(attempt) {
        if (settled) return;
        settled = true;
        cancelAnimationFrame(rafId);
        clearTimeout(missTimeoutId);
        pcTaskBtn.removeEventListener('click', onAttempt);
        window.removeEventListener('keydown', onKeydown);
        breachTaskOpen = false;

        if (attempt) {
          pcTaskResultEl.textContent = attempt.perfect ? `PERFEITO! +${attempt.amount}%` : `BOM +${attempt.amount}%`;
          pcTaskResultEl.className = `pc-task-result ${attempt.perfect ? 'perfeito' : 'bom'}`;
        } else {
          pcTaskResultEl.textContent = 'ERROU A JANELA';
          pcTaskResultEl.className = 'pc-task-result errou';
        }

        setTimeout(() => resolve(attempt ? { stat: attempt.stat, amount: attempt.amount } : null), BREACH_TASK_VERDICT_HOLD_MS);
      }

      function onAttempt() {
        finish(resolveBreachTaskAttempt(pos, zoneStart, zoneEnd, tier));
      }

      function onKeydown(ev) {
        if (ev.code === 'Space') {
          ev.preventDefault();
          onAttempt();
        }
      }

      const missTimeoutId = setTimeout(() => finish(null), BREACH_TASK_AUTO_MISS_MS);
      pcTaskBtn.addEventListener('click', onAttempt);
      window.addEventListener('keydown', onKeydown);
    });
  }

  /**
   * Desenha o menu de acoes disponiveis no PC: minerar, e a lista dos 3
   * predios pra hackear remoto (com o nivel minimo de cada um). So
   * habilita os botoes quando nao ha nada em andamento (isMovementBlocked).
   */
  function renderPcMenu() {
    const busy = hackRuntime.isMovementBlocked;
    const energyCost = hackRuntime.energyMax != null ? Math.round(hackRuntime.energyMax * INFO_MINING_ENERGY_COST_RATIO) : null;
    pcMenuMineBtn.textContent = `[Minerar] informacao no PC (~30s, chance de sucesso, gasta ${energyCost} de energia)`;
    pcMenuMineBtn.disabled = busy;

    pcMenuSellBtn.textContent = `[Vender] toda a informacao por BYTE (estoque: ${hackRuntime.informationTotal})`;
    pcMenuSellBtn.disabled = busy || hackRuntime.informationTotal === 0;

    pcMenuTargetsEl.innerHTML = '';
    for (const entryTarget of hackRuntime.remoteHackTargets) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pc-menu-btn';
      if (entryTarget.locked) {
        btn.textContent = `${entryTarget.id.toUpperCase()} (tier ${entryTarget.tier}) - requer nivel ${entryTarget.requiredLevel}`;
        btn.disabled = true;
      } else {
        btn.textContent = `[Hackear] ${entryTarget.id.toUpperCase()} (tier ${entryTarget.tier})`;
        btn.disabled = busy;
        btn.addEventListener('click', () => startRemoteHack(entryTarget.id));
      }
      pcMenuTargetsEl.appendChild(btn);
    }
  }

  /**
   * Escreve no log/barra o desfecho de um hack (fisico ou remoto) -
   * compartilhado entre handleAction() e startRemoteHack() pra nao
   * duplicar a mesma logica de "o que mostrar pra cada tipo de resultado".
   */
  function pcRevealHackResult(result) {
    if (result.levelBlocked) {
      pcLogPush(`> NIVEL INSUFICIENTE (precisa nivel ${result.requiredLevel}, tem ${result.playerLevel})`, 'fail');
    } else if (result.energyBlocked) {
      pcLogPush('> ENERGIA INSUFICIENTE', 'fail');
    } else if (!result.breach.success) {
      pcLogPush('> [BREACH] FALHOU - conexao derrubada', 'fail');
    } else {
      pcLogPush('> [BREACH] acesso concedido', 'hi');
      pcLogPush('> [EXFILTRATE] copiando arquivos...', 'ok');
      pcLogPush('> [FENCE] convertendo em informacao', 'ok');
      pcLogPush(`> +1 informacao ${result.informationGained.rarity.toUpperCase()}`, 'hi');
    }
    pcLogPush('> conexao encerrada', 'ok');
  }

  function pcLogClear() {
    pcLogEl.innerHTML = '';
  }

  function pcLogPush(text, cls = '') {
    const line = document.createElement('div');
    line.className = `line ${cls}`;
    line.textContent = text;
    pcLogEl.appendChild(line);
    while (pcLogEl.children.length > 9) pcLogEl.removeChild(pcLogEl.firstChild);
  }

  function pcSetHead(targetLabel, tierLabel) {
    pcHeadTargetEl.textContent = `ALVO: ${targetLabel}`;
    pcHeadTierEl.textContent = `TIER: ${tierLabel}`;
  }

  function pcSetBar(percent, label, valueText) {
    pcBarLabelEl.textContent = label;
    pcBarFillEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    pcBarValEl.textContent = valueText;
  }

  /** Desenha a aba EQUIPE: um card por trabalhador contratavel, com retrato e botao de contratar/status. */
  function pcRenderWorkers() {
    pcWorkersEl.innerHTML = '';
    for (const worker of hackRuntime.hirableWorkers) {
      if (!workerPortraits[worker.id]) {
        workerPortraits[worker.id] = loadPortraitImage(worker.id);
      }
      const card = document.createElement('div');
      card.className = 'pc-worker-card';

      const img = workerPortraits[worker.id].cloneNode();
      const name = document.createElement('div');
      name.className = 'pc-worker-name';
      name.textContent = worker.name;

      const passive = document.createElement('div');
      passive.className = 'pc-worker-passive';
      if (worker.passive) passive.textContent = worker.passive.description;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pc-worker-btn';
      if (worker.hired) {
        btn.textContent = `[Hackear] gasta ${WORKER_ENERGY_COST} de energia`;
        btn.classList.add('hired');
        btn.disabled = worker.energyValue < WORKER_ENERGY_COST;
        btn.addEventListener('click', () => {
          handleHackWorkerNow(worker.id);
          pcRenderWorkers();
        });
      } else {
        btn.textContent = `contratar (${WORKER_HIRE_COST_BYTE} BYTE)`;
        btn.addEventListener('click', () => {
          handleHireWorker(worker.id);
          pcRenderWorkers();
        });
      }

      card.append(img, name, passive);

      if (worker.hired) {
        const energyRow = document.createElement('div');
        energyRow.className = 'pc-worker-energy-row';
        const label = document.createElement('span');
        label.textContent = 'ENERGIA';
        const track = document.createElement('div');
        track.className = 'pc-worker-energy-track';
        const fill = document.createElement('div');
        fill.className = 'pc-worker-energy-fill';
        fill.style.width = `${Math.round((worker.energyValue / worker.energyMax) * 100)}%`;
        track.appendChild(fill);
        const val = document.createElement('span');
        val.textContent = `${Math.round(worker.energyValue)}/${worker.energyMax}`;
        energyRow.append(label, track, val);
        card.appendChild(energyRow);
      }

      card.appendChild(btn);
      pcWorkersEl.appendChild(card);
    }
  }

  const PET_PORTRAITS = {
    gato_laranja: 'pet_gato_laranja.png',
    gato_cinza: 'pet_gato_cinza.png',
    gato_sphynx: 'pet_gato_sphynx.png',
  };
  const petPortraits = {};

  /**
   * Desenha a aba LOJA: puramente decorativo (nao muda nada no jogo, e nao
   * tem sprite proprio ainda dentro do quarto - so o retrato aqui na loja).
   */
  function pcRenderPets() {
    pcPetsEl.innerHTML = '';
    for (const pet of hackRuntime.pets) {
      if (!petPortraits[pet.id]) {
        petPortraits[pet.id] = loadPropImage(PET_PORTRAITS[pet.id]);
      }
      const card = document.createElement('div');
      card.className = 'pc-worker-card';

      const icon = petPortraits[pet.id].cloneNode();
      icon.className = 'pc-pet-icon';

      const name = document.createElement('div');
      name.className = 'pc-worker-name';
      name.textContent = pet.name;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pc-worker-btn';
      if (pet.owned) {
        btn.textContent = 'adotado';
        btn.classList.add('hired');
        btn.disabled = true;
      } else if (lastPetResult?.petId === pet.id && lastPetResult.result.reason === 'byte_insuficiente') {
        btn.textContent = `BYTE insuficiente (${hackRuntime.byteBalance}/${PET_COST_BYTE})`;
        btn.addEventListener('click', () => {
          handleBuyPet(pet.id);
          pcRenderPets();
        });
      } else {
        btn.textContent = `adotar (${PET_COST_BYTE} BYTE)`;
        btn.addEventListener('click', () => {
          handleBuyPet(pet.id);
          pcRenderPets();
        });
      }

      card.append(icon, name, btn);
      pcPetsEl.appendChild(card);
    }
  }

  function handleBuyPet(petId) {
    lastPetResult = { petId, result: hackRuntime.buyPet(petId) };
  }

  let lastTradeResult = null;

  /**
   * Desenha a sparkline da BITE - sem lib de grafico nenhuma, so canvas 2D
   * puro. Alem da linha (pontos de verdade, sem suavizar - nao inventa
   * curva onde o preco e reto), tem: grade horizontal discreta pra dar
   * referencia de escala, preenchimento em gradiente sob a linha (reforca
   * a tendencia de longe, sem precisar ler numero), ponto com brilho no
   * preco atual, e os rotulos de minimo/maximo do periodo visivel.
   */
  function drawTradeChart(history) {
    const ctx = pcTradeChartEl.getContext('2d');
    const w = pcTradeChartEl.width;
    const h = pcTradeChartEl.height;
    ctx.clearRect(0, 0, w, h);
    if (history.length < 2) return;

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const padX = 12;
    const padY = 16;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;
    const stepX = plotW / (history.length - 1);
    const up = history[history.length - 1] >= history[0];
    const color = up ? '#4dffb8' : '#ff5d6a';
    const fillColor = up ? '77, 255, 184' : '255, 93, 106';

    const toXY = (price, index) => ({
      x: padX + index * stepX,
      y: padY + (1 - (price - min) / range) * plotH,
    });

    // grade horizontal (topo/meio/base), bem discreta - so referencia de escala
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 2; i++) {
      const y = Math.round(padY + (plotH / 2) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
    }

    // preenchimento em gradiente sob a linha, na mesma cor da tendencia
    const gradient = ctx.createLinearGradient(0, padY, 0, h - padY);
    gradient.addColorStop(0, `rgba(${fillColor}, 0.28)`);
    gradient.addColorStop(1, `rgba(${fillColor}, 0)`);
    ctx.beginPath();
    history.forEach((price, index) => {
      const { x, y } = toXY(price, index);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(padX + (history.length - 1) * stepX, h - padY);
    ctx.lineTo(padX, h - padY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // linha principal (pontas arredondadas, sem suavizar os dados)
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    history.forEach((price, index) => {
      const { x, y } = toXY(price, index);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ponto do preco atual, com um leve brilho
    const last = toXY(history[history.length - 1], history.length - 1);
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // rotulos de minimo/maximo do periodo visivel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(max.toFixed(2), padX, 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText(min.toFixed(2), padX, h - 2);
  }

  /** Redesenha o painel TRADE inteiro (preco, cor, grafico) - chamado ao abrir a aba e a cada frame enquanto ela estiver visivel. */
  function renderTradePanel() {
    const history = hackRuntime.biteHistory;
    const price = hackRuntime.bitePrice;
    const prevPrice = history.length > 1 ? history[history.length - 2] : price;
    const up = price >= prevPrice;

    pcTradePriceEl.textContent = price.toFixed(2);
    pcTradePriceEl.classList.toggle('up', up);
    pcTradePriceEl.classList.toggle('down', !up);
    drawTradeChart(history);

    const canAfford = hackRuntime.byteBalance >= BITE_TRADE_STAKE_BYTE;
    pcTradeUpBtn.disabled = !canAfford;
    pcTradeDownBtn.disabled = !canAfford;

    if (!lastTradeResult) {
      pcTradeResultEl.textContent = canAfford
        ? `aposta ${BITE_TRADE_STAKE_BYTE} BYTE, acerta e ganha ${BITE_TRADE_PAYOUT_BYTE} BYTE`
        : `BYTE insuficiente (precisa de ${BITE_TRADE_STAKE_BYTE})`;
      pcTradeResultEl.className = 'pc-trade-result';
    }
  }

  function handleTrade(direction) {
    const result = hackRuntime.tradeBite(direction);
    if (!result.success) {
      lastTradeResult = null;
      renderTradePanel();
      return;
    }
    lastTradeResult = result;
    renderTradePanel();
    if (result.correct) {
      pcTradeResultEl.textContent = `ACERTOU! +${BITE_TRADE_PAYOUT_BYTE - BITE_TRADE_STAKE_BYTE} BYTE`;
      pcTradeResultEl.className = 'pc-trade-result win';
    } else {
      pcTradeResultEl.textContent = `ERROU. -${BITE_TRADE_STAKE_BYTE} BYTE`;
      pcTradeResultEl.className = 'pc-trade-result lose';
    }
  }

  /**
   * Abre a tela do PC so com a aba TRADE (sem terminal/equipe/loja, que
   * nao fazem sentido no laptop do bar) - so funciona parado nele, dentro
   * do nullpoint_interior.
   */
  function handleOpenBarTrade() {
    if (hackRuntime.nearbyBarInteractable() !== 'laptop') return;
    if (hackRuntime.isMovementBlocked) return;
    lastTradeResult = null;
    pcScreenOpen({ tabs: ['trade'], activeTab: 'trade' });
  }

  /**
   * Mesa trancada dentro da BLACKNET (ver blacknetLocations.js): abre a
   * mesma tela do PC, direto na aba EQUIPE, pra comprar aquele
   * trabalhador ali mesmo - nao precisa voltar pra casa so pra isso.
   */
  function handleOpenBlacknetHire(workerId) {
    if (hackRuntime.nearbyLockedBlacknetDesk() !== workerId) return;
    pcScreenOpen({ tabs: ['equipe'], activeTab: 'equipe' });
    pcRenderWorkers();
  }

  let lastGymResult = null;

  /**
   * Desafia o lutador/lider da vez no ginasio da CORP (ver corpGym.js):
   * roda a mesma task de sincronizacao (Breach Sync) do hack normal, mas
   * aqui o resultado dela decide a luta inteira - acertar vence o estagio
   * (credita a Informacao e destranca o proximo), errar so deixa tentar de
   * novo (nenhum progresso e perdido, igual a filosofia do resto do jogo).
   */
  async function handleChallengeCorpGymStage(stageId) {
    if (hackRuntime.nearbyCorpGymDesk() !== stageId) return;
    if (hackRuntime.corpGymStageStatus(stageId) !== 'current') return;
    const stage = hackRuntime.corpGymStages.find((s) => s.id === stageId);
    if (!stage) return;

    pcScreenOpen({ tabs: ['terminal'], activeTab: 'terminal' });
    const taskResult = await runBreachTask({ id: stageId, tier: stage.taskTier });

    pcScreenShowRun();
    pcLogClear();
    pcSetHead(stageId.toUpperCase(), stage.taskTier.toUpperCase());
    pcSetBar(0, 'STATUS', '--');

    if (taskResult) {
      const outcome = hackRuntime.defeatCorpGymStage(stageId);
      if (outcome.success) {
        pcLogPush('> [SYNC] vitoria', 'hi');
        pcLogPush(`> +1 informacao ${outcome.rarity.toUpperCase()}`, 'hi');
        lastGymResult = { stageId, success: true, rarity: outcome.rarity, gymCompleted: outcome.gymCompleted };
      } else {
        pcLogPush('> [SYNC] falha inesperada', 'fail');
        lastGymResult = { stageId, success: false };
      }
    } else {
      pcLogPush('> [SYNC] falhou - tente de novo', 'fail');
      lastGymResult = { stageId, success: false };
    }
    pcLogPush('> conexao encerrada', 'ok');

    await wait(2200);
    pcScreenClose();
  }

  let lastDrinkMenuResult = null;
  const drinkItemButtons = {};

  /**
   * Monta a lista de drinks UMA vez (botoes fixos, so criados de novo ao
   * reabrir o cardapio) - refazer o innerHTML a cada frame destruia os
   * botoes debaixo do clique do jogador (o elemento sumia antes do click
   * "pegar"). O que muda quadro a quadro (BYTE disponivel, contagem
   * regressiva do buff) fica em updateDrinkMenuDynamic().
   */
  function renderDrinkMenu() {
    drinkListEl.innerHTML = '';
    for (const drink of DRINKS) {
      const item = document.createElement('div');
      item.className = 'drink-item';

      const info = document.createElement('div');
      info.className = 'drink-item-info';
      const name = document.createElement('div');
      name.className = 'drink-item-name';
      name.textContent = drink.name;
      const buff = document.createElement('div');
      buff.className = 'drink-item-buff';
      buff.textContent = `+${drink.label} por ${Math.round(DRINK_BUFF_DURATION_MS / 1000)}s`;
      info.append(name, buff);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'drink-item-btn';
      btn.textContent = `${drink.costByte} BYTE`;
      btn.addEventListener('click', () => handleOrderDrink(drink.id));
      drinkItemButtons[drink.id] = btn;

      item.append(info, btn);
      drinkListEl.appendChild(item);
    }
    updateDrinkMenuDynamic();
  }

  /** So atualiza texto/disabled dos botoes ja existentes - chamado a cada frame enquanto o cardapio estiver aberto. */
  function updateDrinkMenuDynamic() {
    const balance = hackRuntime.byteBalance;
    for (const drink of DRINKS) {
      const btn = drinkItemButtons[drink.id];
      if (btn) btn.disabled = balance < drink.costByte;
    }

    const activeBuff = hackRuntime.activeDrinkBuff;
    if (activeBuff) {
      const drink = DRINKS.find((d) => d.id === activeBuff.drinkId);
      const secsLeft = Math.max(0, Math.ceil((activeBuff.expiresAt - Date.now()) / 1000));
      drinkActiveEl.textContent = `ativo: ${drink?.name ?? activeBuff.drinkId} (+${drink?.label ?? activeBuff.stat}) - ${secsLeft}s`;
    } else {
      drinkActiveEl.textContent = '';
    }

    if (lastDrinkMenuResult && !lastDrinkMenuResult.success) {
      drinkResultEl.textContent = 'BYTE insuficiente pra esse drink';
      drinkResultEl.className = 'drink-result lose';
    } else {
      drinkResultEl.textContent = '';
      drinkResultEl.className = 'drink-result';
    }
  }

  function handleOrderDrink(drinkId) {
    lastDrinkMenuResult = hackRuntime.orderDrink(drinkId);
    updateDrinkMenuDynamic();
  }

  /** Abre o cardapio de drinks - so funciona parado perto do balcao/atendente do bar. */
  function handleOpenDrinkMenu() {
    const nearby = hackRuntime.nearbyBarInteractable();
    if (nearby !== 'counter' && nearby !== 'bartender') return;
    if (hackRuntime.isMovementBlocked) return;
    lastDrinkMenuResult = null;
    drinkMenuEl.hidden = false;
    renderDrinkMenu();
  }

  function closeDrinkMenu() {
    drinkMenuEl.hidden = true;
  }

  function updateStatus() {
    const sittingText = hackRuntime.isSitting ? ' | sentado no banco' : '';
    statusEl.textContent = `mapa: ${mapManager.currentMap.id} | posicao: (${mapManager.playerCol}, ${mapManager.playerRow}) | direcao: ${controller.direction} | pose: ${controller.pose}${sittingText}`;

    const stats = hackRuntime.playerStats;
    const xpNeeded = xpRequiredForLevel(stats.level);
    hudLevelEl.textContent = stats.level;
    hudXpFillEl.style.width = `${Math.min(100, (stats.xp / xpNeeded) * 100)}%`;
    hudXpValueEl.textContent = `${stats.xp}/${xpNeeded}`;

    const energyValue = hackRuntime.energyValue;
    const energyMax = hackRuntime.energyMax;
    const energyPct = (energyValue / energyMax) * 100;
    hudEnergyFillEl.style.width = `${energyPct}%`;
    hudEnergyFillEl.classList.toggle('low', energyPct < 25);
    hudEnergyValueEl.textContent = `${energyValue.toFixed(0)}/${energyMax}`;

    const traceValue = traceMeter.value;
    hudTraceFillEl.style.width = `${(traceValue / TRACE_MAX) * 100}%`;
    hudTraceValueEl.textContent = traceValue.toFixed(0);

    hudByteEl.textContent = `◈ ${hackRuntime.byteBalance} BYTE`;
    hudStatBreachEl.textContent = `BSpd ${stats.breachSpeed}`;
    hudStatStealthEl.textContent = `Stl ${stats.stealth}`;
    hudStatLootEl.textContent = `Loot ${stats.lootYield}`;
    hudStatTraceEl.textContent = `TRes ${stats.traceResistance}`;

    const info = hackRuntime.informationCounts;
    hudInfoComumEl.textContent = info.comum;
    hudInfoRaraEl.textContent = info.rara;
    hudInfoEpicaEl.textContent = info.epica;
    hudInfoTotalEl.textContent = hackRuntime.informationTotal;
  }

  const petRoomImages = {};

  /**
   * Desenha os pets adotados em cima da cama, so no player_home - puramente
   * cosmetico (ver pets.js), com a cabeca/orelha balancando sozinha (seno
   * no tempo, sem depender de nenhum input). Mais de um pet adotado fica
   * lado a lado em cima da cama, cada um com uma fase propria pra nao
   * balancarem em sincronia perfeita.
   */
  function drawOwnedPets(nowMs) {
    if (mapManager.currentMap?.id !== PLAYER_HOME_MAP_ID) return;
    const ownedPets = hackRuntime.pets.filter((pet) => pet.owned);
    if (ownedPets.length === 0) return;

    const spacingPx = 20;
    const startOffset = -((ownedPets.length - 1) * spacingPx) / 2;

    ownedPets.forEach((pet, index) => {
      const config = PET_ROOM_SPRITES[pet.id];
      if (!config) return;
      if (!petRoomImages[pet.id]) {
        petRoomImages[pet.id] = {
          body: loadPropImage(config.body),
          ear: loadPropImage(config.ear),
          earBox: config.earBox,
          earPivot: config.earPivot,
        };
      }
      const sprites = petRoomImages[pet.id];
      const phase = index * 2.1;
      const angle = PET_EAR_WIGGLE_MAX_RAD * Math.sin((nowMs / PET_EAR_WIGGLE_PERIOD_MS) * Math.PI * 2 + phase);
      const xOffsetPx = PET_BED_OFFSET_X_PX + startOffset + index * spacingPx;
      const stretch = petStretchScale(nowMs, index * 5300);
      mapRenderer.drawPet(
        HOME_BED_LOCATION.originX,
        HOME_BED_LOCATION.originY,
        sprites,
        PET_ROOM_ART_HEIGHT_PX,
        angle,
        xOffsetPx,
        PET_BED_OFFSET_Y_PX,
        stretch
      );
    });
  }

  const BLACKNET_SEAT_SPRITE_HEIGHT_PX = 40;
  const blacknetSeatSprites = {};

  function getBlacknetSeatSprite(characterId) {
    if (!blacknetSeatSprites[characterId]) {
      blacknetSeatSprites[characterId] = loadCharacterAssets(characterId).up.idle;
    }
    return blacknetSeatSprites[characterId];
  }

  /**
   * Desenha os trabalhadores contratados (ver workers.js) sentados de
   * costas nas mesas da BLACKNET - puramente cosmetico, mesmo esquema
   * visual dos pets na cama do quarto: sprite estatico, sem tween nem
   * colisao propria (a colisao da mesa/cadeira ja esta no mapa). Cada
   * mesa so aparece ocupada depois que aquele trabalhador e contratado;
   * antes disso, mostra um cadeado (ver drawBlacknetLocks).
   */
  function drawBlacknetWorkers() {
    if (mapManager.currentMap?.id !== BLACKNET_MAP_ID) return;

    for (const worker of hackRuntime.hirableWorkers) {
      if (!worker.hired) continue;
      const desk = BLACKNET_WORKER_DESKS[worker.id];
      if (!desk) continue;
      const sprite = getBlacknetSeatSprite(worker.id);
      if (!isImageReady(sprite)) continue;
      const { x, y } = gridToScreen(desk.seatCol, desk.seatRow, mapRenderer.originX, mapRenderer.originY);
      const h = BLACKNET_SEAT_SPRITE_HEIGHT_PX;
      const w = sprite.naturalWidth * (h / sprite.naturalHeight);
      ctx.drawImage(sprite, x - w / 2, y + TILE_SIZE / 2 - h, w, h);
    }
  }

  const BLACKNET_LOCK_FONT = `${Math.round(TILE_SIZE * 0.7)}px sans-serif`;

  /** Desenha um cadeado por cima de cada mesa ainda nao contratada dentro da BLACKNET. */
  function drawBlacknetLocks() {
    if (mapManager.currentMap?.id !== BLACKNET_MAP_ID) return;
    const hiredIds = new Set(hackRuntime.hirableWorkers.filter((w) => w.hired).map((w) => w.id));
    ctx.save();
    ctx.font = BLACKNET_LOCK_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [workerId, desk] of Object.entries(BLACKNET_WORKER_DESKS)) {
      if (hiredIds.has(workerId)) continue;
      const location = blacknetDeskLocation(desk);
      const { x, y } = gridToScreen(location.originX, location.originY, mapRenderer.originX, mapRenderer.originY);
      ctx.fillText('🔒', x, y);
    }
    ctx.restore();
  }

  const CORP_GYM_SEAT_SPRITE_HEIGHT_PX = 40;
  const CORP_GYM_LEADER_SEAT_SPRITE_HEIGHT_PX = 50;
  const CORP_GYM_LOCK_FONT = `${Math.round(TILE_SIZE * 0.7)}px sans-serif`;
  // Amplitude/periodo bem sutis (bem menores que o petStretchScale, que e
  // um "burst" ocasional) - aqui e continuo, pra dar a sensacao de um NPC
  // parado respirando, nao de uma animacao chamando atencao.
  const CORP_GYM_BREATH_AMPLITUDE = 0.025;
  const CORP_GYM_BREATH_PERIOD_MS = 2600;

  /**
   * Escala vertical continua (respiracao) ancorada nos pes do sprite -
   * diferente do petStretchScale (que e um "burst" periodico pontual),
   * aqui e um seno continuo e suave, sempre ativo enquanto o NPC estiver
   * visivel. `phaseMs` desalinha cada NPC do resto pra nao respirarem
   * todos em sincronia perfeita.
   */
  function npcBreathScale(nowMs, phaseMs = 0) {
    const sy = 1 + CORP_GYM_BREATH_AMPLITUDE * Math.sin(((nowMs + phaseMs) / CORP_GYM_BREATH_PERIOD_MS) * Math.PI * 2);
    return { sx: 1, sy };
  }

  const corpGymSeatSprites = {};

  function getCorpGymSeatSprite(characterId) {
    if (!corpGymSeatSprites[characterId]) {
      corpGymSeatSprites[characterId] = loadCharacterAssets(characterId).up.idle;
    }
    return corpGymSeatSprites[characterId];
  }

  /**
   * Desenha os NPCs do ginasio da CORP (ver corpGym.js/corpGymLocations.js):
   * mesa ainda trancada (fora de ordem) mostra cadeado, igual a BLACKNET;
   * mesa da vez ou ja vencida mostra o "lutador" sentado, respirando (ver
   * npcBreathScale) - o lider (ultima mesa) fica visualmente maior, pra se
   * destacar dos outros.
   */
  function drawCorpGymNpcs(nowMs) {
    if (mapManager.currentMap?.id !== CORP_GYM_MAP_ID) return;

    ctx.save();
    ctx.font = CORP_GYM_LOCK_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    hackRuntime.corpGymStages.forEach((stage, index) => {
      const desk = CORP_GYM_DESKS[stage.id];
      if (!desk) return;

      if (stage.status === 'locked') {
        const location = corpGymDeskLocation(stage.id);
        const { x, y } = gridToScreen(location.originX, location.originY, mapRenderer.originX, mapRenderer.originY);
        ctx.fillText('🔒', x, y);
        return;
      }

      const sprite = getCorpGymSeatSprite(desk.characterId);
      if (!isImageReady(sprite)) return;
      const isLeader = stage.id === 'leader';
      const h = isLeader ? CORP_GYM_LEADER_SEAT_SPRITE_HEIGHT_PX : CORP_GYM_SEAT_SPRITE_HEIGHT_PX;
      const w = sprite.naturalWidth * (h / sprite.naturalHeight);
      const { x, y } = gridToScreen(desk.seatCol, desk.seatRow, mapRenderer.originX, mapRenderer.originY);
      const feetX = x;
      const feetY = y + TILE_SIZE / 2;
      const { sx, sy } = npcBreathScale(nowMs, index * 700);
      ctx.save();
      ctx.translate(feetX, feetY);
      ctx.scale(sx, sy);
      ctx.translate(-feetX, -feetY);
      ctx.drawImage(sprite, x - w / 2, feetY - h, w, h);
      ctx.restore();
    });

    ctx.restore();
  }

  let hackingBuildingId = null;
  let lastHackResult = null;

  function updateHackStatus() {
    if (hackingBuildingId) {
      hackStatusEl.textContent = `hackeando ${hackingBuildingId}... (status: ${hackRuntime.hackSession.status})`;
      return;
    }
    if (lastHackResult) {
      const { target, recon, breach, exfiltrate, informationGained, energyBlocked, energySpent, levelBlocked, requiredLevel, playerLevel } = lastHackResult;
      if (levelBlocked) {
        hackStatusEl.textContent = `ultimo hack (${target.id}, tier ${target.tier}): NIVEL INSUFICIENTE (precisa nivel ${requiredLevel}, tem ${playerLevel})`;
        return;
      }
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
        `${exfiltrate.overTime ? ' (estourou o tempo)' : ''} | informacao obtida: ${informationGained?.rarity ?? '-'} | XP ganho: ${lastHackResult.xpGained}` +
        `${lastHackResult.leveledUp ? ' | SUBIU DE NIVEL!' : ''} | energia gasta: ${energySpent} | trace: ${traceMeter.value.toFixed(1)}`;
      return;
    }
    const nearby = hackRuntime.nearbyHackableBuilding();
    hackStatusEl.textContent = nearby ? `[ESPACO/ENTER] hackear ${nearby.id}` : 'nenhum predio hackavel por perto';
  }

  let lastMineResult = null;
  let lastSleepResult = null;
  let lastNearbyHome = null;
  let lastDrinkResult = null;
  let lastNearbyBar = null;
  let lastSellResult = null;
  let lastHireResult = null;
  let lastNearbyHomeForWorkers = null;

  function updateShopStatus() {
    const nearby = hackRuntime.nearbyHomeInteractable();
    if (nearby !== lastNearbyHome) {
      // saiu/entrou de perto do PC ou da cama: o resultado anterior nao vale
      // mais como "recem-aconteceu", senao ele fica preso na tela pra sempre
      // (o jogador ve uma compra/sono de minutos atras como se fosse agora).
      lastMineResult = null;
      lastSleepResult = null;
      lastNearbyHome = nearby;
    }

    const nearbyBar = hackRuntime.nearbyBarInteractable();
    if (nearbyBar !== lastNearbyBar) {
      lastDrinkResult = null;
      lastNearbyBar = nearbyBar;
    }

    const lockedDeskWorkerId = hackRuntime.nearbyLockedBlacknetDesk();

    if (nearbyBar === 'stool') {
      shopStatusEl.textContent = hackRuntime.isSitting ? '[C] levantar do banco' : '[C] sentar no banco (so cosmetico)';
      return;
    }

    if (nearbyBar === 'counter' || nearbyBar === 'bartender') {
      const label = nearbyBar === 'bartender' ? `${BAR_OWNER_NAME} (dono do bar)` : 'balcao do bar';
      if (!lastDrinkResult) {
        shopStatusEl.textContent =
          nearbyBar === 'bartender'
            ? `[D] ${label}: "aqui e casa, so nao fode com a clientela" - energetico por ${DRINK_COST_BYTE} BYTE`
            : `[D] ${label}: pedir um energetico por ${DRINK_COST_BYTE} BYTE (recarrega a energia)`;
      } else if (lastDrinkResult.success) {
        shopStatusEl.textContent = `[D] ${label}: energetico servido por ${lastDrinkResult.byteSpent} BYTE, energia recarregada`;
      } else if (lastDrinkResult.reason === 'energia_cheia') {
        shopStatusEl.textContent = `[D] ${label}: energia ja esta cheia`;
      } else if (lastDrinkResult.reason === 'byte_insuficiente') {
        shopStatusEl.textContent = `[D] ${label}: BYTE insuficiente (precisa de ${DRINK_COST_BYTE}, tem ${hackRuntime.byteBalance})`;
      } else {
        shopStatusEl.textContent = `[D] ${label}: nao foi possivel pedir agora`;
      }
      shopStatusEl.textContent += ' | [M] cardapio (drinks com buff, nao recarrega energia)';
      return;
    }

    if (lockedDeskWorkerId) {
      const worker = hackRuntime.hirableWorkers.find((w) => w.id === lockedDeskWorkerId);
      shopStatusEl.textContent = `[ESPACO] comprar ${worker?.name ?? lockedDeskWorkerId} (${WORKER_HIRE_COST_BYTE} BYTE)`;
      return;
    }

    if (nearby === 'pc') {
      const energyCost = hackRuntime.energyMax != null ? Math.round(hackRuntime.energyMax * INFO_MINING_ENERGY_COST_RATIO) : null;
      if (hackRuntime.isMining) {
        const secs = Math.ceil(hackRuntime.miningRemainingMs / 1000);
        shopStatusEl.textContent = `[B] minerando... ${secs}s`;
      } else if (!lastMineResult) {
        shopStatusEl.textContent = '[B] abrir o PC (minerar ou hackear remoto)';
      } else if (lastMineResult.success) {
        shopStatusEl.textContent = `[B] minerou com sucesso: +1 informacao ${lastMineResult.rarity} (energia gasta: ${lastMineResult.energySpent})`;
      } else if (lastMineResult.reason === 'sem_energia') {
        shopStatusEl.textContent = `[B] energia insuficiente pra minerar (precisa de ${energyCost}, tem ${hackRuntime.energyValue.toFixed(0)})`;
      } else {
        shopStatusEl.textContent = `[B] minerou sem sucesso (energia gasta: ${lastMineResult.energySpent}), tenta de novo`;
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

  /**
   * Linha separada do shop-status: os trabalhadores contratados (ver
   * workers.js) trabalham sozinhos o tempo todo, entao mostra quantos
   * estao ativos em qualquer lugar do mapa; perto do PC, mostra tambem o
   * menu de contratacao (teclas 1/2/3).
   */
  function updateWorkerStatus() {
    const nearby = hackRuntime.nearbyHomeInteractable();
    if (nearby !== lastNearbyHomeForWorkers) {
      lastHireResult = null;
      lastNearbyHomeForWorkers = nearby;
    }

    const workers = hackRuntime.hirableWorkers;
    const hiredCount = workers.filter((w) => w.hired).length;

    if (nearby !== 'pc') {
      workerStatusEl.textContent = hiredCount > 0
        ? `equipe: ${hiredCount}/${workers.length} trabalhando sozinho(s) em segundo plano`
        : '';
      return;
    }

    const lines = workers.map((worker, index) => {
      const key = index + 1;
      if (worker.hired) {
        return `[${key}] ${worker.name}: contratado, minerando sozinho`;
      }
      if (lastHireResult?.workerId === worker.id && lastHireResult.result.reason === 'byte_insuficiente') {
        return `[${key}] ${worker.name}: BYTE insuficiente (precisa de ${WORKER_HIRE_COST_BYTE}, tem ${hackRuntime.byteBalance})`;
      }
      return `[${key}] ${worker.name}: contratar por ${WORKER_HIRE_COST_BYTE} BYTE`;
    });
    workerStatusEl.textContent = lines.join('\n');
  }

  /** Mostra o progresso do ginasio da CORP so enquanto o jogador estiver dentro dele. */
  function updateGymStatus() {
    if (mapManager.currentMap?.id !== CORP_GYM_MAP_ID) {
      gymStatusEl.textContent = '';
      return;
    }
    const stages = hackRuntime.corpGymStages;
    const defeatedCount = stages.filter((s) => s.status === 'defeated').length;
    let line = `ginasio CORP: ${defeatedCount}/${stages.length} vencidos`;
    if (lastGymResult) {
      line += lastGymResult.success
        ? ` | ultima luta: VITORIA (+1 info ${lastGymResult.rarity.toUpperCase()})${lastGymResult.gymCompleted ? ' | GINASIO COMPLETO!' : ''}`
        : ' | ultima luta: derrota, tente de novo';
    }
    gymStatusEl.textContent = line;
  }

  const MINING_FLAVOR_LINES = [
    '> escaneando redes abertas...',
    '> testando credenciais fracas...',
    '> filtrando trafego de rede...',
    '> tentando burlar firewall...',
    '> compilando pacotes de dados...',
  ];

  /**
   * Abre a tela do PC no MENU (nao comeca nada sozinho) - o jogador
   * escolhe minerar ou hackear um dos predios remoto, e so ai a acao
   * comeca de verdade (startMining/startRemoteHack). So funciona parado
   * no PC, no player_home.
   */
  function handleOpenPc() {
    if (hackRuntime.nearbyHomeInteractable() !== 'pc') return;
    if (hackRuntime.isMovementBlocked) return;
    lastTradeResult = null;
    pcScreenOpen({ tabs: ['terminal', 'equipe', 'loja', 'trade'], activeTab: 'terminal' });
    renderPcMenu();
    pcRenderWorkers();
    pcRenderPets();
    pcScreenShowMenu();
  }

  async function startMining() {
    if (hackRuntime.isMining) return;
    updateShopStatus();

    pcScreenShowRun();
    pcLogClear();
    pcSetHead('PC DE CASA', 'MINERACAO');
    pcSetBar(0, 'MINERANDO', '30s');
    pcLogPush('> conectando ao PC...', 'ok');

    const resultPromise = hackRuntime.mineInformation();
    const totalMs = hackRuntime.miningRemainingMs || 30000;
    let flavorIndex = 0;
    const intervalId = setInterval(() => {
      const remaining = hackRuntime.miningRemainingMs;
      const pct = (1 - remaining / totalMs) * 100;
      pcSetBar(pct, 'MINERANDO', `${Math.ceil(remaining / 1000)}s`);
      if (!hackRuntime.isMining) {
        clearInterval(intervalId);
        return;
      }
      if (Math.random() < 0.4) {
        pcLogPush(MINING_FLAVOR_LINES[flavorIndex % MINING_FLAVOR_LINES.length], 'ok');
        flavorIndex += 1;
      }
    }, 2500);

    const result = await resultPromise;
    clearInterval(intervalId);
    lastMineResult = result;
    updateShopStatus();

    if (result.reason === 'sem_energia') {
      pcLogPush('> ENERGIA INSUFICIENTE', 'fail');
    } else if (result.success) {
      pcSetBar(100, 'CONCLUIDO', '100%');
      pcLogPush(`> +1 informacao ${result.rarity.toUpperCase()}`, 'hi');
    } else {
      pcSetBar(100, 'CONCLUIDO', '100%');
      pcLogPush('> nenhuma informacao encontrada dessa vez', 'fail');
    }
    await wait(2000);
    if (pcScreenEl.hidden) return;
    renderPcMenu();
    pcScreenShowMenu();
  }

  /** Hackeia um dos 3 predios remotamente, direto do menu do PC (ver hackRuntime.triggerRemoteHack). */
  async function startRemoteHack(buildingId) {
    const target = hackRuntime.remoteHackTargets.find((t) => t.id === buildingId);
    if (!target || target.locked) return;

    const taskBuff = await runBreachTask({ id: buildingId, tier: target.tier });

    pcScreenShowRun();
    pcLogClear();
    pcSetHead(buildingId.toUpperCase(), target.tier.toUpperCase());
    pcSetBar(0, 'STATUS', '--');
    pcLogPush(`> conectando a ${buildingId}...`, 'ok');

    const result = await runHackVisual(hackRuntime.triggerRemoteHack(buildingId, taskBuff));
    lastHackResult = result;
    updateHackStatus();
    pcRevealHackResult(result);

    await wait(2200);
    if (pcScreenEl.hidden) return;
    renderPcMenu();
    pcScreenShowMenu();
  }

  function handleSleep() {
    lastSleepResult = hackRuntime.sleep();
    updateShopStatus();
  }

  function handleBuyDrink() {
    lastDrinkResult = hackRuntime.buyDrink();
    updateShopStatus();
  }

  function handleSellInformation() {
    lastSellResult = hackRuntime.sellInformation();
    updateShopStatus();
  }

  /** Igual handleSellInformation(), so que tambem re-renderiza o menu do PC (o botao mostra o estoque restante). */
  function handleSellInformationFromPc() {
    handleSellInformation();
    renderPcMenu();
  }

  function handleHireWorker(workerId) {
    const result = hackRuntime.hireWorker(workerId);
    lastHireResult = { workerId, result };
    updateWorkerStatus();
    if (!pcScreenEl.hidden && !pcTabEquipeEl.hidden) pcRenderWorkers();
  }

  /** Manda o trabalhador `workerId` hackear agora, gastando a energia PROPRIA dele (ver hackRuntime.hackWorkerNow). */
  function handleHackWorkerNow(workerId) {
    hackRuntime.hackWorkerNow(workerId);
    if (!pcScreenEl.hidden && !pcTabEquipeEl.hidden) pcRenderWorkers();
  }

  function handleToggleSit() {
    hackRuntime.toggleSit();
    updateStatus();
    updateShopStatus();
  }

  const HACK_FLAVOR_LINES = [
    '> mapeando defesas do perimetro...',
    '> testando portas de entrada...',
    '> contornando deteccao de intrusao...',
    '> forcando camadas de criptografia...',
    '> interceptando pacotes de resposta...',
  ];

  /**
   * Acompanha o hack de verdade (fisico ou remoto) enquanto ele roda -
   * o delay real agora mora no proprio HackRuntime (ver hackDelayMs em
   * hackRuntime.js), entao aqui e so ler `hackRemainingMs`/`isHacking` e
   * atualizar a barra + linhas de "sabor" aleatorias, mesmo padrao do
   * startMining(). Um hack que nem chega a tentar (levelBlocked/
   * energyBlocked) resolve quase instantaneo, entao o loop nem chega a
   * rodar de verdade - sem espera artificial pra um resultado que ja se
   * sabe de cara.
   */
  async function runHackVisual(resultPromise) {
    const totalMs = hackRuntime.hackRemainingMs || 20000;
    let flavorIndex = 0;
    const intervalId = setInterval(() => {
      const remaining = hackRuntime.hackRemainingMs;
      const pct = (1 - remaining / totalMs) * 100;
      pcSetBar(pct, 'BREACH', `${Math.ceil(remaining / 1000)}s`);
      if (!hackRuntime.isHacking) {
        clearInterval(intervalId);
        return;
      }
      if (Math.random() < 0.4) {
        pcLogPush(HACK_FLAVOR_LINES[flavorIndex % HACK_FLAVOR_LINES.length], 'ok');
        flavorIndex += 1;
      }
    }, 1500);

    const result = await resultPromise;
    clearInterval(intervalId);
    return result;
  }

  async function handleAction() {
    const nearby = hackRuntime.nearbyHackableBuilding();
    if (!nearby) {
      const lockedDeskWorkerId = hackRuntime.nearbyLockedBlacknetDesk();
      if (lockedDeskWorkerId) {
        handleOpenBlacknetHire(lockedDeskWorkerId);
        return;
      }
      const corpGymStageId = hackRuntime.nearbyCorpGymDesk();
      if (corpGymStageId && hackRuntime.corpGymStageStatus(corpGymStageId) === 'current') {
        await handleChallengeCorpGymStage(corpGymStageId);
      }
      return;
    }
    hackingBuildingId = nearby.id;
    updateHackStatus();

    pcScreenOpen({ tabs: ['terminal'], activeTab: 'terminal' });

    // Nivel insuficiente ja vai recusar o hack em triggerHack() - nem vale
    // a pena gastar o tempo do jogador com a task, o bonus dela seria
    // descartado de qualquer jeito.
    const levelBlocked = hackRuntime.playerStats.level < requiredLevelForTier(nearby.target.tier);
    const taskBuff = levelBlocked ? null : await runBreachTask({ id: nearby.id, tier: nearby.target.tier });

    pcScreenShowRun();
    pcLogClear();
    pcSetHead(nearby.id.toUpperCase(), nearby.target.tier.toUpperCase());
    pcSetBar(0, 'STATUS', '--');
    pcLogPush(`> conectando a ${nearby.id}...`, 'ok');

    const result = await runHackVisual(hackRuntime.triggerHack(taskBuff));
    lastHackResult = result;
    hackingBuildingId = null;
    updateHackStatus();
    pcRevealHackResult(result);

    await wait(2200);
    pcScreenClose();
  }

  /**
   * Interativel disponivel agora (NPC, PC, laptop, banco, predio hackavel,
   * terminal da BLACKNET) - usado tanto pro balao de fala (render()) quanto
   * pro clique direto no personagem/objeto (ver canvas 'click' abaixo). So
   * um por vez: a mesma prioridade de nearbyBarInteractable/etc.
   */
  function getActiveHint() {
    if (hackRuntime.isMovementBlocked) return null;
    if (!pcScreenEl.hidden || !drinkMenuEl.hidden) return null;

    const nearbyHome = hackRuntime.nearbyHomeInteractable();
    if (nearbyHome === 'pc') {
      return { location: HOME_PC_LOCATION, text: '[B] abrir o PC, ou clique nele', trigger: handleOpenPc };
    }
    if (nearbyHome === 'bed') {
      return { location: HOME_BED_LOCATION, text: '[S] dormir, ou clique na cama', trigger: handleSleep };
    }

    const nearbyBar = hackRuntime.nearbyBarInteractable();
    if (nearbyBar === 'bartender') {
      return { location: BAR_NPC_LOCATION, text: '[M] acessar a loja, ou clique no personagem', trigger: handleOpenDrinkMenu };
    }
    if (nearbyBar === 'counter') {
      return { location: BAR_COUNTER_LOCATION, text: '[M] acessar a loja, ou clique no balcao', trigger: handleOpenDrinkMenu };
    }
    if (nearbyBar === 'stool') {
      return { location: BAR_STOOL_LOCATION, text: '[C] sentar, ou clique no banco', trigger: handleToggleSit };
    }
    if (nearbyBar === 'laptop') {
      return { location: BAR_LAPTOP_LOCATION, text: '[ESPACO] hackear, ou clique no laptop', trigger: handleAction };
    }

    const nearbyBuilding = hackRuntime.nearbyHackableBuilding();
    if (nearbyBuilding) {
      const { building } = nearbyBuilding;
      // Predios sao grandes (varias fileiras) - o clique continua valendo
      // no footprint inteiro (building), mas o balao ancora na fileira de
      // baixo (a entrada, perto de onde o jogador esta parado) em vez do
      // topo do predio, senao ele fica flutuando longe, quase fora do mapa.
      return {
        location: building,
        anchorRow: building.originY + building.footprintH - 1,
        text: '[ESPACO] hackear, ou clique no predio',
        trigger: handleAction,
      };
    }

    const lockedDeskWorkerId = hackRuntime.nearbyLockedBlacknetDesk();
    if (lockedDeskWorkerId) {
      const worker = hackRuntime.hirableWorkers.find((w) => w.id === lockedDeskWorkerId);
      const desk = BLACKNET_WORKER_DESKS[lockedDeskWorkerId];
      return {
        location: blacknetDeskLocation(desk),
        text: `[ESPACO] comprar ${worker?.name ?? lockedDeskWorkerId} (${WORKER_HIRE_COST_BYTE} BYTE), ou clique`,
        trigger: () => handleOpenBlacknetHire(lockedDeskWorkerId),
      };
    }

    const corpGymStageId = hackRuntime.nearbyCorpGymDesk();
    if (corpGymStageId) {
      const status = hackRuntime.corpGymStageStatus(corpGymStageId);
      const location = corpGymDeskLocation(corpGymStageId);
      const isLeader = corpGymStageId === 'leader';
      if (status === 'current') {
        return {
          location,
          text: `[ESPACO] desafiar ${isLeader ? 'o lider' : 'o lutador'}, ou clique`,
          trigger: () => handleChallengeCorpGymStage(corpGymStageId),
        };
      }
      if (status === 'defeated') {
        return { location, text: isLeader ? 'lider ja derrotado' : 'lutador ja derrotado', trigger: () => {} };
      }
      return { location, text: 'vença os anteriores pra desafiar esse', trigger: () => {} };
    }

    return null;
  }

  let activeHint = null;

  /** true se (col,row) cai dentro do footprint de `location` (mesmo criterio de "em cima do alvo" usado no resto do jogo). */
  function isWithinFootprint(col, row, location) {
    return (
      col >= location.originX &&
      col < location.originX + location.footprintW &&
      row >= location.originY &&
      row < location.originY + location.footprintH
    );
  }

  canvas.addEventListener('click', (event) => {
    if (!activeHint) return;
    const rect = canvas.getBoundingClientRect();
    const canvasX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const canvasY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const { col, row } = screenToGrid(canvasX, canvasY, mapRenderer.originX, mapRenderer.originY);
    if (isWithinFootprint(col, row, activeHint.location)) {
      activeHint.trigger();
    }
  });

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
    if (breachTaskOpen) return; // ESPACO aqui e so a tentativa de sync (ver runBreachTask)
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
      handleOpenPc();
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
    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault();
      handleOpenDrinkMenu();
      return;
    }
    if (event.key === 'v' || event.key === 'V') {
      event.preventDefault();
      handleSellInformation();
      return;
    }
    if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      handleToggleSit();
      return;
    }
    if (event.key === 't' || event.key === 'T') {
      event.preventDefault();
      handleOpenBarTrade();
      return;
    }
    if (event.key === '1' || event.key === '2' || event.key === '3') {
      event.preventDefault();
      const worker = hackRuntime.hirableWorkers[Number(event.key) - 1];
      if (worker) handleHireWorker(worker.id);
      return;
    }
    if (event.key === 'Escape' && !pcScreenEl.hidden) {
      event.preventDefault();
      pcScreenClose();
      return;
    }
    if (event.key === 'Escape' && !drinkMenuEl.hidden) {
      event.preventDefault();
      closeDrinkMenu();
    }
  });

  pcCloseBtnEl.addEventListener('click', () => pcScreenClose());
  drinkCloseBtnEl.addEventListener('click', () => closeDrinkMenu());
  pcTabTerminalEl.addEventListener('click', () => pcScreenSetTab('terminal'));
  pcTabEquipeEl.addEventListener('click', () => pcScreenSetTab('equipe'));
  pcTabLojaEl.addEventListener('click', () => pcScreenSetTab('loja'));
  pcTabTradeEl.addEventListener('click', () => pcScreenSetTab('trade'));
  pcMenuMineBtn.addEventListener('click', () => startMining());
  pcMenuSellBtn.addEventListener('click', () => handleSellInformationFromPc());
  registerWalletUiTarget(document.getElementById('pc-wallet-btn'), document.getElementById('pc-wallet-status'));
  pcTradeUpBtn.addEventListener('click', () => handleTrade('up'));
  pcTradeDownBtn.addEventListener('click', () => handleTrade('down'));

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
    drawOwnedPets(nowMs);
    drawBlacknetWorkers();
    drawBlacknetLocks();
    drawCorpGymNpcs(nowMs);
    mapRenderer.drawDustMotes(mapManager.currentMap, nowMs);
    activeHint = getActiveHint();
    if (activeHint) {
      const { location } = activeHint;
      const anchorRow = activeHint.anchorRow ?? location.originY;
      const { x } = gridToScreen(location.originX + location.footprintW / 2, anchorRow, mapRenderer.originX, mapRenderer.originY);
      const anchorY = mapRenderer.originY + anchorRow * TILE_SIZE;
      drawHintBubble(ctx, x, anchorY, activeHint.text);
    } else if (mapManager.currentMap?.id === BAR_MAP_ID && nowMs < barEntranceHintUntil) {
      // Balao de boas-vindas (ver onMapChanged acima) - so enquanto nenhum
      // outro hint especifico (de estar parado do lado de algo) tiver
      // prioridade.
      const { x } = gridToScreen(8, 6, mapRenderer.originX, mapRenderer.originY);
      const anchorY = mapRenderer.originY + 6 * TILE_SIZE;
      drawHintBubble(ctx, x, anchorY, BAR_ENTRANCE_HINT_TEXT);
    }
    updateStatus();
    updateHackStatus();
    updateShopStatus();
    updateWorkerStatus();
    updateGymStatus();
    if (!pcScreenEl.hidden && !pcPanelTradeEl.hidden) renderTradePanel();
    if (!drinkMenuEl.hidden) updateDrinkMenuDynamic();
  }

  // Reflete a energia dos trabalhadores regenerando sozinha (ver
  // workers.js) enquanto a aba EQUIPE estiver aberta - um intervalo bem
  // mais devagar que o loop de render (que roda a 60fps e recriaria os
  // cards toda hora, sem necessidade nenhuma - a energia so muda de
  // verdade uma vez por segundo).
  setInterval(() => {
    if (!pcScreenEl.hidden && !pcPanelEquipeEl.hidden) pcRenderWorkers();
  }, 1000);

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
  // row5 e a propria fileira das portas do BAR/BLACKNET/CORP (ver
  // district_07.json) - nascer ali em cima da porta e o que fazia
  // qualquer door.approach quebrar (nao tem como "aproximar de cima" de
  // uma porta em que voce ja esta em cima). row6 e a calcada logo abaixo,
  // sempre livre - de la sim da pra aproximar as portas andando pra cima,
  // igual toda vez que volta de dentro de um predio (ver os spawn_y de
  // volta em cada maps/*_interior.json, todos na fileira 6).
  const startRow = Number(params.get('y') ?? 6);

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

// ---------- Wallet (MetaMask/EIP-1193) ----------
// Os trabalhadores vao virar NFT no futuro - isso aqui e so a conexao da
// wallet em si, sem nenhuma transacao de verdade ainda (nao ha contrato
// publicado). Aparece em dois lugares que apontam pro mesmo estado: a
// tela de entrada (antes da selecao de personagem) e a aba EQUIPE, ja
// dentro do jogo - ver registerWalletUiTarget(). A compra continua em
// BYTE (ver hireWorker) ate isso mudar. Nao guarda nada em localStorage -
// quem ja autorizou o site antes, eth_accounts devolve isso sozinho (ver
// restoreWalletConnection), sem precisar duplicar.
let connectedWalletAddress = null;
const walletUiTargets = [];

function shortenWalletAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function updateOneWalletTarget({ btn, statusEl }) {
  if (connectedWalletAddress) {
    statusEl.textContent = shortenWalletAddress(connectedWalletAddress);
    statusEl.className = 'pc-wallet-status connected';
    btn.textContent = 'conectada';
    btn.classList.add('connected');
  } else {
    statusEl.textContent = 'nao conectada';
    statusEl.className = 'pc-wallet-status';
    btn.textContent = 'Conectar Wallet';
    btn.classList.remove('connected');
  }
}

function updateWalletUI() {
  walletUiTargets.forEach(updateOneWalletTarget);
}

/** Registra um par botao/status (ver index.html) pra refletir o estado da wallet - chamado uma vez por tela que tem esse widget. */
function registerWalletUiTarget(btn, statusEl) {
  const target = { btn, statusEl };
  walletUiTargets.push(target);
  btn.addEventListener('click', () => {
    if (!connectedWalletAddress) connectWallet();
  });
  updateOneWalletTarget(target);
}

function setConnectedWallet(address) {
  connectedWalletAddress = address;
  updateWalletUI();
}

/** Pede a conexao de verdade (abre o popup da MetaMask) - so ao clicar num dos botoes. */
async function connectWallet() {
  if (!window.ethereum) {
    walletUiTargets.forEach(({ statusEl }) => {
      statusEl.textContent = 'instale a MetaMask';
      statusEl.title = 'ou outra wallet compativel com EIP-1193';
      statusEl.className = 'pc-wallet-status error';
    });
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts[0]) setConnectedWallet(accounts[0]);
  } catch {
    // usuario recusou a conexao no popup, ou ja tinha um pedido em
    // andamento - so mantem os botoes como "nao conectada", sem travar nada.
  }
}

/** Checa (sem popup) se o site ja estava autorizado de uma visita anterior. */
async function restoreWalletConnection() {
  if (!window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts[0]) setConnectedWallet(accounts[0]);
  } catch {
    // sem wallet instalada/disponivel - fica como "nao conectada", normal.
  }
}

if (window.ethereum?.on) {
  // troca de conta na propria extensao (nao um clique no jogo) - reflete
  // na hora; array vazio significa que o usuario desconectou todos os
  // sites por la.
  window.ethereum.on('accountsChanged', (accounts) => setConnectedWallet(accounts[0] ?? null));
}
restoreWalletConnection();

// ---------- Tela de entrada (conectar wallet) + selecao de personagem ----------
// Tela de selecao de personagem: roda antes do jogo em si. Puramente
// visual/input - nao toca em nada do HackRuntime/MapManager, que so
// existem depois que o jogador escolhe (dentro de startGame). Se a URL
// ja vier com ?char=characterN valido, pula a selecao (atalho pra
// debug/teste visual sem precisar apertar nada) - um id desconhecido
// cai pra tela de selecao normal em vez de tentar carregar assets
// inexistentes silenciosamente.
const forcedCharacter = new URLSearchParams(window.location.search).get('char');
const forcedEntry = CHARACTER_ROSTER.find((entry) => entry.id === forcedCharacter);

function beginCharacterSelect() {
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

if (forcedEntry) {
  // atalho de debug/teste - pula a tela de wallet tambem, direto pro jogo.
  document.getElementById('wallet-gate').hidden = true;
  startGame(forcedEntry.id);
} else {
  const walletGateEl = document.getElementById('wallet-gate');
  const walletGateContinueBtn = document.getElementById('wallet-gate-continue-btn');
  registerWalletUiTarget(document.getElementById('wallet-gate-connect-btn'), document.getElementById('wallet-gate-status'));

  walletGateContinueBtn.addEventListener('click', () => {
    walletGateEl.hidden = true;
    beginCharacterSelect();
  });
}
