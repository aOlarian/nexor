/* MAP §1 project actions §2 toolbar dispatch §3 keyboard */
import {newCategory,newProject,newNode} from './model.js';
import {cloneProject,joinProjects,syncNodeGroups} from './projects.js';
import {exportProject,prepareImport} from './exchange.js';
import {editDescription,promptText,confirmDialog,chooseJoin,jsonDialog,showMessage,showHelp} from './ui/dialogs.js';
// §1 project actions
export function appActions(state,nodes,transport){
 const error=e=>showMessage('Nu am putut aplica modificarea',String(e?.message||e));
 async function addProject(title,categoryId){const name=title?.trim()||await promptText('Proiect nou','Titlu','');if(!name?.trim())return;state.change(l=>{const category=l.categories.find(c=>c.id===categoryId)||l.categories[0];if(!category)throw new Error('Adaugă mai întâi o categorie.');const p=newProject(name.trim(),category.id);l.projects.push(p);l.activeProjectId=p.id;});}
 async function addCategory(title){const name=title?.trim()||await promptText('Categorie nouă','Nume','');if(!name?.trim())return;state.change(l=>l.categories.push(newCategory(name.trim())));}
 async function categoryMenu(id,action){const category=state.library.categories.find(c=>c.id===id);if(!category)return;
  if(action==='rename'){const title=await promptText('Redenumește categoria','Nume',category.title);if(title?.trim())state.change(()=>category.title=title.trim());}
  if(action==='delete'&&await confirmDialog('Șterge categoria?',`Proiectele din „${category.title}” vor fi mutate într-o altă categorie.`))state.change(l=>{let target=l.categories.find(c=>c.id!==id);if(!target){target=newCategory('Proiecte');l.categories.push(target);}l.projects.filter(p=>p.categoryId===id).forEach(p=>p.categoryId=target.id);l.categories=l.categories.filter(c=>c.id!==id);});
 }
 async function projectMenu(id,action){const p=state.library.projects.find(p=>p.id===id);if(!p)return;
  if(action==='rename'){const title=await promptText('Redenumește proiectul','Titlu',p.title);if(title?.trim())state.change(()=>p.title=title.trim());}
  if(action==='clone')state.change(l=>{const clone=cloneProject(p);l.projects.push(clone);l.activeProjectId=clone.id;});
  if(action==='delete'){
   const refs=state.library.projects.filter(s=>s.instances.some(i=>i.projectId===id));if(refs.length)return showMessage('Proiect folosit în ansamblu','Scoate mai întâi proiectul din: '+refs.map(p=>p.title).join(', '));
   if(await confirmDialog('Șterge proiectul?',`„${p.title}” va fi eliminat. Poți recupera proiectul cu Undo.`))state.change(l=>{l.projects=l.projects.filter(p=>p.id!==id);if(l.activeProjectId===id)l.activeProjectId=l.projects[0]?.id||'';});
  }
 }
 async function json(){const p=state.project();if(!p)return;
  await jsonDialog(exportProject(state.library,p),{
   preview:text=>prepareImport(text,state.library,p.id).summary,
   apply:text=>{const prepared=prepareImport(text,state.library,p.id);state.change(()=>state.library=prepared.library);},
   export:text=>transport.export(text,p.title),
  });
 }
 // §2 toolbar dispatch
 async function action(name,payload={}){try{
  if(globalThis.window?.nexorHost?.delegateAction?.(name,payload))return;
  const p=state.project();
  if(name==='undo')return state.undo();if(name==='redo')return state.redo();
  if(name==='save'){state.save.schedule();await state.save.flush();return;}
  if(name==='sync')return state.sync?.run(true);
  if(name==='group-edit')return nodes.groupMenu(payload.id);
  if(name==='group-select'){const ids=p?.nodes.filter(n=>n.groupId===payload.id).map(n=>n.id)||[];state.selection=ids;state.canvas.setSelection(ids);if(ids.length){const n=p.nodes.find(n=>n.id===ids[0]);state.canvas.setView({x:Math.max(0,n.x-100),y:Math.max(0,n.y-100),zoom:1});}return;}
  if(name==='canvas-mode')return state.canvas.setMode?.(payload.mode);
  if(name==='help')return showHelp();if(name==='add-project')return addProject();
  if(name==='theme'){state.library.theme=state.library.theme==='dark'?'light':'dark';state.update();state.save.schedule();return;}
  if(name==='sidebar-resize'){state.library.sidebarWidth=Math.min(600,Math.max(240,payload.width));state.save.schedule();return;}
  if(!p)return showMessage('Creează un proiect','Adaugă primul proiect din bara laterală.');
  if(name==='add-node'){const view=state.canvas.getView();state.change((l,p)=>{const n=newNode(payload.shape,Math.round((payload.x??view.x+240)/20)*20,Math.round((payload.y??view.y+180)/20)*20);p.nodes.push(n);syncNodeGroups(p,new Set([n.id]));});}
  else if(name==='toggle-auto-size'){state.change((l,p)=>{p.autoSizeBySubtitle=Boolean(payload.enabled);});}
  else if(name==='rename-project'){if(payload.title?.trim())state.change((l,p)=>p.title=payload.title.trim());else await projectMenu(p.id,'rename');}
  else if(name==='project-description'){const html=await editDescription(p.title,p.description);if(html!==null)state.change((l,p)=>p.description=html);}
  else if(name==='json')await json();
  else if(name==='join'){const result=await chooseJoin(state.library.projects,p.id);if(result)state.change(l=>{const joined=joinProjects(l,result.ids,result.title,result.mode);l.projects.push(joined);l.activeProjectId=joined.id;});}
  else if(name==='group')await nodes.group();else if(name==='ungroup')nodes.ungroup();
  else if(name==='fit')state.canvas.fit();else if(name==='zoom-reset')state.canvas.resetZoom();
  else if(name==='delete')await nodes.remove();else if(name==='duplicate')nodes.duplicate();
 }catch(e){error(e);}}
 // §3 keyboard
 function bindKeyboard(){document.addEventListener('keydown',event=>{
  if(document.querySelector('[role="dialog"]')||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const mod=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
  if(mod&&['z','y','a','d','c','v','s'].includes(key)){event.preventDefault();
   if(key==='z')action(event.shiftKey?'redo':'undo');if(key==='y')action('redo');
   if(key==='a'){state.selection=state.project()?.nodes.map(n=>n.id)||[];state.canvas.setSelection?.(state.selection);}
   if(key==='d')nodes.duplicate();if(key==='c')nodes.copySelection();if(key==='v')nodes.paste();if(key==='s')action('save');
  }
  if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();action('delete');}
  if(key==='f'&&!mod)action('fit');if(key==='?'&&!mod)action('help');
 });}
 return {action,addProject,addCategory,categoryMenu,projectMenu,error,bindKeyboard};
}
