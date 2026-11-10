import React,{useEffect,useRef,useState} from 'react';
import {Files,Image,Film,File} from 'lucide-react';

const clock=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'});
function size(bytes){
  if(bytes<1024)return bytes+' B';
  if(bytes<1048576)return (bytes/1024).toFixed(1)+' KB';
  return (bytes/1048576).toFixed(1)+' MB';
}

export default function FileManager({expired}){
  const [from,setFrom]=useState(''),[to,setTo]=useState('');
  const [query,setQuery]=useState({page:1});
  const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const dialog=useRef(null);

  useEffect(()=>{
    const controller=new AbortController();
    async function read(){
      try{
        const response=await fetch('/api/admin/files?'+new URLSearchParams(query),{signal:controller.signal});
        if(response.status===401){expired();return}
        const result=await response.json();
        if(!response.ok)throw Error(result.error);
        setData(result);
      }catch(err){if(!controller.signal.aborted)setError(err.message || '读取附件失败')}
    }
    read();
    return ()=>controller.abort();
  },[query]);
  function load(next){
    setData(null);setError('');setQuery(next);
  }
  function filter(event){
    event.preventDefault();setNotice('');
    load({from,to,page:1});
  }
  async function clean(){
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/admin/files/clean',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...query,snapshot:data.snapshot})});
      if(response.status===401){expired();return}
      const result=await response.json();
      if(!response.ok)throw Error(result.error);
      setNotice('已清理 '+result.count+' 个附件。'+(result.pending?'部分磁盘文件正在等待重试。':''));
      load({...query,page:1});
    }catch(err){setData(null);setError(err.message || '清理失败，请重新读取列表')}
    finally{dialog.current?.close();setBusy(false)}
  }
  return <section className="account-card file-manager">
    <h2><Files size={20}/>聊天附件</h2>
    <form className="file-filter" onSubmit={filter}>
      <label>开始日期<input required type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label>
      <label>结束日期<input required type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label>
      <button className="primary">筛选</button>
      <button type="button" onClick={()=>{setFrom('');setTo('');setNotice('');load({page:1})}}>显示全部</button>
    </form>
    <small>按北京时间的上传日期筛选，包含起止当天。</small>
    {notice&&<p role="status">{notice}</p>}
    {error&&<p className="error" role="alert">{error} <button onClick={()=>load({...query,page:1})}>重新读取</button></p>}
    {!data&&!error&&<p>正在读取附件…</p>}
    {data&&<>
      <div className="file-summary"><div><strong>{query.from?query.from+' 至 '+query.to:'全部日期'}</strong><small>{data.count} 个附件 · {size(data.bytes)}</small></div>
        {query.from&&data.count>0&&<button className="danger" disabled={from!==query.from||to!==query.to} onClick={()=>dialog.current.showModal()}>清理此日期范围</button>}</div>
      {data.files.length===0?<p>没有找到附件。</p>:<ul className="file-list">{data.files.map(file=><li key={file.id}>
        {file.mime?.startsWith('video/')?<Film size={20}/>:file.mime?.startsWith('image/')?<Image size={20}/>:<File size={20}/>}
        <div><a href={'/media/'+file.file} target="_blank" rel="noreferrer">{file.filename||'查看附件'}</a>
        <small>{file.name} · {clock.format(file.time)} · {size(file.bytes)}</small></div>
      </li>)}</ul>}
      {data.count>30&&<div className="file-pages"><button disabled={query.page===1} onClick={()=>load({...query,page:query.page-1})}>上一页</button>
        {query.page} / {Math.ceil(data.count/30)} <button disabled={query.page*30>=data.count} onClick={()=>load({...query,page:query.page+1})}>下一页</button></div>}
    </>}
    <dialog ref={dialog} className="cleanup-dialog" aria-labelledby="cleanup-title" onCancel={e=>{if(busy)e.preventDefault()}}>
      <h2 id="cleanup-title">确认永久清理附件？</h2>
      <p>{query.from} 至 {query.to} 的全部 {data?.count} 个附件（{size(data?.bytes??0)}）将从主机删除。聊天文字会保留。</p>
      <div className="actions"><button disabled={busy} onClick={()=>dialog.current.close()}>取消</button><button disabled={busy} className="danger" onClick={clean}>{busy?'正在清理…':'确认删除'}</button></div>
    </dialog>
  </section>;
}
