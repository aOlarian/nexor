/* MAP
 * §1 fixtures L11-L13
 * §2 change contract L14-L58
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLibrary,newNode} from '../src/model.js';
import {prepareSyncChange,SyncConflict,createSyncController} from '../src/sync.js';
import {createState} from '../src/state.js';

// §1 fixtures
function envelope(library,operations,overrides={}){const project=library.projects[0];return JSON.stringify({schemaVersion:1,changeId:'change-1',author:'Nex',projectId:project.id,baseRevision:project.revision,operations,...overrides});}

// §2 change contract
test('sync bundle adds connected nodes transactionally and records its id',()=>{
 const library=initialLibrary(),project=library.projects[0],node=newNode('wide',900,400);node.id='sync-node';node.title='Modul sincronizat';
 const edge={id:'sync-edge',from:{nodeId:project.nodes[0].id,side:'right'},to:{nodeId:node.id,side:'left'},label:'Flux nou',color:'#77818c',waypoints:[]};
 const result=prepareSyncChange(library,envelope(library,[{type:'addNode',node},{type:'addEdge',edge}]));
 assert.equal(result.operations,2);assert.equal(result.library.projects[0].nodes.at(-1).title,'Modul sincronizat');assert.equal(result.library.projects[0].edges.at(-1).to.nodeId,'sync-node');assert.deepEqual(result.library.syncHistory,['change-1']);assert.equal(library.projects[0].nodes.some(item=>item.id==='sync-node'),false);
});

test('stale revision is retained as a conflict instead of overwriting work',()=>{
 const library=initialLibrary(),raw=envelope(library,[{type:'updateProject',changes:{title:'Alt titlu'}}],{baseRevision:9});
 assert.throws(()=>prepareSyncChange(library,raw),SyncConflict);assert.notEqual(library.projects[0].title,'Alt titlu');
});

test('duplicate change is idempotent',()=>{
 const library=initialLibrary();library.syncHistory=['change-1'];const result=prepareSyncChange(library,envelope(library,[{type:'updateProject',changes:{title:'Nu aplica'}}]));
 assert.equal(result.duplicate,true);assert.notEqual(result.library.projects[0].title,'Nu aplica');
});

test('invalid graph and unsupported fields reject the complete bundle',()=>{
 const library=initialLibrary(),badEdge={id:'bad-edge',from:{nodeId:'missing',side:'right'},to:{nodeId:'also-missing',side:'left'},label:'',color:'#77818c',waypoints:[]};
 assert.throws(()=>prepareSyncChange(library,envelope(library,[{type:'addEdge',edge:badEdge}])));
 assert.throws(()=>prepareSyncChange(library,envelope(library,[{type:'updateProject',changes:{revision:999}}])));
 assert.equal(library.projects[0].edges.some(edge=>edge.id==='bad-edge'),false);
});

test('descriptions from sync are sanitized before entering the library',()=>{
 const library=initialLibrary(),node=library.projects[0].nodes[0];const result=prepareSyncChange(library,envelope(library,[{type:'updateNode',nodeId:node.id,changes:{description:'<p>Sigur</p><script>alert(1)</script>'}}]));
 const description=result.library.projects[0].nodes[0].description;assert.match(description,/Sigur/);assert.doesNotMatch(description,/<script\b/i);
});

test('controller applies, saves and acknowledges a pending bundle',async()=>{
 const library=initialLibrary(),state=createState(library),project=library.projects[0],statuses=[],completed=[];state.save={schedule:()=>{},flush:async()=>{}};
 const raw=envelope(library,[{type:'updateProject',changes:{title:'Actualizat de Nex'}}]);
 const transport={syncAvailable:true,listSyncChanges:async()=>[{name:'change.json',content:raw}],completeSyncChange:async(...args)=>completed.push(args)};
 const controller=createSyncController(transport,state,(...args)=>statuses.push(args));await controller.run(true);
 assert.equal(state.project().title,'Actualizat de Nex');assert.deepEqual(completed,[['change.json','applied','']]);assert.equal(statuses.at(-1)[0],'applied');
});

test('manual conflict requires a choice and can rebase safely',async()=>{
 const library=initialLibrary(),state=createState(library),project=library.projects[0],completed=[];state.save={schedule:()=>{},flush:async()=>{}};project.revision=3;
 const raw=envelope(library,[{type:'updateProject',changes:{description:'<p>Completare Nex</p>'}}],{baseRevision:1,changeId:'change-rebase'});
 const transport={syncAvailable:true,listSyncChanges:async()=>[{name:'rebase.json',content:raw}],completeSyncChange:async(...args)=>completed.push(args)};
 const controller=createSyncController(transport,state,()=>{},async()=> 'apply');await controller.run(true);
 assert.match(state.project().description,/Completare Nex/);assert.equal(completed[0][1],'applied');
});
