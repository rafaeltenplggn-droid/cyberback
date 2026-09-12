export function findPath(map,from,to){
  if(map.isBlocked(from.col,from.row)||map.isBlocked(to.col,to.row))return null;
  const queue=[{...from,path:[]}],seen=new Set([`${from.col},${from.row}`]);
  for(let i=0;i<queue.length;i++){
    const {col,row,path}=queue[i];if(col===to.col&&row===to.row)return path;
    for(const [direction,dx,dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]){
      const x=col+dx,y=row+dy,key=`${x},${y}`;
      if(seen.has(key)||map.isBlocked(x,y))continue;
      if(map.getDoorAt(x,y)&&(x!==to.col||y!==to.row))continue;
      seen.add(key);queue.push({col:x,row:y,path:[...path,{col:x,row:y,direction}]});
    }
  }
  return null;
}
// Trailer e jogo usam a mesma rota valida; a interpolacao nunca corta uma parede.
export function samplePath(map,from,to,progress){
  const path=findPath(map,from,to);if(!path)throw new Error('Rota bloqueada');
  const p=Math.max(0,Math.min(1,progress))*path.length,index=Math.min(Math.floor(p),path.length);
  const a=index===0?from:path[index-1],b=path[index]??a,t=p-index;
  return {x:a.col+(b.col-a.col)*t,y:a.row+(b.row-a.row)*t,dir:b.direction??'down',walk:progress>0&&progress<1};
}
