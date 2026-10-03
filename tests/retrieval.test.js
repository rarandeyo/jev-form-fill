import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,propose,acceptChoice} from '../core.js';
const answer=(q,choice,{confidence=0.99,peak=0.99}={})=>({type:'choice',choice,confidence,probabilities:Object.fromEntries(Object.keys(q.criteria).map(key=>[key,key===choice?peak:(1-peak)/(Object.keys(q.criteria).length-1)]))});

test('the observed .79 and .80 source scores can nominate passages but cannot authorize a value',()=>{
  const source='氏名は `新井 美香`。\n請求先の市区町村は `札幌市中央区`。';
  const fields=[{id:'f0',kind:'text',label:'氏名',context:'Participant'},{id:'f1',kind:'text',label:'City',context:'Billing'}];
  const stage=propose(source,fields);
  const rows=stage.resolve({answers:{f0:answer(stage.body.questions.f0,'p0',{confidence:0.77,peak:0.79}),f1:answer(stage.body.questions.f1,'p1',{confidence:0.78,peak:0.8})}});
  assert.deepEqual(rows.map(r=>r.status),['value','value']);
  assert.ok(rows.every(r=>!Object.hasOwn(r,'value')));
});

test('quoted value candidates require whole-source verification before becoming writable',async()=>{
  const source='氏名は `新井 美香`。';const fields=[{id:'f0',kind:'text',label:'氏名'}];
  for(const [valuePeak,verified,status] of [[0.8,0.99,'ready'],[0.8,0.4,'skip'],[0.99,0.4,'skip'],[0.99,0.99,'ready']]) {
    let calls=0;
    const rows=await evaluate(source,fields,async body=>{
      calls++;
      if(calls===1)return {answers:{f0:answer(body.questions.f0,'p0',{confidence:0.77,peak:0.79})}};
      if(calls===2)return {answers:{f0:answer(body.questions.f0,'v0',{peak:valuePeak})}};
      return {answers:{f0:{type:'noul',noul:verified}}};
    });
    assert.equal(rows[0].status,status);
    assert.equal(Object.hasOwn(rows[0],'value'),status==='ready');
    assert.equal(calls,3);
  }
});

test('retrieving an unknown-value instruction preserves the field without a verification proposal',async()=>{
  let calls=0;
  const rows=await evaluate('電話番号は不明。',[{id:'f0',kind:'text',label:'Telephone'}],async body=>{
    calls++;
    return {answers:{f0:calls===1?answer(body.questions.f0,'p0',{confidence:0.77,peak:0.79}):answer(body.questions.f0,'skip')}};
  });
  assert.equal(calls,2);assert.equal(rows[0].status,'skip');assert.equal(rows[0].value,undefined);
});

test('invalid distributions, tied retrieval candidates and non-text uncertainty remain rejected',()=>{
  const stage=propose('Name: Alice',[{id:'f0',kind:'text',label:'Name'},{id:'f1',kind:'checkbox',label:'Active'}]);
  for(const a of [{type:'choice',choice:'p0',confidence:0.99,probabilities:{p0:1}},{type:'choice',choice:'p0',confidence:0.1,probabilities:{p0:0.5,skip:0.5}}])assert.equal(stage.resolve({answers:{f0:a}})[0].status,'skip');
  assert.equal(stage.resolve({answers:{f1:answer(stage.body.questions.f1,'on',{peak:0.79})}})[1].status,'skip');
});
test('distributions totaling .98 or 1.02 are rejected; floating-point roundoff is tolerated',()=>{
  const criteria={skip:'unknown',v0:'Alice'};
  for(const probabilities of [{skip:0,v0:0.98},{skip:0.03,v0:0.99}])assert.equal(acceptChoice({type:'choice',choice:'v0',confidence:0.99,probabilities},criteria),null);
  assert.equal(acceptChoice({type:'choice',choice:'v0',confidence:0.99,probabilities:{skip:0.01,v0:0.9900000000000001}},criteria),'v0');
});
test('invalid probability totals cannot reach writable rows through either retrieval or value selection',async()=>{
  for(const invalidStage of [1,2]) {
    let calls=0;
    const rows=await evaluate('Name: "Alice"',[{id:'f0',kind:'text',label:'Name'}],async body=>{
      calls++;
      if(calls===3)return {answers:{f0:{type:'noul',noul:0.99}}};
      const q=body.questions.f0,choice=calls===1?'p0':'v0';
      const a=answer(q,choice);
      if(calls===invalidStage)a.probabilities=calls===1?{p0:0.99,skip:0.03}:{skip:0.01,clear:0.01,v0:0.99,extract:0.01};
      return {answers:{f0:a}};
    });
    assert.equal(rows[0].status,'skip');assert.equal(Object.hasOwn(rows[0],'value'),false);assert.equal(calls,invalidStage);
  }
});
