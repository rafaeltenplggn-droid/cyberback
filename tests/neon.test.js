import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fresh,valid,migrate,regenerate,transact,REGEN_MS,WHEEL,colorOf,SPIN_MS,upgradeSave} from '../src/neon/economy.js';
import {prepareMap,casinoMap} from '../src/neon/maps.js';
import {parseMap} from '../src/maps/mapParser.js';
import {MapManager} from '../src/maps/mapManager.js';
test('informacoes persistem e so pagam BYTE quando vendidas na BLACKNET',()=>{
  let s=transact(transact(fresh(0),{type:'hackStart'}),{type:'hack'});
  s=JSON.parse(JSON.stringify(s));assert.ok(valid(s));assert.equal(s.information,1);assert.equal(s.byteBalance,100);
  assert.throws(()=>transact(s,{type:'sellInformation',mapId:'player_home'}));
  const sold=transact(s,{type:'sellInformation',mapId:'ghost_row_interior',col:10,row:8});
  assert.equal(sold.byteBalance,130);assert.equal(sold.information,0);
  assert.throws(()=>transact(sold,{type:'sellInformation',mapId:'ghost_row_interior',col:10,row:8}));
});
test('estoque antigo Neon recebe campo novo sem perder saldo, pets ou rodada pendente',()=>{
  const old=transact({...fresh(0),pets:['gato_cinza']},{type:'roulette',result:1,choice:'red'});delete old.information;
  const before=structuredClone(old),updated=upgradeSave(old);assert.ok(valid(updated));assert.equal(updated.information,0);assert.deepEqual(old,before);
  assert.deepEqual(updated.pending,old.pending);assert.deepEqual(updated.pets,old.pets);assert.equal(updated.byteBalance,old.byteBalance);
  assert.equal(upgradeSave({...updated,information:7}).information,7);
});
test('estoque invalido ou venda acima do limite nao altera partida',()=>{
  for(const information of [-1,1.5,NaN,'2'])assert.equal(valid({...fresh(0),information}),false);
  const s={...fresh(0),information:999999999999};assert.throws(()=>transact(s,{type:'sellInformation',mapId:'ghost_row_interior',col:10,row:8}));assert.equal(s.information,999999999999);
});
test('BLACKNET abre pela porta da cidade e permite voltar',async()=>{
  const mm=new MapManager({loadMapJson:async id=>prepareMap(JSON.parse(readFileSync(new URL(`../maps/${id}.json`,import.meta.url))))});
  await mm.loadMap('district_07',11,6);const entered=await mm.tryMove(11,5,'up');assert.equal(entered.targetMap,'ghost_row_interior');assert.ok(mm.canEnter(mm.playerCol,mm.playerRow));
  const exit=await mm.tryMove(8,9,'down');assert.equal(exit.targetMap,'district_07');assert.ok(mm.canEnter(mm.playerCol,mm.playerRow));
});
test('energia limita a 10 tentativas e nao aceita premio duplicado',()=>{
  let s=fresh(0); for(let i=0;i<10;i++){s=transact(s,{type:'hackStart'});s=transact(s,{type:'hack'});}
  assert.equal(s.energy,0);assert.equal(s.byteBalance,100);assert.equal(s.information,10);
  assert.throws(()=>transact(s,{type:'hackStart'}));assert.throws(()=>transact(s,{type:'hack'}));
});
test('cancelar ou errar hack consome energia sem pagar BYTE',()=>{
  const s=transact(transact(fresh(0),{type:'hackStart'}),{type:'hackCancel'});
  assert.equal(s.energy,90);assert.equal(s.byteBalance,100);assert.equal(s.hackActive,false);
});
test('energia regenera com tempo offline, fracao preservada e teto 100',()=>{
  let s={...fresh(0),energy:50};s=regenerate(s,REGEN_MS+1);assert.equal(s.energy,51);assert.equal(s.energyAt,REGEN_MS);
  s=regenerate(s,REGEN_MS*2);assert.equal(s.energy,52);
  assert.equal(regenerate(s,REGEN_MS*10000).energy,100);
  assert.equal(regenerate(s,0).energy,52);
});
test('migracao preserva dinheiro, energia e pets sem mutar save antigo',()=>{
  const old={version:1,byteBalance:550,energy:27.8,pets:['gato_cinza'],characterId:'character2'};
  const copy=structuredClone(old);const s=migrate(old,0);assert.equal(s.energy,27);assert.equal(s.byteBalance,550);assert.deepEqual(s.pets,old.pets);assert.equal(s.characterId,'character2');assert.ok(valid(s));assert.deepEqual(old,copy);
});
test('compra de pet custa 100 e nao repete ou aceita pet inexistente',()=>{
  const initial=fresh(0),s=transact(initial,{type:'pet',id:'gato_cinza'});
  assert.equal(initial.byteBalance,100);assert.equal(s.byteBalance,0);assert.throws(()=>transact(s,{type:'pet',id:'gato_cinza'}));assert.throws(()=>transact(initial,{type:'pet',id:'x'}));
});
test('melhoria do PC custa 150 e dobra premio',()=>{
  const s=transact({...fresh(0),byteBalance:200},{type:'upgrade'});assert.equal(s.byteBalance,50);assert.throws(()=>transact(s,{type:'upgrade'}));
  const hacked=transact(transact(s,{type:'hackStart'}),{type:'hack'});assert.equal(hacked.byteBalance,50);assert.equal(hacked.information,2);
});
test('roleta tem todos 37 numeros, 18 de cada cor e giro de 4 segundos',()=>{
  assert.equal(new Set(WHEEL).size,37);assert.equal(WHEEL.filter(n=>colorOf(n)==='red').length,18);assert.equal(WHEEL.filter(n=>colorOf(n)==='black').length,18);assert.equal(SPIN_MS,4000);
});
test('todos os resultados da roleta pagam a cor correta e zero perde',()=>{
  for(let result=0;result<=36;result++)for(const choice of ['red','black']){
    const s=transact(fresh(0),{type:'roulette',result,choice});assert.equal(s.byteBalance,80);
    const end=transact(s,{type:'settle'});assert.equal(end.byteBalance,colorOf(result)===choice?120:80);assert.deepEqual(transact(end,{type:'settle'}),end);
  }
});
test('rodada salva resiste a recarga sem nova aposta ou premio duplicado',()=>{
  const s=transact(fresh(0),{type:'roulette',result:1,choice:'red'});assert.throws(()=>transact(s,{type:'roulette',result:2,choice:'black'}));
  const reload=JSON.parse(JSON.stringify(s));assert.ok(valid(reload));const paid=transact(reload,{type:'settle'});assert.equal(paid.byteBalance,120);assert.deepEqual(transact(paid,{type:'settle'}),paid);
});
test('trade paga 38 no acerto e 0 no erro, com custo 20',()=>{
  for(const result of [0,1])for(const choice of ['up','down']){
    const s=transact(transact(fresh(0),{type:'trade',result,choice}),{type:'settle'});
    assert.equal(s.byteBalance,choice===(result?'up':'down')?118:80);
  }
});
test('nao aceita saldo insuficiente ou sorteio fora dos limites',()=>{
  assert.throws(()=>transact({...fresh(0),byteBalance:19},{type:'roulette',result:0,choice:'red'}));
  assert.throws(()=>transact(fresh(0),{type:'roulette',result:37,choice:'red'}));assert.throws(()=>transact(fresh(0),{type:'trade',result:2,choice:'up'}));
});
test('efeitos do mapa e casa permanecem intactos e so portas permitidas ficam abertas',()=>{
  for(const id of ['district_07','player_home']){
    const raw=JSON.parse(readFileSync(new URL(`../maps/${id}.json`,import.meta.url)));const original=structuredClone(raw),next=prepareMap(raw);
    assert.deepEqual(next.reflections,raw.reflections);assert.deepEqual(next.dustMotes,raw.dustMotes);if(id==='district_07')assert.deepEqual(next.collision,raw.collision);assert.deepEqual(raw,original);
    if(id==='district_07')assert.deepEqual([...new Set(next.doors.map(d=>d.target_map))],['ghost_row_interior','player_home','neon_royale']);
  }
});
test('cassino tem caminhos para roleta, trade e saida; VIP e mesas bloqueados',()=>{
  const m=parseMap(casinoMap()),q=[[11,13]],visited=new Set();
  for(let i=0;i<q.length;i++){const [x,y]=q[i],key=`${x},${y}`;if(visited.has(key)||m.isBlocked(x,y))continue;visited.add(key);q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
  for(const point of ['6,10','11,6','11,15'])assert.ok(visited.has(point),point);
  assert.ok(m.isBlocked(20,3));assert.ok(m.isBlocked(6,8));assert.ok(m.isBlocked(11,8));
});
