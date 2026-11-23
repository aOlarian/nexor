/* MAP
 * §1 constants             L8-L13
 * §2 node geometry         L14-L56
 * §3 edge geometry         L57-L138
 * §4 viewport geometry     L139-L159
 */

// §1 constants
import { CONFIG } from '../shared/config.js';

export const WORLD_SIZE = { width: 8000, height: 6000 };
export const GRID_SIZE = CONFIG.grid;

// §2 node geometry
export function snap(value, grid = GRID_SIZE) {
  return Math.round(value / grid) * grid;
}

export function nodeBounds(node) {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

export function portPoint(node, side) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  if (side === 'top') return { x: cx, y: node.y };
  if (side === 'right') return { x: node.x + node.width, y: cy };
  if (side === 'bottom') return { x: cx, y: node.y + node.height };
  return { x: node.x, y: cy };
}

export function intersects(a, b) {
  return a.x <= b.x + b.width && a.x + a.width >= b.x &&
    a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function shapePath(node) {
  const { x, y, width: w, height: h } = node;
  if (node.shape === 'circle' || node.shape === 'oval') {
    return `M ${x + w / 2} ${y} A ${w / 2} ${h / 2} 0 1 1 ${x + w / 2} ${y + h} A ${w / 2} ${h / 2} 0 1 1 ${x + w / 2} ${y}`;
  }
  if (node.shape === 'triangle') return `M ${x + w / 2} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  if (node.shape === 'diamond') return `M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z`;
  return `M ${x + 12} ${y} H ${x + w - 12} Q ${x + w} ${y} ${x + w} ${y + 12} V ${y + h - 12} Q ${x + w} ${y + h} ${x + w - 12} ${y + h} H ${x + 12} Q ${x} ${y + h} ${x} ${y + h - 12} V ${y + 12} Q ${x} ${y} ${x + 12} ${y} Z`;
}

export function cardInnerPath(node, inset = 5, cut = 14) {
  const x = node.x + inset;
  const y = node.y + inset;
  const w = Math.max(24, node.width - inset * 2);
  const h = Math.max(24, node.height - inset * 2);
  const r = Math.min(8, w / 4, h / 4);
  const c = Math.min(cut, w / 3, h / 3);
  return `M ${x + r} ${y} H ${x + w - c} L ${x + w} ${y + c} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}

// §3 edge geometry
export function sideOffset(point, side, distance = 28) {
  if (side === 'top') return { x: point.x, y: point.y - distance };
  if (side === 'right') return { x: point.x + distance, y: point.y };
  if (side === 'bottom') return { x: point.x, y: point.y + distance };
  return { x: point.x - distance, y: point.y };
}

export function orthogonalPoints(from, to, waypoints = [], fromSide = 'right', toSide = 'left') {
  const anchors = [from, sideOffset(from, fromSide), ...waypoints, sideOffset(to, toSide), to];
  const points = [anchors[0]];
  for (const target of anchors.slice(1)) {
    const current = points.at(-1);
    if (current.x !== target.x && current.y !== target.y) points.push({ x: target.x, y: current.y });
    points.push(target);
  }
  return points.filter((point, index, all) => !index || point.x !== all[index - 1].x || point.y !== all[index - 1].y);
}

export function pointsPath(points) {
  if (!points.length) return '';
  return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
}

export function roundedPath(points, radius = 40) {
  if (points.length < 3) return pointsPath(points);
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const beforeLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const afterLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const cut = Math.min(radius, beforeLength / 2, afterLength / 2);
    const before = { x: corner.x + (previous.x - corner.x) * cut / beforeLength, y: corner.y + (previous.y - corner.y) * cut / beforeLength };
    const after = { x: corner.x + (next.x - corner.x) * cut / afterLength, y: corner.y + (next.y - corner.y) * cut / afterLength };
    path += ` L ${before.x} ${before.y} Q ${corner.x} ${corner.y} ${after.x} ${after.y}`;
  }
  return `${path} L ${points.at(-1).x} ${points.at(-1).y}`;
}

export function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

export function pointAlong(points, distance) {
  let remaining = distance;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length) {
      const ratio = length ? remaining / length : 0;
      return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    }
    remaining -= length;
  }
  return points.at(-1) || { x: 0, y: 0 };
}

export function segmentWaypoint(points, index, point) {
  const a = points[index];
  const b = points[index + 1];
  if (!a || !b) return point;
  return Math.abs(a.x - b.x) < Math.abs(a.y - b.y)
    ? { x: point.x, y: (a.y + b.y) / 2 }
    : { x: (a.x + b.x) / 2, y: point.y };
}

export function moveRouteSegment(points, index, point) {
  if (index < 1 || index >= points.length - 2) return points.slice(1, -1).map(p => ({...p}));
  const moved = points.map(p => ({...p}));
  const axis = points[index].x === points[index + 1].x ? 'x' : 'y';
  moved[index][axis] = snap(point[axis]);
  moved[index + 1][axis] = snap(point[axis]);
  return moved.slice(1, -1);
}

// §4 viewport geometry
export function contentBounds(nodes = [], frames = []) {
  const items = [...nodes, ...frames];
  if (!items.length) return { x: 0, y: 0, width: 1, height: 1 };
  const left = Math.min(...items.map((item) => item.x));
  const top = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const bottom = Math.max(...items.map((item) => item.y + item.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function fitView(bounds, viewport, padding = 64) {
  const usableWidth = Math.max(1, viewport.width - padding * 2);
  const usableHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, usableWidth / bounds.width, usableHeight / bounds.height));
  return {
    x: Math.max(0, bounds.x - (viewport.width / zoom - bounds.width) / 2),
    y: Math.max(0, bounds.y - (viewport.height / zoom - bounds.height) / 2),
    zoom,
  };
}
