import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createChallenge,enterSymbol,challengePhase,MEMORY_MS,ANSWER_MS} from '../src/neon/memoryHack.js';
import {WALL_LAYERS,HOME_PC,atHomePC} from '../src/neon/interiorLayers.js';
import {prepareMap,casinoMap} from '../src/neon/maps.js';import {parseMap} from '../src/maps/mapParser.js';
import {findPath,samplePath} from '../src/neon/navigation.js';
const load=id=>parseMap(prepareMap(JSON.parse(readFileSync(new URL(`../maps/${id}.json`,import.meta.url)))));
test('hack esconde cinco simbolos e impede respostas durante memorizacao',()=>{
 const h=createChallenge(()=>0,100);assert.equal(h.sequence.length,5);assert.equal(challengePhase(h,100),'memorize');assert.deepEqual(enterSymbol(h,'A',100),h);assert.equal(challengePhase(h,100+MEMORY_MS),'answer');
});
test('hack exige sequencia correta antes do prazo e nao aceita premio repetido',()=>{
 let h=createChallenge(()=>1,0);for(let i=0;i<5;i++)h=enterSymbol(h,'B',MEMORY_MS+100+i*100);assert.equal(h.status,'success');assert.deepEqual(enterSymbol(h,'B',3000),h);
 assert.equal(enterSymbol(createChallenge(()=>0,0),'B',MEMORY_MS).status,'failed');assert.equal(enterSymbol(createChallenge(()=>0,0),'A',MEMORY_MS+ANSWER_MS).status,'timeout');
});
test('PC exige chegada na cadeira e rota da entrada evita parede do banheiro',()=>{
 const m=load('player_home');assert.ok(findPath(m,{col:5,row:7},HOME_PC));assert.ok(m.isBlocked(4,2));assert.ok(m.isBlocked(4,4));assert.equal(atHomePC('player_home',5,7),false);assert.equal(atHomePC('player_home',7,3),true);
 assert.equal(findPath(m,{col:5,row:7},{col:4,row:2}),null);
});
test('todas as salas possuem paredes em primeiro plano sem fechar a passagem central',()=>{
 for(const id of ['player_home','ghost_row_interior','neon_royale']){
  const layers=WALL_LAYERS[id];assert.ok(layers.length>0);for(const [x,y,w,h] of layers){assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1&&y+h<=1);}
  assert.equal(layers.some(([x,y,w,h])=>.5>=x&&.5<=x+w&&.78>=y&&.78<=y+h),false);
 }
});
test('rotas do trailer usam celulas livres e so passos cardinais',()=>{
 for(const [m,from,to] of [[load('district_07'),{col:10,row:8},{col:14,row:8}],[load('player_home'),{col:5,row:7},HOME_PC],[load('ghost_row_interior'),{col:8,row:8},{col:10,row:8}],[parseMap(casinoMap()),{col:11,row:13},{col:6,row:10}]]){
  let last=from;for(const step of findPath(m,from,to)){assert.ok(!m.isBlocked(step.col,step.row));assert.equal(Math.abs(step.col-last.col)+Math.abs(step.row-last.row),1);last=step;}
  assert.equal(samplePath(m,from,to,1).x,to.col);
 }
});
