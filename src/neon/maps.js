export const LOCKS = [{x:3.5,y:4.3,name:'BAR'}, {x:18.5,y:4.3,name:'CORP'}];
export function prepareMap(raw) {
  const map = structuredClone(raw);
  if (map.id === 'district_07') {
    map.background = 'sector7_neon_royale.png';
    map.doors = map.doors.filter(d => ['player_home','data_terminal_interior','ghost_row_interior'].includes(d.target_map)).map(d => d.target_map === 'data_terminal_interior' ? {...d,target_map:'neon_royale',spawn_x:11,spawn_y:13} : d);
  }
  return map;
}
export function casinoMap() {
  const width=24,height=18;
  const collision=Array.from({length:height},()=>Array(width).fill(1));
  const open=(x1,y1,x2,y2)=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)collision[y][x]=0;};
  open(4,6,20,6); open(4,7,4,11); open(9,7,9,11); open(14,7,14,11); open(18,7,18,11);
  open(4,11,20,12); open(10,13,13,15); open(5,10,8,10); open(10,10,13,10); open(15,10,17,10);
  return {id:'neon_royale',tileset:'neon_royale',width,height,background:'neon_royale_interior.png',tiles:Array.from({length:height},()=>Array(width).fill(0)),collision,
    doors:[{x:11,y:15,target_map:'district_07',spawn_x:18,spawn_y:14,approach:'down'},{x:12,y:15,target_map:'district_07',spawn_x:18,spawn_y:14,approach:'down'}],props:[],reflections:[],dustMotes:[]};
}
