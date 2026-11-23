/* MAP §1 export §2 import preparation */
import {CONFIG,copy} from './shared/config.js';
import {validateLibrary} from './model.js';
// §1 export
export function exportProject(library,project){
 const dependencies=[...new Set(project.instances.map(i=>i.projectId))].map(id=>library.projects.find(p=>p.id===id));
 return JSON.stringify({schemaVersion:1,project,dependencies},null,2);
}
// §2 import preparation
export function prepareImport(text,library,currentId){
 if(new TextEncoder().encode(text).length>CONFIG.maxBytes)throw new Error('JSON-ul depășește 32 MB.');
 const payload=JSON.parse(text);if(payload.schemaVersion!==1||!payload.project||!Array.isArray(payload.dependencies))throw new Error('Format necesar: {schemaVersion:1, project:{...}, dependencies:[]}.');
 const current=library.projects.find(p=>p.id===currentId);if(!current)throw new Error('Deschide mai întâi un proiect.');
 const isNew=payload.project.id!==currentId;
 if(isNew&&library.projects.some(p=>p.id===payload.project.id))throw new Error('Acest proiect există deja în bibliotecă. Deschide-l înainte de actualizarea prin JSON.');
 if(!isNew&&payload.project.revision!==current.revision)throw new Error('Proiectul a fost modificat după export. Exportă din nou înainte de aplicare.');
 const next=copy(library);
 const received=new Set();
 for(const source of payload.dependencies){
  if(!source||received.has(source.id)||source.id===payload.project.id)throw new Error('Proiect sursă duplicat sau invalid.');received.add(source.id);
  const index=next.projects.findIndex(p=>p.id===source.id);
  if(index<0)next.projects.push(source);
  else if(JSON.stringify(next.projects[index])!==JSON.stringify(source))throw new Error(`Sursa „${source.title}” diferă de versiunea locală. Actualizeaz-o separat pentru a proteja celelalte ansambluri.`);
 }
 if(isNew)next.projects.push(payload.project);else next.projects[next.projects.findIndex(p=>p.id===currentId)]=payload.project;
 next.activeProjectId=payload.project.id;
 const valid=validateLibrary(next),incoming=valid.projects.find(p=>p.id===payload.project.id),oldNodes=isNew?[]:current.nodes;
 const oldIds=new Set(oldNodes.map(n=>n.id)),newIds=new Set(incoming.nodes.map(n=>n.id));
 const added=incoming.nodes.filter(n=>!oldIds.has(n.id)).length,removed=oldNodes.filter(n=>!newIds.has(n.id)).length;
 const modified=incoming.nodes.filter(n=>oldIds.has(n.id)&&JSON.stringify(n)!==JSON.stringify(oldNodes.find(o=>o.id===n.id))).length;
 incoming.revision=isNew?0:current.revision+1;
 return {library:valid,summary:`${isNew?'Proiect nou în bibliotecă':'Actualizare proiect activ'}\n${added} noduri adăugate · ${modified} modificate · ${removed} șterse\n${incoming.edges.length} conexiuni · ${incoming.instances.length} proiecte incluse\nTitlu: ${incoming.title}\n${isNew?'Proiectul activ existent rămâne în bibliotecă.':'Titlul, descrierile, grupurile și traseele vor fi înlocuite cu valorile din JSON.'} Poți anula aplicarea cu Undo.`};
}
