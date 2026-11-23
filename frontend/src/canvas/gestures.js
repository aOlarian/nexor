/* MAP
 * §1 imports & helpers       L9-L80
 * §2 gesture start           L81-L128
 * §3 gesture movement        L129-L194
 * §4 gesture completion      L195-L246
 * §5 keyboard & lifecycle    L247-L280
 */

// §1 imports & helpers
import { intersects, nodeBounds, orthogonalPoints, portPoint, moveRouteSegment, roundedPath, snap } from './geometry.js';
import { CONFIG } from '../shared/config.js';

const boxBetween = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) });
const MOVE_MARGIN = 64;
const MIN_GROUP_WIDTH = 160;
const MIN_GROUP_HEIGHT = 120;

export function bindGestures(context) {
  const { root, scene, selection, select, paint, point, callbacks: cb } = context;
  const preview = root.querySelector('.canvas-connect-preview');
  const lasso = root.querySelector('.canvas-lasso');
  let active = null;
  let spaceDown = false;
  /** `select` = alegi noduri; `pan` = tragi fundalul. Comutat din bara (butoanele sageata/manuta). */
  let mode = 'select';

  /** Adaugare la selectie: Shift sau Ctrl (Cmd pe mac), ca in orice editor. */
  const adauga = (event) => event.shiftKey || event.ctrlKey || event.metaKey;

  const show = (element, visible) => {
    if (visible) element.removeAttribute('hidden'); else element.setAttribute('hidden', '');
    element.style.display = visible ? '' : 'none';
  };
  show(preview, false);
  show(lasso, false);

  function begin(event, type, start, data = {}) {
    active = { type, start, last: start, pointerId: event.pointerId, ...data };
    root.setPointerCapture(event.pointerId);
    if (type === 'lasso') show(lasso, true);
    if (type === 'connect') show(preview, true);
  }

  function edgeRoute(edge) {
    const nodes = context.project().nodes;
    const from = nodes.find((node) => node.id === edge.from.nodeId);
    const to = nodes.find((node) => node.id === edge.to.nodeId);
    if (!from || !to) return [];
    return orthogonalPoints(portPoint(from, edge.from.side), portPoint(to, edge.to.side), edge.waypoints, edge.from.side, edge.to.side);
  }

  function movementDelta(rawX, rawY) {
    let items = [];
    if (active.type === 'nodes') {
      const ids = new Set(active.ids);
      items = context.project().nodes.filter((node) => ids.has(node.id));
    } else if (active.type === 'instance') {
      items = (context.project().frames || []).filter((frame) => frame.instanceId === active.instanceId);
    } else if (active.type === 'group') {
      items = (context.project().frames || []).filter((frame) => frame.id === active.groupId && !frame.instanceId);
    }
    if (!items.length) return { dx: snap(rawX), dy: snap(rawY) };
    const minX = Math.min(...items.map((item) => item.x));
    const minY = Math.min(...items.map((item) => item.y));
    const maxX = Math.max(...items.map((item) => item.x + item.width));
    const maxY = Math.max(...items.map((item) => item.y + item.height));
    const minDx = MOVE_MARGIN - minX;
    const minDy = MOVE_MARGIN - minY;
    const maxDx = CONFIG.coordinateLimit - maxX;
    const maxDy = CONFIG.coordinateLimit - maxY;
    return {
      dx: Math.max(minDx, Math.min(maxDx, snap(rawX))),
      dy: Math.max(minDy, Math.min(maxDy, snap(rawY))),
    };
  }

  function computeResizedBox(box, dir, dx, dy) {
    let x = box.x, y = box.y, width = box.width, height = box.height;
    if (dir.includes('e')) width = Math.max(MIN_GROUP_WIDTH, snap(box.width + dx));
    if (dir.includes('s')) height = Math.max(MIN_GROUP_HEIGHT, snap(box.height + dy));
    if (dir.includes('w')) {
      const nextX = Math.max(MOVE_MARGIN, Math.min(box.x + box.width - MIN_GROUP_WIDTH, snap(box.x + dx)));
      width = box.x + box.width - nextX;
      x = nextX;
    }
    if (dir.includes('n')) {
      const nextY = Math.max(MOVE_MARGIN, Math.min(box.y + box.height - MIN_GROUP_HEIGHT, snap(box.y + dy)));
      height = box.y + box.height - nextY;
      y = nextY;
    }
    return { x, y, width, height };
  }

  // §2 gesture start
  function pointerDown(event) {
    if (root.dataset.pinchZoom === 'true') return;
    if (event.button > 1) return;
    root.focus({ preventScroll: true });
    const at = point(event);
    const nodeElement = event.target.closest('.canvas-node');
    const edgeElement = event.target.closest('.canvas-edge');
    const frameElement = event.target.closest('.canvas-frame');
    const resizeHandle = event.target.closest('[data-resize-dir]');
    const port = event.target.closest('.canvas-port');
    const waypoint = event.target.closest('.canvas-waypoint');
    const segment = event.target.closest('.canvas-segment-handle');
    if (event.target.closest('[data-open-source], [data-node-menu]')) return;
    const peFundal = !nodeElement && !edgeElement && !frameElement && !port && !waypoint && !segment && !resizeHandle;
    if (spaceDown || event.button === 1 || (mode === 'pan' && peFundal)) return begin(event, 'pan', { x: event.clientX, y: event.clientY }, { scrollX: root.scrollLeft, scrollY: root.scrollTop });
    if (port && nodeElement) return begin(event, 'connect', at, { nodeId: nodeElement.dataset.nodeId, side: port.dataset.side });
    if ((waypoint || segment) && edgeElement) {
      const edge = context.project().edges.find(e => e.id === edgeElement.dataset.edgeId);
      if (!edge || edge._readOnly || selection.edgeId !== edge.id) return select([], edgeElement.dataset.edgeId);
      const handle = waypoint || segment;
      const key = waypoint ? 'waypoint' : 'segment';
      return begin(event, key, at, { edgeId: edge.id, index: Number(handle.dataset[key]), route: edgeRoute(edge), original: edge.waypoints.map(p => ({...p})) });
    }
    if (resizeHandle && frameElement && !frameElement.dataset.instanceId) {
      const frame = (context.project().frames || []).find(f => f.id === frameElement.dataset.frameId && !f.instanceId);
      if (frame) return begin(event, 'group-resize', at, { groupId: frame.id, dir: resizeHandle.dataset.resizeDir, box: { x: frame.x, y: frame.y, width: frame.width, height: frame.height } });
    }
    if (frameElement && event.target.closest('.canvas-frame-header, .canvas-frame-title, .canvas-frame-dot')) {
      const ids = (frameElement.dataset.nodeIds || '').split(',').filter(Boolean);
      if (frameElement.dataset.instanceId) return begin(event, 'instance', at, { instanceId: frameElement.dataset.instanceId });
      return begin(event, 'group', at, { groupId: frameElement.dataset.frameId, ids });
    }
    if (nodeElement) {
      const id = nodeElement.dataset.nodeId;
      const node = context.project().nodes.find((item) => item.id === id);
      if (adauga(event) && selection.nodes.has(id)) { select([...selection.nodes].filter(key => key !== id)); return; }
      if (!selection.nodes.has(id)) select([id], null, adauga(event));
      if (!node?._readOnly) {
        const ids = [...selection.nodes].filter((selectedId) => !context.project().nodes.find((item) => item.id === selectedId)?._readOnly);
        begin(event, 'nodes', at, { ids });
      }
      return;
    }
    if (edgeElement) return select([], edgeElement.dataset.edgeId);
    if (!adauga(event)) select([], null);
    begin(event, 'lasso', at, { append: adauga(event) });
  }

  // §3 gesture movement
  function pointerMove(event) {
    if (!active) return;
    const at = active.type === 'pan' ? { x: event.clientX, y: event.clientY } : point(event);
    active.last = at;
    const dx = at.x - active.start.x;
    const dy = at.y - active.start.y;
    const movement = movementDelta(dx, dy);
    if (active.type === 'pan') {
      root.scrollLeft = active.scrollX - dx;
      root.scrollTop = active.scrollY - dy;
    }
    if (active.type === 'nodes') {
      scene.querySelectorAll('.canvas-node').forEach((element) => {
        if (active.ids.includes(element.dataset.nodeId)) element.setAttribute('transform', `translate(${movement.dx} ${movement.dy})`);
      });
      const first = context.project().nodes.find(n => active.ids.includes(n.id));
      const cx = first ? first.x + movement.dx + first.width / 2 : -1;
      const cy = first ? first.y + movement.dy + first.height / 2 : -1;
      scene.querySelectorAll('.canvas-frame').forEach((element) => {
        if (element.dataset.instanceId) return;
        const frame = (context.project().frames || []).find(f => f.id === element.dataset.frameId);
        const inside = frame && cx >= frame.x && cx <= frame.x + frame.width && cy >= frame.y && cy <= frame.y + frame.height;
        element.classList.toggle('is-drop-target', Boolean(inside));
      });
    }
    if (active.type === 'group') {
      scene.querySelectorAll('.canvas-node').forEach((element) => {
        if (active.ids.includes(element.dataset.nodeId)) element.setAttribute('transform', `translate(${movement.dx} ${movement.dy})`);
      });
      scene.querySelectorAll(`.canvas-frame[data-frame-id="${CSS.escape(active.groupId)}"]`).forEach((element) => {
        if (!element.dataset.instanceId) element.setAttribute('transform', `translate(${movement.dx} ${movement.dy})`);
      });
    }
    if (active.type === 'group-resize') {
      const next = computeResizedBox(active.box, active.dir, dx, dy);
      const frameEl = scene.querySelector(`.canvas-frame[data-frame-id="${CSS.escape(active.groupId)}"]`);
      const boxEl = frameEl?.querySelector('.canvas-frame-box');
      const innerEl = frameEl?.querySelector('.canvas-frame-inner');
      if (boxEl) Object.entries(next).forEach(([k, v]) => boxEl.setAttribute(k, v));
      if (innerEl) {
        innerEl.setAttribute('x', next.x + 6);
        innerEl.setAttribute('y', next.y + 6);
        innerEl.setAttribute('width', Math.max(24, next.width - 12));
        innerEl.setAttribute('height', Math.max(24, next.height - 12));
      }
    }
    if (active.type === 'instance') {
      scene.querySelectorAll(`[data-instance-id="${CSS.escape(active.instanceId)}"]`).forEach((element) => element.setAttribute('transform', `translate(${movement.dx} ${movement.dy})`));
    }
    if (active.type === 'connect') {
      const node = context.project().nodes.find((item) => item.id === active.nodeId);
      const start = node ? portPoint(node, active.side) : active.start;
      preview.setAttribute('d', `M ${start.x} ${start.y} L ${at.x} ${at.y}`);
    }
    if (active.type === 'lasso') {
      const box = boxBetween(active.start, at);
      Object.entries(box).forEach(([key, value]) => lasso.setAttribute(key, value));
    }
    if (active.type === 'waypoint' || active.type === 'segment') {
      const selector = active.type === 'waypoint' ? `[data-waypoint="${active.index}"]` : `[data-segment="${active.index}"]`;
      const handle = scene.querySelector(`[data-edge-id="${CSS.escape(active.edgeId)}"] ${selector}`);
      handle?.setAttribute('cx', at.x);
      handle?.setAttribute('cy', at.y);
      const edge = context.project().edges.find(e => e.id === active.edgeId);
      if (edge) {
        const waypoints = draggedRoute(at);
        const previewEdge = {...edge, waypoints};
        const group = scene.querySelector(`[data-edge-id="${CSS.escape(active.edgeId)}"]`);
        group?.classList.add('is-routing');
        group?.querySelectorAll('.canvas-edge-line,.canvas-edge-hit').forEach(path => path.setAttribute('d', roundedPath(edgeRoute(previewEdge))));
      }
    }
  }

  // §4 gesture completion
  function finish(event, commit = true) {
    if (!active) return;
    try {
      const at = point(event);
      const rawDx = at.x - active.start.x;
      const rawDy = at.y - active.start.y;
      const { dx, dy } = movementDelta(rawDx, rawDy);
      if (commit && active.type === 'nodes' && (dx || dy)) cb.onMoveNodes(active.ids, dx, dy);
      if (commit && active.type === 'group' && (dx || dy)) {
        if (cb.onMoveGroup) cb.onMoveGroup(active.groupId, dx, dy);
        else if (active.ids.length) cb.onMoveNodes(active.ids, dx, dy);
      }
      if (commit && active.type === 'group-resize' && (Math.abs(rawDx) > 2 || Math.abs(rawDy) > 2)) {
        const next = computeResizedBox(active.box, active.dir, rawDx, rawDy);
        cb.onResizeGroup?.(active.groupId, next);
      }
      if (commit && active.type === 'instance' && (dx || dy)) cb.onMoveInstance(active.instanceId, dx, dy);
      if (commit && active.type === 'connect') {
        const hit = document.elementFromPoint(event.clientX, event.clientY);
        const targetPort = hit?.closest('.canvas-port');
        const targetNode = hit?.closest('.canvas-node');
        if (targetPort && targetNode) cb.onConnect({ nodeId: active.nodeId, side: active.side }, { nodeId: targetNode.dataset.nodeId, side: targetPort.dataset.side });
      }
      if (commit && active.type === 'lasso') {
        const area = boxBetween(active.start, at);
        const ids = area.width < 3 && area.height < 3 ? [] : context.project().nodes.filter((node) => intersects(nodeBounds(node), area)).map((node) => node.id);
        select(ids, null, active.append);
      }
      if (commit && (active.type === 'waypoint' || active.type === 'segment')) finishRoute(at);
    } finally {
      active = null;
      show(preview, false); preview.removeAttribute('d');
      show(lasso, false); lasso.setAttribute('width','0'); lasso.setAttribute('height','0');
      if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);
      paint();
    }
  }

  const pointerUp = (event) => finish(event, true);
  const pointerCancel = (event) => finish(event, false);
  const cancelActive = () => {
    if(active)finish({pointerId:active.pointerId,clientX:0,clientY:0},false);
    spaceDown=false;root.classList.remove('is-panning');
  };

  function finishRoute(at) {
    const edge = context.project().edges.find((item) => item.id === active.edgeId);
    if (!edge || edge._readOnly) return;
    if (Math.abs(at.x-active.start.x)+Math.abs(at.y-active.start.y)<2)return;
    cb.onEdgeRoute(edge.id, draggedRoute(at));
  }

  function draggedRoute(at) {
    const target={x:Math.max(0,Math.min(CONFIG.coordinateLimit,snap(at.x))),y:Math.max(0,Math.min(CONFIG.coordinateLimit,snap(at.y)))};
    if(active.type==='segment')return moveRouteSegment(active.route,active.index,target);
    const waypoints=active.original.map(p=>({...p}));waypoints[active.index]=target;return waypoints;
  }

  // §5 keyboard & lifecycle
  function keyDown(event) {
    if (event.target.closest('input, textarea, [contenteditable="true"], [role="dialog"]')) return;
    if(event.key==='Escape'){if(active)finish({pointerId:active.pointerId,clientX:0,clientY:0},false);select([],null);return;}
    if (event.code !== 'Space') return;
    event.preventDefault();
    spaceDown = true;
    root.classList.add('is-panning');
  }

  function keyUp(event) {
    if (event.code !== 'Space') return;
    spaceDown = false;
    root.classList.remove('is-panning');
  }

  root.addEventListener('pointerdown', pointerDown);
  root.addEventListener('pointermove', pointerMove);
  root.addEventListener('pointerup', pointerUp);
  root.addEventListener('pointercancel', pointerCancel);
  root.addEventListener('lostpointercapture', cancelActive);
  root.addEventListener('blur', cancelActive);
  root.addEventListener('keydown', keyDown);
  root.addEventListener('keyup', keyUp);
  return { setMode(next) { mode = next === 'pan' ? 'pan' : 'select'; root.classList.toggle('is-pan-mode', mode === 'pan'); }, cancel: cancelActive,
  destroy() {
    root.removeEventListener('pointerdown', pointerDown);
    root.removeEventListener('pointermove', pointerMove);
    root.removeEventListener('pointerup', pointerUp);
    root.removeEventListener('pointercancel', pointerCancel);
    root.removeEventListener('lostpointercapture', cancelActive);
    root.removeEventListener('blur', cancelActive);
    root.removeEventListener('keydown', keyDown);
    root.removeEventListener('keyup', keyUp);
  } };
}
