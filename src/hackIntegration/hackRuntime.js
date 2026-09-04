// Cola entre o mundo navegavel (MapManager + MovementController, ambos
// consumidos so pela interface publica ja existente) e o HackSession do
// hack-loop. Fica isolado de DOM/render pra ser testavel em Node puro.
//
// Qualquer predio listado em hackableBuildings.js e hackavel - nao ha mais
// nada especifico do gridcorp_tower aqui, o runtime so pergunta "tem algum
// predio hackavel adjacente a posicao atual?" e dispara o hack pra ele.
import { HackSession } from './hackSession.js';
import { findHackableBuildingAt } from './hackableBuildings.js';

export class HackRuntime {
  constructor({ mapManager, controller, playerStats, traceMeter, energyMeter, ledger, rng } = {}) {
    this.mapManager = mapManager;
    this.controller = controller;
    this.ledger = ledger;
    this.hackSession = new HackSession({ playerStats, traceMeter, energyMeter, ledger, rng });
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
  }

  /** Predio hackavel adjacente a posicao atual, ou null se nao houver nenhum. */
  nearbyHackableBuilding() {
    if (this.isMovementBlocked) return null;
    if (this.controller.isMoving) return null;
    const mapId = this.mapManager.currentMap?.id;
    if (!mapId) return null;
    return findHackableBuildingAt(mapId, this.mapManager.playerCol, this.mapManager.playerRow);
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
}
