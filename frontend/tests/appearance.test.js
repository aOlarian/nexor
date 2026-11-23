/* MAP §1 persistence and projection §2 explicit save and color contrast */
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLibrary,parseLibrary,validateLibrary} from '../src/model.js';
import {cloneProject,projectView} from '../src/projects.js';
import {createState} from '../src/state.js';
import {appActions} from '../src/app-actions.js';
import {blendColor,foreground} from '../src/shared/colors.js';
// §1 persistence and projection
test('old files acquire opaque defaults without changing chosen colors',()=>{
 const library=initialLibrary(),p=library.projects[0];delete p.nodes[0].opacity;
 p.groups.push({id:'group',title:'Original',color:'#627382'});p.nodes[0].groupId='group';
 const parsed=parseLibrary(JSON.stringify(library)).projects[0];
 assert.equal(parsed.nodes[0].opacity,1);assert.equal(parsed.groups[0].opacity,1);assert.equal(parsed.groups[0].color,'#627382');
});
test('node and group appearance survives save, clone and resolved canvas',()=>{
 const library=initialLibrary(),p=library.projects[0];p.nodes[0].opacity=.35;
 p.groups.push({id:'group',title:'Infrastructură',color:'#123456',opacity:.6});p.nodes[0].groupId='group';
 const parsed=parseLibrary(JSON.stringify(library)),project=parsed.projects[0],cloned=cloneProject(project);
 assert.equal(cloned.nodes[0].opacity,.35);assert.equal(cloned.groups[0].opacity,.6);
 const frame=projectView(parsed,project).frames[0];assert.equal(frame.color,'#123456');assert.equal(frame.opacity,.6);assert.equal(frame.title,'Infrastructură');
});
test('invalid opacity cannot enter storage or JSON imports',()=>{
 for(const value of [-.1,1.1,'50',null,NaN]){
  const library=initialLibrary();library.projects[0].nodes[0].opacity=value;
  if(value===null)assert.equal(validateLibrary(library).projects[0].nodes[0].opacity,1);
  else assert.throws(()=>validateLibrary(library),/Opacitate/);
 }
});
// §2 explicit save and color contrast
test('Save explicitly queues and awaits the current library write',async()=>{
 const state=createState(initialLibrary()),calls=[];let complete;
 state.save={schedule(){calls.push('schedule');},flush(){calls.push('flush');return new Promise(resolve=>complete=resolve);}};
 let finished=false;const pending=appActions(state,{},{}).action('save').then(()=>finished=true);
 assert.deepEqual(calls,['schedule','flush']);assert.equal(finished,false);complete();await pending;assert.equal(finished,true);
});
test('icon foreground follows actual composited background',()=>{
 assert.equal(foreground('#ffffff'),'#101820');assert.equal(foreground('#000000'),'#f8fafc');
 assert.equal(blendColor('#ffffff',0,'#1b212b'),'#1b212b');assert.equal(blendColor('#123456',1,'#eeeeee'),'#123456');
 assert.equal(foreground(blendColor('#ffffff',0,'#1b212b')),'#f8fafc');
});
