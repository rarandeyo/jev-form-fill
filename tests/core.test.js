import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passages, tokens, acceptChoice, propose, evaluate, PROFILE } from '../core.js';

const yes = (choice, criteria, rest = {}) => ({type:'choice',choice,confidence:0.97,probabilities:Object.fromEntries(Object.keys(criteria).map(key=>[key,key===choice?0.98:0.02/(Object.keys(criteria).length-1)])),...rest});
test('source offsets preserve Japanese, multiline and exact punctuation', () => {
  const source = '名前: 山田 太郎\n- **Description**: `Opens a PR (flow-sync/pending).`\r\n';
  const p = passages(source);
  assert.equal(p.length, 2);
  assert.equal(source.slice(p[1].start, p[1].end), p[1].text);
  const t = tokens(p[1].text);
  const first = t.findIndex(x => x.text === 'Opens');
  const last = t.findIndex(x => x.text === '.');
  assert.equal(p[1].text.slice(t[first].start,t[last].end), 'Opens a PR (flow-sync/pending).');
});
test('missing, malformed, ambiguous and unknown answers leave a field untouched', () => {
  const criteria = {skip:'unknown',on:'on',off:'off'};
  for (const answer of [null,{},yes('invented',criteria),yes('on',criteria,{confidence:NaN}),yes('on',criteria,{probabilities:{on:0.51,off:0.49,skip:0}}),yes('on',criteria,{probabilities:{on:1.5,skip:0,off:0}})]) {
    assert.equal(acceptChoice(answer,criteria), null);
  }
  assert.equal(acceptChoice(yes('off',criteria),criteria),'off');
});
test('a choice distribution must include every offered option, even zero-probability options',()=>{
  const criteria={skip:'missing',p0:'Name: Alice',p1:'Other: Bob'};
  assert.equal(acceptChoice({type:'choice',choice:'p0',confidence:0.99,probabilities:{p0:1}},criteria),null);
  assert.equal(acceptChoice({type:'choice',choice:'p0',confidence:0.99,probabilities:{skip:0,p0:1,p1:0}},criteria),'p0');
});
test('closed choices support explicit OFF and absent-source SKIP independently', () => {
  const fields = [{id:'f0',kind:'checkbox',label:'Active',context:'Webhook'}, {id:'f1',kind:'select',label:'Contents',context:'Repository permissions',options:[{value:'none',label:'No access'},{value:'write',label:'Read and write'}]}];
  const stage = propose('Webhook Active のチェックを外す。 Contents: Read and write',fields);
  assert.ok(stage.body.questions.f0.criteria.off);
  assert.ok(stage.body.questions.f0.criteria.skip);
  const rows = stage.resolve({answers:{f0:yes('off',stage.body.questions.f0.criteria),f1:yes('o1',stage.body.questions.f1.criteria)}});
  assert.equal(rows[0].value,false);
  assert.equal(rows[1].value,'write');
});
test('end-to-end text extraction uses exact source slice, requires verification and never invents values', async () => {
  const source = 'GitHub App name: pfdsl-sweep-pr（取られていたら fallback）';
  const field = {id:'f0',kind:'text',label:'GitHub App name',context:'GitHub App'};
  let calls = 0;
  const result = await evaluate(source,[field],async body => {
    calls++;
    if (calls === 1) return {answers:{f0:yes('p0',body.questions.f0.criteria)}};
    if(calls===2)return {answers:{f0:yes('extract',body.questions.f0.criteria)}};
    if (calls === 3) {
      const start = Object.entries(body.questions.f0_start.criteria).find(([,v]) => v === 'pfdsl-sweep-pr')[0];
      return {answers:{f0_start:yes(start,body.questions.f0_start.criteria),f0_end:yes(start,body.questions.f0_end.criteria)}};
    }
    assert.equal(body.state.proposals[0].value,'pfdsl-sweep-pr');
    return {answers:{f0:{type:'noul',noul:0.96}}};
  });
  assert.equal(calls,4);
  assert.equal(result[0].value,'pfdsl-sweep-pr');
  assert.ok(source.includes(result[0].value));
});
test('failed verification and explicit skip produce no writable row', async () => {
  const field = {id:'f0',kind:'checkbox',label:'Enable Device Flow'};
  let calls=0;
  const result=await evaluate('Enable Device Flow: off',[field], async body => ++calls===1 ? {answers:{f0:yes('off',body.questions.f0.criteria)}} : {answers:{f0:{type:'noul',noul:0.4}}});
  assert.equal(result[0].status,'skip');
  assert.equal(result[0].value,undefined);
});
test('explicit blank is separate from missing data and needs verification', async () => {
  const field={id:'f0',kind:'text',label:'Setup URL'};
  let calls=0;
  const rows=await evaluate('Setup URL は空',[field],async body => ++calls===1 ? {answers:{f0:yes('p0',body.questions.f0.criteria)}} : calls===2?{answers:{f0:yes('clear',body.questions.f0.criteria)}}:{answers:{f0:{type:'noul',noul:0.99}}});
  assert.equal(rows[0].value,'');
  assert.equal(rows[0].status,'ready');
});
test('source selection has no competing blank action; the selected passage decides blank separately',async()=>{
  const fields=[{id:'f0',kind:'text',label:'Middle name'},{id:'f1',kind:'text',label:'Callback URL'}];
  const source='Middle name は空欄にする。Callback URL も空欄にする。';
  const stage=propose(source,fields);
  assert.equal(Object.hasOwn(stage.body.questions.f0.criteria,'clear'),false);
  let calls=0;
  const rows=await evaluate(source,fields,async body=>{
    calls++;
    if(calls===1)return {answers:{f0:yes('p0',body.questions.f0.criteria),f1:yes('p0',body.questions.f1.criteria)}};
    if(calls===2){assert.ok(body.questions.f0.criteria.clear);return {answers:{f0:yes('clear',body.questions.f0.criteria),f1:yes('clear',body.questions.f1.criteria)}};}
    return {answers:{f0:{type:'noul',noul:0.99},f1:{type:'noul',noul:0.99}}};
  });
  assert.equal(calls,3);assert.deepEqual(rows.map(x=>[x.status,x.value]),[['ready',''],['ready','']]);
});
test('multiple marked values in a passage are copied whole, retaining Japanese, leading zeros and punctuation',async()=>{
  const source='請求先の郵便番号は `060-0042`、市区町村は `札幌市中央区`、Street は `大通西2丁目 みなもビル 4F`。';
  const fields=[{id:'f0',kind:'text',label:'City',context:'Billing'},{id:'f1',kind:'text',label:'Street',context:'Billing'}];
  const expected=['札幌市中央区','大通西2丁目 みなもビル 4F'];let calls=0;
  const rows=await evaluate(source,fields,async body=>{
    calls++;
    if(calls===1)return {answers:{f0:yes('p0',body.questions.f0.criteria),f1:yes('p0',body.questions.f1.criteria)}};
    if(calls===2)return {answers:Object.fromEntries(fields.map((field,i)=>{
      const option=Object.entries(body.questions[field.id].criteria).find(([,v])=>v===expected[i]);
      assert.ok(option,'whole source values must be available');return [field.id,yes(option[0],body.questions[field.id].criteria)];
    }))};
    return {answers:{f0:{type:'noul',noul:0.99},f1:{type:'noul',noul:0.99}}};
  });
  assert.equal(calls,3);assert.deepEqual(rows.map(x=>x.value),expected);
});
test('skipped rows retain the rejected stage and probabilities for diagnosis',async()=>{
  const rows=await evaluate('Name: Alice',[{id:'f0',kind:'text',label:'Name'}],async body=>({answers:{f0:yes('p0',body.questions.f0.criteria,{probabilities:{p0:0.7,skip:0.1}})}}));
  assert.equal(rows[0].status,'skip');
  assert.equal(rows[0].diagnostics[0].stage,'source');
  assert.equal(rows[0].diagnostics[0].probability,0.7);
  assert.equal(rows[0].diagnostics[0].accepted,false);
  assert.match(rows[0].reason,/根拠の行/);
});
test('bounds are enforced rather than silently truncating user instructions', () => {
  assert.throws(() => passages('x'.repeat(12001)),/12,000/);
  assert.throws(() => passages(Array.from({length:121},(_,i)=>`line ${i}`).join('\n')),/120/);
});
test('custom thresholds reach every gate and the default stays the Jev profile',async()=>{
  const criteria={skip:'unknown',on:'on',off:'off'};
  const modest={type:'choice',choice:'off',confidence:0.6,probabilities:{skip:0.05,on:0.05,off:0.9}};
  assert.equal(acceptChoice(modest,criteria),null);
  assert.equal(acceptChoice(modest,criteria,{...PROFILE.thresholds,confidence:0.5}),'off');
  const field={id:'f0',kind:'checkbox',label:'Active'};
  const models=[];
  const run=options=>evaluate('Active: off',[field],async body=>{models.push(body.model);return body.questions.f0.type==='noul'?{answers:{f0:{type:'noul',noul:0.85}}}:{answers:{f0:{...modest,probabilities:Object.fromEntries(Object.keys(body.questions.f0.criteria).map(k=>[k,k==='off'?0.9:0.05]))}}};},()=>{},options);
  assert.equal((await run())[0].status,'skip');
  assert.deepEqual(models,['jev-latest']);
  models.length=0;
  assert.equal((await run({model:'clef-flash',thresholds:{...PROFILE.thresholds,confidence:0.5}}))[0].status,'skip');
  const lowered=await run({model:'clef-flash',thresholds:{...PROFILE.thresholds,confidence:0.5,noul:0.8}});
  assert.equal(lowered[0].status,'ready');assert.equal(lowered[0].value,false);
  assert.ok(models.length>=3 && models.every(x=>x==='clef-flash'));
});
