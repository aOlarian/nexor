/* MAP
 * §1 imports & helpers L9-L36
 * §2 edge rendering L37-L68
 * §3 frame rendering L69-L94
 * §4 node rendering L95-L176
 * §5 scene rendering L177-L202
 */

// §1 imports & helpers
import { iconSVG, escapeHTML } from '../shared/icons.js';
import { blendColor, foreground } from '../shared/colors.js';
import { subtitleText, wrapText } from '../projects.js';
import { cardInnerPath, orthogonalPoints, pathLength, pointAlong, portPoint, roundedPath, shapePath } from './geometry.js';

const NS = 'http://www.w3.org/2000/svg';
const SIDES = ['top', 'right', 'bottom', 'left'];
const RESIZE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function svg(markup) {
  const template = document.createElementNS(NS, 'svg');
  template.innerHTML = markup.trim();
  return template.firstElementChild;
}

function arrowMarkup(points, color) {
  const total = pathLength(points);
  const distance = Math.max(0, total - Math.min(8, total / 3));
  const point = pointAlong(points, distance);
  const before = pointAlong(points, Math.max(0, distance - 2));
  const angle = Math.atan2(point.y - before.y, point.x - before.x) * 180 / Math.PI;
  return `<path class="canvas-arrow canvas-arrow-target" d="M -6 -4 L 2 0 L -6 4" transform="translate(${point.x} ${point.y}) rotate(${angle})" stroke="${escapeHTML(color)}"/>`;
}

// §2 edge rendering
function renderEdge(edge, nodes, selected) {
  const fromNode = nodes.get(edge.from.nodeId);
  const toNode = nodes.get(edge.to.nodeId);
  if (!fromNode || !toNode) return null;
  const points = orthogonalPoints(portPoint(fromNode, edge.from.side), portPoint(toNode, edge.to.side), edge.waypoints, edge.from.side, edge.to.side);
  const path = roundedPath(points);
  const color = edge.color || 'var(--text-2)';
  const instanceId = edge._instanceId || fromNode._instanceId || toNode._instanceId || '';
  const group = svg(`<g class="canvas-edge${selected ? ' is-selected' : ''}" data-edge-id="${escapeHTML(edge.id)}" data-instance-id="${escapeHTML(instanceId)}">
    <path class="canvas-edge-hit" d="${path}"/>
    <path class="canvas-edge-line" d="${path}" stroke="${escapeHTML(color)}"/>
    ${arrowMarkup(points, color)}
  </g>`);
  if (edge.label) {
    const center = pointAlong(points, pathLength(points) / 2);
    const label = edge.label.length > 22 ? `${edge.label.slice(0, 21)}…` : edge.label;
    const pillW = Math.max(88, label.length * 7.6 + 26);
    group.insertAdjacentHTML('beforeend', `<g class="canvas-edge-label" transform="translate(${center.x} ${center.y})"><rect x="${-pillW / 2}" y="-14" width="${pillW}" height="28" rx="14"/><text text-anchor="middle" y="5">${escapeHTML(label)}<title>${escapeHTML(edge.label)}</title></text></g>`);
  }
  if (!edge._readOnly && selected) {
    edge.waypoints.forEach((point, index) => {
      group.insertAdjacentHTML('beforeend', `<circle class="canvas-waypoint" data-waypoint="${index}" cx="${point.x}" cy="${point.y}" r="7"/>`);
    });
    points.slice(0, -1).forEach((a, index) => {
      const b = points[index + 1];
      if(index===0 || index>=points.length-2 || Math.hypot(b.x-a.x,b.y-a.y)<12)return;
      group.insertAdjacentHTML('beforeend', `<circle class="canvas-segment-handle" data-segment="${index}" cx="${(a.x + b.x) / 2}" cy="${(a.y + b.y) / 2}" r="8"/>`);
    });
  }
  return group;
}

