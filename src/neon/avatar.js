// Atlas original com quatro personagens e vistas frontal, lateral e traseira.
// Cada recorte e medido pela transparencia para alinhar os pes entre direcoes.
const sheet = new Image();
sheet.src = 'assets/neon_characters.png';
let frames = null;
sheet.onload = () => {
  const canvas = document.createElement('canvas');
  canvas.width = sheet.naturalWidth; canvas.height = sheet.naturalHeight;
  const c = canvas.getContext('2d', {willReadFrequently:true}); c.drawImage(sheet,0,0);
  const pixels = c.getImageData(0,0,canvas.width,canvas.height).data;
  const xs=[0,380,705,1086].map(x=>Math.round(x*canvas.width/1086));
  const ys=[0,357,731,1063,1448].map(y=>Math.round(y*canvas.height/1448));
  frames=Array.from({length:4},(_,row)=>Array.from({length:3},(_,col)=>{
    let left=xs[col+1],right=xs[col],top=ys[row+1],bottom=ys[row];
    for(let y=ys[row];y<ys[row+1];y++)for(let x=xs[col];x<xs[col+1];x++){
      if(pixels[(y*canvas.width+x)*4+3]>100){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    return {x:left,y:top,w:right-left+1,h:bottom-top+1};
  }));
};
export function drawAvatar(ctx,x,feet,id,direction,pose,height=48) {
  if(!frames)return;
  const row=Math.max(0,Math.min(3,Number(id.slice(-1))-1));
  const view=direction==='up'?2:direction==='left'||direction==='right'?1:0;
  const f=frames[row][view],w=Math.round(f.w*height/f.h);
  ctx.save();ctx.translate(Math.round(x),Math.round(feet));
  ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(0,-1,w*.37,3,0,0,Math.PI*2);ctx.fill();
  if(direction==='left')ctx.scale(-1,1);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const step=pose==='step1'?1:pose==='step2'?-1:0;
  const legStart=Math.round(f.h*.77),bodyH=Math.round(height*.77),legH=height-bodyH;
  ctx.drawImage(sheet,f.x,f.y,f.w,legStart,-w/2,-height,w,bodyH);
  // Leve alternancia dos pes, mantendo rosto e tronco estaveis.
  ctx.drawImage(sheet,f.x,f.y+legStart,f.w/2,f.h-legStart,-w/2,-legH+step,w/2,legH);
  ctx.drawImage(sheet,f.x+f.w/2,f.y+legStart,f.w/2,f.h-legStart,0,-legH-step,w/2,legH);
  ctx.restore();
}
