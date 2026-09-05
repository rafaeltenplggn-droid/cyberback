// Carrega a textura real de chao (assets/tiles/<arquivo>). Sem arquivo
// real ainda pro tileId, Renderer.drawDiamond cai sozinho no losango de
// cor solida de sempre - ver isImageReady() em characterRenderer.js.
export function loadTileImage(assetFileName) {
  const img = new Image();
  img.src = `assets/tiles/${assetFileName}`;
  return img;
}