// §3 frame rendering
function renderFrame(frame) {
  const instanceId = frame.instanceId || '';
  const nodeIds = (frame.nodeIds || []).join(',');
  const color = escapeHTML(frame.color || '#22b8cf');
  const title = frame.title || (instanceId ? 'Ansamblu' : 'Grup');
  const headerW = Math.min(Math.max(150, title.length * 9.6 + (instanceId ? 76 : 44)), Math.max(150, frame.width - 24));
  const { x, y, width: w, height: h } = frame;
  const handles = instanceId ? '' : RESIZE_DIRS.map(dir => {
    const hx = dir.includes('w') ? x : dir.includes('e') ? x + w : x + w / 2;
    const hy = dir.includes('n') ? y : dir.includes('s') ? y + h : y + h / 2;
    return `<rect class="canvas-frame-resize canvas-frame-resize--${dir}" data-resize-dir="${dir}" x="${hx - 6}" y="${hy - 6}" width="12" height="12" rx="3"/>`;
  }).join('');
  return svg(`<g class="canvas-frame" data-instance-id="${escapeHTML(instanceId)}" data-frame-id="${escapeHTML(frame.id)}" data-node-ids="${escapeHTML(nodeIds)}" style="--frame-color:${color};--frame-opacity:${frame.opacity ?? 1}">
    <rect class="canvas-frame-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="22"/>
    <rect class="canvas-frame-inner" x="${x + 6}" y="${y + 6}" width="${Math.max(24, w - 12)}" height="${Math.max(24, h - 12)}" rx="17"/>
    <rect class="canvas-frame-header" x="${x + 14}" y="${y - 18}" width="${headerW}" height="36" rx="18"/>
    <circle class="canvas-frame-dot" cx="${x + 30}" cy="${y}" r="5"/>
    <text class="canvas-frame-title" x="${x + 44}" y="${y + 6}">${escapeHTML(title)}</text>
    ${instanceId ? `<g class="canvas-source-open" data-open-source="${escapeHTML(instanceId)}" transform="translate(${x + 14 + headerW - 34} ${y - 13})"><rect width="26" height="26" rx="13"/><text x="13" y="18" text-anchor="middle">↗</text></g>` : ''}
    ${handles}
  </g>`);
}

