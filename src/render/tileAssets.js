// Carrega a textura real de tile (assets/tiles/<arquivo>). Sem arquivo real
// ainda pro tile (ou enquanto carrega), Renderer.drawTile cai sozinho na cor
// solida placeholder de sempre - ver isImageReady() em characterRenderer.js.
export function loadTileImage(assetFileName) {
  const img = new Image();
  img.src = `assets/tiles/${assetFileName}`;
  return img;
}
