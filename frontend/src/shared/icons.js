/* MAP
 * §1 icon paths
 * §2 public API
 */

// §1 icon paths
const PATHS = {
  save:'<path d="M4 3h13l3 3v15H4zM7 3v7h10V3M8 21v-7h8v7"/>',
  undo:'<path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/>', redo:'<path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/>',
  description:'<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>', code:'<path d="m8 9-3 3 3 3m8-6 3 3-3 3m-3-8-2 10"/>',
  join:'<circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/>', group:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/>',
  ungroup:'<path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5"/><path d="M9 9h6v6H9z"/>',
  'align-left':'<path d="M5 4v16M9 7h10v4H9zm0 7h7v4H9z"/>', 'align-top':'<path d="M4 5h16M7 9h4v10H7zm7 0h4v7h-4z"/>',
  fit:'<path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/>', zoom:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5M8 11h6"/>',
  // Cele doua moduri de lucru pe plansa: sageata alege, manuta trage fundalul.
  cursor:'<path d="M6 3l12 8-5 1.2 3 6-2.6 1.3-3-6L6 17z"/>',
  hand:'<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7l-2-3a1.6 1.6 0 0 1 2.4-2L9 14"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sync:'<path d="M20 7h-5V2"/><path d="M20 7a8 8 0 0 0-14-2M4 17h5v5"/><path d="M4 17a8 8 0 0 0 14 2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3 2.3c-.8.3-.8.9-.8 1.7m0 4h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', menu:'<path d="M5 7h14M5 12h14M5 17h14"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', shield:'<path d="M12 3 4.5 6v5.5c0 4.5 3.2 7.8 7.5 9.5 4.3-1.7 7.5-5 7.5-9.5V6z"/>',
  box:'<path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>', globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  terminal:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m5 0h5"/>', mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  server:'<rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/><path d="M8 7h.01M8 17h.01"/>',
  database:'<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5m-14 7v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"/>',
  cloud:'<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9z"/>', file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>',
  folder:'<path d="M3 6h7l2 2h9v11H3z"/>', edit:'<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.5 7l3.5 3.5"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>', chevron:'<path d="m9 6 6 6-6 6"/>',
  bolt:'<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>', gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>'
};

// §2 public API
export const ICON_NAMES = ['box','user','shield','globe','server','database','terminal','mail','cloud','file','bolt','gear'];
export function escapeHTML(value='') { const node=document.createElement('span'); node.textContent=String(value); return node.innerHTML; }
export function iconSVG(name,size=20) { const body=PATHS[name] || PATHS.file; const safeSize=Number(size)||20; return `<svg width="${safeSize}" height="${safeSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`; }
