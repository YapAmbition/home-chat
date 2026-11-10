import React,{useEffect,useState} from 'react';

export default function HostAddress(){
  const [urls,setUrls]=useState(null);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){
      try{
        const response=await fetch('/api/host-addresses',{signal:controller.signal});
        if(!response.ok)throw Error();
        const data=await response.json();
        setUrls(data.urls);
      }catch{
        if(!controller.signal.aborted)setUrls([]);
      }
    }
    load();
    window.addEventListener('focus',load);
    return ()=>{
      controller.abort();
      window.removeEventListener('focus',load);
    };
  },[]);
  return <div className="host-address"><span>主机地址</span>{urls?.length
    ? urls.map(url=><a href={url} key={url}>{new URL(url).host}</a>)
    : <span>{urls?'暂无局域网地址':'正在读取…'}</span>}</div>;
}
