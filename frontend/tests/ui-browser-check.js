/* MAP
 * §1 helpers L9-L16
 * §2 dialog and editor checks L17-L37
 * §3 join and theme checks L37-L45
 */
import {promptText,showMessage,editDescription,chooseJoin,resolveSyncConflict} from '../src/ui/dialogs.js';
import {sanitizeHTML} from '../src/shared/sanitize.js';

// §1 helpers
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const click=(text,root=document)=>{const item=[...root.querySelectorAll('button')].find(node=>node.textContent.trim()===text);if(!item)throw Error(`Control absent: ${text}`);item.click();};
function rgba(value){const match=value.match(/[\d.]+/g)?.map(Number)||[];return match.length===3?[...match,1]:match;}
function solidColor(foreground,background){const fg=rgba(foreground),bg=rgba(background);const alpha=fg[3]??1;return fg.slice(0,3).map((value,index)=>value*alpha+bg[index]*(1-alpha));}
function luminance(rgb){const linear=rgb.map(value=>{const channel=value/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;});return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];}
function contrast(foreground,background){const bg=solidColor(background,'rgb(255,255,255)'),fg=solidColor(foreground,`rgb(${bg.join(',')})`);const values=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);}

// §2 dialog and editor checks
export async function runUIChecks(){
 const results=[];const check=(name,pass,detail)=>results.push({name,pass:!!pass,...(detail?{detail}: {})});
 const originalTheme=document.documentElement.dataset.theme;
 try{
  const trigger=document.createElement('button');trigger.textContent='Test focus';document.body.append(trigger);trigger.focus();
  const saved=promptText('Titlu test','Titlu','Inițial');await frame();const dialog=document.querySelector('[role="dialog"]');
  check('dialog has accessible name',dialog?.getAttribute('aria-labelledby')&&document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent==='Titlu test');
  const input=dialog.querySelector('input');input.value='Salvat';click('Salvează',dialog);check('prompt save resolves value',(await saved)==='Salvat');
  const cancelled=promptText('Anulare','Titlu','Text');await frame();click('Renunță',document.querySelector('[role="dialog"]'));check('prompt cancel resolves null',(await cancelled)===null);
  const conflict=resolveSyncConflict('Proiectul s-a schimbat.');await frame();click('Aplică modificările Nex',document.querySelector('[role="dialog"]'));check('sync conflict returns explicit choice',(await conflict)==='apply');
  showMessage('Dialog exterior','Mesaj');await frame();const outer=document.querySelector('[role="dialog"]');const nested=promptText('Dialog interior','Valoare','');await frame();
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));check('Escape closes only topmost dialog',document.querySelectorAll('[role="dialog"]').length===1&&document.querySelector('[role="dialog"]')===outer);await nested;
  const focusables=[...outer.querySelectorAll('button')];focusables.at(-1).focus();outer.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));check('dialog traps focus',document.activeElement===focusables[0]);click('Închide',outer);check('dialog restores prior focus',document.activeElement===trigger);trigger.remove();
  const rich=editDescription('Editor','<p>sigur</p>');await frame();const editor=document.querySelector('.rich-editor');editor.innerHTML='<p>unu doi</p><img src=x onerror=alert(1)><script>alert(1)</script>';
  const text=editor.querySelector('p').firstChild,range=document.createRange();range.setStart(text,0);range.setEnd(text,3);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);editor.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));click('B',document.querySelector('[role="dialog"]'));check('rich text command preserves selected range',/^(B|STRONG)$/.test(editor.querySelector('p')?.firstElementChild?.tagName||''),editor.innerHTML);
  click('Salvează',document.querySelector('[role="dialog"]'));const html=await rich;check('rich text save sanitizes HTML',!/<(?:script|img)\b|onerror/i.test(html),html);
  const hostile=sanitizeHTML('<a href="javascript:alert(1)" onclick="alert(1)">rău</a><iframe src=x></iframe><p style="color:red;background:url(x)">bun</p>');check('sanitizer removes executable markup',!/(javascript:|onclick|iframe|background)/i.test(hostile)&&hostile.includes('bun'),hostile);
 }catch(error){check('dialog and editor checks complete',false,error.message||String(error));document.querySelectorAll('.dialog-backdrop').forEach(node=>node.remove());}

 // §3 join and theme checks
 try{
  const joined=chooseJoin([{id:'one',title:'Unu'},{id:'two',title:'Doi'}],'one');await frame();const joinDialog=document.querySelector('[role="dialog"]');
  check('join prechecks current project',joinDialog.querySelector('input[value="one"]')?.checked===true);joinDialog.querySelector('input[value="two"]').click();click('Creează',joinDialog);const choice=await joined;check('join returns current and selected projects',choice?.ids.includes('one')&&choice.ids.includes('two'));
  for(const theme of ['light','dark']){document.documentElement.dataset.theme=theme;const body=getComputedStyle(document.body);const ratio=contrast(body.color,body.backgroundColor);check(`${theme} theme normal text contrast`,ratio>=4.5,`contrast ${ratio.toFixed(2)}:1`);}
 }catch(error){check('join and theme checks complete',false,error.message||String(error));document.querySelectorAll('.dialog-backdrop').forEach(node=>node.remove());}
 document.documentElement.dataset.theme=originalTheme;
 return results;
}
