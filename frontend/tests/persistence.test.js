/* MAP §1 browser stand-in §2 save ordering and failure */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersistence} from '../src/persistence.js';
// §1 browser stand-in
globalThis.window={addEventListener(){},runtime:{EventsOn(){}},go:{main:{App:{ConfirmClose(){}}}}};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
// §2 save ordering and failure
test('saving serializes snapshots and close waits for latest changes',async()=>{
 let library={value:1};const saved=[],first=deferred(),statuses=[];
 const transport={native:true,async save(text){saved.push(JSON.parse(text).value);if(saved.length===1)await first.promise;}};
 const saver=createPersistence(transport,()=>library,(...s)=>statuses.push(s));
 saver.schedule();const a=saver.flush();await new Promise(r=>setTimeout(r,0));library={value:2};saver.schedule();const b=saver.flush();
 assert.deepEqual(saved,[1]);first.resolve();await Promise.all([a,b]);assert.deepEqual(saved,[1,2]);assert.equal(saver.dirty,false);assert.equal(statuses.at(-1)[0],'saved');
});
test('write error remains dirty and visible, retry persists latest snapshot',async()=>{
 let fails=true;const statuses=[];const saver=createPersistence({native:true,async save(){if(fails)throw Error('disk full');}},()=>({value:3}),(...s)=>statuses.push(s));
 saver.schedule();await assert.rejects(saver.flush(),/disk full/);assert.equal(saver.dirty,true);assert.equal(statuses.at(-1)[0],'error');fails=false;await saver.flush();assert.equal(saver.dirty,false);
});
test('close is vetoed after a failed save and allowed only after retry',async()=>{
 let closed=0,fails=true;window.go.main.App.ConfirmClose=()=>closed++;
 const saver=createPersistence({native:true,async save(){if(fails)throw Error('denied');}},()=>({value:3}),()=>{});
 saver.schedule();await saver.close();assert.equal(closed,0);fails=false;await saver.close();assert.equal(closed,1);
});
