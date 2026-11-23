/* MAP §1 text escaping §2 rich text allowlist */
// §1 text escaping
export const escapeText=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// §2 rich text allowlist
export function sanitizeHTML(value){
 const text=String(value??'');if(typeof DOMParser==='undefined')return escapeText(text);
 const doc=new DOMParser().parseFromString(text,'text/html');
 const allowed=new Set(['P','DIV','BR','H1','H2','H3','H4','UL','OL','LI','B','STRONG','I','EM','U','S','BLOCKQUOTE','SPAN','FONT','A']);
 const discard=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE','FORM','INPUT','BUTTON','IMG','VIDEO','AUDIO']);
 function clean(parent){for(const child of [...parent.childNodes]){
  if(child.nodeType===8){child.remove();continue;}if(child.nodeType!==1)continue;
  if(discard.has(child.tagName)){child.remove();continue;}clean(child);
  if(!allowed.has(child.tagName)){child.replaceWith(...child.childNodes);continue;}
  const color=child.style?.color||(child.tagName==='FONT'?child.getAttribute('color'):'');
  const href=child.tagName==='A'?child.getAttribute('href'):null;
  for(const attr of [...child.attributes])child.removeAttribute(attr.name);
  if(color&&/^(#[a-f\d]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]+)$/i.test(color))child.style.color=color;
  if(href&&/^(https?:\/\/|mailto:)/i.test(href.trim())){child.setAttribute('href',href.trim());child.setAttribute('target','_blank');child.setAttribute('rel','noopener noreferrer');}
 }}clean(doc.body);return doc.body.innerHTML;
}
