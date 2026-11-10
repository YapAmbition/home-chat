import React,{useState} from 'react';

export default function ChangePassword({expired}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  async function submit(event){
    event.preventDefault();
    const form=event.currentTarget;
    const {currentPassword,newPassword,confirmation}=Object.fromEntries(new FormData(form));
    setError('');setSaved(false);
    if(newPassword!==confirmation){setError('两次输入的新密码不同');return}
    setBusy(true);
    try{
      const res=await fetch('/api/auth/password',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({currentPassword,newPassword})
      });
      if(res.status===401){expired();return}
      if(!res.ok)throw Error((await res.json()).error);
      form.reset();
      setSaved(true);
    }catch(err){setError(err.message||'保存失败，请重试')}
    finally{setBusy(false)}
  }
  return <main className="gate"><section className="account-card">
    <a href="#" className="back-link">返回聊天室</a>
    <h1>修改密码</h1>
    <form onSubmit={submit}>
      <label>当前密码<input type="password" name="currentPassword" autoComplete="current-password" required maxLength={128}/></label>
      <label>新密码<input type="password" name="newPassword" autoComplete="new-password" placeholder="8 至 128 个字符" required minLength={8} maxLength={128}/></label>
      <label>确认新密码<input type="password" name="confirmation" autoComplete="new-password" required minLength={8} maxLength={128}/></label>
      <small>保存后，其他浏览器需要用新密码重新登录。</small>
      {error&&<p role="alert" className="error">{error}</p>}
      {saved&&<p role="status">密码已修改。</p>}
      <button className="primary" disabled={busy}>{busy?'正在保存…':'保存新密码'}</button>
    </form>
  </section></main>
}
