import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from '../core.js';

const choice=(q,key,peak=0.99,confidence=0.99)=>({type:'choice',choice:key,confidence,probabilities:Object.fromEntries(Object.keys(q.criteria).map(k=>[k,k===key?peak:(1-peak)/(Object.keys(q.criteria).length-1)]))});

test('the observed City value candidate reaches whole-source verification before becoming writable',async()=>{
  const source='請求先の郵便番号は `060-0042`、都道府県は北海道、市区町村は `札幌市中央区`、Street は `大通西2丁目 みなもビル 4F`。';
  for(const verification of [{type:'noul',noul:0.99},{type:'noul',noul:0.4},undefined,{type:'noul',noul:1.1}]) {
    let calls=0;
    const rows=await evaluate(source,[{id:'f25',kind:'text',label:'City',context:'Billing / 請求先'}],async body=>{
      calls++;
      const q=body.questions.f25;
      if(calls===1)return {answers:{f25:choice(q,'p0',0.77,0.75)}};
      if(calls===2)return {answers:{f25:{type:'choice',choice:'v1',confidence:0.73,probabilities:{skip:0.01,clear:0,v0:0.01,v1:0.77,v2:0.20,extract:0.01}}}};
      assert.equal(body.state.source,source);
      assert.equal(q.instructions.proposal.value,'札幌市中央区');
      assert.equal(q.instructions.proposal.field.context,'Billing / 請求先');
      return {answers:{f25:verification}};
    });
    assert.equal(calls,3);
    const ready=verification?.noul===0.99;
    assert.equal(rows[0].status,ready?'ready':'skip');
    assert.equal(rows[0].value,ready?'札幌市中央区':undefined);
    assert.equal(rows[0].diagnostics[1].gate,'candidate');
  }
});

test('a quoted value from the wrong section is discarded when whole-source verification rejects it',async()=>{
  let calls=0;
  const rows=await evaluate('参加者名は「新井 美香」。\n請求担当者名は「木村 透」。',[{id:'f0',kind:'text',label:'Name',context:'Billing'}],async body=>{
    calls++;
    if(calls<3)return {answers:{f0:choice(body.questions.f0,calls===1?'p0':'v0',0.77,0.73)}};
    assert.equal(body.questions.f0.instructions.proposal.value,'新井 美香');
    return {answers:{f0:{type:'noul',noul:0.2}}};
  });
  assert.equal(calls,3);assert.equal(rows[0].status,'skip');assert.equal(Object.hasOwn(rows[0],'value'),false);
});

test('uncertain clear and unquoted extraction choices do not use the quoted-candidate gate',async()=>{
  for(const key of ['clear','extract']) {
    let calls=0;
    const rows=await evaluate('Name: Alice; callback URL は空。',[{id:'f0',kind:'text',label:key==='clear'?'Callback URL':'Name'}],async body=>{
      calls++;
      return {answers:{f0:choice(body.questions.f0,calls===1?'p0':key,calls===1?0.99:0.77,calls===1?0.99:0.73)}};
    });
    assert.equal(calls,2);assert.equal(rows[0].status,'skip');assert.equal(Object.hasOwn(rows[0],'value'),false);
    assert.equal(rows[0].diagnostics[1].gate,'value');
  }
});
