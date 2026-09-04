// Conversao grid <-> tela conforme CYBER_SPEC.md
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export function gridToScreen(col, row, originX = 0, originY = 0) {
  const screenX = originX + (col - row) * (TILE_WIDTH / 2);
  const screenY = originY + (col + row) * (TILE_HEIGHT / 2);
  return { x: screenX, y: screenY };
}

export function screenToGrid(screenX, screenY, originX = 0, originY = 0) {
  const x = screenX - originX;
  const y = screenY - originY;
  const col = (x / (TILE_WIDTH / 2) + y / (TILE_HEIGHT / 2)) / 2;
  const row = (y / (TILE_HEIGHT / 2) - x / (TILE_WIDTH / 2)) / 2;
  return { col: Math.round(col), row: Math.round(row) };
}
