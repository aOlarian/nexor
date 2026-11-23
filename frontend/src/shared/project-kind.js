/* MAP §1 project classification and legacy compatibility */
// §1 project classification and legacy compatibility
export function isAssembly(project){
 if(project?.kind)return project.kind==='assembly';
 if(project?.instances?.length)return true;
 // Older copy-joins stored one named group and description heading per source.
 const groups=project?.groups||[],description=project?.description||'';
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 return groups.length>=2&&groups.every(g=>description.includes('<h2>'+escape(g.title)+'</h2>'));
}
export function sidebarProjects(projects,tab){return projects.filter(p=>isAssembly(p)===(tab==='groups'));}
