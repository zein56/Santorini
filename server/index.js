import express from 'express';import {createServer} from 'http';import {Server} from 'socket.io';
import path from 'path';import {fileURLToPath} from 'url';
import {newGame,apply} from '../shared/engine.js';
const app=express(),http=createServer(app),io=new Server(http);
const dist=path.join(path.dirname(fileURLToPath(import.meta.url)),'../client/dist');
app.use(express.static(dist));app.get('*',(q,r)=>r.sendFile(path.join(dist,'index.html')));
const rooms=new Map();
const snap=r=>({code:r.code,host:r.host,pub:r.pub,max:r.max,players:r.players.map(({pid,name,on})=>({pid,name,on})),state:r.state});
const list=()=>[...rooms.values()].filter(r=>r.pub&&!r.state).map(r=>({code:r.code,host:r.players.find(p=>p.pid===r.host)?.name,n:r.players.length,max:r.max}));
io.on('connection',so=>{
 const R=()=>rooms.get(so.data.code);
 const push=r=>{io.to(r.code).emit('room',snap(r));io.emit('room:list',list())};
 const join=(r,pid,name,cb)=>{let p=r.players.find(p=>p.pid===pid);
  if(!p){if(r.state||r.players.length>=r.max)return cb?.({error:'Oda dolu ya da başlamış'});
   p={pid,name:(name||'Oyuncu').slice(0,16)};r.players.push(p)}
  p.on=true;so.data={code:r.code,pid};so.join(r.code);cb?.({ok:1});push(r)};
 const leave=()=>{const r=R();if(!r)return;const p=r.players.find(p=>p.pid===so.data.pid);if(!p)return;
  so.leave(r.code);p.on=false;if(!r.state)r.players=r.players.filter(x=>x!==p);
  if(!r.players.some(p=>p.on)){setTimeout(()=>{if(!r.players.some(p=>p.on)){rooms.delete(r.code);io.emit('room:list',list())}},r.state?6e5:0);return}
  if(r.host===p.pid)r.host=r.players.find(p=>p.on).pid;push(r)};
 so.on('room:list',cb=>cb(list()));
 so.on('room:create',({pid,name,pub},cb)=>{let code;do code=Math.random().toString(36).slice(2,6).toUpperCase();while(rooms.has(code));
  const r={code,host:pid,pub:!!pub,max:4,players:[],state:null};rooms.set(code,r);join(r,pid,name,cb)});
 so.on('room:join',({pid,name,code},cb)=>{const r=rooms.get((code||'').toUpperCase());r?join(r,pid,name,cb):cb?.({error:'Oda yok'})});
 so.on('room:settings',({max,pub})=>{const r=R();if(!r||r.state||r.host!==so.data.pid)return;
  if(max>=Math.max(2,r.players.length)&&max<=12)r.max=max;if(typeof pub==='boolean')r.pub=pub;push(r)});
 so.on('game:start',()=>{const r=R();if(!r||r.state||r.host!==so.data.pid||r.players.length<2)return;r.state=newGame(r.players.length);push(r)});
 so.on('game:action',(a,cb)=>{const r=R();if(!r?.state)return;const k=r.players.findIndex(p=>p.pid===so.data.pid);
  if(k!==r.state.turn)return cb?.({error:'Sıra sende değil'});
  const s=apply(r.state,a);if(s.error)return cb?.(s);r.state=s;push(r)});
 so.on('game:reset',()=>{const r=R();if(r&&r.host===so.data.pid&&r.state?.winner!=null){r.state=null;push(r)}});
 so.on('room:leave',leave);so.on('disconnect',leave);
});
http.listen(process.env.PORT||3000,()=>console.log('Santorini :'+(process.env.PORT||3000)));
