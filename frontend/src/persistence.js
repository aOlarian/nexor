/* MAP §1 transport §2 serialized saving and close */
import {CONFIG} from './shared/config.js';
// §1 transport
export function createTransport(){
 if(window.nexorTransport)return window.nexorTransport;
 const native=window.go?.main?.App;
 if(native)return {load:()=>native.LoadLibrary(),save:text=>native.SaveLibrary(text),export:(text,title)=>native.ExportJSON(text,title),publishSyncState:text=>native.PublishSyncState(text),listSyncChanges:()=>native.ListSyncChanges(),completeSyncChange:(name,status,reason)=>native.CompleteSyncChange(name,status,reason),syncDirectory:()=>native.SyncDirectory(),syncAvailable:false,native:true};
 return {load:async()=>localStorage.getItem('nexor-library-v1')||'',save:async text=>localStorage.setItem('nexor-library-v1',text),publishSyncState:async()=>{},listSyncChanges:async()=>[],completeSyncChange:async()=>{},syncDirectory:async()=>'',syncAvailable:false,export:async(text,title)=>{
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=(title||'nexor')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return a.download;
 },native:false};
}
// §2 serialized saving and close
export function createPersistence(transport,getLibrary,onStatus){
 let timer=null,chain=Promise.resolve(),dirty=false,lastError=null;
 async function flush(){
  clearTimeout(timer);timer=null;if(!dirty)return chain;
  const text=JSON.stringify(getLibrary());dirty=false;onStatus('saving','Se salvează…');
  chain=chain.catch(()=>{}).then(()=>transport.save(text)).then(()=>{lastError=null;if(!dirty)onStatus('saved','Salvat local');}).catch(error=>{dirty=true;lastError=error;onStatus('error',String(error.message||error));throw error;});
  return chain;
 }
 function schedule(){dirty=true;window.nexorHost?.draft?.(getLibrary());onStatus('saving','Modificări nesalvate');clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{/* Eroarea este afișată de onStatus; păstrăm dirty pentru reîncercare. */}),CONFIG.saveDelay);}
 async function close(){try{await flush();if(dirty)await flush();if(lastError)throw lastError;await window.go?.main?.App.ConfirmClose();}catch(error){onStatus('error','Închiderea a fost oprită: '+String(error.message||error));}}
 window.runtime?.EventsOn?.('nexor:before-close',close);
 if(!window.nexorHost)window.addEventListener('beforeunload',event=>{if(dirty){if(!transport.native){try{localStorage.setItem('nexor-library-v1',JSON.stringify(getLibrary()));dirty=false;}catch(error){onStatus('error',error.message);}}if(dirty){event.preventDefault();event.returnValue='';}}});
 return {schedule,flush,close,get dirty(){return dirty;}};
}
