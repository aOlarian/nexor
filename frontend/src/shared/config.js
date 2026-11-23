/* MAP §1 limits and defaults */
// §1 limits and defaults
export const CONFIG = Object.freeze({grid:20,minZoom:0.25,maxZoom:2.5,saveDelay:350,historyLimit:60,maxBytes:33554432,maxProjects:250,maxNodes:5000,maxEdges:15000,coordinateLimit:100000,maxDescription:500000,syncPollMs:2000,maxSyncBytes:2097152,maxSyncOperations:1000,syncHistoryLimit:500});
export const SHAPES=['square','wide','tall','circle','oval','triangle','diamond'];
export const SIDES=['top','right','bottom','left'];
export const COLORS=['#3f7fb0','#4479b5','#47856b','#756593','#a58042','#a45d70','#627382'];
export const uid=()=>crypto.randomUUID();
export const copy=value=>structuredClone(value);
