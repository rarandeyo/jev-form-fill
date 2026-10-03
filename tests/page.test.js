import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pageCommand} from '../page.js';
const require = createRequire(import.meta.url);
const {JSDOM}=require(process.env.JEV_TEST_DEPS || 'jsdom');
function fixture(html) {
  const dom=new JSDOM(html,{url:'https://example.com/form',runScripts:'outside-only',pretendToBeVisual:true});
  dom.window.HTMLElement.prototype.getClientRects=function(){return this.closest('[hidden]') ? [] : [{width:100,height:20}];};
  const command=dom.window.eval(`(${pageCommand.toString()})`);
  return {dom,command};
}
test('scanner groups radios, reads section context, and excludes hidden/disabled/password/file/submit/secret controls', () => {
  const {command}=fixture(`<form><h2>Webhook</h2><label><input type=checkbox checked>Active</label><label>Secret<input type=text></label><input type=hidden><input type=password><input type=file><input type=text disabled><input type=submit><input type=text hidden><fieldset><legend>Where can this App be installed?</legend><label><input type=radio name=where value=only checked>Only on this account</label><label><input type=radio name=where value=any>Any account</label></fieldset></form>`);
  const scan=command({op:'scan'});
  assert.equal(scan.fields.length,2);
  assert.equal(scan.fields[0].label,'Active');
  assert.match(scan.fields[0].context,/Webhook/);
  assert.equal(scan.fields[1].kind,'radio');
  assert.equal(scan.fields[1].options.length,2);
});
test('same-name fields retain only their local section, including when heading levels are inconsistent',()=>{
  const {command}=fixture(`<form><section><h2>Participant</h2><label>Full name<input></label></section><section><h3>Billing</h3><label>Full name<input></label></section><section><h2>Shipping</h2><label>Full name<input></label></section></form>`);
  const scan=command({op:'scan'});
  assert.deepEqual(Array.from(scan.fields,x=>x.context),['Participant','Billing','Shipping']);
});
test('heading outline replaces previous peer sections when semantic containers are absent',()=>{
  const {command}=fixture(`<form><h1>Registration</h1><h2>Participant</h2><label>Full name<input></label><h2>Billing</h2><label>Full name<input></label></form>`);
  const scan=command({op:'scan'});
  assert.equal(scan.fields[1].context,'Registration / Billing');
});
test('nested sections keep parent context and omit sibling sections',()=>{
  const {command}=fixture(`<form><h1>Registration</h1><section><h2>Billing</h2><section><h3>Contact</h3><label>Email<input></label></section><section><h3>Address</h3><label>City<input></label></section></section></form>`);
  const scan=command({op:'scan'});
  assert.deepEqual(Array.from(scan.fields,x=>x.context),['Registration / Billing / Contact','Registration / Billing / Address']);
});
test('a delayed page rejection is detected by the final retention check',async()=>{
  const {dom,command}=fixture(`<form><label>Alias<input></label></form>`);
  const input=dom.window.document.querySelector('input');
  input.addEventListener('input',()=>dom.window.setTimeout(()=>{input.value='RESTORED-BY-PAGE';},600));
  const scan=command({op:'scan'});
  const result=await command({op:'apply',token:scan.token,rows:[{id:'f0',value:'REQUESTED'}]});
  assert.equal(result[0].status,'failed');
  assert.equal(input.value,'RESTORED-BY-PAGE');dom.window.close();
});
test('undo reports a delayed rejection of the restored value as failed',async()=>{
  const {dom,command}=fixture(`<form><label>Alias<input value=ORIGINAL></label></form>`);
  const input=dom.window.document.querySelector('input');
  input.addEventListener('input',()=>{if(input.value==='ORIGINAL')dom.window.setTimeout(()=>{input.value='REQUESTED';},600);});
  try{
    const scan=command({op:'scan'});
    assert.equal((await command({op:'apply',token:scan.token,rows:[{id:'f0',value:'REQUESTED'}]}))[0].status,'filled');
    const result=await command({op:'undo'});
    assert.equal(result[0].status,'failed');assert.equal(input.value,'REQUESTED');
  }finally{dom.window.close();}
});
test('GitHub-style details menus can be scanned without remaining open; contextual labels distinguish permissions', () => {
  const {dom,command}=fixture(`<form><h2>Repository permissions</h2><details><summary>Repository permissions</summary><ul><li><strong>Contents</strong><details><summary>Access: No access</summary><label><input type=radio name=contents value=none checked>No access</label><label><input type=radio name=contents value=read>Read-only</label><label><input type=radio name=contents value=write>Read and write</label></details></li></ul></details></form>`);
  const scan=command({op:'scan'});
  assert.equal(scan.fields.length,1);
  assert.match(scan.fields[0].context,/Contents/);
  assert.ok([...dom.window.document.querySelectorAll('details')].every(x=>!x.open));
});
test('apply in document order, native events, readback and undo; later user edits survive undo', async () => {
  const {dom,command}=fixture(`<form><label>Name<input id=n value=old></label><label><input id=c type=checkbox checked>Active</label><label>Contents<select id=s><option value=none>No access</option><option value=write>Read and write</option></select></label><button>Submit</button></form>`);
  let submits=0;const events=[];
  dom.window.document.querySelector('form').addEventListener('submit',()=>submits++);
  dom.window.document.querySelectorAll('input,select').forEach(x=>x.addEventListener('change',()=>events.push(x.id)));
  const scan=command({op:'scan'});
  const applied=await command({op:'apply',token:scan.token,rows:[{id:'f2',value:'write'},{id:'f1',value:false},{id:'f0',value:'Alice'}]});
  assert.equal(applied.filter(x=>x.status==='filled').length,3);
  assert.deepEqual(events,['n','c','s']);
  assert.equal(submits,0);
  dom.window.document.querySelector('#n').value='user edited';
  const undone=await command({op:'undo'});
  assert.equal(dom.window.document.querySelector('#n').value,'user edited');
  assert.equal(dom.window.document.querySelector('#c').checked,true);
  assert.equal(dom.window.document.querySelector('#s').value,'none');
  assert.equal(undone.filter(x=>x.status==='restored').length,2);
});
test('stale plans, changed values, changed labels and unknown option values cannot write', async () => {
  const {dom,command}=fixture(`<form><label id=l>Name<input id=n value=old></label><label>Level<select><option value=none>No access</option></select></label></form>`);
  const scan=command({op:'scan'});
  dom.window.document.querySelector('#n').value='changed';
  const result=await command({op:'apply',token:scan.token,rows:[{id:'f0',value:'overwrite'},{id:'f1',value:'write'}]});
  assert.ok(result.every(x=>x.status==='skip'));
  assert.equal(dom.window.document.querySelector('#n').value,'changed');
  await assert.rejects(command({op:'apply',token:'stale',rows:[]}),/変わ/);
});
test('controlled fields reverting an input are reported as failed, and removed or newly disabled fields are skipped', async () => {
  const {dom,command}=fixture(`<form><label>Name<input id=n></label><label>Email<input id=e></label></form>`);
  const scan=command({op:'scan'});
  dom.window.document.querySelector('#n').addEventListener('input',e=>{e.target.value='reverted';});
  dom.window.document.querySelector('#e').disabled=true;
  const result=await command({op:'apply',token:scan.token,rows:[{id:'f0',value:'Alice'},{id:'f1',value:'a@example.com'}]});
  assert.equal(result[0].status,'failed');
  assert.equal(result[1].status,'skip');
});
test('authorization-token checkbox is fillable, while a token text input is protected', () => {
  const {command}=fixture(`<form><label><input type=checkbox checked>Expire user authorization tokens</label><label>Access token<input></label></form>`);
  const scan=command({op:'scan'});
  assert.equal(scan.fields.length,1);
  assert.equal(scan.fields[0].kind,'checkbox');
});
test('hidden native radios with visible menu labels are usable; a hidden menu is not', () => {
  const {command}=fixture(`<form><ul><li><strong>Contents</strong><label role=menuitemradio><input hidden type=radio name=access value=none checked>No access</label><label role=menuitemradio><input hidden type=radio name=access value=write>Read and write</label></li></ul><div hidden><label><input type=radio name=bad value=x>Bad</label></div></form>`);
  const scan=command({op:'scan'});
  assert.equal(scan.fields.length,1);
  assert.equal(scan.fields[0].options.length,2);
});
test('same-name radio groups in different forms are separate, and dynamic labels invalidate a plan', async () => {
  const {dom,command}=fixture(`<form><fieldset><legend>A</legend><label><input type=radio name=x value=a checked>A</label><label><input type=radio name=x value=b>B</label></fieldset></form><form><fieldset><legend>B</legend><label><input type=radio name=x value=c checked>C</label><label><input type=radio name=x value=d>D</label></fieldset></form>`);
  const scan=command({op:'scan'});
  assert.equal(scan.fields.length,2);
  dom.window.document.querySelector('legend').textContent='Different meaning';
  const result=await command({op:'apply',token:scan.token,rows:[{id:'f0',value:'b'}]});
  assert.equal(result[0].status,'skip');
});
test('multi-select and a radio group with an excluded member cannot be partially changed', () => {
  const {command}=fixture(`<form><label>Many<select multiple><option value=a selected>A</option><option value=b selected>B</option><option value=c>C</option></select></label><label><input type=radio name=x value=a checked disabled>A</label><label><input type=radio name=x value=b>B</label></form>`);
  const scan=command({op:'scan'});
  assert.equal(scan.fields.length,0);
});
test('undo restores the immediately preceding apply, not every earlier apply', async () => {
  const {dom,command}=fixture(`<form><label>Name<input id=n value=old></label></form>`);
  let scan=command({op:'scan'});
  await command({op:'apply',token:scan.token,rows:[{id:'f0',value:'first'}]});
  scan=command({op:'scan'});
  await command({op:'apply',token:scan.token,rows:[{id:'f0',value:'second'}]});
  await command({op:'undo'});
  assert.equal(dom.window.document.querySelector('#n').value,'first');
});
test('a new radio member inserted after analysis invalidates the whole group', async () => {
  const {dom,command}=fixture(`<form><label><input type=radio name=x value=a checked>A</label><label><input type=radio name=x value=b>B</label></form>`);
  const scan=command({op:'scan'});
  const label=dom.window.document.createElement('label');label.innerHTML='<input type=radio name=x value=c>C';dom.window.document.querySelector('form').append(label);
  const result=await command({op:'apply',token:scan.token,rows:[{id:'f0',value:'b'}]});
  assert.equal(result[0].status,'skip');
});
test('undo restores an original incomplete email value instead of validating it as a new answer', async () => {
  const {dom,command}=fixture(`<form><label>Email<input id=e type=email value=unfinished></label></form>`);
  const scan=command({op:'scan'});
  await command({op:'apply',token:scan.token,rows:[{id:'f0',value:'alice@example.com'}]});
  const result=await command({op:'undo'});
  assert.equal(result[0]?.status,'restored');
  assert.equal(dom.window.document.querySelector('#e').value,'unfinished');
});
