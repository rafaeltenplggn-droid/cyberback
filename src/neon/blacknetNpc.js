export const BLACKNET_NPC = {name:'Cipher', mapId:'ghost_row_interior', col:10, row:7, approachCol:10, approachRow:8};
export function canTalkToBroker(mapId, col, row) {
  return mapId === BLACKNET_NPC.mapId && Number.isInteger(col) && Number.isInteger(row)
    && Math.abs(col - BLACKNET_NPC.col) + Math.abs(row - BLACKNET_NPC.row) === 1;
}
