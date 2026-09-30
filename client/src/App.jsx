import {useState,useEffect,useMemo,useRef} from 'react';import {io} from 'socket.io-client';
import {newGame,apply,moves,builds,occ} from '../../shared/engine.js';
const COL=['#e63946','#1d7ad9','#2a9d5c','#f4a300','#8e44ad','#16a6a6','#e67e9a','#6b4f2a','#555','#a4c400','#ff6f3c','#00b3ff'];
const pid=localStorage.pid||(localStorage.pid=Math.random().toString(36).slice(2)+Date.now().toString(36));
const sock=io();let ac;
const fx=(f,v)=>{try{ac=ac||new AudioContext();const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f;g.gain.value=.08;o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+.09)}catch{}navigator.vibrate?.(v)};

const rumble=g=>g.vibrationActuator?.playEffect?.('dual-rumble',{duration:80,strongMagnitude:.6,weakMagnitude:.4});
function Board({s,me,onAct,ok}){
 const [sel,setSel]=useState(null),[cur,setCur]=useState(0),[kb,setKb]=useState(false),[flat,setFlat]=useState(localStorage.flat==='1');
 const k=sel==null?-1:occ(s,sel);
 const hl=useMemo(()=>{
  if(s.winner!=null||(me!=null&&me!==s.turn))return[];
  if(s.phase==='place')return s.h.map((_,i)=>i).filter(i=>occ(s,i)<0);
  if(s.phase==='build')return builds(s,s.sel);
  const own=s.ws.filter(w=>w.p===s.turn).map(w=>w.i);return k>=0?[...moves(s,k),...own]:own;
 },[s,sel,me]);
 const click=i=>{if(!hl.includes(i))return;
  if(s.phase==='place'){fx(300,20);onAct({t:'place',i})}
  else if(s.phase==='build'){fx(520,[20,30,20]);onAct({t:'build',i})}
  else if(occ(s,i)>=0){setSel(i);fx(400,10)}
  else{onAct({t:'move',from:sel,i});setSel(null);fx(350,30)}};
 const R=useRef();R.current={click,cur,ok,n:s.n};
 const step=(dx,dy)=>{setKb(true);setCur(c=>{const n=R.current.n,r=Math.floor(c/n)+dy,q=c%n+dx;return r<0||q<0||r>=n||q>=n?c:r*n+q})};
 useEffect(()=>{const f=e=>{const d={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]}[e.key];
  if(d){e.preventDefault();step(...d)}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();setKb(true);R.current.click(R.current.cur)}else if(e.key==='Escape')setSel(null)};
  addEventListener('keydown',f);return()=>removeEventListener('keydown',f)},[]);
 useEffect(()=>{let raf,pv={},last=0;
  const loop=()=>{const {click,cur,ok}=R.current;
   for(const g of navigator.getGamepads?.()||[]){if(!g||!ok(g.index))continue;
    const b=i=>!!g.buttons[i]?.pressed,pr=i=>b(i)&&!pv[g.index+'b'+i];
    const dx=Math.sign((b(15)?1:0)-(b(14)?1:0)+(Math.abs(g.axes[0])>.6?Math.sign(g.axes[0]):0)),dy=Math.sign((b(13)?1:0)-(b(12)?1:0)+(Math.abs(g.axes[1])>.6?Math.sign(g.axes[1]):0));
    const now=performance.now();if((dx||dy)&&now-last>170){last=now;step(dx,dy)}
    if(pr(0)){setKb(true);click(cur);rumble(g)}if(pr(1))setSel(null);
    pv[g.index+'b0']=b(0);pv[g.index+'b1']=b(1)}
   raf=requestAnimationFrame(loop)};
  raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf)},[]);
 return <div className="scene"><div className={'board'+(flat?' flat':'')} style={{gridTemplateColumns:`repeat(${s.n},1fr)`,'--pc':COL[s.turn]}}>
  {s.h.map((h,i)=>{const w=s.ws.find(w=>w.i===i);
   return <div key={i} onClick={()=>{setKb(false);click(i)}} className={'cell'+(hl.includes(i)?' hl':'')+(sel===i?' sel':'')}>
    {[1,2,3].map(l=>h>=l&&<i key={l} className={'lv l'+l} style={{'--z':l*12}}/>)}{h===4&&<i className="dome" style={{'--z':36}}/>}
    {w&&<b className="w" style={{background:COL[w.p],'--z':Math.min(h,3)*12+4}}/>}
    {kb&&cur===i&&<u className="cursor"/>}</div>})}</div>
  <button className="view" onClick={()=>{localStorage.flat=flat?'0':'1';setFlat(!flat)}}>{flat?'3D görünüm':'2D görünüm'}</button></div>;
}

