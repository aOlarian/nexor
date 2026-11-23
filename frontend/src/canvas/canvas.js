/* MAP
 * §1 imports & setup L8-L55
 * §2 view & render L56-L109
 * §3 event wiring & tooltip L110-L194
 * §4 public API L195-L208
 */

// §1 imports & setup
import { contentBounds, fitView, snap, WORLD_SIZE } from './geometry.js';
import { bindGestures } from './gestures.js';
import { renderScene } from './render.js';
import { CONFIG } from '../shared/config.js';
import { sanitizeHTML, escapeText } from '../shared/sanitize.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const noop = () => {};

export function createCanvas(container, callbacks = {}) {
  const cb = new Proxy(callbacks, { get: (target, key) => target[key] || noop });
  const root = document.createElement('div');
  root.className = 'nexor-canvas';
  root.tabIndex = 0;
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'Planșă diagramă');
  root.innerHTML = `<div class="canvas-world"><svg class="canvas-svg" xmlns="http://www.w3.org/2000/svg"><g class="canvas-scene"></g><path class="canvas-connect-preview" hidden/><rect class="canvas-lasso" hidden/></svg></div><div class="canvas-empty" hidden><strong>Planșă goală</strong><span>Trage o formă aici pentru a începe.</span></div><div class="nexor-tooltip" role="tooltip" hidden></div>`;
  container.replaceChildren(root);
  const world = root.querySelector('.canvas-world');
  const scene = root.querySelector('.canvas-scene');
  const empty = root.querySelector('.canvas-empty');
  const tooltip = root.querySelector('.nexor-tooltip');
  let project = { nodes: [], edges: [], frames: [], view: { x: 0, y: 0, zoom: 1 } };
  let view = { x: 0, y: 0, zoom: 1 };
  const selection = { nodes: new Set(), edgeId: null };
  let scrollTimer;
  let hoveredNodeId = null;

  function setWorldSize() {
    const bounds = contentBounds(project.nodes, project.frames);
    const width = Math.max(WORLD_SIZE.width, bounds.x + bounds.width + 800);
    const height = Math.max(WORLD_SIZE.height, bounds.y + bounds.height + 800);
    world.style.width = `${width * view.zoom}px`;
    world.style.height = `${height * view.zoom}px`;
    root.style.backgroundSize = `${CONFIG.grid * 2 * view.zoom}px ${CONFIG.grid * view.zoom}px`;
    scene.setAttribute('transform', `scale(${view.zoom})`);
    root.querySelectorAll('.canvas-connect-preview,.canvas-lasso').forEach(element => element.setAttribute('transform', `scale(${view.zoom})`));
  }

  function worldPoint(event) {
    const rect = root.getBoundingClientRect();
    return { x: (event.clientX - rect.left + root.scrollLeft) / view.zoom, y: (event.clientY - rect.top + root.scrollTop) / view.zoom };
  }

  // §2 view & render
  function hideTooltip() {
    hoveredNodeId = null;
    tooltip.hidden = true;
  }

  function emitView() {
    view.x = root.scrollLeft / view.zoom;
    view.y = root.scrollTop / view.zoom;
    cb.onViewChange({ ...view });
  }

  function setView(next, notify = false) {
    view = { x: Number(next?.x) || 0, y: Number(next?.y) || 0, zoom: clamp(Number(next?.zoom) || 1, CONFIG.minZoom, CONFIG.maxZoom) };
    setWorldSize();
    root.scrollLeft = view.x * view.zoom;
    root.scrollTop = view.y * view.zoom;
    if (notify) cb.onViewChange({ ...view });
  }

  function zoomAt(clientX, clientY, zoom) {
    const rect = root.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const anchorX = (root.scrollLeft + localX) / view.zoom;
    const anchorY = (root.scrollTop + localY) / view.zoom;
    view.zoom = clamp(zoom, CONFIG.minZoom, CONFIG.maxZoom);
    setWorldSize();
    root.scrollLeft = anchorX * view.zoom - localX;
    root.scrollTop = anchorY * view.zoom - localY;
    emitView();
  }

  function paint() {
    hideTooltip();
    renderScene(scene, project, selection);
    empty.hidden = Boolean(project.nodes?.length || project.frames?.length);
  }

  function render(nextProject) {
    project = nextProject || { nodes: [], edges: [], frames: [] };
    const validNodes = new Set((project.nodes || []).map((node) => node.id));
    selection.nodes = new Set([...selection.nodes].filter((id) => validNodes.has(id)));
    if (!(project.edges || []).some((edge) => edge.id === selection.edgeId)) selection.edgeId = null;
    if (project.view) setView(project.view);
    paint();
  }

  function select(ids, edgeId = null, append = false) {
    selection.nodes = append ? new Set([...selection.nodes, ...ids]) : new Set(ids);
    selection.edgeId = edgeId;
    cb.onSelect([...selection.nodes], edgeId);
    paint();
  }

  function fit() {
    setView(fitView(contentBounds(project.nodes, project.frames), { width: root.clientWidth, height: root.clientHeight }), true);
  }

  // §3 event wiring & tooltip
  function formatTooltipHTML(node) {
    const parts = [`<div class="nexor-tooltip__head"><span class="nexor-tooltip__badge" style="background:${escapeText(node.color || '#3f7fb0')}"></span><strong>${escapeText(node.title || 'Nod')}</strong></div>`];
    if (node.subtitle && node.subtitle.trim()) {
      const lines = node.subtitle.trim().split(/\r?\n/).map(line => `<div class="nexor-tooltip__line">${escapeText(line)}</div>`).join('');
      parts.push(`<div class="nexor-tooltip__subtitle">${lines}</div>`);
    }
    if (node.description && node.description.trim()) {
      parts.push(`<div class="nexor-tooltip__rich">${sanitizeHTML(node.description)}</div>`);
    }
    return parts.length > 1 ? parts.join('') : '';
  }

  function updateTooltipPosition(clientX, clientY) {
    const pad = 16;
    const maxW = 380, maxH = 340;
    const x = Math.min(window.innerWidth - maxW - pad, Math.max(pad, clientX + 16));
    const y = Math.min(window.innerHeight - maxH - pad, Math.max(pad, clientY + 16));
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  root.addEventListener('pointerover', (event) => {
    const trigger = event.target.closest?.('[data-node-desc]');
    if (!trigger) { hideTooltip(); return; }
    const nodeId = trigger.dataset.nodeDesc;
    const node = (project.nodes || []).find(n => n.id === nodeId);
    if (!node) { hideTooltip(); return; }
    const html = formatTooltipHTML(node);
    if (!html) { hideTooltip(); return; }
    if (hoveredNodeId !== nodeId) {
      hoveredNodeId = nodeId;
      tooltip.innerHTML = html;
      tooltip.style.setProperty('--tip-accent', node.color || '#3f7fb0');
    }
    tooltip.hidden = false;
    updateTooltipPosition(event.clientX, event.clientY);
  });

  root.addEventListener('pointermove', (event) => {
    if (!tooltip.hidden) updateTooltipPosition(event.clientX, event.clientY);
  });

  root.addEventListener('pointerleave', hideTooltip);

  const gestures = bindGestures({ root, scene, project: () => project, view: () => view, selection, select, paint, point: worldPoint, callbacks: cb });
  let pinch = null;
  const touchCenter = touches => ({ x:(touches[0].clientX+touches[1].clientX)/2, y:(touches[0].clientY+touches[1].clientY)/2 });
  const touchDistance = touches => Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
  root.addEventListener('touchstart', event => {
    if(event.touches.length!==2)return;
    event.preventDefault();
    root.dataset.pinchZoom='true';
    gestures.cancel();
    pinch={distance:touchDistance(event.touches),zoom:view.zoom};
  }, {passive:false});
  root.addEventListener('touchmove', event => {
    if(!pinch||event.touches.length!==2)return;
    event.preventDefault();
    const center=touchCenter(event.touches);
    zoomAt(center.x,center.y,pinch.zoom*touchDistance(event.touches)/Math.max(1,pinch.distance));
  }, {passive:false});
  const finishPinch = event => {
    if(event.touches.length<2){pinch=null;delete root.dataset.pinchZoom;}
  };
  root.addEventListener('touchend',finishPinch);
  root.addEventListener('touchcancel',finishPinch);
  root.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, view.zoom * Math.exp(-event.deltaY * 0.002));
  }, { passive: false });
  root.addEventListener('scroll', () => { hideTooltip(); clearTimeout(scrollTimer); scrollTimer = setTimeout(emitView, 100); });
  root.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    hideTooltip();
    const node = event.target.closest('.canvas-node');
    const edge = event.target.closest('.canvas-edge');
    const frame = event.target.closest('.canvas-frame');
    if (node) cb.onNodeMenu(node.dataset.nodeId, event.clientX, event.clientY);
    else if (edge) cb.onEdgeMenu(edge.dataset.edgeId, event.clientX, event.clientY);
    else if (frame && !frame.dataset.instanceId) cb.onGroupMenu(frame.dataset.frameId);
    else if (frame?.dataset.instanceId) cb.onNodeMenu(frame.dataset.instanceId, event.clientX, event.clientY);
  });
  root.addEventListener('dblclick', (event) => {
    hideTooltip();
    const node = event.target.closest('.canvas-node');
    const frame = event.target.closest('.canvas-frame');
    if (node) cb.onNodeMenu(node.dataset.nodeId, event.clientX, event.clientY);
    else if (frame && !frame.dataset.instanceId) cb.onGroupMenu(frame.dataset.frameId);
  });
  root.addEventListener('click', (event) => {
    const menu = event.target.closest('[data-node-menu]');
    if (menu) { hideTooltip(); cb.onNodeMenu(menu.dataset.nodeMenu, event.clientX, event.clientY); return; }
    const opener = event.target.closest('[data-open-source]');
    if (opener) { hideTooltip(); cb.onOpenSource(opener.dataset.openSource); }
  });
  root.addEventListener('dragover', (event) => { if ([...event.dataTransfer.types].includes('application/x-nexor-shape')) event.preventDefault(); });
  root.addEventListener('drop', (event) => { const shape = event.dataTransfer.getData('application/x-nexor-shape'); if (shape) { event.preventDefault(); const at = worldPoint(event); cb.onDropShape(shape, clamp(snap(at.x), 64, CONFIG.coordinateLimit - 64), clamp(snap(at.y), 64, CONFIG.coordinateLimit - 64)); } });

  // §4 public API
  setWorldSize();
  return {
    render,
    setView: (next) => setView(next),
    getView: () => ({ ...view }),
    setSelection: (ids, edgeId = null) => select(ids, edgeId),
    setMode: (mode) => gestures.setMode(mode),
    fit,
    resetZoom: () => zoomAt(root.getBoundingClientRect().left + root.clientWidth / 2, root.getBoundingClientRect().top + root.clientHeight / 2, 1),
    destroy: () => { clearTimeout(scrollTimer); gestures.destroy(); root.remove(); },
  };
}
