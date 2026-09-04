// Render do personagem. Reaproveita a projecao isometrica compartilhada
// (src/core/isometric.js) conforme a secao "Nucleo compartilhado" do
// CYBER_SPEC.md - nunca reimplementa grid<->tela aqui.
//
// Ainda nao ha asset de pixel art real pro personagem (mesma situacao dos
// props/predios em src/render/renderer.js, que usam retangulo cinza como
// placeholder). Este renderer desenha um placeholder simples, mas segue a
// mesma logica de grid de frames (4 direcoes x 3 poses) e o mesmo
// requisito de espelhamento: o frame de "right" nunca e desenhado direto,
// e sempre a geometria de "left" com ctx.scale(-1, 1).
import { gridToScreen, TILE_HEIGHT } from '../core/isometric.js';
import { getFrame } from './spriteSheet.js';

const DIRECTION_COLORS = {
  down: '#3ad6ff',
  up: '#ff2079',
  left: '#c8ff3a',
  right: '#c8ff3a',
};

const POSE_BOB = { idle: 0, step1: -3, step2: 3 };

export class CharacterRenderer {
  constructor(ctx, { originX, originY }) {
    this.ctx = ctx;
    this.originX = originX;
    this.originY = originY;
  }

  draw({ col, row, direction, pose }) {
    const frame = getFrame(direction, pose);
    const { x, y } = gridToScreen(col, row, this.originX, this.originY);
    const bob = POSE_BOB[pose] ?? 0;
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(x, y - TILE_HEIGHT / 2);
    if (frame.mirrored) {
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = DIRECTION_COLORS[direction] ?? '#ffffff';
    ctx.fillRect(-8, -18 + bob, 16, 18);
    ctx.beginPath();
    ctx.arc(0, -22 + bob, 7, 0, Math.PI * 2);
    ctx.fill();

    // "nariz": sempre desenhado como se estivesse olhando pra esquerda,
    // scaleX(-1) acima e quem faz ele apontar pra direita quando precisa.
    ctx.fillStyle = '#111';
    const noseOffsetX = direction === 'up' ? 0 : direction === 'down' ? 0 : -6;
    ctx.fillRect(noseOffsetX - 1, -24 + bob, 3, 3);

    ctx.restore();

    return frame;
  }
}
