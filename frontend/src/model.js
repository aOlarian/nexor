/* MAP §1 factories §2 schema validation §3 library validation */
import {CONFIG,SHAPES,SIDES,COLORS,uid} from './shared/config.js';
import {sanitizeHTML} from './shared/sanitize.js';
import {isAssembly} from './shared/project-kind.js';
// §1 factories
export function newCategory(title='Proiecte'){return {id:uid(),title};}
export function newProject(title='Proiect nou',categoryId=''){return {id:uid(),kind:'project',categoryId,title,description:'',autoSizeBySubtitle:false,revision:0,nodes:[],edges:[],groups:[],instances:[],view:{x:0,y:0,zoom:1}};}
export function newNode(shape='square',x=240,y=200){
 const size={square:[148,132],wide:[220,108],tall:[132,196],circle:[140,140],oval:[204,124],triangle:[156,148],diamond:[156,156]}[shape]||[148,132];
 return {id:uid(),title:'Nod nou',subtitle:'',description:'',x,y,width:size[0],height:size[1],shape,icon:'box',opacity:1,color:COLORS[0]};
}
export function initialLibrary(){
 const category=newCategory('Exemple'),p=newProject('VeroShield · Arhitectură',category.id);
 p.description='<h2>Fluxul de acces la server</h2><p>Exemplu de lucru: utilizatorul trece prin firewall, iar traficul permis ajunge la serviciul corespunzător.</p><p>Mută nodurile, conectează porturile și deschide descrierile pentru a documenta fiecare componentă.</p>';
 const add=(title,icon,x,y,color)=>{const n=newNode('square',x,y);Object.assign(n,{title,icon,color,description:`<p>${title}: descrie aici rolul, regulile și legăturile acestei componente.</p>`});p.nodes.push(n);return n;};
 const user=add('Utilizator','user',500,100,COLORS[1]),firewall=add('Firewall','shield',500,340,COLORS[0]);
 const connect=(a,b,label)=>p.edges.push({id:uid(),from:{nodeId:a.id,side:'bottom'},to:{nodeId:b.id,side:'top'},label,color:'#77818c',waypoints:[]});
 connect(user,firewall,'Trafic de intrare');
 [['HTTP / HTTPS','globe'],['SSH','terminal'],['SMTP','mail']].forEach(([title,icon],i)=>connect(firewall,add(title,icon,240+i*260,620,COLORS[2]),'Permis'));
 return {schemaVersion:1,activeProjectId:p.id,theme:'light',sidebarWidth:270,syncHistory:[],categories:[category],projects:[p]};
}
// §2 schema validation
function fail(message){throw new Error(message);}
function obj(v,name){if(!v||typeof v!=='object'||Array.isArray(v))fail(`${name}: obiect invalid.`);return v;}
function str(v,name,max=1000){if(typeof v!=='string'||v.length>max)fail(`${name}: text invalid sau prea lung.`);return v;}
function id(v,name='ID'){if(typeof v!=='string'||!/^[-\w]{1,128}$/.test(v))fail(`${name}: identificator invalid.`);return v;}
function num(v,name,min=-CONFIG.coordinateLimit,max=CONFIG.coordinateLimit){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(`${name}: număr în afara limitelor.`);return v;}
function list(v,name,max){if(!Array.isArray(v)||v.length>max)fail(`${name}: listă invalidă sau prea mare.`);return v;}
function unique(items,name){const ids=new Set();for(const item of items){if(ids.has(item.id))fail(`${name}: ID duplicat ${item.id}.`);ids.add(item.id);}return ids;}
function color(v){if(typeof v!=='string'||!/^#[a-f\d]{6}$/i.test(v))fail('Culoare invalidă (folosește #RRGGBB).');return v;}
function point(v){obj(v,'Punct');return {x:num(v.x,'x'),y:num(v.y,'y')};}
function endpoint(v){obj(v,'Port');str(v.nodeId,'Nod conexiune',260);v.nodeId.split('::').forEach(x=>id(x));if(v.nodeId.split('::').length>2)fail('Referință de nod invalidă.');if(!SIDES.includes(v.side))fail('Latură invalidă.');return {nodeId:v.nodeId,side:v.side};}
export function validateProject(v,{sanitize=true}={}){
 const rich=(value,name)=>{const text=str(value??'',name,CONFIG.maxDescription);return sanitize?sanitizeHTML(text):text;};
 obj(v,'Proiect');const p=newProject(str(v.title,'Titlu',200).trim());if(!p.title)fail('Proiectul are nevoie de titlu.');
 p.id=id(v.id);p.description=rich(v.description,'Descriere');p.autoSizeBySubtitle=Boolean(v.autoSizeBySubtitle);p.revision=num(v.revision??0,'Revizie',0,Number.MAX_SAFE_INTEGER);
 if(v.categoryId)p.categoryId=id(v.categoryId,'Categorie proiect');
 if(v.kind!==undefined&&!['project','assembly'].includes(v.kind))fail('Tip de proiect invalid.');
 p.kind=isAssembly(v)?'assembly':'project';
 p.view={...point(v.view??{x:0,y:0}),zoom:num(v.view?.zoom??1,'Zoom',CONFIG.minZoom,CONFIG.maxZoom)};
 p.nodes=list(v.nodes,'Noduri',CONFIG.maxNodes).map(n=>{
  obj(n,'Nod');if(!SHAPES.includes(n.shape))fail('Formă necunoscută.');
  const r={id:id(n.id),title:str(n.title,'Titlu nod',200),subtitle:str(n.subtitle??'','Subtitlu nod',4000),description:rich(n.description,'Descriere nod'),...point(n),width:num(n.width,'Lățime',60,1200),height:num(n.height,'Înălțime',60,1400),shape:n.shape,icon:id(n.icon??'box','Icon'),color:color(n.color),opacity:num(n.opacity??1,'Opacitate nod',0,1)};
  if(n.groupId)r.groupId=id(n.groupId);return r;
 });
 p.edges=list(v.edges,'Conexiuni',CONFIG.maxEdges).map(e=>({id:id(e.id),from:endpoint(e.from),to:endpoint(e.to),label:str(e.label??'','Etichetă',500),color:color(e.color??'#77818c'),waypoints:list(e.waypoints??[],'Traseu',100).map(point),...(e.unresolved?{unresolved:true}:{})}));
 p.groups=list(v.groups??[],'Grupuri',CONFIG.maxNodes).map(g=>{
  obj(g,'Grup');
  const r={id:id(g.id),title:str(g.title,'Titlu grup',200),color:color(g.color??'#334155'),opacity:num(g.opacity??1,'Opacitate grup',0,1)};
  if(g.x!==undefined&&g.y!==undefined&&g.width!==undefined&&g.height!==undefined){
   Object.assign(r,{x:num(g.x,'x grup'),y:num(g.y,'y grup'),width:num(g.width,'Lățime grup',120,CONFIG.coordinateLimit),height:num(g.height,'Înălțime grup',100,CONFIG.coordinateLimit)});
  }
  return r;
 });
 p.instances=list(v.instances??[],'Instanțe',100).map(i=>({id:id(i.id),projectId:id(i.projectId),...point(i)}));
 unique(p.nodes,'Noduri');unique(p.edges,'Conexiuni');const gs=unique(p.groups,'Grupuri');unique(p.instances,'Instanțe');
 for(const n of p.nodes)if(n.groupId&&!gs.has(n.groupId))fail('Nodul referă un grup inexistent.');return p;
}
// §3 library validation
export function validateLibrary(v,options={}){
 obj(v,'Bibliotecă');if(v.schemaVersion!==1)fail('Versiunea JSON nu este acceptată. Este necesară schemaVersion: 1.');
 const projects=list(v.projects,'Proiecte',CONFIG.maxProjects).map(p=>validateProject(p,options)),ids=unique(projects,'Proiecte');
 const categories=list(v.categories??[],'Categorii',CONFIG.maxProjects).map(c=>{obj(c,'Categorie');const title=str(c.title,'Titlu categorie',160).trim();if(!title)fail('Categoria are nevoie de nume.');return {id:id(c.id,'Categorie'),title};});
 const categoryIds=unique(categories,'Categorii');let fallback=categories[0];
 for(const p of projects.filter(p=>!isAssembly(p))){if(p.categoryId&&categoryIds.has(p.categoryId))continue;if(!fallback){fallback={id:'default-projects',title:'Proiecte'};categories.push(fallback);categoryIds.add(fallback.id);}p.categoryId=fallback.id;}
 for(const p of projects){const nodes=new Set(p.nodes.map(n=>n.id));
  for(const i of p.instances){const source=projects.find(s=>s.id===i.projectId);if(!source||source.id===p.id||source.instances.length)fail('Ansamblul referă un proiect inexistent sau un alt ansamblu.');source.nodes.forEach(n=>nodes.add(`${i.id}::${n.id}`));}
  for(const e of p.edges)if((!nodes.has(e.from.nodeId)||!nodes.has(e.to.nodeId))&&!e.unresolved)fail(`Conexiunea „${e.label||e.id}” referă un nod inexistent.`);
 }
 if(projects.length&&!ids.has(v.activeProjectId))fail('Proiectul activ nu există.');
 const syncHistory=list(v.syncHistory??[],'Istoric sincronizare',CONFIG.syncHistoryLimit).map(value=>id(value,'Schimbare sincronizată'));
 if(new Set(syncHistory).size!==syncHistory.length)fail('Istoricul sincronizării conține ID-uri duplicate.');
 return {schemaVersion:1,activeProjectId:projects.length?v.activeProjectId:'',theme:v.theme==='dark'?'dark':'light',sidebarWidth:num(v.sidebarWidth??270,'Sidebar',220,600),syncHistory,categories,projects};
}
export function parseLibrary(text){if(new TextEncoder().encode(text).length>CONFIG.maxBytes)fail('Fișierul depășește 32 MB.');return validateLibrary(JSON.parse(text));}