// §4 node rendering
function renderNode(node, selected, backdrop, autoSize = false) {
  if (['square', 'wide', 'tall'].includes(node.shape)) return renderCard(node, selected, autoSize);
  const color = node.color || '#c96442';
  const readOnly = node._readOnly ? ' is-readonly' : '';
  const title = node.title || 'Fără titlu';
  const titleWidth = Math.max(24, node.width - 68);
  const titleChars = Math.max(4, Math.floor(titleWidth / 8.2));
  const shortTitle = title.length > titleChars ? `${title.slice(0, Math.max(1, titleChars - 1))}…` : title;
  const subRaw = subtitleText(node);
  const subLines = subRaw ? wrapText(subRaw, Math.max(10, Math.floor((node.width - 32) / 6.8)), autoSize ? 16 : 2) : [];
  const iconSize = Math.max(26, Math.min(44, node.width * .26, node.height * .3));
  const iconY = node.y + 50;
  const subStartY = iconY + iconSize + 18;
  const group = svg(`<g class="canvas-node${selected ? ' is-selected' : ''}${readOnly}" data-node-id="${escapeHTML(node.id)}" data-instance-id="${escapeHTML(node._instanceId || '')}" style="--node-color:${escapeHTML(color)};--on-node:${foreground(blendColor(color,node.opacity??1,backdrop))}">
    <path class="canvas-node-shape" d="${shapePath(node)}" fill="${escapeHTML(color)}" fill-opacity="${node.opacity??1}"/>
    <path class="canvas-node-outline" d="${shapePath(node)}"/>
    <rect class="canvas-node-header" x="${node.x + 7}" y="${node.y + 7}" width="${Math.max(1, node.width - 14)}" height="${Math.min(42, node.height - 14)}" rx="9"/>
    <text class="canvas-node-title" x="${node.x + 15}" y="${node.y + 33}">${escapeHTML(shortTitle)}<title>${escapeHTML(title)}</title></text>
    <g class="canvas-node-body-icon" transform="translate(${node.x + node.width / 2 - iconSize / 2} ${iconY})">${iconSVG(node.icon || 'box', iconSize)}</g>
    ${subLines.length ? `<g class="canvas-node-description-trigger" data-node-desc="${escapeHTML(node.id)}"><rect class="canvas-desc-hit" x="${node.x + 10}" y="${subStartY - 13}" width="${Math.max(20, node.width - 20)}" height="${subLines.length * 16 + 8}" rx="6"/><text class="canvas-card-caption canvas-shape-caption" x="${node.x + node.width / 2}" y="${subStartY}" text-anchor="middle">${subLines.map((line, i) => `<tspan x="${node.x + node.width / 2}" dy="${i ? 15 : 0}">${escapeHTML(line)}</tspan>`).join('')}</text></g>` : ''}
    ${node.description || node.subtitle ? `<circle class="canvas-description-dot" data-node-desc="${escapeHTML(node.id)}" cx="${node.x + 16}" cy="${node.y + node.height - 16}" r="5"></circle>` : ''}
    <g class="canvas-node-menu" data-node-menu="${escapeHTML(node.id)}" transform="translate(${node.x + node.width - 34} ${node.y + 11})"><rect width="24" height="24" rx="7"/><text x="12" y="16" text-anchor="middle">•••</text></g>
    ${selected ? `<g class="canvas-node-check" transform="translate(${node.x - 9} ${node.y - 9})"><rect width="20" height="20" rx="6"/><path d="M5 10.5 8.5 14 15 6.5"/></g>` : ''}
  </g>`);
  SIDES.forEach((side) => {
    const point = portPoint(node, side);
    group.insertAdjacentHTML('beforeend', `<circle class="canvas-port" data-side="${side}" cx="${point.x}" cy="${point.y}" r="7"/>`);
  });
  return group;
}

