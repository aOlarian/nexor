/* MAP §1 gesture harness §2 regressions */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bindGestures} from '../src/canvas/gestures.js';
import {moveRouteSegment} from '../src/canvas/geometry.js';

// §1 gesture harness: exercise the real event handlers with a minimal DOM adapter.
function element(matches={}) {
  return {dataset:{},style:{},attrs:{},classList:{add(){},remove(){}},
    closest(selector){return matches[selector]||null;},
    setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
}
function harness() {
  const events={},preview=element(),lasso=element(),selection={nodes:new Set(),edgeId:null},calls=[];
  let captured=false;
  const root={...element(),focus(){},querySelector:s=>s.includes('preview')?preview:lasso,
    addEventListener:(s,f)=>events[s]=f,removeEventListener(){},
    setPointerCapture(){captured=true;},hasPointerCapture:()=>captured,releasePointerCapture(){captured=false;}};
  const project={nodes:[{id:'a',x:100,y:100,width:120,height:80},{id:'b',x:500,y:400,width:120,height:80}],
    edges:['first','second'].map(id=>({id,from:{nodeId:'a',side:'right'},to:{nodeId:'b',side:'left'},waypoints:[]})),frames:[]};
  const select=(ids,id=null)=>{selection.nodes=new Set(ids);selection.edgeId=id;};
  bindGestures({root,scene:{querySelector:()=>null,querySelectorAll:()=>[]},selection,select,paint(){},
    point:e=>({x:e.clientX,y:e.clientY}),project:()=>project,
    callbacks:{onConnect:(...args)=>calls.push(['connect',...args]),onEdgeRoute:(...args)=>calls.push(['route',...args])}});
  return {preview,lasso,selection,calls,project,captured:()=>captured,
    fire:(name,target=element(),x=0,y=0,extra={})=>events[name]({target,clientX:x,clientY:y,pointerId:1,button:0,...extra})};
}
function portTarget(id) {
  const node=element(),port=element();node.dataset.nodeId=id;port.dataset.side='right';
  return element({'.canvas-node':node,'.canvas-port':port});
}

// §2 regressions
test('connection preview clears after successful, invalid and cancelled drops',()=>{
  for(const mode of ['valid','invalid','cancel','escape','blur','lostpointercapture']) {
    const h=harness();globalThis.document={elementFromPoint:()=>mode==='valid'?portTarget('b'):null};
    h.fire('pointerdown',portTarget('a'),220,140);h.fire('pointermove',element(),400,300);
    assert.ok(h.preview.attrs.d);assert.equal(h.preview.style.display,'');
    if(mode==='escape')h.fire('keydown',element(),0,0,{key:'Escape'});
    else if(mode==='blur'||mode==='lostpointercapture')h.fire(mode);
    else h.fire(mode==='cancel'?'pointercancel':'pointerup',element(),400,300);
    assert.equal(h.preview.style.display,'none');assert.equal(h.preview.attrs.d,undefined);
    assert.equal(h.captured(),false);assert.equal(h.calls.length,mode==='valid'?1:0);
  }
});
test('blank click clears node and edge selection and the lasso',()=>{
  const h=harness();h.selection.nodes.add('a');h.selection.edgeId='first';
  h.fire('pointerdown',element(),800,800);h.fire('pointerup',element(),800,800);
  assert.equal(h.selection.nodes.size,0);assert.equal(h.selection.edgeId,null);
  assert.equal(h.lasso.style.display,'none');assert.equal(h.lasso.attrs.width,'0');
});
test('route gesture commits only the selected edge and ignores stale handles',()=>{
  const h=harness(),edge=element(),handle=element();globalThis.CSS={escape:s=>s};
  edge.dataset.edgeId='second';handle.dataset.segment='2';
  const target=element({'.canvas-edge':edge,'.canvas-segment-handle':handle});
  h.selection.edgeId='first';h.fire('pointerdown',target,300,140);h.fire('pointerup',target,340,140);
  assert.equal(h.calls.length,0);assert.equal(h.selection.edgeId,'second');
  const before=structuredClone(h.project.edges);
  h.fire('pointerdown',target,300,140);h.fire('pointermove',target,340,180);h.fire('pointerup',target,340,180);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'second');
  assert.deepEqual(h.project.edges,before);
});
test('dragging a middle segment preserves distant vertices and original shared route',()=>{
  const route=[{x:100,y:100},{x:128,y:100},{x:250,y:100},{x:250,y:400},{x:472,y:400},{x:500,y:400}];
  const before=structuredClone(route),moved=moveRouteSegment(route,2,{x:330,y:280});
  assert.deepEqual(moved,[{x:128,y:100},{x:340,y:100},{x:340,y:400},{x:472,y:400}]);
  assert.deepEqual(route,before);
});
test('dragging group resize handle emits resized bounds',()=>{
  const h=harness();
  h.project.frames=[{id:'g1',x:100,y:100,width:300,height:200,nodeIds:['a']}];
  const frame=element(),handle=element();
  frame.dataset.frameId='g1';handle.dataset.resizeDir='se';
  let resized=null;
  const events={},root={...element(),focus(){},querySelector:()=>element(),addEventListener:(s,f)=>events[s]=f,removeEventListener(){},setPointerCapture(){},hasPointerCapture:()=>false,releasePointerCapture(){}};
  bindGestures({root,scene:{querySelector:()=>null,querySelectorAll:()=>[]},selection:{nodes:new Set(),edgeId:null},select(){},paint(){},point:e=>({x:e.clientX,y:e.clientY}),project:()=>h.project,callbacks:{onResizeGroup:(id,box)=>{resized={id,box};}}});
  const target=element({'.canvas-frame':frame,'[data-resize-dir]':handle});
  events.pointerdown({target,clientX:400,clientY:300,pointerId:1,button:0});
  events.pointermove({target,clientX:520,clientY:380,pointerId:1,button:0});
  events.pointerup({target,clientX:520,clientY:380,pointerId:1,button:0});
  assert.deepEqual(resized,{id:'g1',box:{x:100,y:100,width:420,height:280}});
});
