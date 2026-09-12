export const HACK_SYMBOLS = ['A','B','C','D'];
export const MEMORY_MS=1800, ANSWER_MS=7000, SEQUENCE_LENGTH=5;
export function createChallenge(randomInt,now){return {sequence:Array.from({length:SEQUENCE_LENGTH},()=>HACK_SYMBOLS[randomInt(4)]),index:0,revealUntil:now+MEMORY_MS,deadline:now+MEMORY_MS+ANSWER_MS,status:'active'};}
export function challengePhase(hack,now){if(hack.status!=='active')return hack.status;if(now>=hack.deadline)return 'timeout';return now<hack.revealUntil?'memorize':'answer';}
export function enterSymbol(hack,letter,now){
  const phase=challengePhase(hack,now);
  if(phase==='timeout')return {...hack,status:'timeout'};
  if(phase!=='answer'||!HACK_SYMBOLS.includes(letter))return hack;
  if(hack.sequence[hack.index]!==letter)return {...hack,status:'failed'};
  const index=hack.index+1;return {...hack,index,status:index===hack.sequence.length?'success':'active'};
}
