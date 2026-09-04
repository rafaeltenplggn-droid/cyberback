// Parser do formato mapa.json descrito em CYBER_SPEC.md.
import { CollisionMatrix } from '../core/collisionMatrix.js';

function assert(condition, message) {
  if (!condition) throw new MapParseError(message);
}

export class MapParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MapParseError';
  }
}

function validateRectMatrix(matrix, width, height, fieldName) {
  assert(Array.isArray(matrix), `${fieldName} deve ser uma matriz`);
  assert(matrix.length === height, `${fieldName} deve ter ${height} linhas, tem ${matrix.length}`);
  for (let row = 0; row < height; row++) {
    const line = matrix[row];
    assert(Array.isArray(line), `${fieldName}[${row}] deve ser uma linha`);
    assert(line.length === width, `${fieldName}[${row}] deve ter ${width} colunas, tem ${line.length}`);
  }
}

function validateDoor(door, width, height, index) {
  assert(Number.isInteger(door.x) && door.x >= 0 && door.x < width, `doors[${index}].x invalido`);
  assert(Number.isInteger(door.y) && door.y >= 0 && door.y < height, `doors[${index}].y invalido`);
  assert(typeof door.target_map === 'string' && door.target_map.length > 0, `doors[${index}].target_map invalido`);
  assert(Number.isInteger(door.spawn_x), `doors[${index}].spawn_x invalido`);
  assert(Number.isInteger(door.spawn_y), `doors[${index}].spawn_y invalido`);
}

function validateProp(prop, width, height, index) {
  assert(typeof prop.id === 'string' && prop.id.length > 0, `props[${index}].id invalido`);
  assert(typeof prop.asset === 'string' && prop.asset.length > 0, `props[${index}].asset invalido`);
  assert(Number.isInteger(prop.origin_x) && prop.origin_x >= 0 && prop.origin_x < width, `props[${index}].origin_x invalido`);
  assert(Number.isInteger(prop.origin_y) && prop.origin_y >= 0 && prop.origin_y < height, `props[${index}].origin_y invalido`);
  assert(Number.isInteger(prop.footprint_w) && prop.footprint_w >= 1, `props[${index}].footprint_w invalido`);
  assert(Number.isInteger(prop.footprint_h) && prop.footprint_h >= 1, `props[${index}].footprint_h invalido`);
  assert(
    prop.origin_x + prop.footprint_w <= width && prop.origin_y + prop.footprint_h <= height,
    `props[${index}] footprint ultrapassa os limites do mapa`
  );
  assert(typeof prop.collision_footprint === 'boolean', `props[${index}].collision_footprint invalido`);
}

/**
 * Faz o parse e a validacao de um mapa.json e monta a matriz de colisao
 * final: tiles nunca bloqueiam, collision e binaria, e props com
 * collision_footprint=true bloqueiam todas as celulas do seu footprint.
 */
export function parseMap(raw) {
  assert(raw && typeof raw === 'object', 'mapa.json deve ser um objeto');
  assert(typeof raw.id === 'string' && raw.id.length > 0, 'id invalido');
  assert(typeof raw.tileset === 'string' && raw.tileset.length > 0, 'tileset invalido');
  assert(Number.isInteger(raw.width) && raw.width > 0, 'width invalido');
  assert(Number.isInteger(raw.height) && raw.height > 0, 'height invalido');

  const { width, height } = raw;

  validateRectMatrix(raw.tiles, width, height, 'tiles');
  validateRectMatrix(raw.collision, width, height, 'collision');

  const doors = Array.isArray(raw.doors) ? raw.doors : [];
  doors.forEach((door, index) => validateDoor(door, width, height, index));

  const props = Array.isArray(raw.props) ? raw.props : [];
  props.forEach((prop, index) => validateProp(prop, width, height, index));

  const collisionMatrix = new CollisionMatrix(width, height, raw.collision);
  for (const prop of props) {
    if (prop.collision_footprint) {
      collisionMatrix.blockFootprint(prop.origin_x, prop.origin_y, prop.footprint_w, prop.footprint_h);
    }
  }

  const doorsByCell = new Map();
  for (const door of doors) {
    doorsByCell.set(`${door.x},${door.y}`, door);
  }

  return {
    id: raw.id,
    tileset: raw.tileset,
    width,
    height,
    tiles: raw.tiles,
    doors,
    props,
    collisionMatrix,
    getDoorAt(col, row) {
      return doorsByCell.get(`${col},${row}`) ?? null;
    },
    isBlocked(col, row) {
      return collisionMatrix.isBlocked(col, row);
    },
  };
}
