// Measures how Cloudflare's confidence threshold changes fills on the tuning fixtures.
// Usage: CF_ACCOUNT_ID=... CF_API_TOKEN=... node dev/measure-thresholds.mjs [runs]
// One live run per fixture uses confidence 0 (p, margin and noul unchanged) and records every decision;
// higher confidence values are then replayed from those decisions, so all candidates see the same answers.
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {evaluate} from '../core.js';
import {pageCommand} from '../page.js';
import {callJev} from '../client.js';
import {providers} from '../providers.js';
import {fixtures,readState,grade} from './forms.mjs';
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
const provider=providers.cloudflare,runs=Number(process.argv[2]||2),jev=providers.typesafe.thresholds.confidence;
const grid=[jev,0.7,0.65,0.6,0.55,0.5,0.45,0.4,0.3,0];
const key=process.env.CF_API_TOKEN,accountId=process.env.CF_ACCOUNT_ID;
if(provider.settingsError({key,accountId})) throw new Error('Set CF_ACCOUNT_ID and CF_API_TOKEN.');
function page(html) {
  const dom=new JSDOM(html,{url:'https://example.test/form',runScripts:'outside-only'});
  dom.window.HTMLElement.prototype.getClientRects=function(){return [{width:10,height:10}];};
  return {dom,command:dom.window.eval(`(${pageCommand.toString()})`),state:selectors=>dom.window.eval(`(${readState.toString()})(${JSON.stringify(selectors)})`)};
}
// A row recorded at confidence 0 is accepted at `confidence` when every value gate it passed also clears it.
const acceptedAt=(row,confidence)=>row.status==='ready'&&row.diagnostics.filter(x=>x.gate==='value').every(x=>x.confidence>=confidence);
async function applyAt(fixture,rows,confidence) {
  const {dom,command,state}=page(fixture.html),selectors=Object.keys(fixture.expected);
  const initial=state(selectors),scan=command({op:'scan'});
  const ready=rows.filter(row=>acceptedAt(row,confidence));
  if(ready.length) await command({op:'apply',token:scan.token,rows:ready.map(x=>({id:x.id,value:x.value}))});
  const result={confidence,ready:ready.length,...grade(fixture.expected,initial,state(selectors))};
  dom.window.close();
  return result;
}
const all=[],outDir=new URL('../.local/thresholds/',import.meta.url);
await mkdir(outDir,{recursive:true});
// Copied text often has no trailing newline, and Clef's confidences shift with it, so both forms are measured.
const variants=(await fixtures()).flatMap(fixture=>fixture.source===fixture.source.trimEnd()?[fixture]:[fixture,{...fixture,name:`${fixture.name} (no final newline)`,source:fixture.source.trimEnd()}]);
for(const fixture of variants) for(let run=1;run<=runs;run++) {
  const {dom,command}=page(fixture.html);
  const fields=command({op:'scan'}).fields;dom.window.close();
  const started=Date.now();let calls=0;
  const rows=await evaluate(fixture.source,fields,body=>{calls++;return callJev(body,key,{provider,accountId});},()=>{},{model:provider.model,thresholds:{...provider.thresholds,confidence:0}});
  const results=[];
  for(const confidence of grid) results.push(await applyAt(fixture,rows,confidence));
  all.push({fixture:fixture.name,run,calls,ms:Date.now()-started,rows:rows.map(({id,field,status,value,diagnostics})=>({id,label:field.label,status,value,diagnostics})),results});
  console.log(`${fixture.name} run ${run}: ${calls} calls, ${Date.now()-started}ms`);
}
await writeFile(new URL(`measure-${new Date().toISOString().replace(/:/g,'-')}.json`,outDir),JSON.stringify(all,null,1));
console.log('\nconfidence | '+[...new Set(all.map(x=>x.fixture))].join(' | ')+' | required done | correct changes | wrong');
for(const confidence of grid) {
  const cells=[...new Set(all.map(x=>x.fixture))].map(name=>all.filter(x=>x.fixture===name).map(x=>{const r=x.results.find(y=>y.confidence===confidence);return `${r.done}/${r.needed}${r.wrong?` (${r.wrong} wrong)`:''}`;}).join(', '));
  const totals=all.map(x=>x.results.find(y=>y.confidence===confidence));
  const sum=key=>totals.reduce((a,b)=>a+b[key],0);
  console.log(`${confidence} | ${cells.join(' | ')} | ${sum('done')}/${sum('needed')} | ${sum('filled')} | ${sum('wrong')}`);
}
console.log(`\nRows accepted only below ${jev} (fixture/run/label: lowest value-gate confidence, value):`);
for(const run of all) for(const row of run.rows.filter(x=>acceptedAt(x,0)&&!acceptedAt(x,jev))) {
  console.log(`${run.fixture}/${run.run}/${row.label}: ${Math.min(...row.diagnostics.filter(x=>x.gate==='value').map(x=>x.confidence)).toFixed(4)} ${JSON.stringify(row.value)}`);
}
