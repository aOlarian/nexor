/* MAP
 * §1 imports and constants L10-L26
 * §2 shell mount L27-L39
 * §3 rendering API L40-L62
 * §4 interaction helpers L63-L103
 * §5 sidebar groups L104-L124
 * §6 project categories L125-L140
 */

// §1 imports and constants
import { isAssembly,sidebarProjects } from '../shared/project-kind.js';
import { iconSVG } from '../shared/icons.js';
let refs=null;let activeTab='projects',categoriesInitialized=false;const openCategories=new Set();
const SHAPES=[['square','Square'],['wide','Wide rectangle'],['tall','Tall rectangle'],['circle','Circle'],['oval','Oval'],['triangle','Triangle'],['diamond','Diamond']];
/**
 * O SINGURA bara, in ordinea ceruta de Augustin (18 sep 2026): descriere, JSON, separator, grupare,
 * forme; sync si save la dreapta. Titlul proiectului ! mai apare: in nex3 il scrie tabul.
 * Scoase fiindca ! isi aveau rostul: „unește", „încadrează", „zoom 100%". Undo/Redo raman pe
 * Ctrl+Z / Ctrl+Y (`app-actions.js`), fara buton.
 */
const TOOLS=[['project-description','description','Description'],['json','code','JSON'],['group','group','Group'],['ungroup','ungroup','Ungroup']];
const TOOL_LABELS={save:'Save',sync:'Sync','project-description':'Description',json:'JSON'};
/** Modurile plansei: alege noduri, sau trage fundalul. Editarea unui nod merge in amandoua. */
const MODES=[['select','cursor','Select'],['pan','hand','Pan the canvas']];
const button=(action,icon,label)=>`<button class="icon-button${TOOL_LABELS[action]?' labeled-tool':''}" type="button" data-action="${action}" title="${label}" aria-label="${label}">${iconSVG(icon)}${TOOL_LABELS[action]?`<span>${TOOL_LABELS[action]}</span>`:''}${action==='sync'?'<span class="sync-badge" hidden>0</span>':''}</button>`;

// §2 shell mount
export function mountShell(root,handlers={}) {
  activeTab='projects';categoriesInitialized=false;openCategories.clear();
  root.textContent='';
  const shell=document.createElement('div'); shell.className='app-shell';
  shell.innerHTML=`<header class="app-header"><div class="brand"><img class="brand__mark" src="./assets/nexor.svg" alt="NR"><span>Nexor</span></div><input class="project-title" aria-label="Titlul proiectului" maxlength="160"><div class="tool-group">${TOOLS.slice(0,2).map(x=>button(...x)).join('')}</div><div class="tool-group">${TOOLS.slice(2).map(x=>button(...x)).join('')}</div><div class="shape-pick"><button class="shape-toggle" type="button" aria-haspopup="true" aria-expanded="false" title="Shapes"><span class="shape-preview shape-preview--square" aria-hidden="true"></span><span>Shapes</span><span class="pick-caret" aria-hidden="true">▾</span></button><div class="shape-menu" hidden>${SHAPES.map(([shape,label])=>`<button class="shape-button" type="button" draggable="true" data-shape="${shape}" title="${label}" aria-label="${label}"><span class="shape-preview shape-preview--${shape}" aria-hidden="true"></span></button>`).join('')}</div></div><div class="tool-group mode-group" role="group" aria-label="Canvas mode">${MODES.map(([mode,icon,label])=>`<button class="icon-button mode-button" type="button" data-mode="${mode}" title="${label}" aria-label="${label}" aria-pressed="${mode==='select'}">${iconSVG(icon)}</button>`).join('')}</div><label class="tool-group auto-size-toggle" title="Redimensionează automat formele ca să încapă toată descrierea scurtă; când debifezi, revin la dimensiunea standard"><input type="checkbox" class="auto-size-checkbox" aria-label="Extinde formele după descriere"><span>Extinde descrieri</span></label><div class="header-actions">${button('sync','sync','Sync changes from Nex')}${button('save','save','Save scheme')}${button('theme','sun','Switch theme')}${button('help','help','Help')}</div></header><section class="workspace"><div class="project-workspace"><div class="canvas-host" aria-label="Planșă proiect"></div></div><aside class="sidebar" aria-label="Proiecte"><div class="sidebar-resizer" role="separator" aria-orientation="vertical" tabindex="0" aria-label="Redimensionează bara laterală"></div><div class="sidebar-tabs" role="tablist" aria-label="Organizare"><button type="button" role="tab" data-sidebar-tab="projects" aria-selected="true">Proiecte</button><button type="button" role="tab" data-sidebar-tab="groups" aria-selected="false">Grupuri</button></div><section class="categories-panel"><form class="new-category"><label class="sr-only" for="new-category-title">Categorie nouă</label><input id="new-category-title" class="field" maxlength="160" placeholder="Adaugă categorie"><button class="icon-button add-category" type="submit" title="Adaugă categoria" aria-label="Adaugă categoria">${iconSVG('plus',16)}</button></form><div class="category-list"></div></section><div class="group-list" role="list" hidden></div></aside></section><footer class="statusbar"><span class="save-status" data-state="saved">Salvat</span><span class="sync-status" data-state="idle"></span><span class="canvas-stats">0 noduri · 0 conexiuni · 100%</span></footer>`;
  root.append(shell);
  refs={root,shell,canvas:shell.querySelector('.canvas-host'),projectInput:shell.querySelector('.project-title'),autoSizeCheck:shell.querySelector('.auto-size-checkbox'),categoryInput:shell.querySelector('#new-category-title'),categoryList:shell.querySelector('.category-list'),status:shell.querySelector('.save-status'),syncStatus:shell.querySelector('.sync-status'),syncButton:shell.querySelector('[data-action="sync"]'),stats:shell.querySelector('.canvas-stats'),sidebar:shell.querySelector('.sidebar'),handlers,library:null,project:null,projectSignature:'',groupSignature:''};
  bindInteractions();
  shell.querySelectorAll('[data-sidebar-tab]').forEach(tab=>tab.onclick=()=>{activeTab=tab.dataset.sidebarTab;renderTabs();});
  return {canvas:refs.canvas,projectInput:refs.projectInput};
}

