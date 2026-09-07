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
import { SLEEP_ENERGY_RESTORE } from './hackIntegration/sleepAction.js';
import { DRINK_COST_BYTE } from './hackIntegration/drinkShop.js';
import { DRINKS, DRINK_BUFF_DURATION_MS } from './hackIntegration/drinkMenu.js';
import { INFO_MINING_ENERGY_COST_RATIO } from './hackIntegration/infoMining.js';
import { WORKER_HIRE_COST_BYTE } from './hackIntegration/workers.js';
import { PET_COST_BYTE } from './hackIntegration/pets.js';
import { BITE_TRADE_STAKE_BYTE, BITE_TRADE_PAYOUT_BYTE } from './hackIntegration/biteTrade.js';
import { PLAYER_HOME_MAP_ID, HOME_BED_LOCATION } from './hackIntegration/homeLocations.js';

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
  ledger.record({ type: 'gain', amount: STARTING_BYTE_BALANCE, meta: { source: 'saldo_inicial' } });
  const hackRuntime = new HackRuntime({ mapManager, controller, playerStats, traceMeter, energyMeter, ledger });

  const statusEl = document.getElementById('status');
  const playerStatusEl = document.getElementById('player-status');
  const hackStatusEl = document.getElementById('hack-status');
  const shopStatusEl = document.getElementById('shop-status');
  const workerStatusEl = document.getElementById('worker-status');

  // ---------- Tela de invasao (PC screen) ----------
  // Overlay visual mostrado durante um hack de predio ou a mineracao do
  // PC de casa, no lugar do jogador so ver o texto discreto do HUD. Pura
  // camada de apresentacao: nao muda em nada as regras/numeros do jogo,
  // so anima o que ja estava acontecendo por baixo (ver hackRuntime.js).
  const pcScreenEl = document.getElementById('pc-screen');
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
  const pcMenuTargetsEl = document.getElementById('pc-menu-targets');

  // ---------- Cardapio de drinks (buff, ver drinkMenu.js) ----------
  // Overlay separado da tela do PC, com skin propria (balcao de bar) -
  // diferente do energetico simples ([D], ver drinkShop.js), que continua
  // intocado e so recarrega energia.
  const drinkMenuEl = document.getElementById('drink-menu');
  const drinkListEl = document.getElementById('drink-list');
  const drinkActiveEl = document.getElementById('drink-active');
  const drinkResultEl = document.getElementById('drink-result');

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
  }

  /** Mostra o terminal em execucao (log + barra) no lugar do menu. */
  function pcScreenShowRun() {
    pcMenuEl.hidden = true;
    pcRunEl.hidden = false;
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

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pc-worker-btn';
      if (worker.hired) {
        btn.textContent = 'contratado';
        btn.classList.add('hired');
        btn.disabled = true;
      } else {
        btn.textContent = `contratar (${WORKER_HIRE_COST_BYTE} BYTE)`;
        btn.addEventListener('click', () => {
          handleHireWorker(worker.id);
          pcRenderWorkers();
        });
      }

      card.append(img, name, btn);
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
   * Desenha a sparkline da BITE (linha simples ligando os pontos do
   * historico) igual estilo pixel-art do resto da tela do PC - sem lib de
   * grafico nenhuma, so canvas 2D puro.
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
    const pad = 10;
    const stepX = (w - pad * 2) / (history.length - 1);
    const up = history[history.length - 1] >= history[0];

    ctx.strokeStyle = up ? '#4dffb8' : '#ff5d6a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((price, index) => {
      const x = pad + index * stepX;
      const y = pad + (1 - (price - min) / range) * (h - pad * 2);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
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
    statusEl.textContent = `mapa: ${mapManager.currentMap.id} | posicao: (${mapManager.playerCol}, ${mapManager.playerRow}) | direcao: ${controller.direction} | pose: ${controller.pose} | trace: ${traceMeter.value.toFixed(1)}${sittingText}`;

    const stats = hackRuntime.playerStats;
    const xpNeeded = xpRequiredForLevel(stats.level);
    const info = hackRuntime.informationCounts;
    const infoText = ` | informacao: ${hackRuntime.informationTotal} (comum ${info.comum}, rara ${info.rara}, epica ${info.epica})`;
    playerStatusEl.textContent =
      `nivel ${stats.level} | xp ${stats.xp}/${xpNeeded} | energia: ${hackRuntime.energyValue.toFixed(0)}/${hackRuntime.energyMax} | BYTE: ${hackRuntime.byteBalance} | ` +
      `breachSpeed ${stats.breachSpeed} | stealth ${stats.stealth} | lootYield ${stats.lootYield} | traceResistance ${stats.traceResistance}${infoText}`;
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
  let lastNearbyBlacknet = null;
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

    const nearbyBlacknet = hackRuntime.nearbyBlacknetInteractable();
    if (nearbyBlacknet !== lastNearbyBlacknet) {
      lastSellResult = null;
      lastNearbyBlacknet = nearbyBlacknet;
    }

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

    if (nearbyBlacknet === 'sell') {
      if (!lastSellResult) {
        shopStatusEl.textContent = `[V] BLACKNET: vender toda a informacao (estoque: ${hackRuntime.informationTotal})`;
      } else if (lastSellResult.success) {
        shopStatusEl.textContent = `[V] BLACKNET: vendido por ${lastSellResult.byteEarned} BYTE`;
      } else if (lastSellResult.reason === 'sem_informacao') {
        shopStatusEl.textContent = '[V] BLACKNET: nada pra vender ainda';
      } else {
        shopStatusEl.textContent = '[V] BLACKNET: nao foi possivel vender agora';
      }
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

    pcScreenShowRun();
    pcLogClear();
    pcSetHead(buildingId.toUpperCase(), target.tier.toUpperCase());
    pcSetBar(0, 'STATUS', '--');
    pcLogPush(`> conectando a ${buildingId}...`, 'ok');

    const result = await runHackVisual(hackRuntime.triggerRemoteHack(buildingId));
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

  function handleHireWorker(workerId) {
    const result = hackRuntime.hireWorker(workerId);
    lastHireResult = { workerId, result };
    updateWorkerStatus();
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
    if (!nearby) return;
    hackingBuildingId = nearby.id;
    updateHackStatus();

    pcScreenOpen({ tabs: ['terminal'], activeTab: 'terminal' });
    pcScreenShowRun();
    pcLogClear();
    pcSetHead(nearby.id.toUpperCase(), nearby.target.tier.toUpperCase());
    pcSetBar(0, 'STATUS', '--');
    pcLogPush(`> conectando a ${nearby.id}...`, 'ok');

    const result = await runHackVisual(hackRuntime.triggerHack());
    lastHackResult = result;
    hackingBuildingId = null;
    updateHackStatus();
    pcRevealHackResult(result);

    await wait(2200);
    pcScreenClose();
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

  pcTabTerminalEl.addEventListener('click', () => pcScreenSetTab('terminal'));
  pcTabEquipeEl.addEventListener('click', () => pcScreenSetTab('equipe'));
  pcTabLojaEl.addEventListener('click', () => pcScreenSetTab('loja'));
  pcTabTradeEl.addEventListener('click', () => pcScreenSetTab('trade'));
  pcMenuMineBtn.addEventListener('click', () => startMining());
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
    mapRenderer.drawDustMotes(mapManager.currentMap, nowMs);
    updateStatus();
    updateHackStatus();
    updateShopStatus();
    updateWorkerStatus();
    if (!pcScreenEl.hidden && !pcPanelTradeEl.hidden) renderTradePanel();
    if (!drinkMenuEl.hidden) updateDrinkMenuDynamic();
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
