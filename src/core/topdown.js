// Projecao top-down ortogonal (grid quadrado 1:1). Substitui a projecao
// isometrica (src/core/isometric.js, mantido intacto pra rollback) como a
// projecao ativa do jogo - ver CYBER_SPEC.md, secao "Projection Lock".
//
// A posicao logica (col, row) nao muda em nada - so a forma de converter
// pra coordenada de tela muda. gridToScreen sempre retorna o CENTRO
// visual da celula.
export const TILE_SIZE = 32;

export function gridToScreen(col, row, originX = 0, originY = 0) {
  const x = originX + col * TILE_SIZE + TILE_SIZE / 2;
  const y = originY + row * TILE_SIZE + TILE_SIZE / 2;
  return { x, y };
}

export function screenToGrid(screenX, screenY, originX = 0, originY = 0) {
  const col = Math.round((screenX - originX - TILE_SIZE / 2) / TILE_SIZE);
  const row = Math.round((screenY - originY - TILE_SIZE / 2) / TILE_SIZE);
  return { col, row };
}
