import MessageContent from './MessageContent';
import {MAX_MESSAGE_LENGTH,MESSAGE_TOO_LONG} from '../message-limits.mjs';
import {checkMessageResponse} from './message-response.mjs';
import ChangePassword from './ChangePassword';
import HostAddress from './HostAddress';
import React,{useState,useEffect,useRef,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Mail,Send,Images,Film,Monitor,Leaf,LogOut,Menu,X,ImagePlus,Video,Radio,ChevronRight,MessageCircle,Users,Stamp,Settings,Paperclip,Download} from 'lucide-react';
import AdminPage from './AdminPage';
import AccountGate from './AccountGate';
import Postcard from './Postcard';
import './style.css';

const tabs=[['all','家庭聊天室',MessageCircle],['image','小岛相册',Images],['video','家庭影集',Film]];
const formatTime=t=>new Date(t).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
function merge(a,b){return [...new Map([...a,...b].map(m=>[m.id,m])).values()].sort((a,b)=>a.id-b.id)}
function App({user,logout,expired}){
  const device="account:"+user.id,name=user.name;
  const [tab,setTab]=useState('all'),[members,setMembers]=useState([]),[online,setOnline]=useState(false);
  const [items,setItems]=useState([]),[ready,setReady]=useState(false),[more,setMore]=useState(false),[draft,setDraft]=useState(''),[file,setFile]=useState(null);
  const [sending,setSending]=useState(false),[error,setError]=useState(''),[drawer,setDrawer]=useState(false),[photo,setPhoto]=useState(null);
  const picker=useRef(null),stream=useRef(null),refresh=useRef(null),bottom=useRef(true),anchor=useRef(null),view=useRef(null);
  const [cleanupRevision,setCleanupRevision]=useState(0);
  const dialog=useRef(null);
  useEffect(()=>{if(photo) dialog.current?.showModal()},[photo]);
  useEffect(()=>{
    let active=true,first=true;
    bottom.current=true;anchor.current=null;setItems([]);setReady(false);setMore(false);setError('');
    async function load(before){
      try{
        const r=await fetch('/api/messages?kind='+tab+(before?'&before='+before:''));
        if(!active)return;
        if(r.status===401){expired();return}
        if(!r.ok) throw Error();
        const rows=await r.json();
        if(!active) return;
        if(before && view.current) anchor.current=view.current.scrollHeight;
        if(first || before) setMore(rows.length===80);
        first=false;setItems(old=>merge(old,rows));setReady(true);
      }catch{if(active)setError('读取消息失败，请检查连接后重试')}
    }
    refresh.current=load;
    const source=new EventSource('/api/events');
    stream.current=source;
    source.onopen=()=>{setOnline(true);load()};
    source.onerror=()=>{setOnline(false);setMembers([]);load()};
    source.addEventListener('members',e=>setMembers(JSON.parse(e.data)));
    source.addEventListener('files-cleaned',()=>{setPhoto(null);setCleanupRevision(n=>n+1)});
    source.addEventListener('message',()=>load());
    load();
    return ()=>{active=false;source.close()};
  },[tab,name,cleanupRevision]);
  useLayoutEffect(()=>{
    const el=view.current;if(!el)return;
    if(anchor.current!==null){el.scrollTop+=el.scrollHeight-anchor.current;anchor.current=null}
    else if(bottom.current && tab==='all') el.scrollTop=el.scrollHeight;
  },[items,tab]);
  function select(t){setTab(t);setDrawer(false)}
  const [preview,setPreview]=useState('');
  useEffect(()=>{
    if(!file?.type.startsWith('image/')){setPreview('');return}
    const url=URL.createObjectURL(file);
    setPreview(url);
    return ()=>URL.revokeObjectURL(url);
  },[file]);
  function chooseFile(selected){
    if(!selected)return;
    setFile(selected);
    setError('');
  }
  function pasteImage(event){
    const image=Array.from(event.clipboardData.files).find(item=>item.type.startsWith('image/'));
    if(!image)return;
    event.preventDefault();
    chooseFile(image);
  }
  function attach(accept){picker.current.accept=accept;picker.current.click()}
  async function send(e){
    e?.preventDefault();
    if(sending||(!draft.trim()&&!file))return;
    if(draft.length>MAX_MESSAGE_LENGTH){setError(MESSAGE_TOO_LONG);return}
    setSending(true);setError('');
    const body=new FormData();body.append('text',draft);
    if(file)body.append('media',file);
    try{
      const r=await fetch('/api/messages',{method:'POST',body});
      if(r.status===401){expired();return}
      await checkMessageResponse(r);
      setDraft('');setFile(null);bottom.current=true;await refresh.current();
    }catch(e){setError(e.message==='Failed to fetch'?'发送失败，请检查网络后重试':e.message)}
    finally{setSending(false)}
  }
  const current=tabs.find(t=>t[0]===tab);
  function attachment(m){
    if(!m.file)return null;
    const url='/media/'+m.file;
    if(m.mime.startsWith('image/')){
      return <button className="thumb" onClick={()=>setPhoto(m)}><img src={url} alt={m.filename} loading="lazy"/></button>;
    }
    if(m.mime.startsWith('video/')){
      return <video src={url} controls playsInline preload="metadata" aria-label={m.filename}/>;
    }
    return <a className="file-download" href={url} download={m.filename}>
      <Download size={18} aria-hidden="true"/><span>{m.filename || '下载附件'}</span>
    </a>;
  }
  return <div className="page"><header className="mast"><div className="brand"><span className="mark"><Mail size={29}/><Leaf size={18}/></span><div><b>小岛邮局</b><small>ISLAND POST</small></div></div><div className="connection"><HostAddress/><div className="network"><i className={online?'dot':'dot off'}/>{online?'局域网已连接':'正在连接'}</div></div></header>
  <div className="shell">{drawer&&<button className="shade" aria-label="关闭导航" onClick={()=>setDrawer(false)}/>}
  <aside className={drawer?'open':''}><div className="island"><span className="islandIcon">🏝️</span><div><strong>我们的小岛</strong><small>家庭空间</small></div></div>
  <div className="label">邮局导航</div><nav>{tabs.map(([id,title,Icon])=><button key={id} aria-current={id===tab?'page':undefined} className={id===tab?'selected':''} onClick={()=>select(id)}><Icon size={19}/>{title}{id===tab&&<ChevronRight size={15}/>}</button>)}</nav>
  <div className="label people"><Users size={15}/>在线家人 <span>{members.length}</span></div><div className="members">{members.map(m=><div key={m.device}><i className="dot"/><span>{m.name}</span>{m.device===device&&<small>我</small>}</div>)}</div>
  <a className="back-link password-entry" href="#/password">修改密码</a>
  {user.isAdmin&&<a className="admin-entry" href="#/admin">家庭管理</a>}
  <button className="identity" title="退出当前账号" onClick={()=>logout().catch(()=>setError("退出失败，请重试"))}><span className="deviceIcon"><Monitor size={22}/></span><span><small>当前账号 · 退出登录</small><strong>{name}</strong></span><LogOut size={15}/></button></aside>
  <main><header className="room"><button className="mobile" aria-label="打开导航" onClick={()=>setDrawer(true)}><Menu/></button><span className="roomicon">{React.createElement(current[2],{size:23})}</span><div><h1>{current[1]}</h1><small>{tab==='all'?'家人和设备的共享会话':tab==='image'?'聊天中分享的图片':'聊天中分享的视频'}</small></div>{user.isAdmin ? (
    <a className="room-admin-button" href="#/admin"><Settings size={16} aria-hidden="true"/>家庭管理</a>
  ) : <Stamp className="stamp" size={29}/>}</header>
  <div className="feed" ref={view} onScroll={e=>{const el=e.currentTarget;bottom.current=el.scrollHeight-el.clientHeight-el.scrollTop<65}}>
  {more&&<button className="older" onClick={()=>refresh.current(items[0]?.id)}>查看更早的消息</button>}
  {!items.length?<div className="empty"><figure><Postcard/><figcaption><Mail size={13}/> ISLAND POST OFFICE <span>✦</span></figcaption></figure><h2>{!ready?'正在打开邮局…':tab==='all'?'欢迎来到小岛邮局':tab==='image'?'相册里还没有照片':'影集里还没有视频'}</h2><p>{tab==='all'?'寄出第一条消息，和家里的设备打个招呼吧。':'在家庭聊天室发送'+(tab==='image'?'图片':'视频')+'后，就能在这里找到。'}</p></div>:
  <div className={tab==='all'?'messages':'gallery'}>{items.map(m=><article key={m.id} className={m.device===device?'mine':''}><div className="meta">{m.name} · {formatTime(m.time)}</div><div className="bubble"><MessageContent message={m}>{attachment(m)}</MessageContent></div></article>)}</div>}</div>
  {error&&<div role="alert" className="error">{error} <button onClick={()=>{setError('');refresh.current()}}>刷新消息</button></div>}
  {tab==='all'&&<form className="compose" onSubmit={send}><fieldset disabled={sending}><legend>撰写消息</legend>{file&&<div className="attachment">{preview&&<img src={preview} alt="待发送的图片预览"/>}{file.name} <button type="button" aria-label="移除附件" onClick={()=>setFile(null)}><X size={14}/></button></div>}<textarea onPaste={pasteImage} aria-label="消息内容" placeholder="写一封小岛来信…" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&e.nativeEvent.keyCode!==229 && matchMedia('(pointer:fine)').matches){e.preventDefault();send()}}}/>
  <div className="actions"><button type="button" onClick={()=>attach('image/jpeg,image/png,image/gif,image/webp,image/avif')}><ImagePlus/>图片</button><button type="button" onClick={()=>attach('video/mp4,video/webm,video/quicktime')}><Video/>视频</button><button type="button" onClick={()=>attach('')}><Paperclip/>文件</button><button className="send" disabled={(!draft.trim()&&!file)||sending}>{sending?'寄送中…':'发送'}<Send size={16}/></button></div></fieldset><input type="file" hidden ref={picker} onChange={e=>{chooseFile(e.target.files[0]);e.target.value=''}}/></form>}</main></div>
  {photo&&<dialog ref={dialog} onClose={()=>setPhoto(null)}><button className="close" aria-label="关闭图片" onClick={()=>dialog.current.close()}><X/></button><img className="full" src={'/media/'+photo.file} alt={photo.filename}/></dialog>}
  </div>
}
function RoomRouter(props){
  const [path,setPath]=useState(location.hash);
  useEffect(()=>{
    const navigate=()=>setPath(location.hash);
    window.addEventListener('hashchange',navigate);
    return ()=>window.removeEventListener('hashchange',navigate);
  },[]);
  if(path==='#/password')return <ChangePassword expired={props.expired}/>;
  return path==='#/admin'&&props.user.isAdmin?<AdminPage expired={props.expired}/>:<App {...props}/>;
}
createRoot(document.getElementById('root')).render(<AccountGate>{(user,logout,expired)=><RoomRouter key={user.id} user={user} logout={logout} expired={expired}/>}</AccountGate>);