// §3 rendering API
export function renderShell(library,project,stats={}) {
  if(!refs) return;
  if(refs.project?.id!==project?.id)activeTab=isAssembly(project)?'groups':'projects';
  refs.library=library; refs.project=project;
  if(!categoriesInitialized){const categoryId=project?.categoryId||library?.categories?.[0]?.id;if(categoryId)openCategories.add(categoryId);categoriesInitialized=true;}
  // Incorporat (nex3 sau nex-remote), tema o da GAZDA si ! se atinge de aici: altfel o valoare
  // veche din biblioteca aprindea fundal alb peste editorul intunecat (Augustin, 18 sep 2026).
  if(!document.documentElement.dataset.mode) document.documentElement.dataset.theme=library?.theme || 'light';
  if(Number.isFinite(library?.sidebarWidth)) refs.sidebar.style.setProperty('--sidebar-width',`${Math.max(240,library.sidebarWidth)}px`);
  const projects=sidebarProjects(library?.projects||[],'projects');
  const signature=JSON.stringify([(library?.categories||[]).map(item=>[item.id,item.title]),projects.map(item=>[item.id,item.title,item.categoryId,item.id===project?.id])]);
  if(signature!==refs.projectSignature){renderProjectCategories();refs.projectSignature=signature;}
  if(document.activeElement!==refs.projectInput) refs.projectInput.value=project?.title||'';
  if(refs.autoSizeCheck) refs.autoSizeCheck.checked=Boolean(project?.autoSizeBySubtitle);
  renderTabs();
  const broken=Number(stats.broken)||0;
  refs.stats.textContent=`${Number(stats.nodes)||0} noduri · ${Number(stats.edges)||0} conexiuni${broken?` · ${broken} rupte`:''} · ${Math.round((Number(stats.zoom)||1)*100)}%`;
}
export function setSaveStatus(state,message) { if(!refs) return; refs.status.dataset.state=state; refs.status.textContent=message||({saving:'Se salvează…',saved:'Salvat',error:'Eroare la salvare'}[state]||state); }
export function setSyncStatus(state,count=0,message='') {if(!refs)return;refs.syncStatus.dataset.state=state;refs.syncStatus.textContent=message;refs.syncButton.dataset.state=state;refs.syncButton.title=message||'Sincronizează modificările de la Nex';const badge=refs.syncButton.querySelector('.sync-badge');badge.hidden=!count;badge.textContent=String(count);}
export function setSelection() {}

