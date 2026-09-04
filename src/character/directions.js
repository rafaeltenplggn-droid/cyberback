// 4 direcoes, sem diagonal (CYBER_SPEC.md - Movimento do personagem).
export const DIRECTIONS = {
  down: { dCol: 0, dRow: 1 },
  up: { dCol: 0, dRow: -1 },
  left: { dCol: -1, dRow: 0 },
  right: { dCol: 1, dRow: 0 },
};

export function isDirection(value) {
  return Object.prototype.hasOwnProperty.call(DIRECTIONS, value);
}
