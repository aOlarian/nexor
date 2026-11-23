/* MAP
 * §1 imports & fixtures      L8-L16
 * §2 node tests              L18-L39
 * §3 route tests             L41-L74
 * §4 viewport tests          L76-L101
 */

// §1 imports & fixtures
import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBounds, fitView, intersects, orthogonalPoints, pathLength, pointAlong, portPoint, segmentWaypoint, snap } from './geometry.js';

const node = { x: 100, y: 200, width: 120, height: 80 };

// §2 node tests
test('ports are centered on every side', () => {
  assert.deepEqual(portPoint(node, 'top'), { x: 160, y: 200 });
  assert.deepEqual(portPoint(node, 'right'), { x: 220, y: 240 });
  assert.deepEqual(portPoint(node, 'bottom'), { x: 160, y: 280 });
  assert.deepEqual(portPoint(node, 'left'), { x: 100, y: 240 });
});

test('snap rounds symmetrically and intersection includes touching edges', () => {
  assert.equal(snap(9), 0);
  assert.equal(snap(11), 20);
  assert.equal(snap(-31), -40);
  assert.equal(intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 5, width: 3, height: 3 }), true);
});

// §3 route tests
test('path distance and interpolation follow orthogonal segments', () => {
  const points = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }];
  assert.equal(pathLength(points), 70);
  assert.deepEqual(pointAlong(points, 55), { x: 40, y: 15 });
});

test('segment handles constrain inserted waypoint to segment axis', () => {
  const horizontal = [{ x: 0, y: 10 }, { x: 100, y: 10 }];
  const vertical = [{ x: 20, y: 0 }, { x: 20, y: 100 }];
  assert.deepEqual(segmentWaypoint(horizontal, 0, { x: 35, y: 70 }), { x: 50, y: 70 });
  assert.deepEqual(segmentWaypoint(vertical, 0, { x: 70, y: 35 }), { x: 70, y: 50 });
});

test('all side pairs leave source outward and arrive target from outside', () => {
  const sides = ['top', 'right', 'bottom', 'left'];
  const outward = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
  for (const fromSide of sides) for (const toSide of sides) {
    const points = orthogonalPoints({ x: 100, y: 100 }, { x: 400, y: 300 }, [], fromSide, toSide);
    assert.deepEqual([Math.sign(points[1].x - points[0].x), Math.sign(points[1].y - points[0].y)], outward[fromSide]);
    const last = points.length - 1;
    assert.deepEqual([Math.sign(points[last - 1].x - points[last].x), Math.sign(points[last - 1].y - points[last].y)], outward[toSide]);
    points.slice(1).forEach((point, index) => assert.ok(point.x === points[index].x || point.y === points[index].y));
  }
});

test('manual waypoints remain exact and every segment stays orthogonal', () => {
  const waypoint = { x: 245, y: 167 };
  const points = orthogonalPoints({ x: 20, y: 40 }, { x: 500, y: 360 }, [waypoint], 'bottom', 'right');
  assert.ok(points.some((point) => point.x === waypoint.x && point.y === waypoint.y));
  points.slice(1).forEach((point, index) => assert.ok(point.x === points[index].x || point.y === points[index].y));
});

// §4 viewport tests
test('content bounds includes nodes and instance frames', () => {
  const bounds = contentBounds(
    [{ x: 50, y: 80, width: 100, height: 40 }],
    [{ x: 10, y: 30, width: 300, height: 200 }],
  );
  assert.deepEqual(bounds, { x: 10, y: 30, width: 300, height: 200 });
});

test('fit view centers content and respects zoom limits', () => {
  assert.deepEqual(fitView({ x: 100, y: 100, width: 400, height: 200 }, { width: 800, height: 600 }, 0), { x: 100, y: 50, zoom: 2 });
  assert.equal(fitView({ x: 0, y: 0, width: 1, height: 1 }, { width: 800, height: 600 }).zoom, 2.5);
  assert.equal(fitView({ x: 0, y: 0, width: 10000, height: 10000 }, { width: 200, height: 200 }).zoom, 0.25);
});