// §4 interaction helpers
function bindInteractions() {
  const action=(name,payload)=>refs.handlers.action?.(name,payload);
  refs.shell.addEventListener('click',event=>{ const shape=event.target.closest('[data-shape]')?.dataset.shape; if(shape) action('add-node',{shape}); const category=event.target.closest('[data-category-toggle]');if(category){toggleCategory(category.dataset.categoryToggle);return;}const categoryAction=event.target.closest('[data-category-action]');if(categoryAction){refs.handlers.categoryMenu?.(categoryAction.dataset.categoryId,categoryAction.dataset.categoryAction);return;}const name=event.target.closest('[data-action]')?.dataset.action; if(!name)return; if(name==='project-menu') openProjectMenu(event.target.closest('button')); else action(name); });
  refs.shell.addEventListener('submit',event=>{if(event.target.matches('.new-category')){event.preventDefault();const title=refs.categoryInput.value.trim();if(!title)return;refs.handlers.addCategory?.(title);refs.categoryInput.value='';}if(event.target.matches('.new-project')){event.preventDefault();const input=event.target.querySelector('input'),title=input.value.trim();if(!title)return;refs.handlers.addProject?.(title,event.target.dataset.categoryId);input.value='';}});
  refs.projectInput.addEventListener('change',()=>action('rename-project',{title:refs.projectInput.value.trim()}));
  refs.projectInput.addEventListener('keydown',event=>{ if(event.key==='Enter'){ event.preventDefault(); refs.projectInput.blur(); } });
  refs.autoSizeCheck?.addEventListener('change',()=>action('toggle-auto-size',{enabled:refs.autoSizeCheck.checked}));
  // Formele stau intr-un meniu cu DESENELE lor, ! intr-un select cu nume: forma se recunoaste din
  // ochi, numele trebuie citit. Ramane si trasul pe plansa, ca la paleta de dinainte.
  const shapeToggle=refs.shell.querySelector('.shape-toggle'),shapeMenu=refs.shell.querySelector('.shape-menu');
  const closeShapes=()=>{shapeMenu.hidden=true;shapeToggle.setAttribute('aria-expanded','false');};
  shapeToggle.addEventListener('click',event=>{event.stopPropagation();const open=shapeMenu.hidden;shapeMenu.hidden=!open;shapeToggle.setAttribute('aria-expanded',String(open));});
  shapeMenu.addEventListener('click',()=>closeShapes());
  document.addEventListener('click',event=>{if(!shapeMenu.hidden&&!event.target.closest('.shape-pick'))closeShapes();});
  refs.shell.querySelectorAll('[data-shape]').forEach(item=>item.addEventListener('dragstart',event=>{ closeShapes(); event.dataTransfer.effectAllowed='copy'; event.dataTransfer.setData('application/x-nexor-shape',item.dataset.shape); }));
  refs.shell.querySelectorAll('.mode-button').forEach(item=>item.addEventListener('click',()=>{
    refs.shell.querySelectorAll('.mode-button').forEach(other=>other.setAttribute('aria-pressed',String(other===item)));
    action('canvas-mode',{mode:item.dataset.mode});
  }));
  bindResize(refs.shell.querySelector('.sidebar-resizer'),action);
}
function projectRow(project,active) {
  const row=document.createElement('div');row.className=`project-row${active?' is-active':''}`;row.setAttribute('role','listitem');
  const select=document.createElement('button');select.type='button';select.className='project-row__title';setRowTitle(select,project.title,isAssembly(project)?'group':'file');select.setAttribute('aria-current',active?'true':'false');select.onclick=()=>refs.handlers.selectProject?.(project.id);
  const actions=document.createElement('span');actions.className='project-row__actions';[['rename','description','Redenumește'],['clone','join','Clonează'],['delete','close','Șterge']].forEach(([name,icon,label])=>{const item=document.createElement('button');item.type='button';item.className='icon-button';item.title=label;item.setAttribute('aria-label',`${label} ${project.title}`);item.innerHTML=iconSVG(icon,15);item.onclick=()=>refs.handlers.projectMenu?.(project.id,name);actions.append(item);});row.append(select,actions);return row;
}
function openProjectMenu(anchor) {
  const old=refs.shell.querySelector('.project-menu'); if(old){old.remove();return;}
  const menu=document.createElement('div'); menu.className='project-menu';
  [['rename','Redenumește'],['clone','Clonează'],['delete','Șterge']].forEach(([name,label])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=label; b.className=name==='delete'?'danger':''; b.onclick=()=>{refs.handlers.projectMenu?.(refs.project?.id,name);menu.remove();}; menu.append(b); });
  anchor.after(menu); menu.querySelector('button')?.focus();
}
function bindResize(handle,action) {
  let startX=0,startWidth=0;
  handle.addEventListener('pointerdown',event=>{ startX=event.clientX;startWidth=refs.sidebar.getBoundingClientRect().width;handle.setPointerCapture(event.pointerId); });
  handle.addEventListener('pointermove',event=>{ if(!handle.hasPointerCapture(event.pointerId))return; refs.sidebar.style.setProperty('--sidebar-width',`${Math.max(240,startWidth+startX-event.clientX)}px`); });
  handle.addEventListener('pointerup',event=>{ if(!handle.hasPointerCapture(event.pointerId))return;handle.releasePointerCapture(event.pointerId);action('sidebar-resize',{width:Math.round(refs.sidebar.getBoundingClientRect().width)}); });
  handle.addEventListener('keydown',event=>{ if(!['ArrowLeft','ArrowRight'].includes(event.key))return; const width=Math.max(240,refs.sidebar.getBoundingClientRect().width+(event.key==='ArrowLeft'?8:-8));refs.sidebar.style.setProperty('--sidebar-width',`${width}px`);action('sidebar-resize',{width:Math.round(width)}); });
}

