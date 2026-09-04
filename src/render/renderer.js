// Render de validacao visual: tiles numerados genericos e retangulos
// cinza no lugar de prop/predio real. Nao faz parte do character controller,
// so desenha o mapa e um marcador de debug para validar colisao e doors.
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from '../core/isometric.js';

const TILE_COLORS = {
  0: '#2b2f3a',
  1: '#3a3f4d',
  2: '#454b5c',
  3: '#1f2229',
};

export class Renderer {
  constructor(ctx, { originX, originY }) {
    this.ctx = ctx;
    this.originX = originX;
    this.originY = originY;
  }

  clear(width, height) {
    this.ctx.clearRect(0, 0, width, height);
  }

  drawDiamond(col, row, fillStyle) {
    const { x, y } = gridToScreen(col, row, this.originX, this.originY);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x, y - TILE_HEIGHT / 2);
    ctx.lineTo(x + TILE_WIDTH / 2, y);
    ctx.lineTo(x, y + TILE_HEIGHT / 2);
    ctx.lineTo(x - TILE_WIDTH / 2, y);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
  }

  drawMap(map) {
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tileId = map.tiles[row][col];
        this.drawDiamond(col, row, TILE_COLORS[tileId] ?? '#555');
      }
    }

    for (const prop of map.props) {
      this.drawProp(prop);
    }

    for (const door of map.doors) {
      this.drawDoorMarker(door);
    }
  }

  // Placeholder cinza no lugar do asset real do prop/predio.
  drawProp(prop) {
    const { x, y } = gridToScreen(prop.origin_x, prop.origin_y, this.originX, this.originY);
    const w = prop.footprint_w * TILE_WIDTH;
    const h = prop.footprint_h * TILE_HEIGHT;
    const ctx = this.ctx;
    ctx.fillStyle = prop.collision_footprint ? '#8a8a8a' : '#b5b5b5';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(x - w / 2, y - h, w, h);
  }

  drawDoorMarker(door) {
    const { x, y } = gridToScreen(door.x, door.y, this.originX, this.originY);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5ff';
    ctx.fill();
  }

  drawDebugAvatar(col, row) {
    const { x, y } = gridToScreen(col, row, this.originX, this.originY);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ff2079';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}
