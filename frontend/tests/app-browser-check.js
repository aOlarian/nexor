/* MAP §1 test utilities §2 application scenarios */
// §1 test utilities
export async function runAppChecks(){
 const app=window.nexor,results=[];if(!app)throw Error('Nexor bootstrap unavailable');
 const original=app.getLibrary(),tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const check=(name,condition)=>{results.push({name,pass:!!condition});if(!condition)throw Error(name);};
 const clickText=(selector,text)=>{const element=[...document.querySelectorAll(selector)].find(e=>e.textContent.trim()===text);if(!element)throw Error('Control not found: '+text);element.click();};
 // §2 application scenarios
 try{
  check('desktop backend is connected',app.transport.native===true);
  check('sync controls and shared directory exist',!!document.querySelector('[data-action="sync"]')&&(await app.transport.syncDirectory()).includes('Nexor Sync'));
  const form=document.querySelector('.category__body:not([hidden]) .new-project'),input=form.querySelector('input');input.value='Probă nativă';form.requestSubmit();await tick();
  const p=app.state.project();check('project created from sidebar',p.title==='Probă nativă');
  const title=document.querySelector('.project-title');title.value='Plan verificat';title.dispatchEvent(new Event('change',{bubbles:true}));await tick();check('header title saved',p.title==='Plan verificat');
  document.querySelector('[data-action="project-description"]').click();await tick();
  document.querySelector('.rich-editor').innerHTML='<h2>Scop</h2><p><b>Test</b> <u>nativ</u></p><ul><li>Pas unu</li></ul>';
  clickText('.dialog__footer button','Salvează');await tick();check('project rich text saved',p.description.includes('<h2>Scop</h2>')&&p.description.includes('<u>nativ</u>'));
  document.querySelector('[data-shape="square"]').click();await tick();document.querySelector('[data-shape="circle"]').click();await tick();
  check('palette creates nodes',p.nodes.length===2);app.state.change((l,p)=>{p.nodes[1].x+=300;});
  const first=p.nodes[0];document.querySelector(`[data-node-id="${first.id}"]`).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:300,clientY:300}));await tick();
  const formTitle=document.querySelector('.dialog .form-stack input:not([type=color])');formTitle.value='Server verificat';clickText('.dialog__footer button','Salvează');await tick();check('node properties save independently',p.nodes[0].title==='Server verificat');
  app.state.canvas.setSelection(p.nodes.map(n=>n.id));document.querySelector('[data-action="group"]').click();await tick();document.querySelector('.dialog input').value='Infrastructură';clickText('.dialog__footer button','Salvează');await tick();check('group uses selected nodes',p.groups.length===1&&p.nodes.every(n=>n.groupId===p.groups[0].id));
  app.nodes.copySelection();app.nodes.paste();await tick();check('copy paste works',p.nodes.length===4);app.state.undo();await tick();check('undo restores nodes',app.state.project().nodes.length===2);app.state.redo();await tick();check('redo restores nodes',app.state.project().nodes.length===4);
  document.querySelector('[data-action="json"]').click();await tick();const json=document.querySelector('.json-editor'),data=JSON.parse(json.value);data.project.title='Import verificat';json.value=JSON.stringify(data);json.dispatchEvent(new Event('input'));clickText('.dialog__footer button','Verifică');await tick();check('JSON shows preview before apply',document.querySelector('.json-preview').textContent.includes('Actualizare'));clickText('.dialog__footer button','Aplică');await tick();check('JSON applied',app.state.project().title==='Import verificat');
  document.querySelector('[data-action="theme"]').click();await tick();check('dark theme applied',document.documentElement.dataset.theme==='dark');document.querySelector('[data-action="theme"]').click();await tick();
  await app.flush();const saved=JSON.parse(await window.go.main.App.LoadLibrary());check('native disk contains latest state',saved.projects.some(p=>p.title==='Import verificat'));
  return results;
 }finally{document.querySelectorAll('.dialog-backdrop').forEach(e=>e.remove());app.state.library=original;app.state.undoStack=[];app.state.redoStack=[];app.state.selection=[];app.state.update();app.state.save.schedule();await app.flush();}
}
