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
   *
   * `direction` e a direcao do passo que levou ate (col, row) - so
   * dispara a door se ela nao exigir uma direcao especifica (door.approach
   * ausente) ou se bater com a direcao exigida. Sem isso, qualquer door
   * numa celula de passagem aberta (a calcada em frente a uma loja, por
   * exemplo) disparava so de andar DE LADO por cima dela, mesmo sem
   * nenhuma intencao de entrar - ver door.approach em cada maps/*.json.
   */
  async tryMove(col, row, direction) {
    if (!this.canEnter(col, row)) {
      return { moved: false, doorTriggered: false };
    }

    const door = this.currentMap.getDoorAt(col, row);
    if (door && (!door.approach || door.approach === direction)) {
      await this.loadMap(door.target_map, door.spawn_x, door.spawn_y);
      return { moved: true, doorTriggered: true, targetMap: door.target_map };
    }

    this.playerCol = col;
    this.playerRow = row;
    return { moved: true, doorTriggered: false };
  }
}
