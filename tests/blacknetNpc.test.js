import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BLACKNET_NPC as npc,canTalkToBroker} from '../src/neon/blacknetNpc.js';
import {fresh,transact} from '../src/neon/economy.js';
import {prepareMap} from '../src/neon/maps.js';
import {parseMap} from '../src/maps/mapParser.js';
test('Cipher conversa apenas com jogador adjacente na BLACKNET',()=>{
  assert.equal(canTalkToBroker(npc.mapId,10,8),true);
  for(const [map,col,row] of [['player_home',10,8],[npc.mapId,8,8],[npc.mapId,10,7],[npc.mapId,9,8]]) assert.equal(canTalkToBroker(map,col,row),false);
  assert.throws(()=>transact({...fresh(),information:2},{type:'sellInformation',mapId:npc.mapId,col:8,row:8}));
  const sold=transact({...fresh(),information:2},{type:'sellInformation',mapId:npc.mapId,col:10,row:8});assert.equal(sold.information,0);assert.equal(sold.byteBalance,160);
});
test('NPC bloqueia sua celula e seu ponto de conversa tem caminho desde a entrada',()=>{
  const raw=JSON.parse(readFileSync(new URL('../maps/ghost_row_interior.json',import.meta.url)));
  const map=parseMap(prepareMap(raw));assert.ok(map.isBlocked(npc.col,npc.row));assert.equal(raw.collision[npc.row][npc.col],0);
  const queue=[[8,8]],seen=new Set();
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i],key=`${x},${y}`;if(seen.has(key)||map.isBlocked(x,y))continue;seen.add(key);queue.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
  assert.ok(seen.has(`${npc.approachCol},${npc.approachRow}`));assert.ok(seen.has('8,9'));
});
