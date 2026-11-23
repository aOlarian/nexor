/* MAP §1 state construction §2 transactions §3 history */
import {copy,CONFIG} from './shared/config.js';
import {projectView} from './projects.js';
import {validateLibrary} from './model.js';
// §1 state construction
export function createState(library){
 const state={library,selection:[],edgeId:null,canvas:null,save:null,sync:null,update:()=>{},undoStack:[],redoStack:[],clipboard:null};
 const revisions=new Map(library.projects.map(p=>[p.id,p.revision]));
 const content=p=>JSON.stringify({...p,revision:0,view:null});
 function updateRevisions(before){for(const p of state.library.projects){const old=before.projects.find(o=>o.id===p.id);if(!old||content(old)!==content(p)){p.revision=Math.max(revisions.get(p.id)??-1,old?.revision??-1)+1;revisions.set(p.id,p.revision);}}}
 state.project=()=>state.library.projects.find(p=>p.id===state.library.activeProjectId);
 state.projection=()=>{const p=state.project();return p?projectView(state.library,p):null;};
 // §2 transactions
 state.change=(mutate)=>{
  const before=copy(state.library);
  try{mutate(state.library,state.project());validateLibrary(state.library,{sanitize:false});updateRevisions(before);}
  catch(error){state.library=before;state.update();throw error;}
  state.undoStack.push(before);if(state.undoStack.length>CONFIG.historyLimit)state.undoStack.shift();state.redoStack=[];
  state.update();state.save?.schedule();
 };
 state.switchProject=id=>{if(!state.library.projects.some(p=>p.id===id))return;state.library.activeProjectId=id;state.selection=[];state.edgeId=null;state.update();state.canvas?.setSelection?.([]);state.save?.schedule();};
 // §3 history
 state.undo=()=>restore(state.undoStack,state.redoStack);
 state.redo=()=>restore(state.redoStack,state.undoStack);
 function restore(from,to){if(!from.length)return;const before=copy(state.library);to.push(before);state.library=from.pop();updateRevisions(before);state.selection=[];state.edgeId=null;state.update();state.canvas?.setSelection?.([]);state.save?.schedule();}
 return state;
}
