import assert from 'node:assert/strict';
import path from 'node:path';
import {CanvasHandle} from '../../packages/api/src/connect.ts';
import {designSystemPort} from '../../packages/api/src/design-system.ts';
import {readDesignSystem} from '../../packages/api/src/design-system-reader.ts';
import {canvasItemOf,designSystemProperties} from '../../packages/core/src/index.ts';
import {readDesignRecipe} from '../../packages/api/src/design-recipes.ts';
import {click,navigate,screenshot} from './personal-journey-fixture.mjs';
import {until} from './browser.mjs';
import {clickText,selectValue} from './design-systems-browser.mjs';

/** Browser notices and agent reads must count the same uncovered direct memberships and inherited fallback. */
export async function walkScopeCoverage(f,b,ctx) {
  const id='prj_system_scope_proof';await f.client.sendOp(null,ctx.actor,{type:'project.create',canvasId:id,title:'Acme scope coverage',groupMode:'groups'});
  const canvas=new CanvasHandle(ctx,(await f.client.snapshot(id)).project),io=designSystemPort(ctx),recipe=await readDesignRecipe('receiving');
  for(const title of ['Covered','Uncovered','New scope'])await f.cli('--canvas',id,'canvas','group','new',title,'--json');
  const snapshot=await f.client.snapshot(id),group=title=>Object.values(snapshot.canvas.items).find(i=>i.title===title).id,A=group('Covered'),B=group('Uncovered'),C=group('New scope');
  await canvas.add({title:'Covered system',content:recipe.design,mime:'text/markdown',properties:designSystemProperties(),in:A});
  for(const [scope,count] of [[A,2],[B,6],[C,1]])for(let n=0;n<count;n++)await canvas.add({title:`Acme ${scope===B?'uncovered':scope===C?'new':'covered'} screen ${n+1}`,content:'<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><main><h1>Acme screen</h1><p>Synthetic scope coverage fixture.</p></main></html>',mime:'text/html',in:scope});
  const c=await readDesignSystem(io,{canvasId:id,target:{kind:'group',groupId:C}}),uncovered=await readDesignSystem(io,{canvasId:id,target:{kind:'group',groupId:B}});
  assert.equal(c.standing.screenCount,1);assert.equal(c.standing.standing,'fine');assert.equal(uncovered.standing.uncoveredIds.length,6);assert.equal(uncovered.standing.standing,'overdue');
  await navigate(b,`${f.base}/p/${id}`);await click(b,'button[aria-label="More"]');await clickText(b,'Files','[role="menuitem"]');
  await until(b,`document.querySelector('.files-nudge')?.dataset.uncoveredScreens==='7'`,'seven actually uncovered screens, not nine');await screenshot(b,path.join(f.output,'scoped-files-nudge.png'));
  await click(b,'.files-nudge [aria-label="Design system and references"]');await selectValue(b,'select[aria-label="Design scope"]',JSON.stringify({kind:'group',groupId:C}));await until(b,`document.querySelector('[data-design-standing="fine"]')?.textContent.includes('1 screen')`,'new scope has its own one-screen standing');await screenshot(b,path.join(f.output,'new-scope-standing.png'));await click(b,'button[aria-label="Close"]');
  console.log('checkpoint: direct-scope Files notice passed');
  const fallback=await canvas.add({title:'Canvas fallback',content:recipe.design,mime:'text/markdown',properties:designSystemProperties(),containerId:null});
  const fallbackSeq=(await f.client.snapshot(id)).lastSeq;await until(b,`document.querySelector('[data-design-coverage="fine"]')?.dataset.coverageSeq===${JSON.stringify(String(fallbackSeq))} && !document.querySelector('.files-nudge')`,'canvas fallback clears missing-system nudge');
  const libraryId='prj_system_library_proof';await f.client.sendOp(null,ctx.actor,{type:'project.create',canvasId:libraryId,title:'Acme design library'});const library=new CanvasHandle(ctx,(await f.client.snapshot(libraryId)).project);const source=await library.add({title:'Shared source',content:recipe.design,mime:'text/markdown',properties:designSystemProperties()});
  await canvas.add({title:'Acme library reference',content:f.base,mime:'text/plain',properties:{...canvasItemOf(f.base,libraryId).properties,memory:'inherit'}});await canvas.remove(fallback.id);
  const inherited=await readDesignSystem(io,{canvasId:id,target:{kind:'group',groupId:B}});assert.equal(inherited.governing.artifact.itemId,source.id);assert.equal(inherited.standing.standing,'fine');
  const viaCLI=await f.cli('--canvas',id,'design','direction','--in',B,'--json');assert.equal(viaCLI.governing.artifact.versionId,inherited.governing.artifact.versionId);
  const inheritedSeq=(await f.client.snapshot(id)).lastSeq;await until(b,`document.querySelector('[data-design-coverage="fine"]')?.dataset.coverageSeq===${JSON.stringify(String(inheritedSeq))} && !document.querySelector('.files-nudge')`,'permitted inheritance clears missing-system nudge');
  await f.client.sendOp(id,ctx.actor,{type:'project.update',patch:{properties:{design:'none'}}});const exempt=await readDesignSystem(io,{canvasId:id,target:{kind:'group',groupId:B}});assert.equal(exempt.governing.exempt,true);assert.equal(exempt.governing.artifact.itemId,source.id);assert.equal(exempt.standing.standing,'fine');
  console.log('checkpoint: canvas/inherited fallback and exemption passed');
  return 'Covered group A, six uncovered B and one-screen C have independent standing; Files counts only seven uncovered screens, canvas/inherited fallback clears notice, CLI resolves the same source and design=none preserves its incumbent.';
}
