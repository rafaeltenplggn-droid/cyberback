import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fresh,valid,migrate,regenerate,transact,REGEN_MS,WHEEL,colorOf,SPIN_MS} from '../src/neon/economy.js';
import {prepareMap,casinoMap} from '../src/neon/maps.js';
import {parseMap} from '../src/maps/mapParser.js';
test('energia limita a 10 tentativas e nao aceita premio duplicado',()=>{
  let s=fresh(0); for(let i=0;i<10;i++){s=transact(s,{type:'hackStart'});s=transact(s,{type:'hack'});}
  assert.equal(s.energy,0);assert.equal(s.byteBalance,400);
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
  assert.equal(transact(transact(s,{type:'hackStart'}),{type:'hack'}).byteBalance,110);
});
test('roleta tem todos 37 numeros, 18 de cada cor e giro de 10 segundos',()=>{
  assert.equal(new Set(WHEEL).size,37);assert.equal(WHEEL.filter(n=>colorOf(n)==='red').length,18);assert.equal(WHEEL.filter(n=>colorOf(n)==='black').length,18);assert.equal(SPIN_MS,10000);
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
    assert.deepEqual(next.reflections,raw.reflections);assert.deepEqual(next.dustMotes,raw.dustMotes);assert.deepEqual(next.collision,raw.collision);assert.deepEqual(raw,original);
    if(id==='district_07')assert.deepEqual([...new Set(next.doors.map(d=>d.target_map))],['player_home','neon_royale']);
  }
});
test('cassino tem caminhos para roleta, trade e saida; VIP e mesas bloqueados',()=>{
  const m=parseMap(casinoMap()),q=[[11,13]],visited=new Set();
  for(let i=0;i<q.length;i++){const [x,y]=q[i],key=`${x},${y}`;if(visited.has(key)||m.isBlocked(x,y))continue;visited.add(key);q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
  for(const point of ['6,10','11,6','11,15'])assert.ok(visited.has(point),point);
  assert.ok(m.isBlocked(20,3));assert.ok(m.isBlocked(6,8));assert.ok(m.isBlocked(11,8));
});
