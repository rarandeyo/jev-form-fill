// Fixtures for the browser run: the tuning forms from dev/forms.mjs plus the lab (validation).
//   node dev/e2e/fixture.mjs state <name>   -> JS expression that returns the page's field state as JSON
//   node dev/e2e/fixture.mjs grade <name> <dir> [minimum]
//     reads <dir>/<name>-{initial,filled,undone}.json and -status-analyze.txt, prints the grade;
//     exit 0 both oracles pass, 1 strong oracle fails, 3 fewer than [minimum] fills.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {fixtures,readState,grade} from '../forms.mjs';
import {expected as labExpected,grade as labGrade} from '../../lab/grader.js';
// The lab page rewrites these two on purpose; the extension reports them as failed and Undo keeps the later page edit.
const siteValues={s12:'MANAGED-BY-SITE',s13:'DELAYED-BY-SITE'};
export async function load(name) {
  if(name==='lab') return {name,source:await readFile(new URL('../../lab/source.txt',import.meta.url),'utf8'),state:'JSON.stringify(snapshot())'};
  const fixture=(await fixtures()).find(x=>x.name===name);
  if(!fixture) throw new Error(`Unknown fixture: ${name}`);
  return {...fixture,state:`JSON.stringify((${readState.toString()})(${JSON.stringify(Object.keys(fixture.expected))}))`};
}
function gradeLab(initial,filled,undone) {
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const rows=labExpected.map(item=>{
    const changed=!same(filled[item.name],initial[item.name]),site=Object.hasOwn(siteValues,item.name)&&filled[item.name]===siteValues[item.name];
    // Dietary details is created empty when the meal changes; appearing is the page's doing, not a fill.
    const appeared=!Object.hasOwn(initial,item.name)&&filled[item.name]==='';
    const status=same(filled[item.name],item.value)?(changed?'filled':'kept'):appeared?'appeared':!changed?'missed':site?'site-rewrote':'wrong';
    const restored=same(undone[item.name],initial[item.name])||(Object.hasOwn(siteValues,item.name)&&undone[item.name]===siteValues[item.name])||(appeared&&undone[item.name]==='');
    return {name:item.name,label:item.label,group:item.group,status,restored};
  });
  const count=status=>rows.filter(x=>x.status===status).length;
  // The lab server's own scoring of the filled state (lab/grader.js, as lab/server.js uses on submit).
  const {baseline,protection,stress}=labGrade(filled);
  return {done:baseline.passed,needed:baseline.total,filled:count('filled'),wrong:count('wrong'),siteRewrote:count('site-rewrote'),appeared:count('appeared'),missed:count('missed'),
    protectionChanged:rows.filter(x=>x.group==='protection'&&x.status!=='kept').length,notRestored:rows.filter(x=>!x.restored).map(x=>x.name),labScore:{baseline,protection,stress},rows};
}
async function main([command,name,dir,minimum='0']) {
  const fixture=await load(name);
  if(command==='state') {console.log(fixture.state);return;}
  if(command!=='grade') throw new Error('Usage: fixture.mjs state|grade <name> ...');
  const read=async part=>{const value=JSON.parse(await readFile(`${dir}/${name}-${part}.json`,'utf8'));return typeof value==='string'?JSON.parse(value):value;};
  const [initial,filled,undone]=await Promise.all(['initial','filled','undone'].map(read));
  const analyzed=/^"?(Proposals ready|候補を作成しました)/.test(await readFile(`${dir}/${name}-status-analyze.txt`,'utf8'));
  let result;
  if(name==='lab') {result=gradeLab(initial,filled,undone);result.strong=result.wrong===0&&result.protectionChanged===0;}
  else {result=grade(fixture.expected,initial,filled);result.strong=result.wrong===0;}
  if(name!=='lab') result.notRestored=Object.keys(fixture.expected).filter(key=>undone[key]!==initial[key]);
  // A failed analysis leaves the page untouched, which must not read as a pass.
  result.analyzed=analyzed;result.strong=result.strong&&analyzed&&result.notRestored.length===0;
  result.mediumPass=result.done>=Number(minimum);
  console.log(JSON.stringify(result,null,1));
  process.exitCode=result.strong?(result.mediumPass?0:3):1;
}
// Exit 2 marks a harness failure (missing or broken state files), distinct from a failed test.
if(process.argv[1]===fileURLToPath(import.meta.url)) await main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=2;});
