/* MAP §1 projection §2 copy/join §3 mutations */
import {copy,uid} from './shared/config.js';
import {newProject} from './model.js';
import {escapeText} from './shared/sanitize.js';
// §1 projection
export function bounds(nodes){
 if(!nodes.length)return {x:0,y:0,width:400,height:240};
 const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));
 return {x,y,width:Math.max(...nodes.map(n=>n.x+n.width))-x,height:Math.max(...nodes.map(n=>n.y+n.height))-y};
}
export function subtitleText(node){
 if(node.subtitle&&node.subtitle.trim())return node.subtitle.trim();
 if(!node.description)return '';
 const clean=String(node.description)
  .replace(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/gi,'')
  .replace(/<li[^>]*>/gi,'\n• ')
  .replace(/<\/(p|div|li|blockquote)>/gi,'\n')
  .replace(/<br\s*\/?>/gi,'\n')
  .replace(/<[^>]+>/g,'')
  .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"')
  .split('\n').map(s=>s.trim()).filter(Boolean).join('\n');
 return clean;
}
export function wrapText(text,maxChars,maxLines=20){
 const out=[];
 for(const raw of String(text||'').split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  let rest=line;
  while(rest&&out.length<maxLines){
   if(rest.length<=maxChars){out.push(rest);break;}
   let cut=rest.lastIndexOf(' ',maxChars);
   if(cut<maxChars*.4)cut=maxChars;
   out.push(rest.slice(0,cut));
   rest=rest.slice(cut).trim();
   if(out.length===maxLines&&rest)out[out.length-1]=out[out.length-1].slice(0,Math.max(1,maxChars-1))+'…';
  }
 }
 return out;
}
export function expandedNodeSize(node){
 const text=subtitleText(node);
 if(!text)return {width:node.width,height:node.height};
 const card=['square','wide','tall'].includes(node.shape);
 const width=Math.max(node.width,card?240:200);
 const chars=Math.max(16,Math.floor((width-(card?84:36))/7.2));
 const lines=wrapText(text,chars,18);
 const minHeight=card?Math.max(node.height,66+lines.length*17+18):Math.max(node.height,108+lines.length*16+20);
 return {width,height:Math.min(1200,Math.ceil(minHeight/20)*20)};
}
export function groupFrameBounds(group,members=[]){
 if(Number.isFinite(group.x)&&Number.isFinite(group.y)&&Number.isFinite(group.width)&&Number.isFinite(group.height)){
  if(!members.length)return {x:group.x,y:group.y,width:group.width,height:group.height};
  const b=bounds(members);
  const left=Math.min(group.x,b.x-24),top=Math.min(group.y,b.y-52);
  const right=Math.max(group.x+group.width,b.x+b.width+24),bottom=Math.max(group.y+group.height,b.y+b.height+24);
  return {x:left,y:top,width:right-left,height:bottom-top};
 }
 if(!members.length)return null;
 const b=bounds(members);
 return {x:b.x-24,y:b.y-52,width:b.width+48,height:b.height+76};
}
export function applyAutoSizeReflow(nodes,origHeights){
 const byY=[...nodes].sort((a,b)=>a.y-b.y);
 for(let i=0;i<byY.length;i++){
  const upper=byY[i],origBottom=upper.y+(origHeights.get(upper.id)??upper.height),newBottom=upper.y+upper.height;
  if(newBottom<=origBottom)continue;
  for(let j=i+1;j<byY.length;j++){
   const lower=byY[j];
   const overlapX=Math.min(upper.x+upper.width,lower.x+lower.width)-Math.max(upper.x,lower.x)>16;
   if(overlapX&&lower.y>=upper.y&&lower.y<newBottom+48){
    lower.y=newBottom+48;
   }
  }
 }
}
export function projectView(library,project){
 const out=copy(project);out.frames=[];
 if(out.autoSizeBySubtitle){
  const origHeights=new Map(out.nodes.map(n=>[n.id,n.height]));
  for(const n of out.nodes){const size=expandedNodeSize(n);n.width=size.width;n.height=size.height;}
  applyAutoSizeReflow(out.nodes,origHeights);
 }
 for(const group of project.groups){
  const members=out.nodes.filter(n=>n.groupId===group.id);
  const box=groupFrameBounds(group,members);
  if(box)out.frames.push({...box,id:group.id,title:group.title,color:group.color,opacity:group.opacity??1,nodeIds:members.map(n=>n.id)});
 }
 for(const instance of project.instances){
  const source=library.projects.find(p=>p.id===instance.projectId);if(!source)continue;
  const prefix=`${instance.id}::`;
  const nodes=source.nodes.map(n=>{const c={...copy(n),id:prefix+n.id,x:n.x+instance.x,y:n.y+instance.y,_instanceId:instance.id,_sourceNodeId:n.id,_readOnly:true};if(out.autoSizeBySubtitle){const size=expandedNodeSize(c);c.width=size.width;c.height=size.height;}return c;});
  const b=bounds(nodes);out.nodes.push(...nodes);
  out.edges.push(...source.edges.map(e=>({...copy(e),id:prefix+e.id,from:{...e.from,nodeId:prefix+e.from.nodeId},to:{...e.to,nodeId:prefix+e.to.nodeId},waypoints:e.waypoints.map(p=>({x:p.x+instance.x,y:p.y+instance.y})),_readOnly:true})));
  out.frames.push({...b,id:instance.id,instanceId:instance.id,title:source.title,color:'#334155',opacity:1,nodeIds:nodes.map(n=>n.id),x:b.x-28,y:b.y-56,width:b.width+56,height:b.height+84});
 }
 const ids=new Set(out.nodes.map(n=>n.id));out.broken=out.edges.filter(e=>!ids.has(e.from.nodeId)||!ids.has(e.to.nodeId));return out;
}
// §2 copy/join
export function cloneProject(project,title=project.title+' · copie'){
 const p=copy(project);p.id=uid();p.title=title;p.revision=0;
 const map=new Map([...p.nodes,...p.groups,...p.instances].map(x=>[x.id,uid()]));
 const remap=ref=>ref.split('::').map((part,index)=>index===0?(map.get(part)||part):part).join('::');
 p.nodes.forEach(n=>{n.id=map.get(n.id);if(n.groupId)n.groupId=map.get(n.groupId);});
 p.groups.forEach(g=>g.id=map.get(g.id));p.instances.forEach(i=>i.id=map.get(i.id));
 p.edges.forEach(e=>{e.id=uid();e.from.nodeId=remap(e.from.nodeId);e.to.nodeId=remap(e.to.nodeId);});return p;
}
export function joinProjects(library,ids,title,mode){
 if(ids.length<2)throw new Error('Selectează cel puțin două proiecte.');
 const p=newProject(title.trim()||'Ansamblu nou');let offset=120;
 p.kind='assembly';
 if(mode==='dynamic')p.description='<h2>Ansamblu dinamic</h2><p>Editează conținutul în proiectele sursă. Aici poți muta blocurile și descrie conexiunile dintre ele.</p>';
 for(const id of ids){const source=library.projects.find(p=>p.id===id);if(!source)throw new Error('Proiectul selectat nu mai există.');
  if(mode!=='dynamic')p.description+=`<h2>${escapeText(source.title)}</h2>${source.description||'<p>Fără descriere generală.</p>'}`;
  if(mode==='dynamic'){
   if(source.instances.length)throw new Error('Ansamblurile nu pot fi incluse în alte ansambluri în V1.');
   const b=bounds(source.nodes);p.instances.push({id:uid(),projectId:id,x:offset-b.x,y:140-b.y});offset+=b.width+160;
  }else{
   const view=projectView(library,source);if(view.broken.length)throw new Error(`Repară conexiunile nerezolvate din „${source.title}” înainte de unirea prin copie.`);
   const b=bounds(view.nodes),map=new Map(view.nodes.map(n=>[n.id,uid()])),groupId=uid();
   p.groups.push({id:groupId,title:source.title,color:'#627382'});
   p.nodes.push(...view.nodes.map(n=>{const {_readOnly,_instanceId,_sourceNodeId,...clean}=n;return {...clean,id:map.get(n.id),groupId,x:n.x+offset-b.x,y:n.y+140-b.y};}));
   p.edges.push(...view.edges.filter(e=>map.has(e.from.nodeId)&&map.has(e.to.nodeId)).map(e=>{const {_readOnly,unresolved,...clean}=copy(e);return {...clean,id:uid(),from:{...e.from,nodeId:map.get(e.from.nodeId)},to:{...e.to,nodeId:map.get(e.to.nodeId)},waypoints:e.waypoints.map(w=>({x:w.x+offset-b.x,y:w.y+140-b.y}))};}));
   offset+=b.width+160;
  }
 }
 return p;
}
// §3 mutations
export function syncNodeGroups(project,movedIds=null){
 const frames=project.groups.map(g=>{
  const members=project.nodes.filter(n=>n.groupId===g.id&&(!movedIds||!movedIds.has(n.id)));
  const box=groupFrameBounds(g,members);
  return box?{id:g.id,...box,area:box.width*box.height}:null;
 }).filter(Boolean).sort((a,b)=>a.area-b.area);
 const targets=movedIds?project.nodes.filter(n=>movedIds.has(n.id)):project.nodes;
 for(const n of targets){
  const cx=n.x+n.width/2,cy=n.y+n.height/2;
  const hit=frames.find(f=>cx>=f.x&&cx<=f.x+f.width&&cy>=f.y&&cy<=f.y+f.height);
  if(hit)n.groupId=hit.id;else delete n.groupId;
 }
}
export function resizeGroup(project,groupId,rect){
 const group=project.groups.find(g=>g.id===groupId);if(!group)return;
 Object.assign(group,{x:rect.x,y:rect.y,width:Math.max(160,rect.width),height:Math.max(120,rect.height)});
 for(const n of project.nodes){
  const cx=n.x+n.width/2,cy=n.y+n.height/2;
  const inside=cx>=group.x&&cx<=group.x+group.width&&cy>=group.y&&cy<=group.y+group.height;
  if(inside)n.groupId=group.id;
  else if(n.groupId===group.id)delete n.groupId;
 }
}
export function moveGroup(project,groupId,dx,dy){
 const group=project.groups.find(g=>g.id===groupId);if(!group)return;
 const members=project.nodes.filter(n=>n.groupId===groupId);
 const box=groupFrameBounds(group,members);
 if(box)Object.assign(group,{x:box.x+dx,y:box.y+dy,width:box.width,height:box.height});
 const ids=new Set(members.map(n=>n.id));
 project.nodes.forEach(n=>{if(ids.has(n.id)){n.x+=dx;n.y+=dy;}});
 project.edges.forEach(e=>{if(ids.has(e.from.nodeId)&&ids.has(e.to.nodeId))e.waypoints.forEach(p=>{p.x+=dx;p.y+=dy;});});
}
export function moveNodes(project,ids,dx,dy){
 const selected=new Set(ids);
 for(const g of project.groups){
  const members=project.nodes.filter(n=>n.groupId===g.id);
  if(members.length&&!Number.isFinite(g.x)){const box=groupFrameBounds(g,members);if(box)Object.assign(g,box);}
 }
 project.nodes.forEach(n=>{if(selected.has(n.id)){n.x+=dx;n.y+=dy;}});
 project.edges.forEach(e=>{if(selected.has(e.from.nodeId)&&selected.has(e.to.nodeId))e.waypoints.forEach(p=>{p.x+=dx;p.y+=dy;});});
 syncNodeGroups(project,selected);
}
export function removeNodes(library,project,ids){
 const selected=new Set(ids);project.nodes=project.nodes.filter(n=>!selected.has(n.id));project.edges=project.edges.filter(e=>!selected.has(e.from.nodeId)&&!selected.has(e.to.nodeId));
 project.groups=project.groups.filter(g=>project.nodes.some(n=>n.groupId===g.id)||(Number.isFinite(g.width)&&Number.isFinite(g.height)));
 for(const p of library.projects)for(const inst of p.instances.filter(i=>i.projectId===project.id))for(const e of p.edges){
  const prefix=inst.id+'::';
  if((e.from.nodeId.startsWith(prefix)&&selected.has(e.from.nodeId.slice(prefix.length)))||(e.to.nodeId.startsWith(prefix)&&selected.has(e.to.nodeId.slice(prefix.length))))e.unresolved=true;
 }
}
export function duplicateNodes(project,ids,offset=40){
 const chosen=new Set(ids),nodes=project.nodes.filter(n=>chosen.has(n.id)),map=new Map(nodes.map(n=>[n.id,uid()]));
 project.nodes.push(...nodes.map(n=>{const c=copy(n);delete c.groupId;return {...c,id:map.get(n.id),x:n.x+offset,y:n.y+offset};}));
 project.edges.push(...project.edges.filter(e=>map.has(e.from.nodeId)&&map.has(e.to.nodeId)).map(e=>({...copy(e),id:uid(),from:{...e.from,nodeId:map.get(e.from.nodeId)},to:{...e.to,nodeId:map.get(e.to.nodeId)},waypoints:e.waypoints.map(w=>({x:w.x+offset,y:w.y+offset}))})));
 return [...map.values()];
}
