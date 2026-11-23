/* MAP §1 node edits §2 selection actions §3 clipboard */
import {uid,copy} from './shared/config.js';
import {newNode} from './model.js';
import {bounds,removeNodes,duplicateNodes} from './projects.js';
import {editNode,editEdge,editGroup,confirmDialog,promptText} from './ui/dialogs.js';
// §1 node edits
export function nodeActions(state){
 const localSelection=()=>state.selection.filter(id=>state.project()?.nodes.some(n=>n.id===id));
 async function nodeMenu(id){
  const p=state.project();if(!p)return;
  const instance=p.instances.find(i=>i.id===id);
  if(instance){if(await confirmDialog('Scoate proiectul din ansamblu?','Proiectul sursă rămâne în bibliotecă. Legăturile externe ale acestui bloc vor fi eliminate.'))state.change((l,p)=>{p.instances=p.instances.filter(i=>i.id!==id);p.edges=p.edges.filter(e=>!e.from.nodeId.startsWith(id+'::')&&!e.to.nodeId.startsWith(id+'::'));});return;}
  if(id.includes('::')){const inst=p.instances.find(i=>i.id===id.split('::')[0]);if(inst)state.switchProject(inst.projectId);return;}
  const node=p.nodes.find(n=>n.id===id);if(!node)return;const result=await editNode(copy(node));if(!result)return;
  if(result.delete||result.action==='delete'){if(await confirmDialog('Șterge nodul?',`„${node.title}” și conexiunile sale locale vor fi eliminate.`))state.change((l,p)=>removeNodes(l,p,[id]));return;}
  state.change((l,p)=>{const target=p.nodes.find(n=>n.id===id);if(!target)return;
   const shape=result.shape||target.shape;if(shape!==target.shape){const size=newNode(shape);target.width=size.width;target.height=size.height;}
   for(const key of ['title','subtitle','description','shape','icon','color','opacity'])if(result[key]!==undefined)target[key]=result[key];
  });
 }
 async function edgeMenu(id){
  const edge=state.project()?.edges.find(e=>e.id===id);if(!edge)return;
  const result=await editEdge(copy(edge));if(!result)return;
  state.change((l,p)=>{if(result.delete||result.action==='delete')p.edges=p.edges.filter(e=>e.id!==id);else{const e=p.edges.find(e=>e.id===id);if(!e)return;for(const k of ['label','color'])if(result[k]!==undefined)e[k]=result[k];if(result.resetRoute||result.action==='reset-route')e.waypoints=[];}});
 }
 async function groupMenu(id){
  const group=state.project()?.groups.find(g=>g.id===id);if(!group)return;
  const result=await editGroup(copy(group));if(!result)return;
  if(result.delete){state.change((l,p)=>{p.nodes.forEach(n=>{if(n.groupId===id)delete n.groupId;});p.groups=p.groups.filter(g=>g.id!==id);});return;}
  state.change((l,p)=>{const g=p.groups.find(g=>g.id===id);if(g)Object.assign(g,result);});
 }
 // §2 selection actions
 async function remove(){
  if(state.edgeId){state.change((l,p)=>p.edges=p.edges.filter(e=>e.id!==state.edgeId));state.edgeId=null;return;}
  const ids=localSelection();if(!ids.length)return;
  if(await confirmDialog('Șterge selecția?',`${ids.length} noduri și conexiunile lor locale vor fi eliminate. Poți reveni cu Undo.`))state.change((l,p)=>removeNodes(l,p,ids));
 }
 async function group(){
  const ids=localSelection();
  const title=await promptText('Grup nou','Titlu','Grup nou');if(!title?.trim())return;
  const view=state.canvas?.getView?.()||{x:0,y:0};
  state.change((l,p)=>{
   const id=uid(),members=p.nodes.filter(n=>ids.includes(n.id));
   if(members.length){
    const b=bounds(members);
    p.groups.push({id,title:title.trim(),color:'#22b8cf',opacity:1,x:b.x-24,y:b.y-52,width:Math.max(240,b.width+48),height:Math.max(160,b.height+76)});
    members.forEach(n=>n.groupId=id);
   }else{
    p.groups.push({id,title:title.trim(),color:'#22b8cf',opacity:1,x:Math.round((view.x+160)/20)*20,y:Math.round((view.y+120)/20)*20,width:380,height:260});
   }
   p.groups=p.groups.filter(g=>p.nodes.some(n=>n.groupId===g.id)||(Number.isFinite(g.width)&&Number.isFinite(g.height)));
  });
 }
 function ungroup(){
  const ids=localSelection();
  state.change((l,p)=>{
   const touched=new Set(p.nodes.filter(n=>ids.includes(n.id)&&n.groupId).map(n=>n.groupId));
   p.nodes.filter(n=>ids.includes(n.id)).forEach(n=>delete n.groupId);
   p.groups=p.groups.filter(g=>!touched.has(g.id)&&p.nodes.some(n=>n.groupId===g.id)||(Number.isFinite(g.width)&&Number.isFinite(g.height)&&!touched.has(g.id)));
  });
 }
 function duplicate(){const ids=localSelection();if(!ids.length)return;let added;state.change((l,p)=>added=duplicateNodes(p,ids));state.selection=added;state.canvas.setSelection?.(added);}
 // §3 clipboard
 function copySelection(){const ids=new Set(localSelection()),p=state.project();if(!p||!ids.size)return;state.clipboard={nodes:copy(p.nodes.filter(n=>ids.has(n.id))),edges:copy(p.edges.filter(e=>ids.has(e.from.nodeId)&&ids.has(e.to.nodeId)))};}
 function paste(){if(!state.clipboard)return;let ids;state.change((l,p)=>{const temp={...copy(state.clipboard)},oldIds=temp.nodes.map(n=>n.id);ids=duplicateNodes(temp,oldIds);p.nodes.push(...temp.nodes.filter(n=>ids.includes(n.id)));p.edges.push(...temp.edges.filter(e=>ids.includes(e.from.nodeId)));});state.selection=ids;state.canvas.setSelection?.(ids);}
 return {nodeMenu,edgeMenu,groupMenu,remove,group,ungroup,duplicate,copySelection,paste};
}
