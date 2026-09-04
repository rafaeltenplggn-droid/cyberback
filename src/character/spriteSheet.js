// Formato do sprite descrito em CYBER_SPEC.md: 12 frames por arquetipo,
// grid 4 linhas (direcao) por 3 colunas (pose). A linha "right" do arquivo
// nunca e lida: o frame de direita e sempre derivado espelhando a linha
// "left" em tempo de render (scaleX -1), quem consome isso e
// src/character/characterRenderer.js.
export const FRAME_POSES = ['idle', 'step1', 'step2'];

export const DIRECTION_ROWS = { down: 0, up: 1, left: 2, right: 3 };

export function getFrame(direction, pose) {
  const col = FRAME_POSES.indexOf(pose);
  if (col === -1) {
    throw new Error(`Pose invalida: ${pose}`);
  }

  const mirrored = direction === 'right';
  const sourceDirection = mirrored ? 'left' : direction;
  const row = DIRECTION_ROWS[sourceDirection];
  if (row === undefined) {
    throw new Error(`Direcao invalida: ${direction}`);
  }

  return { row, col, mirrored };
}
