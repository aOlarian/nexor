/* MAP §1 setup §2 model and graph invariants §3 exchange and undo */
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLibrary,newProject,newNode,validateLibrary,parseLibrary} from '../src/model.js';
import {cloneProject,joinProjects,projectView,moveNodes,removeNodes,duplicateNodes} from '../src/projects.js';
import {exportProject,prepareImport} from '../src/exchange.js';
import {createState} from '../src/state.js';
// §1 setup
const simple=()=>{const p=newProject('Test');p.nodes=[newNode(),newNode('circle',600,200)];p.edges=[{id:'edge',from:{nodeId:p.nodes[0].id,side:'right'},to:{nodeId:p.nodes[1].id,side:'left'},label:'',color:'#77818c',waypoints:[{x:450,y:200}]}];return {schemaVersion:1,activeProjectId:p.id,theme:'light',sidebarWidth:270,projects:[p]};};
// §2 model and graph invariants
test('new library has coherent example and survives structural validation',()=>{const lib=validateLibrary(initialLibrary());assert.equal(lib.projects[0].nodes.length,5);assert.equal(lib.projects[0].edges.length,4);});
test('rejects nonfinite positions, duplicate IDs and dangling edges',()=>{for(const corrupt of [p=>p.nodes[0].x=Infinity,p=>p.nodes.push(p.nodes[0]),p=>p.edges[0].to.nodeId='missing']){const l=simple();corrupt(l.projects[0]);assert.throws(()=>validateLibrary(l));}});
test('clone remaps node, group and edge IDs without changing topology',()=>{const p=simple().projects[0];p.groups=[{id:'group',title:'G',color:'#627382'}];p.nodes.forEach(n=>n.groupId='group');const c=cloneProject(p);assert.notEqual(c.id,p.id);assert.equal(c.edges[0].from.nodeId,c.nodes[0].id);assert.notEqual(c.nodes[0].groupId,'group');assert.deepEqual(c.edges[0].waypoints,p.edges[0].waypoints);});
test('group movement translates only fully internal manual routes',()=>{const p=simple().projects[0];moveNodes(p,p.nodes.map(n=>n.id),40,60);assert.deepEqual(p.edges[0].waypoints,[{x:490,y:260}]);moveNodes(p,[p.nodes[0].id],20,0);assert.deepEqual(p.edges[0].waypoints,[{x:490,y:260}]);});
test('duplicate selection copies internal topology and drops group membership',()=>{const p=simple().projects[0];const ids=duplicateNodes(p,p.nodes.map(n=>n.id));assert.equal(p.nodes.length,4);assert.equal(p.edges.length,2);assert.ok(ids.includes(p.edges[1].from.nodeId));});
test('dynamic join resolves source changes without moving source geometry',()=>{const l=simple(),p2=newProject('Two');p2.nodes=[newNode()];l.projects.push(p2);const joined=joinProjects(l,l.projects.map(p=>p.id),'Joined','dynamic');l.projects.push(joined);const before=l.projects[0].nodes[0].x;l.projects[0].nodes[0].title='Renamed';const view=projectView(l,joined);assert.equal(view.nodes[0].title,'Renamed');assert.equal(l.projects[0].nodes[0].x,before);assert.equal(view.frames.length,2);assert.equal(view.nodes[0]._readOnly,true);assert.doesNotThrow(()=>validateLibrary(l));});
test('static join retains source relative geometry and links',()=>{const l=simple();l.projects.push(cloneProject(l.projects[0]));const joined=joinProjects(l,l.projects.map(p=>p.id),'Copy','copy');assert.equal(joined.nodes.length,4);assert.equal(joined.edges.length,2);assert.equal(joined.nodes[1].x-joined.nodes[0].x,360);assert.equal(joined.instances.length,0);});
test('source deletion retains unresolved external edge visibly',()=>{const l=simple(),source=l.projects[0],other=newProject('Other');other.nodes=[newNode()];l.projects.push(other);const j=joinProjects(l,l.projects.map(p=>p.id),'Join','dynamic');const from=j.instances[0].id+'::'+source.nodes[0].id,to=j.instances[1].id+'::'+other.nodes[0].id;j.edges.push({id:'external',from:{nodeId:from,side:'right'},to:{nodeId:to,side:'left'},label:'',color:'#77818c',waypoints:[]});l.projects.push(j);removeNodes(l,source,[source.nodes[0].id]);assert.equal(projectView(l,j).broken.length,1);assert.equal(j.edges[0].unresolved,true);assert.doesNotThrow(()=>validateLibrary(l));});
// §3 exchange and undo
test('exchange changes title and route, rejects stale revision and invalid graph',()=>{const l=simple(),p=l.projects[0],raw=JSON.parse(exportProject(l,p));raw.project.title='Imported';raw.project.edges[0].waypoints=[{x:300,y:600}];const result=prepareImport(JSON.stringify(raw),l,p.id);assert.equal(result.library.projects[0].title,'Imported');assert.equal(l.projects[0].title,'Test');raw.project.revision=7;assert.throws(()=>prepareImport(JSON.stringify(raw),l,p.id),/după export/);raw.project.revision=0;raw.project.edges[0].from.nodeId='absent';assert.throws(()=>prepareImport(JSON.stringify(raw),l,p.id),/inexistent/);});
test('undo/redo restores full graph transaction and failed mutation rolls back',()=>{const l=simple(),s=createState(l);s.change((l,p)=>{p.nodes=[];p.edges=[];});assert.equal(s.project().nodes.length,0);s.undo();assert.equal(s.project().nodes.length,2);s.redo();assert.equal(s.project().nodes.length,0);assert.throws(()=>s.change((l,p)=>{p.title='Bad';throw Error('stop');}));assert.equal(s.project().title,'Test');});
test('invalid UI mutation is rolled back before it can be saved',()=>{const s=createState(simple());assert.throws(()=>s.change((l,p)=>p.nodes[0].x=Infinity));assert.equal(s.project().nodes[0].x,240);assert.equal(s.undoStack.length,0);});
test('undo revisions remain monotonic so old JSON cannot overwrite new state',()=>{const s=createState(simple());s.change((l,p)=>p.title='First');const rev=s.project().revision;s.undo();assert.ok(s.project().revision>rev);s.change((l,p)=>p.title='Second');assert.ok(s.project().revision>rev+1);});
test('JSON from another library creates project without deleting current one',()=>{const l=simple(),other=simple();const next=prepareImport(exportProject(other,other.projects[0]),l,l.activeProjectId);assert.equal(next.library.projects.length,2);assert.equal(next.library.activeProjectId,other.activeProjectId);});
test('malformed JSON and schema reject rather than reset library',()=>{assert.throws(()=>parseLibrary('{'));assert.throws(()=>parseLibrary('{"schemaVersion":2,"projects":[]}'));});
test('autoSizeBySubtitle dynamically expands node height in projection and reverts on uncheck',()=>{
 const l=simple(),p=l.projects[0];
 p.nodes[0].subtitle='• Pasul 1: verificare intrare\n• Pasul 2: validare semnatura\n• Pasul 3: procesare pachet\n• Pasul 4: raspuns catre client\n• Pasul 5: arhivare log';
 const baseH=p.nodes[0].height;
 assert.equal(projectView(l,p).nodes[0].height,baseH);
 p.autoSizeBySubtitle=true;
 const expandedH=projectView(l,p).nodes[0].height;
 assert.ok(expandedH>baseH);
 p.autoSizeBySubtitle=false;
 assert.equal(projectView(l,p).nodes[0].height,baseH);
});
test('resizing group and dragging nodes in or out updates group membership automatically',()=>{
 const l=simple(),p=l.projects[0];
 p.groups.push({id:'g1',title:'Grup A',color:'#22b8cf',opacity:1,x:80,y:80,width:280,height:240});
 p.groups.push({id:'g2',title:'Grup B',color:'#756593',opacity:1,x:500,y:80,width:280,height:240});
 moveNodes(p,[p.nodes[0].id],-80,0);
 assert.equal(p.nodes[0].groupId,'g1');
 moveNodes(p,[p.nodes[0].id],420,0);
 assert.equal(p.nodes[0].groupId,'g2');
 moveNodes(p,[p.nodes[0].id],0,500);
 assert.equal(p.nodes[0].groupId,undefined);
});
