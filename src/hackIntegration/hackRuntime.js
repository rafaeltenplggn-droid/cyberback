// Cola entre o mundo navegavel (MapManager + MovementController, ambos
// consumidos so pela interface publica ja existente) e o HackSession do
// hack-loop. Fica isolado de DOM/render pra ser testavel em Node puro.
//
// Qualquer predio listado em hackableBuildings.js e hackavel - nao ha mais
// nada especifico do gridcorp_tower aqui, o runtime so pergunta "tem algum
// predio hackavel adjacente a posicao atual?" e dispara o hack pra ele.
import { HackSession } from './hackSession.js';
import { findHackableBuildingAt, HACKABLE_BUILDINGS } from './hackableBuildings.js';
import { nearbyHomeInteractable as nearbyHomeInteractableAt } from './homeLocations.js';
import { SleepTracker } from './sleepAction.js';
import { nearbyBarInteractable as nearbyBarInteractableAt, BAR_HACKABLE_BUILDING_ID } from './barLocations.js';
import { nearbyBlacknetInteractable as nearbyBlacknetInteractableAt } from './blacknetLocations.js';
import { buyDrink as buyDrinkAction } from './drinkShop.js';
import { InformationLedger } from './informationLedger.js';
import { mineInformation as mineInformationAction } from './infoMining.js';
import { WorkerRoster } from './workers.js';
import { requiredLevelForTier } from './hackLevelGate.js';
import { PetCollection } from './pets.js';
import { BiteMarket } from './biteTrade.js';
import { DrinkBuffTracker } from './drinkMenu.js';

// 30s pra dar tempo real de "trabalho" (e de mostrar uma tela de PC/HUD
// enquanto isso acontece), em vez do resultado aparecer quase instantaneo.
const DEFAULT_MINING_DELAY_MS = 30000;

// Hackear um predio (fisico ou remoto) tambem leva um tempo de verdade -
// um pouco menos que minerar no PC, pra sentir mais "profissional"/rapido
// que ficar tateando sozinho. So estica quanto tempo o resultado demora
// pra aparecer; nao muda energia/chance/trace, que continuam 100% do
// HackSession/hack-loop de sempre.
const DEFAULT_HACK_DELAY_MS = 20000;

