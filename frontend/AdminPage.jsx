import FileManager from './FileManager';
import HostAddress from './HostAddress';
import React,{useEffect,useState} from 'react';
import {ArrowLeft,Ticket} from 'lucide-react';

export default function AdminPage({expired}){
  const [current,setCurrent]=useState(null),[draft,setDraft]=useState('');
  const [status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    async function read(){
      setCurrent(null);setError('');setStatus('');setDraft('');
      try{
        const res=await fetch('/api/admin/invite',{signal:controller.signal});
        if(res.status===401){expired();return}
        const result=await res.json();
        if(!res.ok)throw Error(result.error);
        setCurrent(result.invite);
      }catch(err){if(!controller.signal.aborted)setError(err.message || '读取失败，请重试')}
    }
    read();
    return ()=>controller.abort();
  },[revision]);
  async function save(event){
    event.preventDefault();
    setBusy(true);setStatus('');setError('');
    try{
      const res=await fetch('/api/admin/invite',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite:draft.trim(),previous:current})});
      if(res.status===401){expired();return}
      const result=await res.json();
      if(!res.ok)throw Error(result.error);
      setCurrent(result.invite);setDraft('');setStatus('已保存，新邀请码已生效。');
    }catch(err){setError(err.message || '保存失败，请重试')}
    finally{setBusy(false)}
  }
  return <main className="admin-layout"><header className="admin-heading">
    <a href="#" className="back-link"><ArrowLeft size={16}/>返回聊天室</a>
    <h1>家庭管理</h1>
    <HostAddress/>
    </header><div className="admin-panels"><FileManager expired={expired}/><section className="account-card admin-card">
    <h2><Ticket size={20}/>注册邀请码</h2>
    {current===null&&!error&&<p role="status">正在读取邀请码…</p>}
    {current!==null&&<form onSubmit={save}>
      <label>当前邀请码<input readOnly value={current} onFocus={e=>e.target.select()}/></label>
      <label>新邀请码<input value={draft} onChange={e=>{setDraft(e.target.value);setStatus('')}} maxLength={128} required autoComplete="off"/></label>
      <small>保存后，家人下次注册时需要填写新码。</small>
      <button className="primary" disabled={busy||!draft.trim()||draft.trim()===current}>{busy?'正在保存…':'保存邀请码'}</button>
    </form>}
    {status&&<p role="status">{status}</p>}
    {error&&<><p role="alert" className="error">{error}</p><button onClick={()=>setRevision(n=>n+1)}>重新读取</button></>}
  </section></div></main>
}
