// Cola entre o mundo navegavel (MapManager + MovementController, ambos
// consumidos so pela interface publica ja existente) e o HackSession do
// hack-loop. Fica isolado de DOM/render pra ser testavel em Node puro.
//
// Qualquer predio listado em hackableBuildings.js e hackavel - nao ha mais
// nada especifico do gridcorp_tower aqui, o runtime so pergunta "tem algum
// predio hackavel adjacente a posicao atual?" e dispara o hack pra ele.
import { HackSession } from './hackSession.js';
import { findHackableBuildingAt, HACKABLE_BUILDINGS } from './hackableBuildings.js';
import { buyEnergyRefill as buyEnergyRefillAction } from './energyShop.js';
import { nearbyHomeInteractable as nearbyHomeInteractableAt } from './homeLocations.js';
import { SleepTracker } from './sleepAction.js';
import { nearbyBarInteractable as nearbyBarInteractableAt, BAR_HACKABLE_BUILDING_ID } from './barLocations.js';
import { DrinkBuffTracker } from './drinkBuff.js';
import { buyDrink as buyDrinkAction } from './drinkShop.js';

export class HackRuntime {
  constructor({ mapManager, controller, playerStats, traceMeter, energyMeter, ledger, rng, now } = {}) {
    this.mapManager = mapManager;
    this.controller = controller;
    this.ledger = ledger;
    const drinkBuffTracker = new DrinkBuffTracker(now ? { now } : undefined);
    this.hackSession = new HackSession({ playerStats, traceMeter, energyMeter, drinkBuffTracker, ledger, rng });
    this.sleepTracker = new SleepTracker(now ? { now } : undefined);
    this._sitting = false;
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

  /** Enquanto um hack estiver em andamento, o personagem nao pode andar. */
  get isMovementBlocked() {
    return this.hackSession.isActive;
  }

  /** Chamado pelo loop de render no lugar de controller.tick() direto. */
  tick(deltaMs) {
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

  /** Dispara o hack contra o predio adjacente, se houver. Retorna a Promise do resultado, ou null se fora de alcance/bloqueado. */
  triggerHack() {
    const entry = this.nearbyHackableBuilding();
    if (!entry) return null;
    return this.hackSession.run(entry.target).then((result) => {
      this.hackSession.reset();
      return result;
    });
  }

  /** 'pc', 'bed' ou null - onde o personagem esta parado dentro do player_home. */
  nearbyHomeInteractable() {
    if (this.isMovementBlocked) return null;
    if (this.controller.isMoving) return null;
    return nearbyHomeInteractableAt(this.mapManager);
  }

  /** Compra uma recarga de energia com BYTE. So funciona parado ao lado do PC, no player_home. */
  buyEnergyRefill() {
    if (this.nearbyHomeInteractable() !== 'pc') {
      return { success: false, reason: 'fora_do_pc', byteSpent: 0 };
    }
    const energyMeter = this.hackSession.energyMeter;
    if (!energyMeter || !this.ledger) {
      return { success: false, reason: 'loja_indisponivel', byteSpent: 0 };
    }
    return buyEnergyRefillAction({ energyMeter, ledger: this.ledger });
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

  get drinkBuffTracker() {
    return this.hackSession.drinkBuffTracker;
  }

  /** Compra um drink: da um bonus temporario de breachSpeed. Funciona parado ao lado do balcao ou do atendente (mesma loja, dois pontos de acesso). */
  buyDrink() {
    const nearby = this.nearbyBarInteractable();
    if (nearby !== 'counter' && nearby !== 'bartender') {
      return { success: false, reason: 'fora_do_balcao', byteSpent: 0 };
    }
    if (!this.ledger) {
      return { success: false, reason: 'loja_indisponivel', byteSpent: 0 };
    }
    return buyDrinkAction({ buffTracker: this.drinkBuffTracker, ledger: this.ledger });
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