// §5 sidebar groups
function renderTabs(){
 const groups=activeTab==='groups';
 refs.shell.querySelectorAll('[data-sidebar-tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.sidebarTab===activeTab)));
 refs.shell.querySelector('.categories-panel').hidden=groups;
 const list=refs.shell.querySelector('.group-list');list.hidden=!groups;if(!groups)return;
 const signature=JSON.stringify([sidebarProjects(refs.library?.projects||[],'groups').map(p=>[p.id,p.title,p.id===refs.project?.id]),(refs.project?.groups||[]).map(g=>[g.id,g.title,g.color])]);if(signature===refs.groupSignature)return;refs.groupSignature=signature;
 const fragment=document.createDocumentFragment();
 for(const project of sidebarProjects(refs.library?.projects||[],'groups'))fragment.append(projectRow(project,project.id===refs.project?.id));
 if(refs.project?.groups?.length){const heading=document.createElement('p');heading.className='sidebar-empty';heading.textContent='Grupuri de noduri · '+refs.project.title;fragment.append(heading);}
 for(const group of refs.project?.groups||[]){
  const row=document.createElement('div');row.className='project-row';row.setAttribute('role','listitem');
  const select=document.createElement('button');select.type='button';select.className='project-row__title';setRowTitle(select,group.title,'group');
  select.style.borderLeft='3px solid '+group.color;select.onclick=()=>refs.handlers.action('group-select',{id:group.id});
  const edit=document.createElement('button');edit.type='button';edit.className='icon-button';edit.innerHTML=iconSVG('gear',15);edit.title='Editează grupul';edit.setAttribute('aria-label','Editează '+group.title);edit.onclick=()=>refs.handlers.action('group-edit',{id:group.id});
  row.append(select,edit);fragment.append(row);
 }
 if(!fragment.childNodes.length){const empty=document.createElement('p');empty.className='sidebar-empty';empty.textContent='Niciun ansamblu. Folosește Unește pentru a reuni proiecte.';fragment.append(empty);}
 list.replaceChildren(fragment);
}

// §6 project categories
function renderProjectCategories(){
 const fragment=document.createDocumentFragment(),projects=sidebarProjects(refs.library?.projects||[],'projects');
 for(const category of refs.library?.categories||[]){
  const section=document.createElement('section');section.className='category';
  const header=document.createElement('div');header.className='category__header';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='category__toggle';toggle.dataset.categoryToggle=category.id;toggle.setAttribute('aria-expanded',String(openCategories.has(category.id)));toggle.innerHTML=`<span class="category__chevron">${iconSVG('chevron',15)}</span><span class="category__folder">${iconSVG('folder',17)}</span><span class="category__title"></span>`;toggle.querySelector('.category__title').textContent=category.title;
  const actions=document.createElement('span');actions.className='category__actions';for(const [name,icon,label] of [['rename','edit','Redenumește'],['delete','trash','Șterge']]){const item=document.createElement('button');item.type='button';item.className='icon-button';item.dataset.categoryAction=name;item.dataset.categoryId=category.id;item.title=label;item.setAttribute('aria-label',`${label} categoria ${category.title}`);item.innerHTML=iconSVG(icon,14);actions.append(item);}header.append(toggle,actions);
  const body=document.createElement('div');body.className='category__body';body.hidden=!openCategories.has(category.id);const form=document.createElement('form');form.className='new-project';form.dataset.categoryId=category.id;form.innerHTML=`<label class="sr-only">Titlu proiect nou</label><input class="field" maxlength="160" placeholder="Adaugă proiect"><button class="icon-button add-project" type="submit" title="Adaugă proiect" aria-label="Adaugă proiect">${iconSVG('plus',16)}</button>`;const list=document.createElement('div');list.className='project-list';list.setAttribute('role','list');list.replaceChildren(...projects.filter(p=>p.categoryId===category.id).map(p=>projectRow(p,p.id===refs.project?.id)));body.append(form,list);section.append(header,body);fragment.append(section);
 }
 if(!fragment.childNodes.length){const empty=document.createElement('p');empty.className='sidebar-empty';empty.textContent='Adaugă prima categorie pentru proiecte.';fragment.append(empty);}refs.categoryList.replaceChildren(fragment);
}

function toggleCategory(id){if(openCategories.has(id))openCategories.delete(id);else openCategories.add(id);renderProjectCategories();}

function setRowTitle(button,title,icon){const glyph=document.createElement('span');glyph.className='sidebar-row-icon';glyph.innerHTML=iconSVG(icon,16);const label=document.createElement('span');label.className='sidebar-row-label';label.textContent=title;button.append(glyph,label);button.title=title;}