// Cardurile moderne cu dublu contur, titlu vizibil și descriere scurtă sub titlu.
function renderCard(node, selected, autoSize = false) {
  const { x, y, width, height } = node;
  const color = escapeHTML(node.color || '#3f7fb0');
  const compact = width < 190;
  const tiny = width < 115 || height < 92 && compact;
  const iconX = tiny ? x + width / 2 - 21 : x + 16;
  const iconY = tiny ? y + height / 2 - 21 : compact ? y + 14 : y + 18;
  const textX = compact ? x + 16 : x + 68;
  const titleY = compact ? y + 72 : y + 34;
  const available = Math.max(36, width - (compact ? 32 : 96));
  const titleChars = Math.max(5, Math.floor(available / 8.2));
  const title = node.title || 'Fără titlu';
  const titleLines = wrapText(title, titleChars, 2);
  const subRaw = subtitleText(node);
  const maxSubLines = autoSize ? 18 : Math.max(1, Math.floor((height - (titleY - y) - titleLines.length * 18 - 10) / 16));
  const subChars = Math.max(8, Math.floor((width - (compact ? 30 : 84)) / 6.8));
  const subLines = subRaw ? wrapText(subRaw, subChars, maxSubLines) : ['Adaugă descriere…'];
  const subY = titleY + (titleLines.length - 1) * 19 + 19;
  const hasDesc = Boolean(node.subtitle?.trim() || node.description?.trim());
  const group = svg(`<g class="canvas-node canvas-card${selected ? ' is-selected' : ''}${node._readOnly ? ' is-readonly' : ''}" data-node-id="${escapeHTML(node.id)}" data-instance-id="${escapeHTML(node._instanceId || '')}" style="--node-color:${color};--on-node:${foreground(node.color || '#3f7fb0')};--node-opacity:${node.opacity ?? 1}">
    <path class="canvas-node-shape canvas-card-surface" d="${shapePath(node)}"/>
    <path class="canvas-node-outline" d="${shapePath(node)}"/>
    <path class="canvas-card-inner-frame" d="${cardInnerPath(node)}"/>
    <path class="canvas-node-header canvas-card-drag" d="${shapePath(node)}"/>
    <g class="canvas-card-icon" transform="translate(${iconX} ${iconY})"><rect width="42" height="42" rx="12"/><g transform="translate(9 9)">${iconSVG(node.icon || 'box', 24)}</g></g>
    ${!tiny ? `<text class="canvas-node-title" x="${textX}" y="${titleY}">${titleLines.map((line, i) => `<tspan x="${textX}" dy="${i ? 19 : 0}">${escapeHTML(line)}</tspan>`).join('')}<title>${escapeHTML(title)}</title></text>` : ''}
    ${!tiny && subY < y + height - 8 ? `<g class="canvas-node-description-trigger${hasDesc ? ' has-content' : ' is-placeholder'}" data-node-desc="${escapeHTML(node.id)}"><rect class="canvas-desc-hit" x="${textX - 4}" y="${subY - 13}" width="${Math.max(24, width - (textX - x) - 12)}" height="${Math.min(y + height - subY + 8, subLines.length * 16 + 8)}" rx="6"/><text class="canvas-card-caption" x="${textX}" y="${subY}">${subLines.map((line, i) => `<tspan x="${textX}" dy="${i ? 16 : 0}">${escapeHTML(line)}</tspan>`).join('')}</text></g>` : ''}
    <g class="canvas-node-menu" data-node-menu="${escapeHTML(node.id)}" transform="translate(${x + width - 34} ${y + 10})"><rect width="24" height="24" rx="8"/><text x="12" y="16" text-anchor="middle">•••</text></g>
    ${selected ? `<g class="canvas-node-check" transform="translate(${x - 9} ${y - 9})"><rect width="20" height="20" rx="7"/><path d="M5 10.5 8.5 14 15 6.5"/></g>` : ''}
  </g>`);
  SIDES.forEach(side => {
    const point = portPoint(node, side);
    group.insertAdjacentHTML('beforeend', `<circle class="canvas-port" data-side="${side}" cx="${point.x}" cy="${point.y}" r="6.5"/>`);
  });
  return group;
}

// §5 scene rendering
export function renderScene(layer, project, selection) {
  const fragment = document.createDocumentFragment();
  const nodeMap = new Map((project.nodes || []).map((node) => [node.id, node]));
  const edgeLayer = svg('<g class="canvas-edges"></g>');
  const frameLayer = svg('<g class="canvas-frames"></g>');
  const nodeLayer = svg('<g class="canvas-nodes"></g>');
  const orderedEdges = [...(project.edges || [])].sort((a,b) => Number(a.id === selection.edgeId) - Number(b.id === selection.edgeId));
  for (const edge of orderedEdges) {
    const element = renderEdge(edge, nodeMap, selection.edgeId === edge.id);
    if (element) edgeLayer.append(element);
  }
  for (const frame of project.frames || []) frameLayer.append(renderFrame(frame));
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#eef2f6';
  const autoSize = Boolean(project.autoSizeBySubtitle);
  for (const node of project.nodes || []) {
    const frame = (project.frames || []).find(f => f.nodeIds?.includes(node.id));
    const backdrop = frame ? blendColor(frame.color || '#334155', frame.opacity ?? 1, background) : background;
    nodeLayer.append(renderNode(node, selection.nodes.has(node.id), backdrop, autoSize));
  }
  fragment.append(frameLayer, edgeLayer, nodeLayer);
  const labelLayer = svg('<g class="canvas-edge-labels"></g>');
  for (const label of edgeLayer.querySelectorAll('.canvas-edge-label')) {
    labelLayer.append(label);
  }
  fragment.append(labelLayer);
  layer.replaceChildren(fragment);
}
