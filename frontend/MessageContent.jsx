import React,{useState,useId} from 'react';
import {Copy,Check} from 'lucide-react';

async function copyText(text){
  if(navigator.clipboard?.writeText){
    try{
      await navigator.clipboard.writeText(text);
      return;
    }catch{
      // HTTP pages and browsers with clipboard restrictions use the selection fallback.
    }
  }
  const focused=document.activeElement;
  const selection=window.getSelection();
  const ranges=[];
  for(let index=0;index<(selection?.rangeCount??0);index++){
    ranges.push(selection.getRangeAt(index).cloneRange());
  }
  const input=document.createElement('textarea');
  input.value=text;
  input.readOnly=true;
  input.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;font-size:16px';
  document.body.append(input);
  try{
    input.focus({preventScroll:true});
    input.select();
    if(!document.execCommand('copy'))throw Error('复制失败，请手动选中文本复制');
  }finally{
    input.remove();
    focused?.focus({preventScroll:true});
    selection?.removeAllRanges();
    for(const range of ranges)selection?.addRange(range);
  }
}

export default function MessageContent({message,children}){
  const [expanded,setExpanded]=useState(false);
  const [status,setStatus]=useState('');
  const [copying,setCopying]=useState(false);
  const contentId=useId();
  const text=message.text||'';
  const preview=Array.from(text.slice(0,802)).slice(0,400).join('').split('\n').slice(0,8).join('\n');
  const collapsible=preview.length<text.length;
  const linkOnly=!text && message.file;
  async function copy(){
    setCopying(true);setStatus('');
    try{
      await copyText(linkOnly?new URL('/media/'+message.file,location.origin).href:text);
      setStatus(linkOnly?'链接已复制':'已复制全文');
    }catch{
      setStatus('复制失败，请手动选择内容复制');
    }finally{setCopying(false)}
  }
  return <>
    {children}
    {text&&<div id={contentId}>{collapsible&&!expanded?preview+'…':text}</div>}
    <div className="message-tools">
      {collapsible&&<button type="button" aria-expanded={expanded} aria-controls={contentId} onClick={()=>setExpanded(value=>!value)}>{expanded?'收起':'展开全文'}</button>}
      <button type="button" disabled={copying} onClick={copy}>
        {status.startsWith('已复制')||status==='链接已复制'?<Check size={14}/>:<Copy size={14}/>}
        {linkOnly?'复制附件链接':'复制'}
      </button>
      {status&&<span role="status">{status}</span>}
    </div>
  </>;
}
