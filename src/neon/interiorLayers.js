// Recortes normalizados da arte original. A parede e redesenhada em primeiro
// plano; a matriz de colisao continua sendo a autoridade para o movimento.
export const WALL_LAYERS = {
  player_home: [[.042,.04,.023,.86],[.935,.04,.025,.87],[.043,.035,.23,.033],[.278,.016,.485,.033],[.762,.04,.195,.025],[.271,.04,.021,.387],[.044,.327,.09,.025],[.202,.327,.051,.025],[.044,.768,.332,.142],[.618,.768,.338,.142],[.376,.685,.025,.274],[.598,.685,.021,.274],[.376,.681,.243,.027]],
  ghost_row_interior: [[.03,.036,.02,.84],[.946,.036,.025,.84],[.031,.034,.196,.024],[.229,.012,.498,.025],[.727,.035,.24,.023],[.033,.719,.348,.155],[.62,.719,.347,.155],[.382,.677,.022,.271],[.597,.677,.024,.271],[.382,.673,.24,.025]],
  neon_royale: [[.03,.04,.023,.83],[.945,.04,.023,.83],[.03,.035,.323,.022],[.353,.015,.29,.025],[.643,.035,.322,.022],[.033,.716,.355,.15],[.611,.716,.355,.15],[.389,.679,.021,.25],[.592,.679,.02,.25],[.389,.674,.223,.025]],
};
export const HOME_PC = {mapId:'player_home',col:7,row:3};
export function atHomePC(mapId,col,row){return mapId===HOME_PC.mapId&&col===HOME_PC.col&&row===HOME_PC.row;}
export function drawInteriorForeground(ctx,map,image,originX=0,originY=0){
  if(!image?.complete||!image.naturalWidth)return;
  const w=map.width*32,h=map.height*32;
  ctx.save();ctx.imageSmoothingEnabled=false;
  for(const [x,y,rw,rh] of WALL_LAYERS[map.id]??[])ctx.drawImage(image,x*image.naturalWidth,y*image.naturalHeight,rw*image.naturalWidth,rh*image.naturalHeight,originX+x*w,originY+y*h,rw*w,rh*h);
  ctx.restore();
}
export function drawPCChair(ctx,map,image,originX=0,originY=0){
  if(map.id!=='player_home'||!image?.complete||!image.naturalWidth)return;
  // Encosto original em frente ao tronco sentado, sem repintar a sala.
  const x=.481,y=.292,w=.046,h=.059;
  ctx.drawImage(image,x*image.naturalWidth,y*image.naturalHeight,w*image.naturalWidth,h*image.naturalHeight,originX+x*map.width*32,originY+y*map.height*32,w*map.width*32,h*map.height*32);
}