function Game({s,names,me,onAct,onExit,extra,padsMap}){
 const ph={place:'işçini yerleştir',move:'işçini hareket ettir',build:'bina yap'}[s.phase];
 const ok=padsMap?(i=>padsMap[s.turn]!==undefined?i===padsMap[s.turn]:!Object.values(padsMap).includes(i)):(()=>true);
 return <div className="page"><div className="bar" style={{color:COL[s.turn]}}>
  {s.winner!=null?`🏆 ${names[s.winner]} kazandı!`:`Sıra: ${names[s.turn]} — ${ph}`}{me!=null&&me===s.turn&&s.winner==null?' (sen)':''}</div>
  <Board s={s} me={me} onAct={onAct} ok={ok}/>
  <div className="row">{names.map((n,i)=><span key={i} style={{color:COL[i],opacity:s.alive[i]?1:.4}}>● {n}{padsMap?.[i]!==undefined?' 🎮':''}</span>)}</div>
  {extra}<button onClick={onExit}>Çık</button></div>;
}

function LocalSetup({np,setNp,pads,setPads,onStart,onBack}){
 const [learn,setLearn]=useState(null),[cnt,setCnt]=useState(0);
 useEffect(()=>{let raf;const loop=()=>{const gs=[...(navigator.getGamepads?.()||[])].filter(Boolean);setCnt(gs.length);
  if(learn!=null)for(const g of gs)if(g.buttons.some(b=>b.pressed)){
   setPads(p=>{const q={};for(const k in p)if(p[k]!==g.index)q[k]=p[k];q[learn]=g.index;return q});rumble(g);setLearn(null);return}
  raf=requestAnimationFrame(loop)};raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf)},[learn]);
 return <div className="page"><h1>Yerel oyun</h1><div className="card">
  <label className="row">Oyuncu sayısı<select value={np} onChange={e=>setNp(+e.target.value)}>{Array.from({length:11},(_,i)=>i+2).map(n=><option key={n}>{n}</option>)}</select></label>
  <div>🎮 Bağlı kol: {cnt}{cnt===0&&' (kolda bir tuşa basınca görünür)'}</div>
  {Array.from({length:np},(_,i)=><div className="row" key={i}><span style={{color:COL[i]}}>● Oyuncu {i+1}</span>
   <span>{pads[i]!==undefined?`🎮 Kol ${pads[i]+1}`:'Fare/klavye'}</span>
   <button onClick={()=>setLearn(learn===i?null:i)} disabled={cnt===0}>{learn===i?'Kolda tuşa bas…':'Kol ata'}</button>
   {pads[i]!==undefined&&<button onClick={()=>setPads(p=>{const q={...p};delete q[i];return q})}>✕</button>}</div>)}
  <button className="p" onClick={onStart}>Başla</button><button onClick={onBack}>Geri</button></div></div>;
}

