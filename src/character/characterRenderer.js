// Render do personagem. Reaproveita a projecao isometrica compartilhada
// (src/core/isometric.js) conforme a secao "Nucleo compartilhado" do
// CYBER_SPEC.md - nunca reimplementa grid<->tela aqui.
//
// Sem `assets`, desenha o placeholder de sempre (retangulo + bolinha).
// Com `assets` (ver formato abaixo), desenha o sprite de pixel art real
// no lugar - mesma logica de grid de frames (4 direcoes x 3 poses) e o
// mesmo requisito de espelhamento: o frame de "right" nunca e desenhado
// direto, e sempre a geometria de "left" com ctx.scale(-1, 1).
import { gridToScreen, TILE_HEIGHT } from '../core/isometric.js';
import { getFrame } from './spriteSheet.js';

const DIRECTION_COLORS = {
  down: '#3ad6ff',
  up: '#ff2079',
  left: '#c8ff3a',
  right: '#c8ff3a',
};

const POSE_BOB = { idle: 0, step1: -3, step2: 3 };

// Altura alvo do sprite desenhado na tela, calibrada visualmente contra o
// grid isometrico (TILE_WIDTH=64/TILE_HEIGHT=32) - ver preview em
// ART_STYLE_GUIDE.md. A largura e derivada mantendo a proporcao da imagem.
const SPRITE_TARGET_HEIGHT = 42;

export function isImageReady(img) {
  return Boolean(img) && img.complete && img.naturalWidth > 0;
}

export class CharacterRenderer {
  /**
   * `assets` (opcional) tem o formato { down: {idle, step1, step2}, up: {...}, left: {...} },
   * cada valor um HTMLImageElement ja carregado. Nao ha entrada "right" -
   * a direita sempre reusa "left" espelhada, igual ao spriteSheet.js.
   * Quem monta esse objeto (main.js) e responsavel por preencher poses
   * sem imagem propria repetindo a imagem mais proxima disponivel.
   */
  constructor(ctx, { originX, originY }, { assets } = {}) {
    this.ctx = ctx;
    this.originX = originX;
    this.originY = originY;
    this.assets = assets ?? null;
  }

  draw({ col, row, direction, pose }) {
    const frame = getFrame(direction, pose);
    const { x, y } = gridToScreen(col, row, this.originX, this.originY);
    const bob = POSE_BOB[pose] ?? 0;
    const ctx = this.ctx;

    const sourceDirection = frame.mirrored ? 'left' : direction;
    const sprite = this.assets?.[sourceDirection]?.[pose];

    ctx.save();
    ctx.translate(x, y - TILE_HEIGHT / 2);
    if (frame.mirrored) {
      ctx.scale(-1, 1);
    }

    if (isImageReady(sprite)) {
      const h = SPRITE_TARGET_HEIGHT;
      const w = sprite.naturalWidth * (h / sprite.naturalHeight);
      ctx.drawImage(sprite, -w / 2, -h + bob, w, h);
    } else {
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
    }

    ctx.restore();

    return frame;
  }
}
