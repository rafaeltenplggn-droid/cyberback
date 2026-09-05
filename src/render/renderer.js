// Render de validacao visual: tiles numerados genericos e retangulos
// cinza no lugar de prop/predio sem arte real ainda. Nao faz parte do
// character controller, so desenha o mapa e um marcador de debug para
// validar colisao e doors.
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from '../core/isometric.js';
import { isImageReady } from '../character/characterRenderer.js';

const TILE_COLORS = {
  0: '#2b2f3a',
  1: '#3a3f4d',
  2: '#454b5c',
  3: '#1f2229',
};

// Nome do arquivo (em assets/tiles/) pra cada tileId, se tiver textura real
// pronta. tileId sem entrada aqui cai sozinho na cor solida de sempre
// (TILE_COLORS).
const TILE_ASSETS = {
  0: 'tile_street.png',
};

export class Renderer {
  /**
   * `propImages` e `tileImages` (opcionais) sao objetos
   * { [nomeDoArquivo]: HTMLImageElement } - ver src/render/propAssets.js e
   * tileAssets.js. Entrada sem imagem carregada/pronta cai sozinha no
   * placeholder de sempre (isImageReady).
   */
  constructor(ctx, { originX, originY }, { propImages, tileImages } = {}) {
    this.ctx = ctx;
    this.originX = originX;
    this.originY = originY;
    this.propImages = propImages ?? {};
    this.tileImages = tileImages ?? {};
  }

  clear(width, height) {
    this.ctx.clearRect(0, 0, width, height);
  }

  // Com textura real carregada pro tileId, desenha a imagem (ja um losango
  // pre-recortado do tamanho exato de um tile - ver assets/tiles/ e o
  // script que gera essa textura a partir de um quadrado plano). Sem
  // textura ainda, cai no losango de cor solida de sempre.
  drawDiamond(col, row, tileId) {
    const { x, y } = gridToScreen(col, row, this.originX, this.originY);
    const ctx = this.ctx;

    const assetName = TILE_ASSETS[tileId];
    const image = assetName ? this.tileImages[assetName] : null;
    if (isImageReady(image)) {
      ctx.drawImage(image, x - TILE_WIDTH / 2, y - TILE_HEIGHT / 2, TILE_WIDTH, TILE_HEIGHT);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x, y - TILE_HEIGHT / 2);
    ctx.lineTo(x + TILE_WIDTH / 2, y);
    ctx.lineTo(x, y + TILE_HEIGHT / 2);
    ctx.lineTo(x - TILE_WIDTH / 2, y);
    ctx.closePath();
    ctx.fillStyle = TILE_COLORS[tileId] ?? '#555';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
  }

  drawMap(map) {
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        this.drawDiamond(col, row, map.tiles[row][col]);
      }
    }

    for (const prop of map.props) {
      this.drawProp(prop);
    }

    for (const door of map.doors) {
      this.drawDoorMarker(door);
    }
  }

  // Com arte real carregada pro asset, desenha o sprite ancorado na base
  // do footprint. Sem arte real ainda, cai no retangulo placeholder.
  //
  // A ancora usa o canto MAIS PROXIMO da camera do footprint (maior
  // col+row), nao o origin_x/origin_y (canto de tras) - senao qualquer
  // footprint maior que 1x1 desenha "afundado" um passo isometrico
  // inteiro pra tras de onde ele realmente termina no chao, abrindo um
  // vao vazio entre o predio e uma porta/personagem logo na frente dele.
  //
  // Tamanho do sprite: se o prop tiver art_height_px no mapa.json, a
  // altura desenhada e essa (calibrada a mao pra bater com a escala do
  // personagem principal, ~42px de altura - ver CYBER_SPEC.md), com a
  // largura seguindo a proporcao da imagem. Sem art_height_px (props
  // grandes o bastante pra preencher o proprio footprint de proposito,
  // tipo os predios), a largura segue o footprint e a altura vem da
  // proporcao da imagem, podendo ficar bem mais alto que a "caixa" do
  // footprint (torres, por exemplo) - mesmo comportamento de sempre.
  drawProp(prop) {
    const frontCol = prop.origin_x + prop.footprint_w - 1;
    const frontRow = prop.origin_y + prop.footprint_h - 1;
    const { x, y } = gridToScreen(frontCol, frontRow, this.originX, this.originY);
    const w = prop.footprint_w * TILE_WIDTH;
    const h = prop.footprint_h * TILE_HEIGHT;
    const ctx = this.ctx;

    const image = this.propImages[prop.asset];
    if (isImageReady(image)) {
      let drawW = w;
      let drawH = image.naturalHeight * (drawW / image.naturalWidth);
      if (prop.art_height_px) {
        drawH = prop.art_height_px;
        drawW = image.naturalWidth * (drawH / image.naturalHeight);
      }
      ctx.drawImage(image, x - drawW / 2, y - drawH, drawW, drawH);
      return;
    }

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
