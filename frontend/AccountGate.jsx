import HostAddress from './HostAddress';
import React,{useEffect,useState} from 'react';
import {Mail} from 'lucide-react';

export default function AccountGate({children}){
  const [user,setUser]=useState(null),[mode,setMode]=useState('loading');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function restore(){
    try{
      const res=await fetch('/api/auth/me');
      if(res.status===401){setUser(null);setMode('login');return}
      if(!res.ok)throw Error();
      setUser(await res.json());
    }catch{setError('连接失败，请检查聊天室服务');setMode('login')}
  }
  useEffect(()=>{
    restore();
    function sync(event){if(event.key==='islandAccountChange')location.reload()}
    window.addEventListener('storage',sync);
    return ()=>window.removeEventListener('storage',sync);
  },[]);
  function changed(){localStorage.setItem('islandAccountChange',String(Date.now()))}
  async function logout(){
    const res=await fetch('/api/auth/logout',{method:'POST'});
    if(!res.ok && res.status!==401)throw Error('退出失败，请重试');
    setUser(null);setMode('login');setError('');changed();
  }
  if(user)return children(user,logout,()=>{setUser(null);setMode('login');setError('登录已过期，请重新登录')});
  const register=mode==='register';
  async function submit(e){
    e.preventDefault();if(busy)return;
    const fields=Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);setError('');
    try{
      const res=await fetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)});
      const body=await res.json();
      if(!res.ok)throw Error(body.error||'请求失败，请重试');
      setUser(body);changed();
    }catch(err){setError(err.message)}
    finally{setBusy(false)}
  }
  return <main className="gate"><section className="account-card"><span className="mark"><Mail/></span>
    <h1>{mode==='loading'?'正在打开小岛邮局…':register?'加入小岛邮局':'登录小岛邮局'}</h1>
    <HostAddress/>
    {mode!=='loading'&&<form onSubmit={submit} key={mode}>
      <label>用户名<input name="username" autoComplete="username" maxLength={32} required/></label>
      <label>密码<input type="password" name="password" autoComplete={register?'new-password':'current-password'} minLength={register?8:1} maxLength={128} placeholder={register?'至少 8 个字符':undefined} required/></label>
      {register&&<label>家庭邀请码<input name="code" autoComplete="off" required/><small>请向运行聊天室的家人获取邀请码。</small></label>}
      {error&&<p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy?'请稍候…':register?'创建账号':'登录'}</button>
      <button type="button" disabled={busy} onClick={()=>{setError('');setMode(register?'login':'register')}}>{register?'已有账号？去登录':'第一次来？注册家庭账号'}</button>
    </form>}</section></main>
}
