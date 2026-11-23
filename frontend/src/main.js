/* MAP §1 imports §2 bootstrap §3 canvas callbacks §4 render */
import {initialLibrary,parseLibrary,newNode} from './model.js';
import {createState} from './state.js';
import {createTransport,createPersistence} from './persistence.js';
import {createCanvas} from './canvas/index.js';
import {mountShell,renderShell,setSaveStatus,setSelection,setSyncStatus} from './ui/shell.js';
import {showMessage,resolveSyncConflict} from './ui/dialogs.js';
import {nodeActions} from './node-actions.js';
import {appActions} from './app-actions.js';
import {uid} from './shared/config.js';
import {moveNodes,moveGroup,resizeGroup,syncNodeGroups} from './projects.js';
import {createSyncController} from './sync.js';
// §2 bootstrap
const root=document.querySelector('#app');
async function boot(){
 const transport=createTransport();let text;
 try{text=await transport.load();}catch(error){throw new Error('Nu am putut citi biblioteca. Datele nu au fost înlocuite. '+String(error.message||error));}
 const state=createState(text?parseLibrary(text):initialLibrary());
 if(window.nexorHost){const switchLocal=state.switchProject;state.switchProject=id=>{if(window.nexorHost.navigateLocal)switchLocal(id);window.nexorHost.open(id);};}
 if(!text)state.library.sidebarWidth=Math.round(Math.max(240,Math.min(600,window.innerWidth*.15)));
 const nodes=nodeActions(state),actions=appActions(state,nodes,transport);
 const commit=fn=>{try{state.change(fn);}catch(error){actions.error(error);}};
 const refs=mountShell(root,{action:actions.action,addProject:(title,categoryId)=>actions.addProject(title,categoryId).catch(actions.error),addCategory:title=>actions.addCategory(title).catch(actions.error),categoryMenu:(id,action)=>actions.categoryMenu(id,action).catch(actions.error),selectProject:state.switchProject,projectMenu:(id,action)=>actions.projectMenu(id,action).catch(actions.error)});
 state.save=createPersistence(transport,()=>state.library,setSaveStatus);
 state.sync=createSyncController(transport,state,setSyncStatus,resolveSyncConflict);
 let lastProjectId=null;
 // §3 canvas callbacks
 state.canvas=createCanvas(refs.canvas,{
  onSelect(ids,edgeId){state.selection=ids;state.edgeId=edgeId;setSelection(ids.length,!!edgeId);},
  onMoveNodes(ids,dx,dy){if(dx||dy)commit((l,p)=>moveNodes(p,ids,dx,dy));},
  onMoveGroup(id,dx,dy){if(dx||dy)commit((l,p)=>moveGroup(p,id,dx,dy));},
  onResizeGroup(id,rect){commit((l,p)=>resizeGroup(p,id,rect));},
  onMoveInstance(id,dx,dy){commit((l,p)=>{const i=p.instances.find(i=>i.id===id);if(i){i.x+=dx;i.y+=dy;const prefix=id+'::';p.edges.forEach(e=>{if(e.from.nodeId.startsWith(prefix)&&e.to.nodeId.startsWith(prefix))e.waypoints.forEach(w=>{w.x+=dx;w.y+=dy;});});}});},
  onConnect(from,to){if(from.nodeId===to.nodeId&&from.side===to.side)return;commit((l,p)=>p.edges.push({id:uid(),from,to,label:'',color:'#77818c',waypoints:[]}));},
  onEdgeRoute(id,waypoints){commit((l,p)=>{const e=p.edges.find(e=>e.id===id);if(e)e.waypoints=waypoints;});},
  onGroupMenu:id=>nodes.groupMenu(id).catch(actions.error),
  onNodeMenu:id=>nodes.nodeMenu(id).catch(actions.error),onEdgeMenu:id=>nodes.edgeMenu(id).catch(actions.error),
  onViewChange(view){const p=state.project();if(p){p.view={...view};state.save.schedule();const projection=state.projection();renderShell(state.library,p,{nodes:projection.nodes.length,edges:projection.edges.length,broken:projection.broken.length,zoom:view.zoom});}},
  onDropShape(shape,x,y){commit((l,p)=>{const n=newNode(shape,x,y);p.nodes.push(n);syncNodeGroups(p,new Set([n.id]));});},
  onOpenSource(id){const instance=state.project()?.instances.find(i=>i.id===id);if(instance)state.switchProject(instance.projectId);},
 });
 // §4 render
 state.update=()=>{
  const p=state.project(),projection=state.projection();
  if(p){state.canvas.render(projection);if(lastProjectId!==p.id){state.canvas.setView(p.view);lastProjectId=p.id;}}
  else{state.canvas.render({id:'empty',nodes:[],edges:[],groups:[],instances:[],frames:[],view:{x:0,y:0,zoom:1}});lastProjectId=null;}
  renderShell(state.library,p,{nodes:projection?.nodes.length||0,edges:projection?.edges.length||0,broken:projection?.broken.length||0,zoom:p?.view.zoom||1});
  setSelection(state.selection.length,!!state.edgeId);
 };
 state.update();actions.bindKeyboard();try{await transport.publishSyncState(JSON.stringify(state.library));}catch(error){setSyncStatus('error',0,String(error.message||error));}state.sync.start();if(!text)state.save.schedule();else setSaveStatus('saved','Salvat local');
 window.addEventListener('error',event=>setSaveStatus('error',event.message));
 window.addEventListener('unhandledrejection',event=>setSaveStatus('error',String(event.reason?.message||event.reason)));
 // Permite verificarea deterministă fără publicarea datelor într-un serviciu extern.
 window.nexor={getLibrary:()=>structuredClone(state.library),flush:()=>state.save.flush(),state,actions,nodes,transport};
 window.nexorHost?.ready(window.nexor);
 document.documentElement.dataset.ready='true';
}
boot().catch(error=>{
 root.replaceChildren();const box=document.createElement('section');box.className='startup-error';
 const heading=document.createElement('h1');heading.textContent='Biblioteca nu a putut fi deschisă';
 const detail=document.createElement('p');detail.textContent=String(error.message||error);
 const retry=document.createElement('button');retry.textContent='Reîncearcă';retry.onclick=()=>location.reload();
 const close=document.createElement('button');close.textContent='Închide';close.onclick=()=>window.go?.main?.App.ConfirmClose();
 box.append(heading,detail,retry,close);root.append(box);
 window.runtime?.EventsOn?.('nexor:before-close',()=>window.go?.main?.App.ConfirmClose());
});
