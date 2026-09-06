// Carrega a arte de fundo de mapa inteiro (assets/backgrounds/<arquivo>).
// Sem arquivo real ainda pro fundo (ou enquanto carrega), Renderer.drawMap
// cai sozinho no render de tiles de sempre - ver isImageReady() em
// characterRenderer.js.
export function loadBackgroundImage(assetFileName) {
  const img = new Image();
  img.src = `assets/backgrounds/${assetFileName}`;
  return img;
}
