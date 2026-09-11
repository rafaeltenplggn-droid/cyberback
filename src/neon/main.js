import { MapManager } from '../maps/mapManager.js';
import { Renderer } from '../render/renderer.js';
import { MovementController } from '../character/movementController.js';
import { centerMapOrigin, gridToScreen, screenToGrid } from '../core/topdown.js';
import { SAVE_KEY, fresh, valid, upgradeSave, migrate, regenerate, transact, WHEEL, colorOf, SPIN_MS, INFORMATION_PRICE } from './economy.js';
import { prepareMap, casinoMap, LOCKS } from './maps.js';
import { drawAvatar } from './avatar.js';
import { BLACKNET_NPC as broker, canTalkToBroker } from './blacknetNpc.js';

const $=id=>document.getElementById(id), canvas=$('game'),ctx=canvas.getContext('2d');
const dialog=$('activity'),content=$('dialog-content');
const names={district_07:'A cidade é sua.',player_home:'Seu esconderijo.',neon_royale:'Neon Royale',ghost_row_interior:'BLACKNET'};
const petNames=['Gato Laranja','Gato Cinza','Gato Sphynx'],petIds=['gato_laranja','gato_cinza','gato_sphynx'];
let state=fresh(), storageBlocked=false, busy=false, loading=false, ready=false, hack=null, lastFrame=0, wheelAngle=0;
let approachingBroker=false;
let origin={originX:0,originY:0};
const keys=new Set(), images={};
function message(text){$('message').textContent=text;}
try {
  const raw=localStorage.getItem(SAVE_KEY);
  if(raw!==null){const parsed=upgradeSave(JSON.parse(raw));if(!valid(parsed))throw Error();state=parsed;state.hackActive=false;}
  else {const old=localStorage.getItem('cyberback.save.v1');if(old){const imported=migrate(JSON.parse(old));if(!imported)throw Error();state=imported;message('Saldo, energia e pets da partida anterior foram recuperados.');}}
  state=regenerate(state);
  if(state.pending){state=transact(state,{type:'settle'});message('Sua rodada anterior foi concluída. O saldo já está atualizado.');}
} catch {storageBlocked=true;message('Não foi possível ler o salvamento. O original foi preservado; esta sessão não será salva.');}
function save(next=state){
  if(!storageBlocked){try{localStorage.setItem(SAVE_KEY,JSON.stringify(next));$('save-status').textContent='Salvo neste navegador';}catch{$('save-status').textContent='Não foi possível salvar neste navegador';}}
  else $('save-status').textContent='Sessão sem salvamento';
}
function update(){
  $('balance').innerHTML=`${state.byteBalance.toLocaleString('pt-BR')} <span>BYTE</span>`;
  const energy=$('energy-value');if(energy)energy.textContent=`${state.energy}/100`;
  const bar=$('energy-bar');if(bar)bar.value=state.energy;
  const inventory=$('information-count');if(inventory)inventory.textContent=state.information;
  $('character').value=state.characterId;
}
function act(action){try{const next=transact(regenerate(state),action);save(next);state=next;update();return true;}catch(e){message(e.message);return false;}}
function randomInt(n){const a=new Uint32Array(1);let v;const limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a);v=a[0];}while(v>=limit);return v%n;}
function loadImage(file){if(!images[file]){const im=new Image();im.src=`assets/backgrounds/${file}`;images[file]=im;}return images[file];}
const mm=new MapManager({loadMapJson:async id=>{
  if(id==='neon_royale')return casinoMap();
  if(!['district_07','player_home','ghost_row_interior'].includes(id))throw Error('Local fechado.');
  const response=await fetch(`maps/${id}.json`);if(!response.ok)throw Error('Falha ao carregar o mapa.');return prepareMap(await response.json());
}});
const renderer=new Renderer(ctx,origin,{backgroundImages:images});
const controller=new MovementController(mm,{isInputBlocked:()=>loading||dialog.open||busy,onMapChanged:()=>{keys.clear();controller.queue.length=0;mapChanged();},onMoveError:()=>message('Não consegui abrir esse local. Tente novamente.')});
function mapChanged(){
  approachingBroker=false;
  origin=centerMapOrigin(mm.currentMap,canvas.width,canvas.height);Object.assign(renderer,origin);loadImage(mm.currentMap.background);
  $('place').textContent=names[mm.currentMap.id];$('district').textContent=mm.currentMap.id==='neon_royale'?'♠ CASSINO · PLAY / TRADE / WIN':'SECTOR 7';
  document.querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('active',b.dataset.go===mm.currentMap.id));
  activities();
}
async function go(id){
  if(busy||loading||dialog.open||controller.isMoving||controller._finishing)return;
  loading=true;approachingBroker=false;keys.clear();controller.queue.length=0;$('map-loading').hidden=false;
  try{const pos=id==='neon_royale'?[11,13]:id==='player_home'?[5,7]:id==='ghost_row_interior'?[8,8]:[12,8];await mm.loadMap(id,...pos);mapChanged();ready=true;}
  catch{message('Não consegui carregar o local. Tente novamente.');}
  finally{loading=false;$('map-loading').hidden=true;}
}
const card=(symbol,title,desc,buttons,extra='')=>`<section class="card ${extra}"><div class="symbol">${symbol}</div><h3>${title}</h3><p>${desc}</p>${buttons}</section>`;
function activities(){
  const id=mm.currentMap.id;
  let html=`<div class="energy"><span>⚡ Energia <strong id="energy-value">${state.energy}/100</strong></span><progress id="energy-bar" value="${state.energy}" max="100"></progress><small>Hack: 10 de energia · recupera 1 a cada 30 s</small></div>`;
  html+=`<div class="energy"><span>▤ Informações <strong id="information-count">${state.information}</strong></span><small>Venda na BLACKNET · ${INFORMATION_PRICE} BYTE cada</small></div>`;
  if(id==='player_home')html+=card('⌘','Conecte. Invada. Lucre.','Colete informações no terminal e venda na BLACKNET.',`<button id="hack-open" class="primary">Hackear · +${state.pcLevel} ${state.pcLevel===1?'informação':'informações'}</button><button id="trade-open">Trade BITE / BYTE</button><button id="upgrade">${state.pcLevel===1?'Melhorar PC · 150 BYTE':'PC melhorado · nível 2'}</button>`)+card('♧','Seus companheiros','Pets decorativos para deixar sua casa com a sua cara.','<button id="pets-open">Comprar pets · 100 BYTE</button>');
  else if(id==='ghost_row_interior')html+=card('▤','Cipher · Corretor de dados',`Cipher compra suas informações por ${INFORMATION_PRICE} BYTE cada. Clique nele ou aproxime-se e aperte E.`,`<button id="sell-open" class="primary">Falar com Cipher</button><button data-go="player_home">Voltar para casa</button>`);
  else if(id==='neon_royale')html+=card('♠','Faça sua jogada.','Uma rodada, uma escolha. O próximo número pode ser o seu.','<button id="roulette-open" class="gold">Jogar roleta</button>','casino')+`<p class="dialog-note">♔ Área VIP fechada por enquanto.</p>`;
  else html+=card('⌂','Comece em casa.','Hackeie para obter informações. Venda na BLACKNET para ganhar BYTE.','<button data-go="player_home" class="primary">Ir para casa</button><button data-go="ghost_row_interior">Vender na BLACKNET</button>')+card('♠','NEON ROYALE','Roleta sob as luzes de Sector 7.','<button data-go="neon_royale" class="gold">Entrar no cassino</button>','casino')+`<p class="dialog-note">🔒 Bar e CORP estão fechados.</p>`;
  $('activities').innerHTML=html;
  $('hack-open')?.addEventListener('click',openHack);$('pets-open')?.addEventListener('click',openPets);
  $('roulette-open')?.addEventListener('click',openRoulette);$('trade-open')?.addEventListener('click',openTrade);
  $('sell-open')?.addEventListener('click',visitBroker);
  if($('upgrade')){$('upgrade').disabled=state.pcLevel===2;$('upgrade').onclick=()=>{if(act({type:'upgrade'})){message('PC melhorado: cada hack correto rende 2 informações.');activities();}};}
}
function visitBroker(){
  if(busy||loading||dialog.open||controller.isMoving||mm.currentMap.id!==broker.mapId)return;
  if(canTalkToBroker(mm.currentMap.id,mm.playerCol,mm.playerRow)){openSell();return;}
  keys.clear();pathTo(broker.approachCol,broker.approachRow);approachingBroker=true;message('Indo conversar com Cipher…');
}
function openSell(){
  if(!canTalkToBroker(mm.currentMap.id,mm.playerCol,mm.playerRow)){message('Aproxime-se de Cipher para conversar.');return;}
  if(!openDialog('CIPHER · CORRETOR DA BLACKNET'))return;
  content.innerHTML=`<h2>Tem informações para mim?</h2><p class="dialog-note">Cipher: “Dados bons têm seu preço. Eu pago em BYTE.”</p><p>Seu estoque: <strong id="sale-stock">${state.information}</strong></p><p class="dialog-note">Cada informação vale ${INFORMATION_PRICE} BYTE.</p><button id="sell-all" class="primary" ${state.information===0?'disabled':''}>Vender tudo · ${state.information*INFORMATION_PRICE} BYTE</button><div id="sale-result" class="result" role="status"></div>`;
  $('sell-all').onclick=()=>{const amount=state.information*INFORMATION_PRICE;if(act({type:'sellInformation',mapId:mm.currentMap.id,col:mm.playerCol,row:mm.playerRow})){$('sell-all').disabled=true;$('sell-all').textContent='Estoque vendido';$('sale-stock').textContent='0';$('sale-result').textContent=`Vendido! +${amount} BYTE`;message(`Informações vendidas na BLACKNET: +${amount} BYTE.`);}};
}
function openDialog(kicker){if(busy||loading||controller.isMoving)return false;keys.clear();controller.queue.length=0;$('dialog-kicker').textContent=kicker;dialog.showModal();return true;}
function closeDialog(){if(busy)return;if(hack)act({type:'hackCancel'});hack=null;dialog.close();canvas.focus();activities();}
$('close').onclick=closeDialog;dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
function setBusy(value){busy=value;$('close').disabled=value;document.querySelectorAll('[data-go],#character').forEach(b=>b.disabled=value);}
function openHack(){
  if(!openDialog('MINHA CASA · TERMINAL'))return;
  content.innerHTML=`<h2>Quebre a sequência.</h2><p class="dialog-note">Repita os 3 símbolos na ordem. Cada tentativa usa 10 de energia. Acertou? +${state.pcLevel} ${state.pcLevel===1?'informação':'informações'} para vender na BLACKNET.</p><div class="letters" id="sequence"><span>?</span><span>?</span><span>?</span></div><div class="hack-keys"><button id="start-hack" class="primary">Iniciar hack · 10 de energia</button></div><div class="result" id="hack-result"></div>`;
  $('start-hack').onclick=()=>{if(!act({type:'hackStart'}))return;hack={sequence:Array.from({length:3},()=>['A','B','C'][randomInt(3)]),index:0};$('sequence').innerHTML=hack.sequence.map(x=>`<span>${x}</span>`).join('');document.querySelector('.hack-keys').innerHTML=['A','B','C'].map(x=>`<button data-letter="${x}">${x}</button>`).join('');document.querySelectorAll('[data-letter]').forEach(b=>b.onclick=()=>hackLetter(b.dataset.letter));};
}
function hackLetter(letter){
  if(!hack)return;
  if(hack.sequence[hack.index]!==letter){act({type:'hackCancel'});hack=null;$('hack-result').textContent='Sequência incorreta.';finishHack();return;}
  $('sequence').children[hack.index].classList.add('done');hack.index++;
  if(hack.index===3){hack=null;if(act({type:'hack'}))$('hack-result').textContent=`+${state.pcLevel} ${state.pcLevel===1?'informação':'informações'}! Venda na BLACKNET.`;finishHack();}
}
function finishHack(){document.querySelector('.hack-keys').innerHTML='<button id="again-hack">Novo hack</button>';$('again-hack').onclick=()=>{dialog.close();openHack();};}
function openPets(){
  if(!openDialog('MINHA CASA · PETS'))return;
  content.innerHTML='<h2>Um lar com companhia.</h2><p class="dialog-note">Cada pet custa 100 BYTE. Eles aparecem na sua casa.</p>'+petIds.map((id,i)=>`<div class="pet-row"><img src="assets/props/pet_${id}.png" alt="${petNames[i]}"><div><strong>${petNames[i]}</strong><small>Companheiro decorativo</small></div><button data-pet="${id}" ${state.pets.includes(id)?'disabled':''}>${state.pets.includes(id)?'Já é seu':'100 BYTE'}</button></div>`).join('');
  content.querySelectorAll('[data-pet]').forEach(b=>b.onclick=()=>{if(act({type:'pet',id:b.dataset.pet})){b.textContent='Já é seu';b.disabled=true;message('Seu novo pet está esperando em casa.');}});
}
function openRoulette(){
  if(!openDialog('NEON ROYALE · ROLETA EUROPEIA'))return;
  const step=360/37;const gradient=WHEEL.map((n,i)=>`${n===0?'#078a72':colorOf(n)==='red'?'#b22c52':'#172333'} ${i*step}deg ${(i+1)*step}deg`).join(',');
  content.innerHTML=`<h2>A sorte gira devagar.</h2><div class="wheel-shell"><div class="wheel" id="wheel" style="background:conic-gradient(from ${-step/2}deg,${gradient})">${WHEEL.map((n,i)=>`<span class="wheel-number" style="transform:rotate(${i*step}deg) translateY(-94px)">${n}</span>`).join('')}</div><div class="ball-track" id="ball-track"><span class="ball"></span></div></div><div id="round-result" class="result">Escolha uma cor</div><p class="dialog-note">Aposta: 20 BYTE. Acerto retorna 40 BYTE (lucro de 20). O zero verde perde. Chance por cor: 18 em 37.</p><div class="bets"><button class="red" data-bet="red">Vermelho · 20 BYTE</button><button class="black" data-bet="black">Preto · 20 BYTE</button></div>`;
  wheelAngle=0;content.querySelectorAll('[data-bet]').forEach(b=>b.onclick=()=>spin(b.dataset.bet));
}
async function animate(el,frames,duration){await el.animate(frames,{duration,easing:'linear',fill:'forwards'}).finished;}
async function spin(choice){
  if(busy)return;const result=randomInt(37);if(!act({type:'roulette',choice,result}))return;
  setBusy(true);content.querySelectorAll('[data-bet]').forEach(b=>b.disabled=true);$('round-result').textContent='Girando…';
  const target=(360-WHEEL.indexOf(result)*360/37)%360, end=wheelAngle+8*360+((target-wheelAngle%360+360)%360);
  const duration=SPIN_MS;
  const turnFrames=(from,to)=>[{transform:`rotate(${from}deg)`,offset:0},{transform:`rotate(${from+(to-from)*.78}deg)`,offset:.7},{transform:`rotate(${from+(to-from)*.96}deg)`,offset:.9,easing:'ease-out'},{transform:`rotate(${to}deg)`,offset:1}];
  try{await Promise.all([animate($('wheel'),turnFrames(wheelAngle,end),duration),animate($('ball-track'),turnFrames(0,-3600),duration)]);}finally{
    wheelAngle=end;const payout=state.pending?.payout??0;act({type:'settle'});$('round-result').textContent=`${result} · ${colorOf(result)==='red'?'Vermelho':result===0?'Zero':'Preto'} · ${payout?'+20':'−20'} BYTE`;
    message(payout?'Acertou a cor! Lucro de 20 BYTE.':'Dessa vez não deu. Você perdeu 20 BYTE.');setBusy(false);content.querySelectorAll('[data-bet]').forEach(b=>b.disabled=false);
  }
}
function openTrade(){
  if(!openDialog('MINHA CASA · BITE / BYTE'))return;
  content.innerHTML=`<h2>Qual o próximo movimento?</h2><div class="ticker"><span>BITE / BYTE</span><span>Rodada virtual · 4 s</span></div><svg class="chart" viewBox="0 0 400 140" role="img" aria-label="Gráfico ilustrativo do trade"><path class="baseline" d="M0 70H400"/><polyline id="trade-line" points="0,93 25,80 50,87 75,65 100,77 125,51 150,60 175,47 200,70"/></svg><div class="result" id="trade-result">Alta ou baixa?</div><p class="dialog-note">Cada rodada custa 20 BYTE. Acerto retorna 38 (lucro de 18). Chance de 50%; o gráfico é ilustrativo.</p><div class="bets"><button data-trade="up" class="primary">↑ Alta · 20 BYTE</button><button data-trade="down" class="red">↓ Baixa · 20 BYTE</button></div>`;
  content.querySelectorAll('[data-trade]').forEach(b=>b.onclick=()=>trade(b.dataset.trade));
}
async function trade(choice){
  if(busy)return;const result=randomInt(2);if(!act({type:'trade',choice,result}))return;
  setBusy(true);content.querySelectorAll('[data-trade]').forEach(b=>b.disabled=true);$('trade-result').textContent='Mercado em movimento…';
  const base='0,93 25,80 50,87 75,65 100,77 125,51 150,60 175,47 200,70';let points=base;
  for(let i=1;i<=8;i++){await new Promise(r=>setTimeout(r,500));points+=` ${200+i*25},${Math.round(70+(result?-1:1)*i*5+(i%2?6:-3))}`;$('trade-line').setAttribute('points',points);}
  const payout=state.pending.payout;act({type:'settle'});$('trade-result').textContent=`${result?'Alta ↑':'Baixa ↓'} · ${payout?'+18':'−20'} BYTE`;message(payout?'Trade correto! Lucro de 18 BYTE.':'O mercado foi para o outro lado. −20 BYTE.');setBusy(false);content.querySelectorAll('[data-trade]').forEach(b=>b.disabled=false);
}
document.addEventListener('click',e=>{const goButton=e.target.closest('[data-go]');if(goButton)go(goButton.dataset.go);});
$('character').onchange=()=>{state={...state,characterId:$('character').value};save();};
const moves={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
window.addEventListener('keydown',e=>{if(e.target.matches('select,input,textarea'))return;if(dialog.open){if(hack&&['a','b','c'].includes(e.key.toLowerCase())){e.preventDefault();hackLetter(e.key.toUpperCase());}return;}const d=moves[e.key];if(d){e.preventDefault();approachingBroker=false;controller.queue.length=0;keys.add(d);}if(e.key.toLowerCase()==='e')interact();});
window.addEventListener('keyup',e=>keys.delete(moves[e.key]));window.addEventListener('blur',()=>keys.clear());
document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>controller.enqueueInput(b.dataset.move));$('interact').onclick=()=>interact();
function interact(){if(!ready||busy||dialog.open)return;if(mm.currentMap.id==='player_home')openHack();else if(mm.currentMap.id==='neon_royale')openRoulette();else if(mm.currentMap.id==='ghost_row_interior')openSell();else message('Casa: hack e trade. BLACKNET: venda informações. NEON ROYALE: roleta.');}
function pathTo(col,row){
  if(!mm.canEnter(col,row)||controller.isMoving)return;
  const start=[mm.playerCol,mm.playerRow],queue=[[...start,[]]],seen=new Set([start.join(',')]);
  for(let i=0;i<queue.length;i++){const [x,y,path]=queue[i];if(x===col&&y===row){controller.queue.length=0;path.forEach(d=>controller.enqueueInput(d));return;}
    for(const [d,dx,dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(seen.has(k)||!mm.canEnter(nx,ny))continue;const door=mm.currentMap.getDoorAt(nx,ny);if(door&&(nx!==col||ny!==row))continue;seen.add(k);queue.push([nx,ny,[...path,d]]);}}
}
canvas.onclick=e=>{
  if(!ready||busy||dialog.open||loading)return;canvas.focus();const rect=canvas.getBoundingClientRect();const x=(e.clientX-rect.left)*canvas.width/rect.width,y=(e.clientY-rect.top)*canvas.height/rect.height;const grid=screenToGrid(x,y,origin.originX,origin.originY);
  if(mm.currentMap.id==='district_07'){
    if(LOCKS.some(l=>Math.abs(grid.col-l.x)<2&&grid.row<6)){message('🔒 Este prédio está fechado.');return;}
    if(grid.col>=10&&grid.col<=13&&grid.row>=2&&grid.row<=5){go('ghost_row_interior');return;}
    if(grid.col>=17&&grid.col<=20&&grid.row>=10&&grid.row<=13){go('neon_royale');return;}
    if(grid.col>=5&&grid.col<=8&&grid.row>=11&&grid.row<=13){go('player_home');return;}
  }else if(mm.currentMap.id==='neon_royale'){
    if(grid.col>=18&&grid.row<=5){message('🔒 Área VIP fechada por enquanto.');return;}
    if(grid.col>=5&&grid.col<=8&&grid.row>=7&&grid.row<=9){openRoulette();return;}
    if(grid.col>=9&&grid.col<=14&&grid.row>=3&&grid.row<=5){message('Bem-vindo ao NEON ROYALE. Escolha a roleta para jogar.');return;}
  }else if(mm.currentMap.id==='player_home'&&grid.col>=6&&grid.col<=9&&grid.row<=3){openHack();return;}
  if(mm.currentMap.id===broker.mapId&&grid.col===broker.col&&grid.row>=broker.row-1&&grid.row<=broker.row){visitBroker();return;}
  approachingBroker=false;pathTo(grid.col,grid.row);
};
function label(col,row,text,color='#ffd688'){
  const {x,y}=gridToScreen(col,row,origin.originX,origin.originY);ctx.save();ctx.font='bold 9px monospace';ctx.textAlign='center';const w=ctx.measureText(text).width+14;ctx.fillStyle='#07111ee8';ctx.fillRect(x-w/2,y-10,w,19);ctx.strokeStyle=color;ctx.strokeRect(x-w/2,y-10,w,19);ctx.fillStyle=color;ctx.fillText(text,x,y+3);ctx.restore();
}
function lock(col,row){const {x,y}=gridToScreen(col,row,origin.originX,origin.originY);ctx.save();ctx.fillStyle='#07111eee';ctx.fillRect(x-13,y-14,26,27);ctx.strokeStyle='#f7c577';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-5,5,Math.PI,0);ctx.stroke();ctx.fillStyle='#f7c577';ctx.fillRect(x-8,y-5,16,13);ctx.fillStyle='#122030';ctx.fillRect(x-1,y-1,2,5);ctx.restore();}
const petImages=petIds.map(id=>{const im=new Image();im.src=`assets/props/pet_${id}.png`;return im;});
function render(now){
  requestAnimationFrame(render);if(!ready)return;const dt=lastFrame?Math.min(now-lastFrame,50):0;lastFrame=now;
  if(keys.size&&!controller.isMoving&&!controller.queueLength)controller.enqueueInput([...keys].at(-1));controller.tick(dt);
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;renderer.drawMap(mm.currentMap);renderer.drawReflections(mm.currentMap,now);
  const {col,row}=controller.visualPosition;const pos=gridToScreen(col,row,origin.originX,origin.originY);
  const drawBroker=()=>{const p=gridToScreen(broker.col,broker.row,origin.originX,origin.originY);ctx.save();ctx.filter='hue-rotate(150deg)';drawAvatar(ctx,p.x,p.y+16,'character4','down','idle');ctx.restore();};
  const hasBroker=mm.currentMap.id===broker.mapId;
  if(hasBroker&&row>=broker.row)drawBroker();
  renderer.drawPropsAndCharacter(mm.currentMap.props,row,()=>drawAvatar(ctx,pos.x,pos.y+16,state.characterId,controller.direction,controller.pose));
  if(hasBroker&&row<broker.row)drawBroker();
  if(hasBroker){label(broker.col,broker.row-1.7,'CIPHER · VENDER');if(canTalkToBroker(mm.currentMap.id,mm.playerCol,mm.playerRow))label(broker.col,broker.row+.8,'E · CONVERSAR','#52efff');}
  if(approachingBroker&&!controller.isMoving&&!controller.queueLength&&!controller._finishing){approachingBroker=false;openSell();}
  if(mm.currentMap.id==='district_07'){LOCKS.forEach(l=>lock(l.x,l.y));label(18,11.5,'♠ CASSINO ♠');}
  if(mm.currentMap.id==='neon_royale'){lock(19.8,3.5);label(6.4,9.8,'ROLETA', '#ffd688');label(11.5,5.7,'NEON ROYALE','#52efff');}
  if(mm.currentMap.id==='player_home'){state.pets.forEach((id,i)=>{const im=petImages[petIds.indexOf(id)];if(im.complete&&im.naturalWidth){ctx.drawImage(im,origin.originX+360+i*18,origin.originY+137,42,42);}});}
  renderer.drawDustMotes(mm.currentMap,now);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();save();}});window.addEventListener('pagehide',()=>save());
setInterval(()=>{const next=regenerate(state);if(next.energy!==state.energy){state=next;save();update();}},1000);
save();update();await go('district_07');requestAnimationFrame(render);
