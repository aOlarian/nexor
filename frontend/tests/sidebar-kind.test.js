/* MAP §1 sidebar categories and legacy joins */
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLibrary,newProject,validateLibrary,validateProject} from '../src/model.js';
import {joinProjects,cloneProject} from '../src/projects.js';
import {isAssembly,sidebarProjects} from '../src/shared/project-kind.js';
// §1 sidebar categories and legacy joins
for(const mode of ['copy','dynamic'])test(`${mode} assembly lives exclusively in Groups and survives cloning/reload`,()=>{
 const library=initialLibrary();library.projects.push(cloneProject(library.projects[0]));
 const joined=joinProjects(library,library.projects.map(p=>p.id),'Ansamblu',mode);library.projects.push(joined);
 assert.equal(sidebarProjects(library.projects,'projects').length,2);
 assert.deepEqual(sidebarProjects(library.projects,'groups').map(p=>p.id),[joined.id]);
 assert.equal(validateProject(joined).kind,'assembly');assert.equal(cloneProject(joined).kind,'assembly');
 delete joined.kind;assert.equal(isAssembly(joined),true);assert.equal(validateProject(joined).kind,'assembly');
});
test('ordinary node groups do not turn a project into an assembly',()=>{
 const p=newProject('Proiect');p.groups=[{id:'a',title:'Unu'},{id:'b',title:'Doi'}];
 assert.equal(isAssembly(p),false);delete p.kind;assert.equal(isAssembly(p),false);
});
test('an emptied assembly retains its category after saving',()=>{
 const p=newProject('Ansamblu');p.kind='assembly';assert.equal(validateProject(p).kind,'assembly');
});
test('legacy projects migrate into a default category without changing assemblies',()=>{
 const project=newProject('Proiect vechi'),assembly=newProject('Ansamblu');assembly.kind='assembly';
 const library=validateLibrary({schemaVersion:1,activeProjectId:project.id,theme:'light',sidebarWidth:270,projects:[project,assembly]});
 assert.equal(library.categories.length,1);assert.equal(library.projects[0].categoryId,library.categories[0].id);assert.equal(library.projects[1].categoryId,'');
});
test('project categories survive validation',()=>{
 const library=initialLibrary(),category=library.categories[0],project=library.projects[0];
 const validated=validateLibrary(library);assert.equal(validated.categories[0].title,category.title);assert.equal(validated.projects[0].categoryId,category.id);
});