export default function App(){
 const [name,setName]=useState(localStorage.pname||''),[scr,setScr]=useState(localStorage.pname?'home':'name');
 const [list,setList]=useState([]),[room,setRoom]=useState(null),[code,setCode]=useState(''),[err,setErr]=useState('');
 const [ls,setLs]=useState(null),[np,setNp]=useState(2),[pads,setPads]=useState({});
 useEffect(()=>{sock.on('room',setRoom);sock.on('room:list',setList);sock.emit('room:list',setList);
  sock.on('connect',()=>{const c=sessionStorage.room;if(c)sock.emit('room:join',{pid,name:localStorage.pname,code:c},r=>{if(r?.error)sessionStorage.removeItem('room');else setScr('room')})});
  return()=>{sock.off('room');sock.off('room:list')}},[]);
 const enter=r=>{if(r?.error)return setErr(r.error);setErr('');setScr('room')};
 const leave=()=>{sock.emit('room:leave');sessionStorage.removeItem('room');setRoom(null);setScr('home')};
 useEffect(()=>{if(room)sessionStorage.room=room.code},[room]);
 if(scr==='name')return <div className="page"><h1>🏛️ Santorini</h1><input placeholder="Adın" value={name} maxLength={16} onChange={e=>setName(e.target.value)}/>
  <button className="p" disabled={!name.trim()} onClick={()=>{localStorage.pname=name.trim();setScr('home')}}>Devam</button></div>;
 if(scr==='lsetup')return <LocalSetup np={np} setNp={setNp} pads={pads} setPads={setPads} onBack={()=>setScr('home')} onStart={()=>{setLs(newGame(np));setScr('local')}}/>;
 if(scr==='local'&&ls)return <Game s={ls} names={Array.from({length:ls.np},(_,i)=>'Oyuncu '+(i+1))} me={null} padsMap={pads}
  onAct={a=>{const r=apply(ls,a);if(!r.error)setLs(r)}} onExit={()=>{setLs(null);setScr('home')}}
  extra={ls.winner!=null&&<button className="p" onClick={()=>setLs(newGame(ls.np))}>Tekrar oyna</button>}/>;
 if(scr==='room'&&room){const me=room.players.findIndex(p=>p.pid===pid),host=room.host===pid;
  if(room.state)return <Game s={room.state} names={room.players.map(p=>p.name)} me={me} onAct={a=>sock.emit('game:action',a,r=>r?.error&&setErr(r.error))} onExit={leave}
   extra={<>{err&&<div className="err">{err}</div>}{room.state.winner!=null&&host&&<button className="p" onClick={()=>sock.emit('game:reset')}>Lobiye dön</button>}</>}/>;
  return <div className="page"><h1>Oda {room.code}</h1><div className="card">{room.players.map((p,i)=><div key={p.pid} style={{color:COL[i]}}>● {p.name}{p.pid===room.host?' 👑':''}</div>)}<div>{room.players.length}/{room.max} oyuncu</div></div>
   {host?<div className="card"><label className="row">Oyuncu sayısı
    <select value={room.max} onChange={e=>sock.emit('room:settings',{max:+e.target.value})}>{Array.from({length:11},(_,i)=>i+2).map(n=><option key={n} disabled={n<room.players.length}>{n}</option>)}</select></label>
    <label className="row">Herkese açık<input type="checkbox" checked={room.pub} onChange={e=>sock.emit('room:settings',{pub:e.target.checked})}/></label>
    <button className="p" disabled={room.players.length<2} onClick={()=>sock.emit('game:start')}>Başlat</button></div>:<div className="bar">Host başlatınca oyun açılır…</div>}
   <button onClick={leave}>Ayrıl</button></div>}
 return <div className="page"><h1>🏛️ Merhaba {name}</h1>{err&&<div className="err">{err}</div>}
  <div className="card"><b>Yerel oyun (tek cihaz)</b><button className="p" onClick={()=>setScr('lsetup')}>Kur ve başla</button></div>
  <div className="card"><b>Online oda</b><div className="row"><button className="p" onClick={()=>sock.emit('room:create',{pid,name,pub:true},enter)}>Herkese açık kur</button>
   <button onClick={()=>sock.emit('room:create',{pid,name,pub:false},enter)}>Özel kur</button></div>
   <div className="row"><input placeholder="Kod" value={code} maxLength={4} onChange={e=>setCode(e.target.value.toUpperCase())}/><button onClick={()=>sock.emit('room:join',{pid,name,code},enter)}>Katıl</button></div></div>
  <div className="card"><b>Açık odalar</b>{list.length?list.map(r=><div className="row" key={r.code}><span>{r.host} ({r.n}/{r.max})</span><button onClick={()=>sock.emit('room:join',{pid,name,code:r.code},enter)}>Katıl</button></div>):<i>Bekleyen oda yok</i>}</div>
  <button onClick={()=>setScr('name')}>İsmi değiştir</button></div>;
}
