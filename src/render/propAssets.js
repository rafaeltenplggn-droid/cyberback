// Carrega a arte real de predios/props (assets/props/<arquivo>, o mesmo
// nome que ja vem em prop.asset no mapa.json). Sem arquivo real ainda pro
// asset (ou enquanto carrega), Renderer.drawProp cai sozinho no retangulo
// placeholder de sempre - ver isImageReady() em characterRenderer.js.
export function loadPropImage(assetFileName) {
  const img = new Image();
  img.src = `assets/props/${assetFileName}`;
  return img;
}
