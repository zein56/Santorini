// Santorini kurallar motoru (sunucu + istemci ortak)
export const SIZES={2:5,3:6,4:7,5:8,6:9,7:10,8:10,9:12,10:12,11:13,12:13};
export const W=2; // oyuncu basina isci
export const newGame=(np,n=SIZES[np])=>({n,np,h:Array(n*n).fill(0),ws:[],turn:0,phase:'place',alive:Array(np).fill(true),placed:0,sel:null,winner:null});
export const occ=(s,i)=>s.ws.findIndex(w=>w.i===i);
export const nb=(s,i)=>{const r=Math.floor(i/s.n),c=i%s.n,o=[];
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){if(!a&&!b)continue;const x=r+a,y=c+b;if(x>=0&&y>=0&&x<s.n&&y<s.n)o.push(x*s.n+y)}return o};
export const moves=(s,k)=>{const w=s.ws[k];return nb(s,w.i).filter(j=>occ(s,j)<0&&s.h[j]<4&&s.h[j]<=s.h[w.i]+1)};
export const builds=(s,k)=>nb(s,s.ws[k].i).filter(j=>occ(s,j)<0&&s.h[j]<4);
const canMove=(s,p)=>s.ws.some((w,k)=>w.p===p&&moves(s,k).length>0);
const elim=(s,p)=>{s.alive[p]=false;s.ws=s.ws.filter(w=>w.p!==p)};
function next(s){s.phase='move';s.sel=null;
 do{s.turn=(s.turn+1)%s.np;
  if(s.alive[s.turn]&&!canMove(s,s.turn))elim(s,s.turn); // hamle yapamayan elenir
  if(s.alive.filter(Boolean).length===1){s.winner=s.alive.indexOf(true);return}
 }while(!s.alive[s.turn])}
// a: {t:'place',i} | {t:'move',from,i} | {t:'build',i}  -> yeni state ya da {error}
export function apply(s0,a){
 if(s0.winner!=null)return{error:'Oyun bitti'};
 const s=structuredClone(s0),p=s.turn,i=a.i;
 if(s.phase==='place'&&a.t==='place'){
  if(!(i>=0&&i<s.n*s.n)||occ(s,i)>=0)return{error:'Dolu'};
  s.ws.push({p,i});s.placed++;
  if(s.placed===s.np*W){s.phase='move';s.turn=0}else s.turn=(p+1)%s.np;
  return s}
 if(s.phase==='move'&&a.t==='move'){
  const k=occ(s,a.from);
  if(k<0||s.ws[k].p!==p||!moves(s,k).includes(i))return{error:'Gecersiz hamle'};
  s.ws[k].i=i;
  if(s.h[i]===3){s.winner=p;return s}
  s.phase='build';s.sel=k;
  if(!builds(s,k).length){elim(s,p);next(s)}
  return s}
 if(s.phase==='build'&&a.t==='build'){
  if(!builds(s,s.sel).includes(i))return{error:'Gecersiz insa'};
  s.h[i]++;next(s);return s}
 return{error:'Yanlis asama'}}
