// Measures Clef (Cloudflare Workers AI) on fixtures from dev/forms.mjs and how its confidence threshold changes fills.
// Usage: CF_ACCOUNT_ID=... CF_API_TOKEN=... node dev/measure-thresholds.mjs [runs] [set] [model]
// set is a fixture set (tuning, the default, or japan) or a comma-separated list of fixture names;
// model is a Cloudflare model id from providers.js (the provider's default when omitted).
// One live run per fixture uses confidence 0 (p, margin and noul unchanged) and records every decision;
// higher confidence values are then replayed from those decisions, so all candidates see the same answers.
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {evaluate,passages,tokens,valueStart} from '../core.js';
import {pageCommand} from '../page.js';
import {callJev} from '../client.js';
import {providers,profileOf} from '../providers.js';
import {fixtures,readState,grade} from './forms.mjs';
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
if(process.argv[4]&&!Object.hasOwn(providers.cloudflare.models,process.argv[4])) throw new Error(`Unknown Cloudflare model: ${process.argv[4]}`);
const provider=profileOf('cloudflare',process.argv[4]),runs=Number(process.argv[2]||2),set=process.argv[3]||'tuning',jev=profileOf('typesafe').thresholds.confidence,threshold=provider.thresholds.confidence;
const grid=[...new Set([jev,threshold,0.7,0.65,0.6,0.55,0.5,0.45,0.4,0.3,0])].sort((a,b)=>b-a);
console.log(`model ${provider.model}, confidence ${threshold}`);
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
  const result={confidence,ready:ready.length,...grade(fixture.expected,initial,state(selectors),fixture.limits)};
  dom.window.close();
  return result;
}
// What a skipped row would have written: the proposal sent to the whole-source check, or the token range it picked.
function proposal(row,source,verified) {
  if(Object.hasOwn(verified,row.id)) return verified[row.id];
  const at=stage=>row.diagnostics.find(x=>x.stage===stage)?.choice;
  const passage=passages(source)[Number(at('source')?.slice(1))],start=at('start'),end=at('end');
  if(!passage||!/^t\d+$/.test(start||'')||!/^t\d+$/.test(end||'')) return undefined;
  const pieces=tokens(passage.text),last=Number(end.slice(1));
  if(!pieces[last]||Number(start.slice(1))>last) return undefined;
  const first=valueStart(pieces,Number(start.slice(1)),last);
  return first<=last?passage.text.slice(pieces[first].start,pieces[last].end):'';
}
// The gate that stopped a row at Clef's threshold.
function stopper(row) {
  const rejected=row.diagnostics.find(x=>!x.accepted);
  if(rejected) return rejected.stage==='verification'?`verification ${rejected.probability?.toFixed(2)}`:`${rejected.stage} ${rejected.gate} choice=${rejected.choice} c=${rejected.confidence?.toFixed(2)} p=${rejected.probability?.toFixed(2)}`;
  const low=row.diagnostics.find(x=>x.gate==='value'&&x.confidence<threshold);
  if(row.status==='ready'&&low) return `${low.stage} c=${low.confidence.toFixed(2)} below ${threshold}`;
  const skipped=row.diagnostics.find(x=>x.choice==='skip');
  return skipped?`${skipped.stage} chose skip`:row.proposal===''?'symbol-only range':'structural (range order or size)';
}
const all=[],outDir=new URL('../.local/thresholds/',import.meta.url);
await mkdir(outDir,{recursive:true});
const selected=(await fixtures()).filter(x=>x.set===set||set.split(',').includes(x.name));
if(!selected.length) throw new Error(`No fixtures in set ${set}.`);
for(const fixture of selected) for(let run=1;run<=runs;run++) {
  const {dom,command}=page(fixture.html);
  const fields=command({op:'scan'}).fields;dom.window.close();
  const started=Date.now(),verified={};let calls=0,retries=0;
  // Workers AI sometimes answers 'capacity exceeded' (shown as the busy message) or stalls; retry the same request.
  const call=async(body,attempt=1)=>{
    try{return await callJev(body,key,{provider,accountId});}
    catch(error){
      if(attempt>=4||!(error.name==='TimeoutError'||/混雑/.test(error.message)))throw error;
      retries++;console.log(`  retry ${attempt} after: ${error.name==='TimeoutError'?'timeout':error.message}`);
      await new Promise(resolve=>setTimeout(resolve,20000*attempt));return call(body,attempt+1);
    }
  };
  const rows=await evaluate(fixture.source,fields,body=>{calls++;for(const item of body.state?.proposals||[])verified[item.id]=item.value;return call(body);},()=>{},{model:provider.model,thresholds:{...provider.thresholds,confidence:0}});
  const results=[];
  for(const confidence of grid) results.push(await applyAt(fixture,rows,confidence));
  all.push({fixture:fixture.name,run,calls,retries,ms:Date.now()-started,rows:rows.map(row=>({id:row.id,label:row.field.label,status:row.status,value:row.value,proposal:proposal(row,fixture.source,verified),diagnostics:row.diagnostics})),results});
  console.log(`${fixture.name} run ${run}: ${calls} calls, ${retries} retries, ${Date.now()-started}ms`);
}
await writeFile(new URL(`measure-${provider.modelId}-${new Date().toISOString().replace(/:/g,'-')}.json`,outDir),JSON.stringify(all,null,1));
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
// Each field at Clef's threshold: the grade, then every proposal with what stopped it and what it would have written.
const limits=Object.fromEntries(selected.map(x=>[x.name,x.limits||{}]));
for(const run of all) {
  const result=run.results.find(x=>x.confidence===threshold);
  console.log(`\n== ${run.fixture} run ${run.run} at confidence ${threshold}: ${result.done}/${result.needed} required, ${result.wrong} wrong`);
  for(const row of result.rows) console.log(`  ${row.status.padEnd(7)} ${row.selector} = ${JSON.stringify(row.final)}${limits[run.fixture][row.selector]?` [limit: ${limits[run.fixture][row.selector]}]`:''}`);
  for(const row of run.rows) console.log(`  · ${row.label}: ${acceptedAt(row,threshold)?'ready '+JSON.stringify(row.value):`skip ${stopper(row)}${row.proposal!==undefined?` proposed ${JSON.stringify(row.proposal)}`:''}`}`);
}