export class HackRuntime {
  constructor({
    mapManager,
    controller,
    playerStats,
    traceMeter,
    energyMeter,
    ledger,
    rng,
    now,
    miningDelayMs = DEFAULT_MINING_DELAY_MS,
    hackDelayMs = DEFAULT_HACK_DELAY_MS,
    delayFn,
  } = {}) {
    this.mapManager = mapManager;
    this.controller = controller;
    this.ledger = ledger;
    this.rng = rng ?? Math.random;
    this._now = now ?? (() => Date.now());
    this.informationLedger = new InformationLedger();
    this.hackSession = new HackSession({ playerStats, traceMeter, energyMeter, informationLedger: this.informationLedger, rng });
    this.sleepTracker = new SleepTracker(now ? { now } : undefined);
    this.workerRoster = new WorkerRoster({ rng: this.rng });
    this.petCollection = new PetCollection();
    this.biteMarket = new BiteMarket({ rng: this.rng });
    this.drinkBuffTracker = new DrinkBuffTracker(now ? { now } : undefined);
    this._sitting = false;
    this._mining = false;
    this._miningStartedAt = null;
    this._miningDelayMs = miningDelayMs;
    this._hacking = false;
    this._hackStartedAt = null;
    this._hackDelayMs = hackDelayMs;
    this._delayFn = delayFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** Stats atuais do jogador, sempre atualizados apos cada hack bem sucedido (XP/nivel). */
  get playerStats() {
    return this.hackSession.playerStats;
  }

  /** Saldo atual de BYTE, direto do ledger (append-only, ver src/hackloop/byteLedger.js). */
  get byteBalance() {
    return this.ledger ? this.ledger.balance : null;
  }

  /** Energia atual do jogador, ou null se nenhum energyMeter foi passado. */
  get energyValue() {
    return this.hackSession.energyMeter ? this.hackSession.energyMeter.value : null;
  }

  /** Energia maxima, ou null se nenhum energyMeter foi passado. */
  get energyMax() {
    return this.hackSession.energyMeter ? this.hackSession.energyMeter.max : null;
  }

  /** Enquanto um hack (de predio ou minerando no PC) estiver em andamento, o personagem nao pode andar. */
  get isMovementBlocked() {
    return this.hackSession.isActive || this._mining || this._hacking;
  }

  /** true enquanto mineInformation() esta rodando (o delay artificial de feedback, ver DEFAULT_MINING_DELAY_MS). */
  get isMining() {
    return this._mining;
  }

  /** Quantos ms faltam pro mineInformation() em andamento terminar (0 se nao estiver minerando). */
  get miningRemainingMs() {
    if (!this._mining || this._miningStartedAt === null) return 0;
    return Math.max(0, this._miningDelayMs - (this._now() - this._miningStartedAt));
  }

  /** true enquanto um hack (fisico ou remoto) esta rodando (ver DEFAULT_HACK_DELAY_MS). */
  get isHacking() {
    return this._hacking;
  }

  /** Quantos ms faltam pro hack em andamento terminar (0 se nao estiver hackeando). */
  get hackRemainingMs() {
    if (!this._hacking || this._hackStartedAt === null) return 0;
    return Math.max(0, this._hackDelayMs - (this._now() - this._hackStartedAt));
  }

  /**
   * Chamado pelo loop de render no lugar de controller.tick() direto. Os
   * trabalhadores contratados (ver workers.js) tickam sempre, mesmo com o
   * movimento bloqueado - eles trabalham sozinhos, independente do que o
   * jogador esta fazendo.
   */
  tick(deltaMs) {
    this.workerRoster.tick(deltaMs, { informationLedger: this.informationLedger });
    this.biteMarket.tick(deltaMs);
    if (this.isMovementBlocked) return;
    this.controller.tick(deltaMs);
    // Levanta sozinho se o jogador se afastou do banco (cosmetico, nao
    // precisa apertar a tecla de novo pra "acordar" ao andar embora).
    if (this._sitting && nearbyBarInteractableAt(this.mapManager) !== 'stool') {
      this._sitting = false;
    }
  }

  /**
   * Predio hackavel adjacente a posicao atual (do lado de fora, como
   * sempre), ou null se nao houver nenhum. Alem disso, parado no laptop
   * dentro do nullpoint_interior tambem conta - e o mesmo nullpoint_bar,
   * so que hackeado remotamente de dentro do bar, sem sair.
   */
  nearbyHackableBuilding() {
    if (this.isMovementBlocked) return null;
    if (this.controller.isMoving) return null;
    const mapId = this.mapManager.currentMap?.id;
    if (!mapId) return null;

    const exterior = findHackableBuildingAt(mapId, this.mapManager.playerCol, this.mapManager.playerRow);
    if (exterior) return exterior;

    if (nearbyBarInteractableAt(this.mapManager) === 'laptop') {
      return HACKABLE_BUILDINGS.find((entry) => entry.id === BAR_HACKABLE_BUILDING_ID) ?? null;
    }

    return null;
  }

  /** So pode disparar hack parado, adjacente a um predio hackavel, e sem outro hack em andamento. */
  canTriggerHack() {
    return this.nearbyHackableBuilding() !== null;
  }

  /**
   * Roda o hack contra `entry` (uma entrada de HACKABLE_BUILDINGS), com a
   * trava de nivel minimo (ver hackLevelGate.js) - abaixo do nivel
   * exigido pro tier do alvo, nem tenta, igual energyBlocked mas pra
   * nivel. Compartilhado entre triggerHack (fisico) e triggerRemoteHack
   * (do PC) - a trava e a mesma pros dois jeitos de hackear.
   *
   * O hack de verdade (recon/breach/exfiltrate/fence) roda rapido demais
   * pra acompanhar visualmente, entao o resultado real e calculado logo,
   * mas so "revelado" (a Promise so resolve) depois de DEFAULT_HACK_DELAY_MS
   * no total - da tempo real de sensacao de trabalho, igual o PC. Um
   * hack que nem chega a tentar o breach (energyBlocked) nao espera esse
   * tempo todo - nao faz sentido segurar 20s so pra dizer "sem energia".
   */
  async _runHack(entry) {
    const requiredLevel = requiredLevelForTier(entry.target.tier);
    if (this.playerStats.level < requiredLevel) {
      return {
        target: entry.target,
        levelBlocked: true,
        requiredLevel,
        playerLevel: this.playerStats.level,
      };
    }

    this._hacking = true;
    this._hackStartedAt = this._now();
    const result = await this.hackSession.run(entry.target, { statBuff: this.drinkBuffTracker.active });
    this.hackSession.reset();

    if (!result.energyBlocked) {
      const remaining = this._hackDelayMs - (this._now() - this._hackStartedAt);
      if (remaining > 0) await this._delayFn(remaining);
    }

    this._hacking = false;
    this._hackStartedAt = null;
    return result;
  }

  /** Dispara o hack contra o predio adjacente, se houver. Retorna a Promise do resultado, ou null se fora de alcance/bloqueado. */
  triggerHack() {
    const entry = this.nearbyHackableBuilding();
    if (!entry) return null;
    return this._runHack(entry);
  }

  /**
   * Lista dos 3 predios hackaveis com o nivel minimo de cada um e se
   * estao travados pro nivel atual do jogador - pronta pra UI (aba de
   * hackear remoto no PC).
   */
  get remoteHackTargets() {
    const level = this.playerStats.level;
    return HACKABLE_BUILDINGS.map((entry) => {
      const requiredLevel = requiredLevelForTier(entry.target.tier);
      return { id: entry.id, tier: entry.target.tier, requiredLevel, locked: level < requiredLevel };
    });
  }

  /**
   * Hackeia um predio remotamente, direto do PC de casa - sem precisar
   * andar ate la. So funciona parado no PC, sem nenhum hack/mineracao ja
   * em andamento, e respeita a mesma trava de nivel do hack fisico.
   */
  triggerRemoteHack(buildingId) {
    if (this.nearbyHomeInteractable() !== 'pc') return null;
    if (this.hackSession.isActive || this._mining || this._hacking) return null;
    const entry = HACKABLE_BUILDINGS.find((building) => building.id === buildingId);
    if (!entry) return null;
    return this._runHack(entry);
  }

  /**
   * 'pc', 'bed' ou null - onde o personagem esta parado dentro do
   * player_home. So bloqueia por hack de predio (hackSession.isActive) e
   * movimento em andamento - nao por `_mining`, senao a propria tela de
   * "minerando..." perderia a referencia de onde o jogador esta assim que
   * mineInformation() comeca (o personagem nao anda enquanto minera, entao
   * a adjacencia real nao muda de qualquer forma).
   */
  nearbyHomeInteractable() {
    if (this.hackSession.isActive) return null;
    if (this.controller.isMoving) return null;
    return nearbyHomeInteractableAt(this.mapManager);
  }

  /** Contagem atual de Informacao por raridade, e o total (ver informationLedger.js). */
  get informationCounts() {
    return this.informationLedger.counts;
  }

  get informationTotal() {
    return this.informationLedger.total;
  }

  /**
   * Minera informacao (chance fixa de sucesso, gasta energia toda vez -
   * ver INFO_MINING_ENERGY_COST_RATIO em infoMining.js). So funciona
   * parado ao lado do PC, no player_home. Assincrona de proposito: o
   * delay artificial (`isMining` fica true durante ele, bloqueando
   * movimento) da um feedback visual de que algo esta acontecendo, em vez
   * do resultado aparecer instantaneo sem nenhum sinal.
   */
  async mineInformation() {
    if (this.nearbyHomeInteractable() !== 'pc') {
      return { success: false, reason: 'fora_do_pc' };
    }
    this._mining = true;
    this._miningStartedAt = this._now();
    await this._delayFn(this._miningDelayMs);
    const result = mineInformationAction({
      informationLedger: this.informationLedger,
      energyMeter: this.hackSession.energyMeter,
      rng: this.rng,
    });
    this._mining = false;
    this._miningStartedAt = null;
    return result;
  }

  /** Lista dos trabalhadores contrataveis (id/nome) e quais ja foram contratados - ver workers.js. */
  get hirableWorkers() {
    return this.workerRoster.list();
  }

  /** Contrata um trabalhador pelo id (ver HIRABLE_WORKERS em workers.js). So funciona parado no PC, no player_home. */
  hireWorker(workerId) {
    if (this.nearbyHomeInteractable() !== 'pc') {
      return { success: false, reason: 'fora_do_pc' };
    }
    if (!this.ledger) {
      return { success: false, reason: 'loja_indisponivel' };
    }
    return this.workerRoster.hire(workerId, { ledger: this.ledger });
  }

  /** Lista dos pets compraveis (id/nome) e quais ja foram comprados - ver pets.js. Puramente decorativo. */
  get pets() {
    return this.petCollection.list();
  }

  /** Compra um pet pelo id (ver PETS em pets.js). So funciona parado no PC, no player_home. */
  buyPet(petId) {
    if (this.nearbyHomeInteractable() !== 'pc') {
      return { success: false, reason: 'fora_do_pc' };
    }
    if (!this.ledger) {
      return { success: false, reason: 'loja_indisponivel' };
    }
    return this.petCollection.buy(petId, { ledger: this.ledger });
  }

  /** Preco atual da BITE e o historico recente (sparkline) - ver biteTrade.js. O mercado roda sozinho, mesmo com a tela fechada. */
  get bitePrice() {
    return this.biteMarket.price;
  }

  get biteHistory() {
    return this.biteMarket.history;
  }

  /**
   * Aposta 'up' ou 'down' na BITE. So funciona parado no PC de casa ou no
   * laptop do bar (nullpoint_interior) - fora dai, recusa sem cobrar nada.
   */
  tradeBite(direction) {
    const atHomePc = this.nearbyHomeInteractable() === 'pc';
    const atBarLaptop = this.nearbyBarInteractable() === 'laptop';
    if (!atHomePc && !atBarLaptop) {
      return { success: false, reason: 'fora_do_trade' };
    }
    if (!this.ledger) {
      return { success: false, reason: 'loja_indisponivel' };
    }
    return this.biteMarket.trade(direction, { ledger: this.ledger });
  }

  /** Dorme na cama: recupera energia de graca, mas so fora do cooldown. So funciona parado ao lado da cama. */
  sleep() {
    if (this.nearbyHomeInteractable() !== 'bed') {
      return { success: false, reason: 'fora_da_cama' };
    }
    const energyMeter = this.hackSession.energyMeter;
    if (!energyMeter) {
      return { success: false, reason: 'sem_energyMeter' };
    }
    return this.sleepTracker.sleep(energyMeter);
  }

  /** 'counter', 'stool', 'laptop' ou null - o que o personagem esta parado do lado, dentro do bar (nullpoint_interior). */
  nearbyBarInteractable() {
    if (this.isMovementBlocked) return null;
    if (this.controller.isMoving) return null;
    return nearbyBarInteractableAt(this.mapManager);
  }

  /** Compra um energetico: recarrega a energia com BYTE. Funciona parado ao lado do balcao ou do atendente (mesma loja, dois pontos de acesso). */
  buyDrink() {
    const nearby = this.nearbyBarInteractable();
    if (nearby !== 'counter' && nearby !== 'bartender') {
      return { success: false, reason: 'fora_do_balcao', byteSpent: 0 };
    }
    const energyMeter = this.hackSession.energyMeter;
    if (!energyMeter || !this.ledger) {
      return { success: false, reason: 'loja_indisponivel', byteSpent: 0 };
    }
    return buyDrinkAction({ energyMeter, ledger: this.ledger });
  }

  /** Buff de drink ativo agora (ou null) - ver drinkMenu.js. Pra UI mostrar o que esta ativo e quanto falta. */
  get activeDrinkBuff() {
    return this.drinkBuffTracker.active;
  }

  /**
   * Pede um drink do cardapio novo (com buff, ver drinkMenu.js) - diferente
   * de buyDrink(), este NAO recarrega energia, so da um bonus temporario
   * num stat. Funciona parado ao lado do balcao ou do atendente, igual
   * buyDrink().
   */
  orderDrink(drinkId) {
    const nearby = this.nearbyBarInteractable();
    if (nearby !== 'counter' && nearby !== 'bartender') {
      return { success: false, reason: 'fora_do_balcao' };
    }
    if (!this.ledger) {
      return { success: false, reason: 'loja_indisponivel' };
    }
    return this.drinkBuffTracker.order(drinkId, { ledger: this.ledger });
  }

  /** 'sell' ou null - se o personagem esta parado no ponto de venda dentro da BLACKNET (ghost_row_interior). */
  nearbyBlacknetInteractable() {
    if (this.isMovementBlocked) return null;
    if (this.controller.isMoving) return null;
    return nearbyBlacknetInteractableAt(this.mapManager);
  }

  /** Vende todo o estoque de Informacao por BYTE. So funciona parado no ponto de venda, dentro da BLACKNET. */
  sellInformation() {
    if (this.nearbyBlacknetInteractable() !== 'sell') {
      return { success: false, reason: 'fora_da_blacknet', byteEarned: 0, sold: {} };
    }
    if (!this.ledger) {
      return { success: false, reason: 'loja_indisponivel', byteEarned: 0, sold: {} };
    }
    const { byteEarned, sold } = this.informationLedger.sellAll();
    if (byteEarned === 0) {
      return { success: false, reason: 'sem_informacao', byteEarned: 0, sold: {} };
    }
    this.ledger.record({ type: 'gain', amount: byteEarned, meta: { source: 'blacknet_sell' } });
    return { success: true, reason: null, byteEarned, sold };
  }

  get isSitting() {
    return this._sitting;
  }

  /**
   * Senta/levanta do banco do bar. Puramente cosmetico - nao bloqueia
   * movimento nem tem nenhum efeito de jogo, so um estado pra interface
   * mostrar. Levantar sempre funciona (de qualquer lugar); sentar so
   * funciona parado do lado do banco.
   */
  toggleSit() {
    if (this._sitting) {
      this._sitting = false;
      return { success: true, sitting: false };
    }
    if (this.nearbyBarInteractable() !== 'stool') {
      return { success: false, reason: 'fora_do_banco', sitting: false };
    }
    this._sitting = true;
    return { success: true, sitting: true };
  }
}
