// Fixture helpers for the browser run.
//   node dev/e2e/fixture.mjs state <name>     -> JS expression that returns the page's field state as JSON
//   node dev/e2e/fixture.mjs source <name>    -> source text to paste into the popup
//   node dev/e2e/fixture.mjs grade <name> <initial.json> <filled.json> <undone.json> [minimum required changes]
import {readFile} from 'node:fs/promises';
import {fixtures,readState,grade} from '../forms.mjs';
import {expected as labExpected,grade as labGrade} from '../../lab/grader.js';
const [command,name,...rest]=process.argv.slice(2);
// The lab page rewrites these two on purpose; the extension reports them as failed and Undo keeps the later page edit.
const siteValues={s12:'MANAGED-BY-SITE',s13:'DELAYED-BY-SITE'};
const lab={name:'lab',source:await readFile(new URL('../../lab/source.txt',import.meta.url),'utf8'),state:'JSON.stringify(snapshot())'};
const fixture=name==='lab'?lab:(await fixtures()).find(x=>x.name===name);
if(!fixture) throw new Error(`Unknown fixture: ${name}`);
const read=async path=>{const value=JSON.parse(await readFile(path,'utf8'));return typeof value==='string'?JSON.parse(value):value;};
if(command==='state') console.log(fixture.state||`JSON.stringify((${readState.toString()})(${JSON.stringify(Object.keys(fixture.expected))}))`);
else if(command==='source') process.stdout.write(fixture.source);
else if(command==='grade') {
  const [initial,filled,undone]=await Promise.all(rest.slice(0,3).map(read)),minimum=Number(rest[3]||0);
  let result;
  if(name==='lab') {
    const rows=labExpected.map(item=>{
      const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),changed=!same(filled[item.name],initial[item.name]);
      // Dietary details is created empty when the meal changes; appearing is the page's doing, not a fill.
      const appeared=!Object.hasOwn(initial,item.name)&&filled[item.name]==='';
      const status=same(filled[item.name],item.value)?(changed?'filled':'kept'):appeared?'appeared':!changed?'missed':filled[item.name]===siteValues[item.name]?'site-rewrote':'wrong';
      return {name:item.name,label:item.label,group:item.group,status,restored:same(undone[item.name],initial[item.name])||undone[item.name]===siteValues[item.name]||(appeared&&undone[item.name]==='')};
    });
    const count=(status,group)=>rows.filter(x=>x.status===status&&(!group||x.group===group)).length;
    result={filled:count('filled'),wrong:count('wrong'),siteRewrote:count('site-rewrote'),appeared:count('appeared'),missed:count('missed'),protectionChanged:rows.filter(x=>x.group==='protection'&&!['kept'].includes(x.status)).length,notRestored:rows.filter(x=>!x.restored).map(x=>x.name),rows};
    result.strong=result.wrong===0&&result.protectionChanged===0&&result.notRestored.length===0;
    // The lab server's own scoring of the filled state (lab/grader.js, as used by lab/server.js on submit).
    const {baseline,protection,stress}=labGrade(filled);result.labScore={baseline,protection,stress};
  } else {
    const graded=grade(fixture.expected,initial,filled);
    const notRestored=Object.keys(fixture.expected).filter(key=>undone[key]!==initial[key]);
    result={...graded,notRestored,strong:graded.wrong===0&&notRestored.length===0};
  }
  result.medium=result.done??result.filled;result.mediumPass=result.medium>=minimum;
  console.log(JSON.stringify(result,null,1));
  process.exitCode=result.strong?(result.mediumPass?0:3):1;
} else throw new Error('Usage: fixture.mjs state|source|grade <name> ...');
