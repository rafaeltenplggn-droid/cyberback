import { MapManager } from '../maps/mapManager.js';
import { Renderer } from '../render/renderer.js';
import { MovementController } from '../character/movementController.js';
import { centerMapOrigin, gridToScreen, screenToGrid } from '../core/topdown.js';
import { SAVE_KEY, fresh, valid, upgradeSave, migrate, regenerate, transact, WHEEL, colorOf, SPIN_MS, INFORMATION_PRICE } from './economy.js';
import { prepareMap, casinoMap, LOCKS } from './maps.js';
import { drawAvatar } from './avatar.js';
import {findPath} from './navigation.js';
import {HOME_PC,atHomePC,drawInteriorForeground,drawPCChair} from './interiorLayers.js';
import {HACK_SYMBOLS,createChallenge,challengePhase,enterSymbol,SEQUENCE_LENGTH,ANSWER_MS} from './memoryHack.js';
import { BLACKNET_NPC as broker, canTalkToBroker } from './blacknetNpc.js';

const $=id=>document.getElementById(id), canvas=$('game'),ctx=canvas.getContext('2d');
const dialog=$('activity'),content=$('dialog-content');
const names={district_07:'The city is yours.',player_home:'Your hideout.',neon_royale:'Neon Royale',ghost_row_interior:'BLACKNET'};
const petNames=['Orange Cat','Gray Cat','Sphynx Cat'],petIds=['gato_laranja','gato_cinza','gato_sphynx'];
let state=fresh(), storageBlocked=false, busy=false, loading=false, ready=false, hack=null, lastFrame=0, wheelAngle=0;
let approachingBroker=false,pendingPC=null,seatedPC=false,hackTimer=null;
let origin={originX:0,originY:0};
const keys=new Set(), images={};
function message(text){$('message').textContent=text;}
try {
  const raw=localStorage.getItem(SAVE_KEY);
  if(raw!==null){const parsed=upgradeSave(JSON.parse(raw));if(!valid(parsed))throw Error();state=parsed;state.hackActive=false;}
  else {const old=localStorage.getItem('cyberback.save.v1');if(old){const imported=migrate(JSON.parse(old));if(!imported)throw Error();state=imported;message('Balance, energy and pets from your previous save have been restored.');}}
  state=regenerate(state);
  if(state.pending){state=transact(state,{type:'settle'});message('Your previous round has finished. Your balance is up to date.');}
} catch {storageBlocked=true;message('Could not read your save. The original was preserved; this session will not be saved.');}
function save(next=state){
  if(!storageBlocked){try{localStorage.setItem(SAVE_KEY,JSON.stringify(next));$('save-status').textContent='Saved in this browser';}catch{$('save-status').textContent='Could not save in this browser';}}
  else $('save-status').textContent='Session not saved';
}
function update(){
  $('balance').innerHTML=`${state.byteBalance.toLocaleString('en')} <span>BYTE</span>`;
  const energy=$('energy-value');if(energy)energy.textContent=`${state.energy}/100`;
  const bar=$('energy-bar');if(bar)bar.value=state.energy;
  const inventory=$('information-count');if(inventory)inventory.textContent=state.information;
  $('character').value=state.characterId;
  if($('pc-energy'))$('pc-energy').textContent=state.energy+'/100';
  if($('pc-files'))$('pc-files').textContent=state.information+' files';
  if($('pc-balance'))$('pc-balance').textContent=state.byteBalance+' BYTE';
}
function act(action){try{const next=transact(regenerate(state),action);save(next);state=next;update();return true;}catch(e){message(e.message);return false;}}
function randomInt(n){const a=new Uint32Array(1);let v;const limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a);v=a[0];}while(v>=limit);return v%n;}
function loadImage(file){if(!images[file]){const im=new Image();im.src=`assets/backgrounds/${file}`;images[file]=im;}return images[file];}
const mm=new MapManager({loadMapJson:async id=>{
  if(id==='neon_royale')return casinoMap();
  if(!['district_07','player_home','ghost_row_interior'].includes(id))throw Error('Location closed.');
  const response=await fetch(`maps/${id}.json`);if(!response.ok)throw Error('Could not load the map.');return prepareMap(await response.json());
}});
const renderer=new Renderer(ctx,origin,{backgroundImages:images});
const controller=new MovementController(mm,{isInputBlocked:()=>loading||dialog.open||busy,onMapChanged:()=>{keys.clear();controller.queue.length=0;mapChanged();},onMoveError:()=>message('Could not open this location. Please try again.')});
function mapChanged(){
  approachingBroker=false;pendingPC=null;seatedPC=false;
  origin=centerMapOrigin(mm.currentMap,canvas.width,canvas.height);Object.assign(renderer,origin);loadImage(mm.currentMap.background);
  $('place').textContent=names[mm.currentMap.id];$('district').textContent=mm.currentMap.id==='neon_royale'?'♠ CASINO · PLAY / TRADE / WIN':'SECTOR 7';
  document.querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('active',b.dataset.go===mm.currentMap.id));
  activities();
}
async function go(id){
  if(busy||loading||dialog.open||controller.isMoving||controller._finishing)return;
  loading=true;approachingBroker=false;pendingPC=null;seatedPC=false;keys.clear();controller.queue.length=0;$('map-loading').hidden=false;
  try{const pos=id==='neon_royale'?[11,13]:id==='player_home'?[5,7]:id==='ghost_row_interior'?[8,8]:[12,8];await mm.loadMap(id,...pos);mapChanged();ready=true;}
  catch{message('Could not load this location. Please try again.');}
  finally{loading=false;$('map-loading').hidden=true;}
}
const card=(symbol,title,desc,buttons,extra='')=>`<section class="card ${extra}"><div class="symbol">${symbol}</div><h3>${title}</h3><p>${desc}</p>${buttons}</section>`;
function activities(){
  const id=mm.currentMap.id;
  let html=`<div class="energy"><span>⚡ Energy <strong id="energy-value">${state.energy}/100</strong></span><progress id="energy-bar" value="${state.energy}" max="100"></progress><small>Hack: 10 energy · restores 1 every 30 s</small></div>`;
  html+=`<div class="energy"><span>▤ Intel <strong id="information-count">${state.information}</strong></span><small>Sell on BLACKNET · ${INFORMATION_PRICE} BYTE each</small></div>`;
  if(id==='player_home')html+=card('⌘','Connect. Hack. Profit.','Collect intel at the terminal and sell it on BLACKNET.',`<button id="hack-open" class="primary">Hack · +${state.pcLevel} ${state.pcLevel===1?'intel file':'intel files'}</button><button id="trade-open">Trade BITE / BYTE</button><button id="upgrade">${state.pcLevel===1?'Upgrade PC · 150 BYTE':'PC upgraded · level 2'}</button>`)+card('♧','Your companions','Cosmetic pets to make your hideout feel like home.','<button id="pets-open">Buy pets · 100 BYTE</button>');
  else if(id==='ghost_row_interior')html+=card('▤','Cipher · Data broker',`Cipher buys your intel for ${INFORMATION_PRICE} BYTE each. Click him or approach and press E.`,`<button id="sell-open" class="primary">Talk to Cipher</button><button data-go="player_home">Return home</button>`);
  else if(id==='neon_royale')html+=card('♠','Make your move.','One round, one choice. The next number could be yours.','<button id="roulette-open" class="gold">Play roulette</button>','casino')+`<p class="dialog-note">♔ VIP area currently closed.</p>`;
  else html+=card('⌂','Start at home.','Hack to collect intel. Sell it on BLACKNET to earn BYTE.','<button data-go="player_home" class="primary">Go home</button><button data-go="ghost_row_interior">Sell on BLACKNET</button>')+card('♠','NEON ROYALE','Roulette under the lights of Sector 7.','<button data-go="neon_royale" class="gold">Enter the casino</button>','casino')+`<p class="dialog-note">🔒 The bar and CORP are closed.</p>`;
  $('activities').innerHTML=html;
  $('hack-open')?.addEventListener('click',openHack);$('pets-open')?.addEventListener('click',openPets);
  $('roulette-open')?.addEventListener('click',openRoulette);$('trade-open')?.addEventListener('click',openTrade);
  $('sell-open')?.addEventListener('click',visitBroker);
  if($('upgrade')){$('upgrade').disabled=state.pcLevel===2;$('upgrade').onclick=()=>{if(act({type:'upgrade'})){message('PC upgraded: each successful hack yields 2 intel files.');activities();}};}
}
function visitBroker(){
  if(busy||loading||dialog.open||controller.isMoving||mm.currentMap.id!==broker.mapId)return;
  if(canTalkToBroker(mm.currentMap.id,mm.playerCol,mm.playerRow)){openSell();return;}
  keys.clear();pathTo(broker.approachCol,broker.approachRow);approachingBroker=true;message('Walking over to Cipher…');
}
function openSell(){
  if(!canTalkToBroker(mm.currentMap.id,mm.playerCol,mm.playerRow)){message('Approach Cipher to talk.');return;}
  if(!openDialog('CIPHER · BLACKNET BROKER'))return;
  content.innerHTML=`<h2>Got any intel for me?</h2><p class="dialog-note">Cipher: “Good data has a price. I pay in BYTE.”</p><p>Your stock: <strong id="sale-stock">${state.information}</strong></p><p class="dialog-note">Each intel file is worth ${INFORMATION_PRICE} BYTE.</p><button id="sell-all" class="primary" ${state.information===0?'disabled':''}>Sell all · ${state.information*INFORMATION_PRICE} BYTE</button><div id="sale-result" class="result" role="status"></div>`;
  $('sell-all').onclick=()=>{const amount=state.information*INFORMATION_PRICE;if(act({type:'sellInformation',mapId:mm.currentMap.id,col:mm.playerCol,row:mm.playerRow})){$('sell-all').disabled=true;$('sell-all').textContent='Stock sold';$('sale-stock').textContent='0';$('sale-result').textContent=`Sold! +${amount} BYTE`;message(`Intel sold on BLACKNET: +${amount} BYTE.`);}};
}
function openDialog(kicker){if(busy||loading||controller.isMoving)return false;keys.clear();controller.queue.length=0;dialog.classList.remove('pc-monitor');$('close').textContent='✕';$('dialog-kicker').textContent=kicker;dialog.showModal();window.scrollTo({top:0,behavior:"instant"});return true;}
function closeDialog(){if(busy)return;clearInterval(hackTimer);hackTimer=null;seatedPC=false;if(hack)act({type:'hackCancel'});hack=null;dialog.close();canvas.focus();activities();}
$('close').onclick=closeDialog;dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
function setBusy(value){busy=value;lockPCApps(value);$('close').disabled=value;document.querySelectorAll('[data-go],#character').forEach(b=>b.disabled=value);}
function visitPC(mode){
  if(mm.currentMap.id!==HOME_PC.mapId||busy||loading||dialog.open||controller.isMoving)return;
  if(atHomePC(mm.currentMap.id,mm.playerCol,mm.playerRow)){mode==='trade'?openTrade():openHack();return;}
  keys.clear();approachingBroker=false;pathTo(HOME_PC.col,HOME_PC.row);pendingPC=mode;message('Walking to the PC chair…');
}
function mountPC(mode){
  dialog.classList.add('pc-monitor');$('dialog-kicker').textContent='SECTOR OS / PERSONAL TERMINAL';$('close').textContent='Exit PC ×';
  const app=content.innerHTML;
  content.innerHTML=`<div class="pc-desktop"><div class="pc-system"><span>● LOCAL CONNECTION</span><span>PC LVL ${state.pcLevel} / SECTOR 7</span></div><div class="pc-layout"><section class="pc-sidebar" aria-label="Computer applications"><div class="pc-logo">S_</div><small>SECTOR OS</small><button data-pc="hack" class="${mode==='hack'?'selected':''}">⌘ Intrusion</button><button data-pc="trade" class="${mode==='trade'?'selected':''}">↗ Trade</button><div class="pc-storage"><small>COLLECTED FILES</small><strong id="pc-files">${state.information} files</strong><p>Sell your data to Cipher on BLACKNET.</p></div></section><section class="pc-app"><div class="pc-window-title"><span>${mode==='hack'?'intrusion.exe':'market.exe'}</span><span>− □</span></div><div class="pc-command">guest@sector7:~$ ${mode==='hack'?'connect --target encrypted':'open BITE/BYTE'} ▌</div><div class="pc-app-body">${app}</div></section></div><div class="pc-status"><span>⚡ <b id="pc-energy">${state.energy}/100</b></span><span id="pc-balance">${state.byteBalance} BYTE</span><span>PRIVATE SESSION</span></div></div>`;
  content.querySelectorAll('[data-pc]').forEach(button=>button.onclick=()=>{if(busy||hack)return;dialog.close();button.dataset.pc==='hack'?openHack():openTrade();});
}
function lockPCApps(value){content.querySelectorAll('[data-pc]').forEach(button=>button.disabled=value);}
function openHack(){
  if(!atHomePC(mm.currentMap.id,mm.playerCol,mm.playerRow)){visitPC('hack');return;}
  if(!openDialog('MY HOME · TERMINAL'))return;
  seatedPC=true;
  content.innerHTML='<h2>Memorize. Hack.</h2><p class="dialog-note">Memorize 5 symbols in 1.8 seconds. Then they disappear: you have 7 seconds to repeat them. Each attempt costs 10 energy.</p><div class="letters" id="sequence"></div><div id="hack-clock" role="status">Get ready to memorize.</div><div class="hack-keys"><button id="start-hack" class="primary">Start hack · 10 energy</button></div><div class="result" id="hack-result"></div>';
  mountPC('hack');
  $('sequence').innerHTML=Array(SEQUENCE_LENGTH).fill('<span>?</span>').join('');
  $('start-hack').onclick=()=>{
    if(!act({type:'hackStart'}))return;
    hack=createChallenge(randomInt,performance.now());lockPCApps(true);
    document.querySelector('.hack-keys').innerHTML=HACK_SYMBOLS.map(x=>'<button data-letter="'+x+'">'+x+'</button>').join('');
    document.querySelectorAll('[data-letter]').forEach(b=>b.onclick=()=>hackLetter(b.dataset.letter));
    refreshHack();clearInterval(hackTimer);hackTimer=setInterval(refreshHack,50);
  };
}
function refreshHack(){
  if(!hack)return;
  const phase=challengePhase(hack,performance.now());
  if(phase==='timeout'){finishChallenge(false,'Time is up. Try memorizing again.');return;}
  [...$('sequence').children].forEach((cell,i)=>{cell.textContent=phase==='memorize'?hack.sequence[i]:i<hack.index?'✓':'?';cell.classList.toggle('done',phase==='answer'&&i<hack.index);});
  document.querySelectorAll('[data-letter]').forEach(b=>b.disabled=phase!=='answer');
  $('hack-clock').textContent=phase==='memorize'?'MEMORIZE — the symbols will disappear.':'Your turn · '+Math.max(0,(hack.deadline-performance.now())/1000).toFixed(1)+' s';
}
function hackLetter(letter){
  if(!hack)return;
  hack=enterSymbol(hack,letter,performance.now());
  if(hack.status==='success'){finishChallenge(true,'Intel acquired! Sell it on BLACKNET.');return;}
  if(hack.status==='failed'||hack.status==='timeout'){finishChallenge(false,hack.status==='timeout'?'Time is up.':'Incorrect sequence.');return;}
  refreshHack();
}
function finishChallenge(success,result){
  clearInterval(hackTimer);hackTimer=null;
  if(success){if(!act({type:'hack'}))result='Could not complete the hack.';}else act({type:'hackCancel'});
  hack=null;lockPCApps(false);$('hack-result').textContent=result;$('hack-clock').textContent=success?'ACCESS GRANTED':'ACCESS DENIED';
  if(success)[...$('sequence').children].forEach(cell=>{cell.textContent='✓';cell.classList.add('done');});
  document.querySelector('.hack-keys').innerHTML='<button id="again-hack">New hack</button>';
  $('again-hack').onclick=()=>{dialog.close();openHack();};
}
function openPets(){
  if(!openDialog('MY HOME · PETS'))return;
  content.innerHTML='<h2>A home with company.</h2><p class="dialog-note">Each pet costs 100 BYTE and appears in your home.</p>'+petIds.map((id,i)=>`<div class="pet-row"><img src="assets/props/pet_${id}.png" alt="${petNames[i]}"><div><strong>${petNames[i]}</strong><small>Cosmetic companion</small></div><button data-pet="${id}" ${state.pets.includes(id)?'disabled':''}>${state.pets.includes(id)?'Owned':'100 BYTE'}</button></div>`).join('');
  content.querySelectorAll('[data-pet]').forEach(b=>b.onclick=()=>{if(act({type:'pet',id:b.dataset.pet})){b.textContent='Owned';b.disabled=true;message('Your new pet is waiting at home.');}});
}
function openRoulette(){
  if(!openDialog('NEON ROYALE · EUROPEAN ROULETTE'))return;
  const step=360/37;const gradient=WHEEL.map((n,i)=>`${n===0?'#078a72':colorOf(n)==='red'?'#b22c52':'#172333'} ${i*step}deg ${(i+1)*step}deg`).join(',');
  content.innerHTML=`<h2>Let luck take its time.</h2><div class="wheel-shell"><div class="wheel" id="wheel" style="background:conic-gradient(from ${-step/2}deg,${gradient})">${WHEEL.map((n,i)=>`<span class="wheel-number" style="transform:rotate(${i*step}deg) translateY(-94px)">${n}</span>`).join('')}</div><div class="ball-track" id="ball-track"><span class="ball"></span></div></div><div id="round-result" class="result">Choose a color</div><p class="dialog-note">Bet: 20 BYTE. A win returns 40 BYTE (20 profit). Green zero loses. Odds per color: 18 in 37.</p><div class="bets"><button class="red" data-bet="red">Red · 20 BYTE</button><button class="black" data-bet="black">Black · 20 BYTE</button></div>`;
  wheelAngle=0;content.querySelectorAll('[data-bet]').forEach(b=>b.onclick=()=>spin(b.dataset.bet));
}
async function animate(el,frames,duration){await el.animate(frames,{duration,easing:'linear',fill:'forwards'}).finished;}
async function spin(choice){
  if(busy)return;const result=randomInt(37);if(!act({type:'roulette',choice,result}))return;
  setBusy(true);content.querySelectorAll('[data-bet]').forEach(b=>b.disabled=true);$('round-result').textContent='Spinning…';
  const target=(360-WHEEL.indexOf(result)*360/37)%360, end=wheelAngle+8*360+((target-wheelAngle%360+360)%360);
  const duration=SPIN_MS;
  const turnFrames=(from,to)=>[{transform:`rotate(${from}deg)`,offset:0},{transform:`rotate(${from+(to-from)*.78}deg)`,offset:.7},{transform:`rotate(${from+(to-from)*.96}deg)`,offset:.9,easing:'ease-out'},{transform:`rotate(${to}deg)`,offset:1}];
  try{await Promise.all([animate($('wheel'),turnFrames(wheelAngle,end),duration),animate($('ball-track'),turnFrames(0,-3600),duration)]);}finally{
    wheelAngle=end;const payout=state.pending?.payout??0;act({type:'settle'});$('round-result').textContent=`${result} · ${colorOf(result)==='red'?'Red':result===0?'Zero':'Black'} · ${payout?'+20':'−20'} BYTE`;
    message(payout?'You picked the winning color! Profit: 20 BYTE.':'No luck this time. You lost 20 BYTE.');setBusy(false);content.querySelectorAll('[data-bet]').forEach(b=>b.disabled=false);
  }
}
function openTrade(){
  if(!atHomePC(mm.currentMap.id,mm.playerCol,mm.playerRow)){visitPC('trade');return;}
  if(!openDialog('MY HOME · BITE / BYTE'))return;
  seatedPC=true;
  content.innerHTML=`<h2>What is the next move?</h2><div class="ticker"><span>BITE / BYTE</span><span>Virtual round · 4 s</span></div><svg class="chart" viewBox="0 0 400 140" role="img" aria-label="Illustrative trading chart"><path class="baseline" d="M0 70H400"/><polyline id="trade-line" points="0,93 25,80 50,87 75,65 100,77 125,51 150,60 175,47 200,70"/></svg><div class="result" id="trade-result">Up or down?</div><p class="dialog-note">Each round costs 20 BYTE. A win returns 38 (18 profit). Odds: 50%; the chart is illustrative.</p><div class="bets"><button data-trade="up" class="primary">↑ Up · 20 BYTE</button><button data-trade="down" class="red">↓ Down · 20 BYTE</button></div>`;
  mountPC('trade');
  content.querySelectorAll('[data-trade]').forEach(b=>b.onclick=()=>trade(b.dataset.trade));
}
async function trade(choice){
  if(busy)return;const result=randomInt(2);if(!act({type:'trade',choice,result}))return;
  setBusy(true);content.querySelectorAll('[data-trade]').forEach(b=>b.disabled=true);$('trade-result').textContent='Market moving…';
  const base='0,93 25,80 50,87 75,65 100,77 125,51 150,60 175,47 200,70';let points=base;
  for(let i=1;i<=8;i++){await new Promise(r=>setTimeout(r,500));points+=` ${200+i*25},${Math.round(70+(result?-1:1)*i*5+(i%2?6:-3))}`;$('trade-line').setAttribute('points',points);}
  const payout=state.pending.payout;act({type:'settle'});$('trade-result').textContent=`${result?'Up ↑':'Down ↓'} · ${payout?'+18':'−20'} BYTE`;message(payout?'Correct trade! Profit: 18 BYTE.':'The market went the other way. −20 BYTE.');setBusy(false);content.querySelectorAll('[data-trade]').forEach(b=>b.disabled=false);
}
document.addEventListener('click',e=>{const goButton=e.target.closest('[data-go]');if(goButton)go(goButton.dataset.go);});
$('character').onchange=()=>{state={...state,characterId:$('character').value};save();};
const moves={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
window.addEventListener('keydown',e=>{if(e.target.matches('select,input,textarea'))return;if(dialog.open){if(hack&&['a','b','c','d'].includes(e.key.toLowerCase())&&!e.repeat){e.preventDefault();hackLetter(e.key.toUpperCase());}return;}const d=moves[e.key];if(d){e.preventDefault();approachingBroker=false;pendingPC=null;controller.queue.length=0;keys.add(d);}if(e.key.toLowerCase()==='e')interact();});
window.addEventListener('keyup',e=>keys.delete(moves[e.key]));window.addEventListener('blur',()=>keys.clear());
document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>controller.enqueueInput(b.dataset.move));$('interact').onclick=()=>interact();
function interact(){if(!ready||busy||dialog.open)return;if(mm.currentMap.id==='player_home')openHack();else if(mm.currentMap.id==='neon_royale')openRoulette();else if(mm.currentMap.id==='ghost_row_interior')openSell();else message('Home: hack and trade. BLACKNET: sell intel. NEON ROYALE: roulette.');}
function pathTo(col,row){
  if(controller.isMoving)return;
  const path=findPath(mm.currentMap,{col:mm.playerCol,row:mm.playerRow},{col,row});
  if(!path)return;controller.queue.length=0;path.forEach(step=>controller.enqueueInput(step.direction));
}
canvas.onclick=e=>{
  if(!ready||busy||dialog.open||loading)return;canvas.focus();const rect=canvas.getBoundingClientRect();const x=(e.clientX-rect.left)*canvas.width/rect.width,y=(e.clientY-rect.top)*canvas.height/rect.height;const grid=screenToGrid(x,y,origin.originX,origin.originY);
  if(mm.currentMap.id==='district_07'){
    if(LOCKS.some(l=>Math.abs(grid.col-l.x)<2&&grid.row<6)){message('🔒 This building is closed.');return;}
    if(grid.col>=10&&grid.col<=13&&grid.row>=2&&grid.row<=5){go('ghost_row_interior');return;}
    if(grid.col>=17&&grid.col<=20&&grid.row>=10&&grid.row<=13){go('neon_royale');return;}
    if(grid.col>=5&&grid.col<=8&&grid.row>=11&&grid.row<=13){go('player_home');return;}
  }else if(mm.currentMap.id==='neon_royale'){
    if(grid.col>=18&&grid.row<=5){message('🔒 VIP area currently closed.');return;}
    if(grid.col>=5&&grid.col<=8&&grid.row>=7&&grid.row<=9){openRoulette();return;}
    if(grid.col>=9&&grid.col<=14&&grid.row>=3&&grid.row<=5){message('Welcome to NEON ROYALE. Choose roulette to play.');return;}
  }else if(mm.currentMap.id==='player_home'&&grid.col>=6&&grid.col<=9&&grid.row<=3){openHack();return;}
  if(mm.currentMap.id===broker.mapId&&grid.col===broker.col&&grid.row>=broker.row-1&&grid.row<=broker.row){visitBroker();return;}
  approachingBroker=false;pendingPC=null;pathTo(grid.col,grid.row);
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
  renderer.drawPropsAndCharacter(mm.currentMap.props,row,()=>{if(seatedPC&&mm.currentMap.id==='player_home'){drawAvatar(ctx,origin.originX+mm.currentMap.width*32*.504,origin.originY+mm.currentMap.height*32*.34,state.characterId,'up','idle',48,true);drawPCChair(ctx,mm.currentMap,images[mm.currentMap.background],origin.originX,origin.originY);}else drawAvatar(ctx,pos.x,pos.y+16,state.characterId,controller.direction,controller.pose);});
  if(hasBroker&&row<broker.row)drawBroker();
  drawInteriorForeground(ctx,mm.currentMap,images[mm.currentMap.background],origin.originX,origin.originY);
  if(hasBroker){label(broker.col,broker.row-1.7,'CIPHER · SELL');if(canTalkToBroker(mm.currentMap.id,mm.playerCol,mm.playerRow))label(broker.col,broker.row+.8,'E · TALK','#52efff');}
  if(pendingPC&&!controller.isMoving&&!controller.queueLength&&!controller._finishing){const mode=pendingPC;pendingPC=null;if(atHomePC(mm.currentMap.id,mm.playerCol,mm.playerRow)){mode==='trade'?openTrade():openHack();}}
  if(approachingBroker&&!controller.isMoving&&!controller.queueLength&&!controller._finishing){approachingBroker=false;openSell();}
  if(mm.currentMap.id==='district_07'){LOCKS.forEach(l=>lock(l.x,l.y));label(18,11.5,'♠ CASINO ♠');}
  if(mm.currentMap.id==='neon_royale'){lock(19.8,3.5);label(6.4,9.8,'ROULETTE', '#ffd688');label(11.5,5.7,'NEON ROYALE','#52efff');}
  if(mm.currentMap.id==='player_home'){state.pets.forEach((id,i)=>{const im=petImages[petIds.indexOf(id)];if(im.complete&&im.naturalWidth){ctx.drawImage(im,origin.originX+360+i*18,origin.originY+137,42,42);}});}
  renderer.drawDustMotes(mm.currentMap,now);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();save();}});window.addEventListener('pagehide',()=>save());
setInterval(()=>{const next=regenerate(state);if(next.energy!==state.energy){state=next;save();update();}},1000);
save();update();await go('district_07');requestAnimationFrame(render);
