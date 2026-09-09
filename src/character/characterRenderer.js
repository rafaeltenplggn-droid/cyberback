// Render do personagem. Reaproveita a projecao top-down compartilhada
// (src/core/topdown.js) conforme a secao "Projection Lock" do
// CYBER_SPEC.md - nunca reimplementa grid<->tela aqui.
//
// Sem `assets`, desenha o placeholder de sempre (retangulo + bolinha).
// Com `assets` (ver formato abaixo), desenha o sprite de pixel art real
// no lugar - mesma logica de grid de frames (4 direcoes x 3 poses) e o
// mesmo requisito de espelhamento: o frame de "left" nunca e desenhado
// direto, e sempre a geometria de "right" com ctx.scale(-1, 1) (a arte de
// perfil foi desenhada olhando pra direita).
import { gridToScreen, TILE_SIZE } from '../core/topdown.js';
import { getFrame } from './spriteSheet.js';

const DIRECTION_COLORS = {
  down: '#3ad6ff',
  up: '#ff2079',
  left: '#c8ff3a',
  right: '#c8ff3a',
};

const POSE_BOB = { idle: 0, step1: -3, step2: 3 };

// Altura alvo do sprite desenhado na tela - calibrada pra ficar legivel
// no grid top-down (TILE_SIZE=32), de proposito maior que um tile (o
// personagem e "mais alto" que a celula que ocupa, igual a referencia
// visual pede) - ver ART_STYLE_GUIDE.md. A largura e derivada mantendo a
// proporcao da imagem.
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

    const sourceDirection = frame.mirrored ? 'right' : direction;
    const sprite = this.assets?.[sourceDirection]?.[pose];

    ctx.save();
    // Feet anchor: os pes do personagem ficam no centro-inferior da
    // celula que ele ocupa (a posicao logica representa onde ele toca o
    // chao) - o sprite desenha pra cima a partir dai, podendo ficar mais
    // alto que a propria celula (esperado, ver Projection Lock).
    ctx.translate(x, y + TILE_SIZE / 2);
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
