// Carrega mapas e aplica a troca completa de mapa ao pisar em uma door,
// conforme CYBER_SPEC.md: sala e troca de mapa inteira, nunca camada ou zoom.
import { parseMap } from './mapParser.js';

export class MapManager {
  constructor({ loadMapJson }) {
    this._loadMapJson = loadMapJson;
    this.currentMap = null;
    this.playerCol = 0;
    this.playerRow = 0;
  }

  async loadMap(mapId, spawnCol = 0, spawnRow = 0) {
    const raw = await this._loadMapJson(mapId);
    this.currentMap = parseMap(raw);
    this.playerCol = spawnCol;
    this.playerRow = spawnRow;
    return this.currentMap;
  }

  canEnter(col, row) {
    if (!this.currentMap) return false;
    return !this.currentMap.isBlocked(col, row);
  }

  /**
   * Move o jogador para (col, row) se nao houver colisao. Se a celula de
   * destino tiver uma door, troca o mapa inteiro e reposiciona no spawn
   * definido pelo destino. Retorna o que aconteceu para quem for renderizar.
   */
  async tryMove(col, row) {
    if (!this.canEnter(col, row)) {
      return { moved: false, doorTriggered: false };
    }

    const door = this.currentMap.getDoorAt(col, row);
    if (door) {
      await this.loadMap(door.target_map, door.spawn_x, door.spawn_y);
      return { moved: true, doorTriggered: true, targetMap: door.target_map };
    }

    this.playerCol = col;
    this.playerRow = row;
    return { moved: true, doorTriggered: false };
  }
}
