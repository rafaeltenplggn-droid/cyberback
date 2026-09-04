// Marcador minimo de debug para validar colisao e troca de mapa nesta
// branch. NAO e o character controller (sem sprite, sem tween, sem fila de
// input) - isso e responsabilidade da branch feat/character-controller.
export function bindDebugAvatarControls(window, mapManager, onChange) {
  const DIRECTIONS = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  };

  window.addEventListener('keydown', async (event) => {
    const delta = DIRECTIONS[event.key];
    if (!delta) return;
    event.preventDefault();
    const targetCol = mapManager.playerCol + delta[0];
    const targetRow = mapManager.playerRow + delta[1];
    const result = await mapManager.tryMove(targetCol, targetRow);
    onChange(result);
  });
}
