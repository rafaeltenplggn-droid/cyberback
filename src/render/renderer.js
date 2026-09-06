// Render top-down ortogonal (grid quadrado 1:1 - ver src/core/topdown.js e
// CYBER_SPEC.md, secao "Projection Lock"). Tiles numerados genericos e
// retangulos cinza no lugar de prop/predio sem arte real ainda. Nao faz
// parte do character controller, so desenha o mapa e um marcador de debug
// para validar colisao e doors.
import { gridToScreen, TILE_SIZE } from '../core/topdown.js';
import { isImageReady } from '../character/characterRenderer.js';

// Placeholder mais proximo da referencia visual (cyber-noir) enquanto os
// tiles finais nao existem - ver CYBER_SPEC.md.
const TILE_COLORS = {
  0: '#1c2230', // piso: dark navy/blue-gray
  1: '#2a3142', // calcada: um pouco mais claro
  2: '#333b4d',
  3: '#12151c', // bloqueado/predio: dark charcoal/navy
};

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class Renderer {
  /**
   * `propImages` (opcional) e um objeto { [nomeDoArquivo]: HTMLImageElement }
   * - ver src/render/propAssets.js. Prop sem entrada carregada/pronta ali
   * cai sozinho no retangulo placeholder de sempre (isImageReady).
   *
   * `backgroundImages` (opcional) e o mesmo esquema pra fundo de mapa
   * inteiro (ver src/render/backgroundAssets.js e map.background no
   * mapa.json) - usado pelo Sector 7 exterior, que usa o Visual Master
   * oficial como fundo unico em vez de tiles individuais.
   */
  constructor(ctx, { originX, originY }, { propImages, backgroundImages } = {}) {
    this.ctx = ctx;
    this.originX = originX;
    this.originY = originY;
    this.propImages = propImages ?? {};
    this.backgroundImages = backgroundImages ?? {};
  }

  clear(width, height) {
    this.ctx.clearRect(0, 0, width, height);
  }

  // Cada tile e um quadrado ortogonal simples - sem contorno forte entre
  // tiles vizinhos (fica "grade demais" senao); so a cor solida por
  // enquanto, ate ter textura real.
  drawTile(col, row, tileId) {
    const { x, y } = gridToScreen(col, row, this.originX, this.originY);
    const ctx = this.ctx;
    ctx.fillStyle = TILE_COLORS[tileId] ?? '#555';
    ctx.fillRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
  }

  // Com map.background definido e a imagem carregada/pronta, desenha ela
  // esticada pra cobrir o mapa inteiro (map.width/height * TILE_SIZE) no
  // lugar dos tiles individuais - o mapa ja vem com rua/calcada/predios
  // desenhados na propria arte. Sem background pronto, cai no render de
  // tiles de sempre (placeholder ou Ground Kit).
  drawMap(map) {
    const background = map.background ? this.backgroundImages[map.background] : null;
    if (isImageReady(background)) {
      this.ctx.drawImage(background, this.originX, this.originY, map.width * TILE_SIZE, map.height * TILE_SIZE);
      return;
    }

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        this.drawTile(col, row, map.tiles[row][col]);
      }
    }

    for (const door of map.doors) {
      this.drawDoorMarker(door);
    }
  }

  // Brilho animado e sutil sobre os reflexos de neon na rua molhada
  // (map.reflections no mapa.json - opcional, so o Sector 7 usa por
  // enquanto). Cada entrada e um gradiente radial na cor do letreiro,
  // com a opacidade "respirando" ao longo do tempo (nowMs, o mesmo
  // timestamp do requestAnimationFrame) - fase e periodo proprios por
  // reflexo pra nao pulsarem todos em sincronia. Desenhado sobre o
  // fundo mas antes de props/personagem, pra ficar no plano do chao.
  drawReflections(map, nowMs) {
    const reflections = map.reflections;
    if (!reflections || reflections.length === 0) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of reflections) {
      const { x: baseX, y: baseY } = gridToScreen(r.x, r.y, this.originX, this.originY);
      const radiusPx = r.radius * TILE_SIZE;
      const phase = r.phase ?? 0;
      const periodMs = r.periodMs ?? 3000;
      const baseAlpha = r.baseAlpha ?? 0.12;
      const amplitude = r.amplitude ?? 0.06;
      const alpha = baseAlpha + amplitude * Math.sin((nowMs / periodMs) * Math.PI * 2 + phase);

      // Deriva de posicao: o proprio reflexo balanca alguns pixels, tipo
      // agua tremulando, em vez de so a opacidade mudar no lugar fixo.
      // Periodo/fase levemente diferentes nos eixos x/y (e do pulso de
      // opacidade) pra nao parecer um "respirar" mecanico e sim organico.
      const driftPx = r.driftPx ?? 5;
      const driftPeriodMs = r.driftPeriodMs ?? periodMs * 1.4;
      const dx = driftPx * Math.sin((nowMs / driftPeriodMs) * Math.PI * 2 + phase);
      const dy = driftPx * 0.6 * Math.cos((nowMs / driftPeriodMs) * Math.PI * 2 + phase * 0.7);
      const x = baseX + dx;
      const y = baseY + dy;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radiusPx);
      gradient.addColorStop(0, hexToRgba(r.color, Math.max(alpha, 0)));
      gradient.addColorStop(1, hexToRgba(r.color, 0));

      ctx.fillStyle = gradient;
      ctx.fillRect(x - radiusPx, y - radiusPx, radiusPx * 2, radiusPx * 2);
    }
    ctx.restore();
  }

  // Props e personagem sao desenhados juntos, ordenados por profundidade
  // (linha mais ao sul do footprint de cada um) - quem estiver mais ao
  // norte desenha primeiro (fica atras), quem estiver mais ao sul desenha
  // por ultimo (fica na frente). Regra simples pedida no Projection Lock,
  // sem sistema de depth complexo.
  drawPropsAndCharacter(props, characterRow, drawCharacter) {
    const entries = props.map((prop) => ({
      depth: prop.origin_y + prop.footprint_h - 1,
      draw: () => this.drawProp(prop),
    }));
    entries.push({ depth: characterRow, draw: drawCharacter });
    entries.sort((a, b) => a.depth - b.depth);
    for (const entry of entries) entry.draw();
  }

  // Com arte real carregada pro asset, desenha o sprite ancorado no
  // BOTTOM-CENTER do footprint (centro horizontal, borda inferior) - a
  // posicao logica representa onde o objeto toca o chao. Largura segue o
  // footprint, altura segue a proporcao da imagem (deixa predios mais
  // altos que a "caixa" do footprint, igual ao personagem). Sem arte
  // real ainda, cai no retangulo placeholder.
  //
  // Tamanho do sprite: se o prop tiver art_height_px no mapa.json, a
  // altura desenhada e essa (calibrada a mao pra bater com a escala do
  // personagem principal, ~42px de altura), com a largura seguindo a
  // proporcao da imagem. Sem art_height_px (predios), a largura segue o
  // footprint e a altura vem da proporcao da imagem.
  drawProp(prop) {
    const anchorX = this.originX + (prop.origin_x + prop.footprint_w / 2) * TILE_SIZE;
    const anchorY = this.originY + (prop.origin_y + prop.footprint_h) * TILE_SIZE;
    const w = prop.footprint_w * TILE_SIZE;
    const h = prop.footprint_h * TILE_SIZE;
    const ctx = this.ctx;

    const image = this.propImages[prop.asset];
    if (isImageReady(image)) {
      let drawW = w;
      let drawH = image.naturalHeight * (drawW / image.naturalWidth);
      if (prop.art_height_px) {
        drawH = prop.art_height_px;
        drawW = image.naturalWidth * (drawH / image.naturalHeight);
      }
      ctx.drawImage(image, anchorX - drawW / 2, anchorY - drawH, drawW, drawH);
      return;
    }

    ctx.fillStyle = prop.collision_footprint ? '#8a8a8a' : '#b5b5b5';
    ctx.fillRect(anchorX - w / 2, anchorY - h, w, h);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(anchorX - w / 2, anchorY - h, w, h);
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
