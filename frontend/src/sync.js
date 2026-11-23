/* MAP
 * §1 contract helpers L10-L26
 * §2 operation application L27-L42
 * §3 change preparation L43-L54
 * §4 synchronization controller L55-L78
 */
import {CONFIG,copy} from './shared/config.js';
import {validateLibrary} from './model.js';

// §1 contract helpers
export class SyncConflict extends Error {}
const identifier=value=>typeof value==='string'&&/^[-\w]{1,128}$/.test(value);
function object(value,name){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${name}: obiect invalid.`);return value;}
function requiredId(value,name){if(!identifier(value))throw new Error(`${name}: identificator invalid.`);return value;}
function text(value,name,max){if(typeof value!=='string'||value.length>max)throw new Error(`${name}: text invalid.`);return value;}
function locate(items,id,name){const item=items.find(value=>value.id===id);if(!item)throw new Error(`${name} inexistent: ${id}.`);return item;}
function assignAllowed(target,changes,allowed,name){object(changes,name);for(const key of Object.keys(changes)){if(!allowed.includes(key))throw new Error(`${name}: câmp neacceptat ${key}.`);target[key]=copy(changes[key]);}}
function parseEnvelope(raw){
 if(new TextEncoder().encode(raw).length>CONFIG.maxSyncBytes)throw new Error('Pachetul de sincronizare este prea mare.');
 const envelope=object(JSON.parse(raw),'Pachet');if(envelope.schemaVersion!==1)throw new Error('Versiune de sincronizare neacceptată.');
 requiredId(envelope.changeId,'changeId');requiredId(envelope.projectId,'projectId');text(envelope.author,'Autor',100);
 if(!Number.isSafeInteger(envelope.baseRevision)||envelope.baseRevision<0)throw new Error('baseRevision invalid.');
 if(!Array.isArray(envelope.operations)||!envelope.operations.length||envelope.operations.length>CONFIG.maxSyncOperations)throw new Error('Lista operațiilor este invalidă.');
 return envelope;
}

// §2 operation application
function applyOperation(project,operation){
 object(operation,'Operație');const type=operation.type;
 if(type==='addNode'){const node=copy(object(operation.node,'Nod'));requiredId(node.id,'Nod');if(project.nodes.some(item=>item.id===node.id))throw new Error(`Nod duplicat: ${node.id}.`);project.nodes.push(node);return;}
 if(type==='updateNode'){const node=locate(project.nodes,requiredId(operation.nodeId,'Nod'),'Nod');assignAllowed(node,operation.changes,['title','subtitle','description','x','y','width','height','shape','icon','color','opacity','groupId'],'Modificări nod');return;}
 if(type==='removeNode'){const id=requiredId(operation.nodeId,'Nod');locate(project.nodes,id,'Nod');project.nodes=project.nodes.filter(node=>node.id!==id);project.edges=project.edges.filter(edge=>edge.from.nodeId!==id&&edge.to.nodeId!==id);project.groups=project.groups.filter(group=>project.nodes.some(node=>node.groupId===group.id)||(group.width&&group.height));return;}
 if(type==='addEdge'){const edge=copy(object(operation.edge,'Conexiune'));requiredId(edge.id,'Conexiune');if(project.edges.some(item=>item.id===edge.id))throw new Error(`Conexiune duplicată: ${edge.id}.`);project.edges.push(edge);return;}
 if(type==='updateEdge'){const edge=locate(project.edges,requiredId(operation.edgeId,'Conexiune'),'Conexiune');assignAllowed(edge,operation.changes,['from','to','label','color','waypoints'],'Modificări conexiune');return;}
 if(type==='removeEdge'){const id=requiredId(operation.edgeId,'Conexiune');locate(project.edges,id,'Conexiune');project.edges=project.edges.filter(edge=>edge.id!==id);return;}
 if(type==='addGroup'){const group=copy(object(operation.group,'Grup'));requiredId(group.id,'Grup');if(project.groups.some(item=>item.id===group.id))throw new Error(`Grup duplicat: ${group.id}.`);project.groups.push(group);return;}
 if(type==='updateGroup'){const group=locate(project.groups,requiredId(operation.groupId,'Grup'),'Grup');assignAllowed(group,operation.changes,['title','color','opacity','x','y','width','height'],'Modificări grup');return;}
 if(type==='removeGroup'){const id=requiredId(operation.groupId,'Grup');locate(project.groups,id,'Grup');project.nodes.forEach(node=>{if(node.groupId===id)delete node.groupId;});project.groups=project.groups.filter(group=>group.id!==id);return;}
 if(type==='updateProject'){assignAllowed(project,operation.changes,['title','description','autoSizeBySubtitle'],'Modificări proiect');return;}
 throw new Error(`Operație necunoscută: ${String(type)}.`);
}

// §3 change preparation
export function prepareSyncChange(library,raw,{ignoreRevision=false}={}){
 const envelope=parseEnvelope(raw),history=library.syncHistory||[];
 if(history.includes(envelope.changeId))return {duplicate:true,changeId:envelope.changeId,author:envelope.author,operations:0,library};
 const project=library.projects.find(item=>item.id===envelope.projectId);if(!project)throw new Error(`Proiectul nu există: ${envelope.projectId}.`);
 if(!ignoreRevision&&project.revision!==envelope.baseRevision)throw new SyncConflict(`„${project.title}” este la revizia ${project.revision}, iar pachetul pornește de la ${envelope.baseRevision}.`);
 const next=copy(library),target=next.projects.find(item=>item.id===envelope.projectId);
 envelope.operations.forEach(operation=>applyOperation(target,operation));
 next.syncHistory=[...(next.syncHistory||[]),envelope.changeId].slice(-CONFIG.syncHistoryLimit);
 return {duplicate:false,changeId:envelope.changeId,author:envelope.author,operations:envelope.operations.length,library:validateLibrary(next)};
}

// §4 synchronization controller
export function createSyncController(transport,state,onStatus,onConflict){
 let running=false,timer=null;
 async function run(manual=false){
  if(running)return;running=true;let applied=0,conflicts=0,rejected=0;
  try{
   const files=await transport.listSyncChanges();
   for(const file of files){let prepared;
    try{prepared=prepareSyncChange(state.library,file.content);}
    catch(error){if(error instanceof SyncConflict){conflicts++;if(!manual||!onConflict)continue;const choice=await onConflict(error.message);if(!choice)continue;if(choice==='reject'){await transport.completeSyncChange(file.name,'rejected','Versiunea locală a fost păstrată la alegerea utilizatorului.');conflicts--;rejected++;continue;}try{prepared=prepareSyncChange(state.library,file.content,{ignoreRevision:true});conflicts--;}catch(rebaseError){await transport.completeSyncChange(file.name,'rejected',String(rebaseError.message||rebaseError));conflicts--;rejected++;continue;}}else{rejected++;await transport.completeSyncChange(file.name,'rejected',String(error.message||error));continue;}}
    try{if(!prepared.duplicate)state.change(()=>state.library=prepared.library);await state.save.flush();await transport.completeSyncChange(file.name,'applied','');applied+=prepared.operations;}
    catch(error){onStatus('error',conflicts,`Sincronizarea nu a putut salva: ${String(error.message||error)}`);return;}
   }
   if(conflicts)onStatus('conflict',conflicts,`${conflicts} pachete necesită actualizare`);
   else if(applied)onStatus('applied',0,`${applied} modificări de la Nex aplicate`);
   else if(rejected)onStatus('rejected',rejected,`${rejected} pachete invalide respinse`);
   else if(manual)onStatus('idle',0,'Sincronizarea este la zi');
  }catch(error){onStatus('error',0,String(error.message||error));}
  finally{running=false;}
 }
 function start(){if(!transport.syncAvailable)return;run(false);timer=setInterval(()=>run(false),CONFIG.syncPollMs);window.addEventListener('focus',()=>run(false));}
 function stop(){if(timer)clearInterval(timer);timer=null;}
 return {run,start,stop};
}
