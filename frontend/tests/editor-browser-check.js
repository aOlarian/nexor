/* MAP §1 editor layout and save checks */
import {editNode,editDescription,editGroup} from '../src/ui/dialogs.js';
// §1 editor layout and save checks, to run in the native browser harness.
export async function runEditorChecks(){
 const results=[],check=(name,pass)=>results.push({name,pass:!!pass});
 const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const save=()=>[...document.querySelectorAll('.dialog__footer button')].find(b=>b.textContent==='Salvează').click();
 const pending=editNode({title:'Exemplu',shape:'square',icon:'server',color:'#123456',opacity:.7,description:'<p>Inițial</p>'});
 await frame();const dialog=document.querySelector('.dialog'),rect=dialog.getBoundingClientRect();
 check('node dialog fills 90% height and 75% width capped at 1600',Math.abs(rect.height-innerHeight*.9)<2&&Math.abs(rect.width-Math.min(innerWidth*.75,1600))<2);
 const row=document.querySelector('.node-fields'),labels=[...row.children].map(n=>n.getBoundingClientRect().top);
 check('all node properties occupy one row',Math.max(...labels)-Math.min(...labels)<2);
 check('icon chooser is a select',row.querySelectorAll('select').length===2);
 check('description is inline without a second dialog',document.querySelectorAll('[role=dialog]').length===1&&!dialog.textContent.includes('Editează descrierea'));
 const editor=dialog.querySelector('.rich-editor'),style=getComputedStyle(editor);
 check('description has 20 lines and vertical resize',parseFloat(style.height)>=20*parseFloat(style.lineHeight)&&style.resize==='vertical');
 editor.innerHTML='<h2>Descriere nouă</h2>';dialog.querySelector('textarea').value='• Linia 1\n• Linia 2';row.querySelector('input[type=range]').value='45';save();const node=await pending;
 check('inline content, subtitle and transparency save together',node.description.includes('Descriere nouă')&&node.subtitle.includes('Linia 1')&&node.opacity===.55);
 const project=editDescription('Proiect','<p>Scop</p>');await frame();
 check('project description uses the large editor',document.querySelector('.dialog--editor .rich-editor'));save();await project;
 const group=editGroup({title:'Grup',color:'#334155',opacity:1});await frame();
 document.querySelector('.dialog input:not([type=color]):not([type=range])').value='Grup redenumit';
 document.querySelector('.dialog input[type=color]').value='#556677';save();const result=await group;
 check('group title and color can be saved',result.title==='Grup redenumit'&&result.color==='#556677');
 return results;
}
