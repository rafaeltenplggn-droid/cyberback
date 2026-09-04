// Cola entre o mundo navegavel (MapManager + MovementController, ambos
// consumidos so pela interface publica ja existente) e o HackSession do
// hack-loop. Fica isolado de DOM/render pra ser testavel em Node puro.
import { HackSession, GRIDCORP_TOWER_TARGET, GRIDCORP_TOWER_BUILDING, GRIDCORP_TOWER_MAP_ID, isAdjacentToBuilding } from './gridcorpHack.js';

export class HackRuntime {
  constructor({ mapManager, controller, playerStats, traceMeter, ledger, rng } = {}) {
    this.mapManager = mapManager;
    this.controller = controller;
    this.hackSession = new HackSession({ playerStats, traceMeter, ledger, rng });
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

  /** So pode disparar hack parado, ao alcance do gridcorp_tower, em district_07, e sem outro hack em andamento. */
  canTriggerHack() {
    if (this.isMovementBlocked) return false;
    if (this.controller.isMoving) return false;
    if (this.mapManager.currentMap?.id !== GRIDCORP_TOWER_MAP_ID) return false;
    return isAdjacentToBuilding(this.mapManager.playerCol, this.mapManager.playerRow, GRIDCORP_TOWER_BUILDING);
  }

  /** Dispara o hack se possivel. Retorna a Promise do resultado, ou null se fora de alcance/bloqueado. */
  triggerHack() {
    if (!this.canTriggerHack()) return null;
    return this.hackSession.run(GRIDCORP_TOWER_TARGET).then((result) => {
      this.hackSession.reset();
      return result;
    });
  }
}
